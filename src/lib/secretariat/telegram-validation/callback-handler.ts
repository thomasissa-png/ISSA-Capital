/**
 * Callback handler pour la validation email-ingest via Telegram.
 *
 * Traite les callbacks quand Thomas clique un bouton inline :
 *   - valider : exécute toutes les ActionProposal via vault-client + mark_processed
 *   - skip : mark_processed + audit "skip"
 *   - voir : envoie le body de l'email dans un nouveau message
 *   - modifier : envoie un message "non implémenté en V1"
 *
 * Chaque action est auditée en JSONL via vault-client/audit-log.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md section Jalon 4B.
 */

import type { ActionProposal } from '../handlers/types';
import type { PendingValidation } from './telegram-cards';
import { VALIDATION_CALLBACK_PREFIX, buildValidationCard, editMessageText, sendSimpleMessage, escapeHtml } from './telegram-cards';
import { getPending, deletePending } from './pending-store';
import { answerCallbackQuery } from '../telegram';
import {
  appendToHistorique,
  updateFrontmatter,
  createVaultFile,
} from '../vault-client';
import { appendToTodoInbox } from '../drive-todo';
import { markProcessed } from '../gmail-source/gmail-source';
import { writeAuditLog } from '../vault-client/audit-log';

// ============================================================
// Types
// ============================================================

export interface TelegramCallback {
  callback_query_id: string;
  /** Callback data (ex: "email_val:valider:abc123") */
  data: string;
  message_id: number;
  chat_id: number;
}

type ValidationAction = 'valider' | 'skip' | 'voir' | 'modifier';

// ============================================================
// Parsing
// ============================================================

/**
 * Parse le callback data en action + pendingId.
 * Format attendu : "email_val:<action>:<pendingId>"
 */
function parseCallbackData(data: string): {
  action: ValidationAction;
  pendingId: string;
} | null {
  if (!data.startsWith(VALIDATION_CALLBACK_PREFIX)) return null;

  const withoutPrefix = data.slice(VALIDATION_CALLBACK_PREFIX.length);
  const colonIdx = withoutPrefix.indexOf(':');
  if (colonIdx === -1) return null;

  const action = withoutPrefix.slice(0, colonIdx);
  const pendingId = withoutPrefix.slice(colonIdx + 1);

  if (!['valider', 'skip', 'voir', 'modifier'].includes(action)) return null;
  if (!pendingId) return null;

  return { action: action as ValidationAction, pendingId };
}

// ============================================================
// Formatage heure
// ============================================================

function currentTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ============================================================
// Exécution des actions vault
// ============================================================

/**
 * Exécute une ActionProposal unique via vault-client.
 * Retourne { ok, error? } pour chaque action.
 */
