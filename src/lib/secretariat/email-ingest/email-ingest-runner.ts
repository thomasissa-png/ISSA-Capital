/**
 * Pipeline runner email-ingest — Anya V1.
 *
 * Orchestre le cycle complet :
 *   1. Charger contacts depuis cache
 *   2. Lister les emails non traités
 *   3. Pour chaque email : pré-filtre → triage Haiku → handler → Telegram
 *   4. Retourner les stats
 *
 * Aucune modification vault directe — les handlers génèrent des ActionProposal[],
 * stockées en pending, exécutées uniquement après validation Telegram par Thomas.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4C §A.
 */

import { randomUUID } from 'crypto';
import type { EmailMessage } from '../gmail-source/types';
import type { TriageResult, KnownContact } from '../triage/types';
import type { ActionProposal } from '../handlers/types';
import type { PendingValidation } from '../telegram-validation/telegram-cards';
import {
  listUnprocessed,
  fetchDetail,
  markProcessed,
  markFailed,
} from '../gmail-source/gmail-source';
import { triageEmail } from '../triage/triage';
import { isLikelySpamByHeuristic } from './pre-filter';
import { loadKnownContacts } from './contacts-cache';
import { composeDraft } from './draft-composer';
import type { DraftResult } from './draft-composer';
import {
  handleLocataire,
  handleAClassifier,
  handleContactPro,
  handleApporteur,
  handleCandidat,
} from '../handlers';
import {
  savePending,
  sendValidationCard,
  saveNoMatch,
  sendNoMatchCard,
} from '../telegram-validation';
import type { NoMatchPending } from '../telegram-validation';
import { writeAuditLog } from '../vault-client/audit-log';
import {
  appendToHistorique,
  updateFrontmatter,
  createVaultFile,
} from '../vault-client';
import { appendToTodoInbox } from '../drive-todo';
import { markProcessed as markEmailProcessed } from '../gmail-source/gmail-source';
import { createTickTickTaskForEmail } from './ticktick-integration';
import { buildCoherenceActions } from './coherence-actions';
import { appendProjetHistoriqueLine } from '../calendar-ingest/projet-enricher';
import { sendHotContextPatchCard } from '../telegram-validation/handlers/hot-context-patch';
import type { Patch } from '../hot-context/types';

// ============================================================
// Types
// ============================================================

export interface IngestStats {
  totalListed: number;
  preFilteredSpam: number;
  haikuSpam: number;
  pendingCreated: number;
  /** S18.5 : emails traités automatiquement (contact existant ou email système) */
  autoExecuted: number;
  /** S18.5 : emails système filtrés (noreply@, contact@, etc.) */
  systemEmailsFiltered: number;
  draftsCreated: number;
  draftsSkipped: number;
  draftsFailed: number;
  errors: number;
  durationMs: number;
}

// ============================================================
// Constantes
// ============================================================

/** Seuil de confiance pour auto-spam sans Telegram */
const AUTO_SPAM_CONFIDENCE_THRESHOLD = 0.9;

// ============================================================
// Dispatch handler par catégorie
// ============================================================

type HandlerFn = (triage: TriageResult, email: EmailMessage) => Promise<ActionProposal[]>;

/**
 * Mapping catégorie triage → handler.
 *
 * candidat → handleCandidat (handler dédié depuis Jalon 4D-1).
 * spam (confidence ≤ 0.9) → handleAClassifier (carte Telegram quand même).
 */
function getHandler(category: string): HandlerFn {
  switch (category) {
    case 'locataire':
      return handleLocataire;
    case 'contact-pro':
      return handleContactPro;
    case 'apporteur':
      return handleApporteur;
    case 'candidat':
      return handleCandidat;
    case 'a-classifier':
    case 'spam':
    default:
      return handleAClassifier;
  }
}

// ============================================================
// Pipeline principal
// ============================================================

/**
 * Exécute un cycle complet d'email-ingest.
 *
 * @returns Stats du run (total, spam pré-filtrés, spam Haiku, pendings créés, erreurs)
 */
export async function runEmailIngest(): Promise<IngestStats> {
  const startMs = Date.now();

  const stats: IngestStats = {
    totalListed: 0,
    preFilteredSpam: 0,
    haikuSpam: 0,
    pendingCreated: 0,
    autoExecuted: 0,
    systemEmailsFiltered: 0,
    draftsCreated: 0,
    draftsSkipped: 0,
    draftsFailed: 0,
    errors: 0,
    durationMs: 0,
  };

  // 1. Charger contacts depuis cache
  let contacts: KnownContact[];
  try {
    contacts = await loadKnownContacts();
  } catch {
    console.warn('[email-ingest] erreur chargement contacts — run avec liste vide');
    contacts = [];
  }

  // 2. Lister les emails non traités
  let messages: Array<{ id: string; threadId?: string }>;
  try {
    messages = await listUnprocessed();
  } catch (err) {
    console.warn(
      `[email-ingest] erreur listUnprocessed : ${err instanceof Error ? err.message : String(err)}`,
    );
    stats.errors = 1;
    stats.durationMs = Date.now() - startMs;
    return stats;
  }

  stats.totalListed = messages.length;
  console.warn(`[email-ingest] ${messages.length} email(s) non traité(s) trouvé(s)`);

  if (messages.length === 0) {
    stats.durationMs = Date.now() - startMs;
    return stats;
  }

  // 3. Traiter chaque message
  for (const msg of messages) {
    try {
      await processOneEmail(msg.id, contacts, stats);
    } catch (err) {
      console.warn(
        `[email-ingest] erreur inattendue sur message ${msg.id} : ${err instanceof Error ? err.message : String(err)}`,
      );
      stats.errors++;
    }
  }

  // 4. Audit final — ligne récap
  stats.durationMs = Date.now() - startMs;

  await writeAuditLog({
    ts: new Date().toISOString(),
    op: 'classify_note',
    target: 'email-ingest-run',
    trigger: 'api/email-ingest',
    payload: { ...stats },
    status: 'success',
  });

  console.warn(
    `[email-ingest] terminé en ${stats.durationMs}ms — ` +
    `total=${stats.totalListed}, pré-filtrés=${stats.preFilteredSpam}, ` +
    `haiku-spam=${stats.haikuSpam}, pendings=${stats.pendingCreated}, ` +
    `auto=${stats.autoExecuted}, sys=${stats.systemEmailsFiltered}, ` +
    `drafts=${stats.draftsCreated}/${stats.draftsSkipped}skip/${stats.draftsFailed}err, ` +
    `erreurs=${stats.errors}`,
  );

  return stats;
}

// ============================================================
// Traitement d'un email
// ============================================================