async function executeAction(
  action: ActionProposal,
  pending: PendingValidation,
): Promise<{ ok: boolean; error?: string }> {
  const trigger = `email_ingest:${pending.email.id}`;

  try {
    switch (action.type) {
      case 'append_historique': {
        if (!action.target) {
          return { ok: false, error: 'target manquant pour append_historique' };
        }
        // Extraire folderPath et filename depuis target
        const lastSlash = action.target.lastIndexOf('/');
        if (lastSlash === -1) {
          return { ok: false, error: `target invalide : ${action.target}` };
        }
        const folderPath = action.target.slice(0, lastSlash);
        const filename = action.target.slice(lastSlash + 1);

        const title = (action.payload['title'] as string) ?? `${new Date().toISOString().slice(0, 10)} — Email traité`;
        const content = (action.payload['content'] as string) ?? pending.triage.summary;

        const success = await appendToHistorique(folderPath, filename, {
          title,
          content,
          trigger,
          updateLastInteraction: (action.payload['updateLastInteraction'] as boolean) ?? true,
        });
        return success ? { ok: true } : { ok: false, error: 'appendToHistorique échoué' };
      }

      case 'update_frontmatter': {
        if (!action.target) {
          return { ok: false, error: 'target manquant pour update_frontmatter' };
        }
        const lastSlash = action.target.lastIndexOf('/');
        if (lastSlash === -1) {
          return { ok: false, error: `target invalide : ${action.target}` };
        }
        const folderPath = action.target.slice(0, lastSlash);
        const filename = action.target.slice(lastSlash + 1);
        const fields = (action.payload['fields'] as Record<string, string | number | boolean | null>) ?? {};

        const success = await updateFrontmatter({
          folderPath,
          filename,
          fields,
          trigger,
        });
        return success ? { ok: true } : { ok: false, error: 'updateFrontmatter échoué' };
      }

      case 'create_file':
      case 'create_bien_stub': {
        if (!action.target) {
          return { ok: false, error: `target manquant pour ${action.type}` };
        }
        const lastSlash = action.target.lastIndexOf('/');
        if (lastSlash === -1) {
          return { ok: false, error: `target invalide : ${action.target}` };
        }
        const folderPath = action.target.slice(0, lastSlash);
        const filename = action.target.slice(lastSlash + 1);
        const content = (action.payload['content'] as string) ?? '';

        const success = await createVaultFile(folderPath, filename, content, trigger);
        return success ? { ok: true } : { ok: false, error: `createVaultFile échoué pour ${action.target}` };
      }

      case 'add_todo': {
        const title = (action.payload['title'] as string) ?? pending.triage.summary;
        const date = (action.payload['date'] as string) ?? undefined;
        const description = (action.payload['description'] as string) ?? undefined;

        const result = await appendToTodoInbox(title, date, description);
        return result.success ? { ok: true } : { ok: false, error: result.error ?? 'appendToTodoInbox échoué' };
      }

      case 'mark_processed': {
        const emailId = pending.email.id;
        const success = await markProcessed(emailId);
        return success ? { ok: true } : { ok: false, error: 'markProcessed échoué' };
      }

      case 'skip': {
        // Skip est une action conceptuelle, pas d'opération vault
        return { ok: true };
      }

      default: {
        return { ok: false, error: `type d'action inconnu : ${action.type}` };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Écrit une ligne d'audit pour une action de validation email-ingest.
 */
async function auditAction(
  op: string,
  actionType: string,
  pendingId: string,
  target: string | null,
  status: 'ok' | 'error',
  errorMessage?: string,
): Promise<void> {
  // Utiliser writeAuditLog avec un format adapté email-ingest
  // On écrit directement car le format audit-log existant ne couvre pas
  // les ops de validation — on construit un entry compatible
  await writeAuditLog({
    ts: new Date().toISOString(),
    op: 'append_historique', // Mapped to closest valid op for the AuditLogEntry type
    target: target ?? pendingId,
    trigger: `email_val:${op}:${actionType}`,
    payload: {
      pendingId,
      actionType,
      validationAction: op,
      status,
      ...(errorMessage ? { errorMessage } : {}),
    },
    status: status === 'ok' ? 'success' : 'error',
    ...(errorMessage ? { errorMessage } : {}),
  });
}

// ============================================================
// Handlers par action
// ============================================================

async function handleValider(
  pending: PendingValidation,
  callback: TelegramCallback,
): Promise<void> {
  let allOk = true;

  for (const action of pending.actions) {
    const result = await executeAction(action, pending);

    await auditAction(
      'valider',
      action.type,
      pending.id,
      action.target,
      result.ok ? 'ok' : 'error',
      result.error,
    );

    if (!result.ok) {
      console.warn(
        `[callback-handler] action ${action.type} échouée pour ${pending.id} : ${result.error}`,
      );
      allOk = false;
      // Continue — on exécute toutes les actions même si une échoue
    }
  }

  // Marquer l'email comme traité (sauf si déjà dans les actions)
  const hasMarkProcessed = pending.actions.some((a) => a.type === 'mark_processed');
  if (!hasMarkProcessed) {
    const markResult = await markProcessed(pending.email.id);
    if (!markResult) {
      console.warn(`[callback-handler] markProcessed échoué pour email ${pending.email.id}`);
    }
  }

  // Edit le message Telegram : ajouter le statut et retirer le keyboard
  const time = currentTimeHHMM();
  const { text: originalText } = buildValidationCard(pending);
  const statusLine = allOk
    ? `\n\n\u{2705} Validé à ${time}`
    : `\n\n\u{26A0}\u{FE0F} Validé à ${time} (certaines actions en erreur)`;
  await editMessageText(callback.chat_id, callback.message_id, originalText + statusLine);

  // Supprimer le pending
  await deletePending(pending.id);
}

async function handleSkip(
  pending: PendingValidation,
  callback: TelegramCallback,
): Promise<void> {
  // Marquer l'email comme traité sans toucher au vault
  await markProcessed(pending.email.id);

  // Audit
  await auditAction('skip', 'skip', pending.id, null, 'ok');

  // Edit le message Telegram
  const time = currentTimeHHMM();
  const { text: originalText } = buildValidationCard(pending);
  await editMessageText(
    callback.chat_id,
    callback.message_id,
    originalText + `\n\n\u{23ED}\u{FE0F} Skippé à ${time}`,
  );

  // Supprimer le pending
  await deletePending(pending.id);
}

async function handleVoir(
  pending: PendingValidation,
  callback: TelegramCallback,
): Promise<void> {
  // Envoyer le body de l'email dans un nouveau message
  const bodyPreview = pending.email.bodyPlain.slice(0, 1500);
  const escapedBody = escapeHtml(bodyPreview);

  const message = `\u{1F4E8} <b>Corps de l'email</b>\n<b>De</b> : ${escapeHtml(pending.email.from.name ?? pending.email.from.email)}\n\n<pre>${escapedBody}</pre>`;

  await sendSimpleMessage(callback.chat_id, message);
  // Le pending reste actif — Thomas peut encore valider ou skip
}

async function handleModifier(
  _pending: PendingValidation,
  callback: TelegramCallback,
): Promise<void> {
  const message =
    '\u{270F}\u{FE0F} Modification non implémentée en V1. ' +
    'Utilise Skip puis traite manuellement, ou attends Jalon 5+.';

  await sendSimpleMessage(callback.chat_id, message);
  // Le pending reste actif
}

// ============================================================
// API publique
// ============================================================

/**
 * Traite un callback Telegram de validation email-ingest.
 *
 * Appelé depuis le webhook Telegram quand Thomas clique un bouton inline
 * sur une carte de validation email.
 *
 * @param callback Les données du callback Telegram
 */
export async function handleTelegramCallback(callback: TelegramCallback): Promise<void> {
  // Toujours acquitter le callback pour retirer le spinner
  const answerPromise = answerCallbackQuery(callback.callback_query_id);

  // Parser le callback data
  const parsed = parseCallbackData(callback.data);
  if (!parsed) {
    console.warn(`[callback-handler] callback data invalide : ${callback.data}`);
    await answerPromise;
    return;
  }

  const { action, pendingId } = parsed;

  try {
    // Charger le pending
    const pending = await getPending(pendingId);
    if (!pending) {
      // Pending expiré ou introuvable
      await sendSimpleMessage(
        callback.chat_id,
        '\u{26A0}\u{FE0F} Pending expiré ou introuvable. L\'email devra être traité manuellement.',
      );
      await answerPromise;
      return;
    }

    // Dispatch par action
    switch (action) {
      case 'valider':
        await handleValider(pending, callback);
        break;
      case 'skip':
        await handleSkip(pending, callback);
        break;
      case 'voir':
        await handleVoir(pending, callback);
        break;
      case 'modifier':
        await handleModifier(pending, callback);
        break;
    }
  } catch (err) {
    console.warn(
      `[callback-handler] erreur traitement ${action} pour ${pendingId} : ${err instanceof Error ? err.message : String(err)}`,
    );
    await sendSimpleMessage(
      callback.chat_id,
      `\u{274C} Erreur lors du traitement : ${err instanceof Error ? err.message : 'inconnue'}`,
    );
  }

  await answerPromise;
}