async function processOneEmail(
  messageId: string,
  contacts: KnownContact[],
  stats: IngestStats,
): Promise<void> {
  // Fetch detail
  const detail = await fetchDetail(messageId);
  if (!detail) {
    console.warn(`[email-ingest] fetchDetail null pour message ${messageId}`);
    stats.errors++;
    return;
  }

  // Pré-filtre heuristique
  if (isLikelySpamByHeuristic(detail)) {
    await markProcessed(messageId);
    await writeAuditLog({
      ts: new Date().toISOString(),
      op: 'classify_note',
      target: messageId,
      trigger: 'email-ingest:pre-filter',
      payload: {
        from: detail.from.email,
        subject: detail.subject,
        reason: 'auto-spam-prefilter',
      },
      status: 'success',
    });
    stats.preFilteredSpam++;
    return;
  }

  // Triage Haiku
  const triage = await triageEmail(detail, contacts);
  if (!triage) {
    await markFailed(messageId);
    await writeAuditLog({
      ts: new Date().toISOString(),
      op: 'classify_note',
      target: messageId,
      trigger: 'email-ingest:triage-failed',
      payload: {
        from: detail.from.email,
        subject: detail.subject,
      },
      status: 'error',
      errorMessage: 'Haiku triage échoué après retry',
    });
    stats.errors++;
    return;
  }

  // Auto-spam Haiku (confidence > 0.9)
  if (triage.category === 'spam' && triage.confidence > AUTO_SPAM_CONFIDENCE_THRESHOLD) {
    await markProcessed(messageId);
    await writeAuditLog({
      ts: new Date().toISOString(),
      op: 'classify_note',
      target: messageId,
      trigger: 'email-ingest:auto-spam-haiku',
      payload: {
        from: detail.from.email,
        subject: detail.subject,
        confidence: triage.confidence,
      },
      status: 'success',
    });
    stats.haikuSpam++;
    return;
  }

  // Dispatch handler
  const handler = getHandler(triage.category);
  const handlerActions = await handler(triage, detail);

  // S23 — actions de cohérence (historique projet, copie PJ, hot-context).
  // Best-effort : un échec ne bloque PAS le traitement de l'email.
  let coherenceActions: ActionProposal[] = [];
  try {
    coherenceActions = await buildCoherenceActions(detail, triage);
  } catch (err) {
    console.warn(
      `[email-ingest] buildCoherenceActions échoué pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // (e) Hot-context → carte dédiée `hotcontext:` (PAS la carte email principale,
  // anti-bruit : c'est un flux de validation distinct avec sa propre machinerie).
  const hotContextActions = coherenceActions.filter((a) => a.type === 'update_hot_context');
  for (const hcAction of hotContextActions) {
    const patch = hcAction.payload['patch'] as Patch | undefined;
    if (!patch) continue;
    try {
      await sendHotContextPatchCard(patch);
    } catch (err) {
      console.warn(
        `[email-ingest] envoi carte hot-context pour ${messageId} échoué : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Les actions restantes (projet histo auto + copie PJ proposée) rejoignent le
  // flux carte email principale / auto-execute classique.
  const actions = [
    ...handlerActions,
    ...coherenceActions.filter((a) => a.type !== 'update_hot_context'),
  ];

  // S18.5 : si TOUTES les actions sont auto-exécutables, court-circuiter
  // la validation Telegram. Cas typiques :
  //   - contact existant (handleContactPro buildExistingContactActions)
  //   - email système (noreply@, contact@) filtré par contact-pro
  // Pas de carte Telegram, pas de pending, pas de draft (Anya silencieuse).
  const allAutoExecute =
    actions.length > 0 && actions.every((a) => a.autoExecute === true);

  if (allAutoExecute) {
    const isSystemEmailAction = actions.some(
      (a) =>
        a.type === 'mark_processed' &&
        (a.payload as Record<string, unknown>)['reason'] === 'system-email',
    );

    await executeAutoActions(actions, detail, triage, isSystemEmailAction);

    stats.autoExecuted++;
    if (isSystemEmailAction) stats.systemEmailsFiltered++;
    return;
  }

  // Composer un brouillon de réponse Gmail (Jalon 5B)
  let draftResult: DraftResult | null = null;
  try {
    draftResult = await composeDraft(detail, triage);
    if (draftResult.success) {
      stats.draftsCreated++;
    } else if (draftResult.skipReason) {
      stats.draftsSkipped++;
    } else {
      stats.draftsFailed++;
      console.warn(
        `[email-ingest] draft échoué pour ${messageId} : ${draftResult.error ?? 'erreur inconnue'}`,
      );
    }
  } catch (err) {
    stats.draftsFailed++;
    console.warn(
      `[email-ingest] erreur inattendue draft pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Séparer les actions : filtrer prompt_create_contact_choice (traitée séparément)
  const noMatchAction = actions.find((a) => a.type === 'prompt_create_contact_choice');
  const cardActions = actions.filter((a) => a.type !== 'prompt_create_contact_choice');

  // Créer le pending + envoyer la carte Telegram principale
  const pendingId = randomUUID();
  const pending: PendingValidation = {
    id: pendingId,
    triage,
    actions: cardActions,
    email: serializeEmail(detail),
    createdAt: new Date().toISOString(),
    draftGmailUrl: draftResult?.gmailUrl ?? undefined,
    draftPreview: draftResult?.preview ?? undefined,
  };

  await savePending(pending);

  try {
    await sendValidationCard(pending);
  } catch (err) {
    console.warn(
      `[email-ingest] erreur envoi carte Telegram pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
    );
    // Le pending est sauvegardé, Thomas pourra valider si Telegram revient
  }

  // Si action no-match → créer un NoMatchPending et envoyer carte secondaire
  if (noMatchAction) {
    const noMatchId = randomUUID();
    const noMatch: NoMatchPending = {
      id: noMatchId,
      parentPendingId: pendingId,
      emailFrom: noMatchAction.payload['emailFrom'] as string,
      nameFrom: (noMatchAction.payload['nameFrom'] as string | null) ?? null,
      defaultType: (noMatchAction.payload['defaultType'] as NoMatchPending['defaultType']) ?? 'autres',
      emailMessageId: noMatchAction.payload['emailMessageId'] as string,
      emailThreadRef: noMatchAction.payload['emailThreadRef'] as string,
      createdAt: new Date().toISOString(),
    };

    await saveNoMatch(noMatch);

    try {
      await sendNoMatchCard(noMatch);
    } catch (err) {
      console.warn(
        `[email-ingest] erreur envoi carte no-match pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Créer une tâche TickTick pour les emails nécessitant une action
  // (toutes les catégories sauf spam auto-filtré — ceux qui arrivent ici sont actionnables)
  try {
    await createTickTickTaskForEmail(detail, triage);
  } catch (err) {
    // Non bloquant — la tâche TickTick est un bonus, pas un prérequis
    console.warn(
      `[email-ingest] erreur création tâche TickTick pour ${messageId} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  stats.pendingCreated++;
}

// ============================================================
// Auto-execute (S18.5)
// ============================================================

/**
 * Exécute les actions auto-exécutables d'un email sans validation Telegram.
 *
 * Cas d'usage S18.5 :
 *   1. Contact existant : append_historique + update_frontmatter + mark_processed
 *      → fiche enrichie en silence, pas de carte Thomas
 *   2. Email système (noreply@, contact@) : uniquement mark_processed
 *      → email marqué traité, pas de carte
 *
 * Audit : chaque action écrit une ligne JSONL avec auto: true.
 * Erreur silencieuse : si une action échoue (ex: Drive 503), on log mais
 * on continue — le mark_processed final reste critique (sinon l'email
 * sera re-traité au prochain cycle).
 */
async function executeAutoActions(
  actions: ActionProposal[],
  email: EmailMessage,
  triage: TriageResult,
  isSystemEmail: boolean,
): Promise<void> {
  const trigger = `email_ingest:auto:${email.id}`;

  for (const action of actions) {
    const result = await executeAutoAction(action, email, triage, trigger);

    await writeAuditLog({
      ts: new Date().toISOString(),
      op: 'classify_note',
      target: action.target ?? email.id,
      trigger: `email_ingest:auto:${action.type}`,
      payload: {
        auto: true,
        reason: isSystemEmail ? 'system-email' : 'contact-existing',
        actionType: action.type,
        emailId: email.id,
        from: email.from.email,
        subject: email.subject,
        category: triage.category,
        ok: result.ok,
        ...(result.error ? { error: result.error } : {}),
      },
      status: result.ok ? 'success' : 'error',
      ...(result.error ? { errorMessage: result.error } : {}),
    });

    if (!result.ok) {
      console.warn(
        `[email-ingest] auto-action ${action.type} échouée pour ${email.id} : ${result.error}`,
      );
    }
  }
}

/**
 * Exécute UNE action auto en appelant le vault-client directement.
 *
 * Dupliqué léger du callback-handler.executeAction car ici on a un
 * EmailMessage direct (pas de PendingValidation). Garder la duplication
 * volontairement (3 cases utilisés sur 7) pour éviter un refactor de
 * callback-handler qui touche le critical path validation Telegram.
 */
async function executeAutoAction(
  action: ActionProposal,
  email: EmailMessage,
  triage: TriageResult,
  trigger: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'append_historique': {
        if (!action.target) {
          return { ok: false, error: 'target manquant pour append_historique' };
        }
        const lastSlash = action.target.lastIndexOf('/');
        if (lastSlash === -1) {
          return { ok: false, error: `target invalide : ${action.target}` };
        }
        const folderPath = action.target.slice(0, lastSlash);
        const filename = action.target.slice(lastSlash + 1);

        const title =
          (action.payload['title'] as string) ??
          `${new Date().toISOString().slice(0, 10)} — Email traité`;
        const content = (action.payload['content'] as string) ?? triage.summary;

        const success = await appendToHistorique(folderPath, filename, {
          title,
          content,
          trigger,
          updateLastInteraction:
            (action.payload['updateLastInteraction'] as boolean) ?? true,
        });
        return success
          ? { ok: true }
          : { ok: false, error: 'appendToHistorique échoué' };
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

        // Le handler contact-pro passe le payload directement (pas dans .fields)
        // Construire le mapping fields à partir du payload (hors meta keys)
        const fields: Record<string, string | number | boolean | null> = {};
        for (const [key, value] of Object.entries(action.payload)) {
          if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean' ||
            value === null
          ) {
            fields[key] = value;
          }
        }

        const success = await updateFrontmatter({
          folderPath,
          filename,
          fields,
          trigger,
        });
        return success
          ? { ok: true }
          : { ok: false, error: 'updateFrontmatter échoué' };
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
        return success
          ? { ok: true }
          : { ok: false, error: `createVaultFile échoué pour ${action.target}` };
      }

      case 'add_todo': {
        const title = (action.payload['title'] as string) ?? triage.summary;
        const date = (action.payload['date'] as string) ?? undefined;
        const description =
          (action.payload['description'] as string) ?? undefined;

        const result = await appendToTodoInbox(title, date, description);
        return result.success
          ? { ok: true }
          : { ok: false, error: result.error ?? 'appendToTodoInbox échoué' };
      }

      case 'mark_processed': {
        const success = await markEmailProcessed(email.id);
        return success ? { ok: true } : { ok: false, error: 'markProcessed échoué' };
      }

      // S23 — historique projet (silencieux). Réutilise la résolution fiche
      // (findProjetFicheByEntite) + appendToHistorique PATCH in-place (R5) via
      // le helper projet-enricher.
      case 'append_projet_historique': {
        const code = action.payload['projetCode'] as string | undefined;
        if (!code) {
          return { ok: false, error: 'projetCode manquant pour append_projet_historique' };
        }
        const res = await appendProjetHistoriqueLine(code, {
          title: action.payload['title'] as string,
          content: action.payload['content'] as string,
          trigger: `email_ingest:auto:${email.id}`,
        });
        return res.status === 'enriched'
          ? { ok: true }
          : res.status === 'no-fiche'
            ? { ok: true } // fiche absente = skip silencieux, pas une erreur
            : { ok: false, error: res.error ?? 'append_projet_historique échoué' };
      }

      case 'skip': {
        return { ok: true };
      }

      default: {
        return { ok: false, error: `type d'action inconnu (auto) : ${action.type}` };
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ============================================================
// Utilitaires
// ============================================================

/**
 * Sérialise un EmailMessage pour le stockage dans le pending.
 * La Date est convertie en string ISO pour la sérialisation JSON.
 */
function serializeEmail(email: EmailMessage): EmailMessage {
  return {
    ...email,
    receivedAt: email.receivedAt instanceof Date
      ? email.receivedAt
      : new Date(email.receivedAt),
  };
}
