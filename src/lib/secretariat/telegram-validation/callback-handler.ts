/**
 * Callback handler pour la validation email-ingest via Telegram.
 *
 * Traite les callbacks quand Thomas clique un bouton inline :
 *   - email_val:valider : exécute toutes les ActionProposal via vault-client + mark_processed
 *   - email_val:skip : mark_processed + audit "skip"
 *   - email_val:voir : envoie le body de l'email dans un nouveau message
 *   - email_val:modifier : envoie un message "non implémenté en V1"
 *   - email_nomatch:<type> : crée une fiche contact dans le bon dossier (Jalon 4D-2)
 *
 * Chaque action est auditée en JSONL via vault-client/audit-log.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md section Jalon 4B.
 * Fix Jalon 4D-2 : dispatch email_nomatch callbacks.
 */

import type { ActionProposal } from '../handlers/types';
import type { PendingValidation } from './telegram-cards';
import type { NoMatchPending, ContactType } from './no-match-card';
import type { WhatsappNoMatchPending } from './whatsapp-no-match-card';
import { VALIDATION_CALLBACK_PREFIX, buildValidationCard, editMessageText, editMessageTextWithButtons, sendSimpleMessage, escapeHtml } from './telegram-cards';
import { NOMATCH_CALLBACK_PREFIX, buildNoMatchCard } from './no-match-card';
import {
  WA_NOMATCH_CALLBACK_PREFIX,
  buildWhatsappNoMatchCard,
  parseWhatsappNoMatchCallback,
} from './whatsapp-no-match-card';
import {
  getPending,
  deletePending,
  getNoMatch,
  deleteNoMatch,
  getWhatsappNoMatch,
  deleteWhatsappNoMatch,
} from './pending-store';
import { answerCallbackQuery } from '../telegram';
import {
  appendToHistorique,
  updateFrontmatter,
  createVaultFile,
  addToFrontmatterList,
} from '../vault-client';
import { readFile, writeFile } from '../vault-client/obsidian-file';
import { invalidateVaultContactsCache } from '../vault-contacts';
import { invalidateContactsCache } from '../email-ingest/contacts-cache';

/**
 * Invalide les deux caches contacts (vault-contacts + email-ingest) après
 * toute écriture sur une fiche contact — création ou lien d'alias. Évite
 * qu'un cache stale fasse louper la détection homonyme à la prochaine carte
 * juste après la mise à jour (S24 nuit, audit Thomas).
 */
function invalidateContactCachesAfterWrite(): void {
  invalidateContactsCache();
  invalidateVaultContactsCache();
}

/**
 * Extrait les 3-4 premières lignes utiles de la section `## Qui c'est` du
 * contenu fiche pour preview dans le message de succès Telegram (audit
 * S24 nuit : « rendre le polish accountable »).
 * Retourne `null` si la section est absente / vide.
 */
function extractQuiCestPreview(content: string, maxLines = 4): string | null {
  const lines = content.split('\n');
  let capturing = false;
  const captured: string[] = [];
  for (const line of lines) {
    if (/^##\s+Qui c'est\s*$/i.test(line)) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (/^##\s/.test(line)) break;
      const t = line.trim();
      if (t.length === 0) continue;
      // Skip italic placeholders type « _Contact ajouté…_ ».
      if (/^_[^_]*_$/.test(t)) continue;
      captured.push(t);
      if (captured.length >= maxLines) break;
    }
  }
  return captured.length > 0 ? captured.join('\n') : null;
}
import { addTaskToTickTick, mapTodoPriority } from '../ticktick/inbox-task';
import { markProcessed } from '../gmail-source/gmail-source';
import { writeAuditLog } from '../vault-client/audit-log';
import { appendProjetHistoriqueLine } from '../calendar-ingest/projet-enricher';
import { executeCopyAttachment } from '../email-ingest/attachment-handler';
import {
  VAULT_PATHS,
  slugifyVaultFilename,
} from '../handlers/vault-paths';
import { enrichContact, buildEnrichPreviewLines } from '../contact-enrich';
import { polishUserContext } from '../contact-enrich/polish-user-context';
import type { EnrichContactResult } from '../contact-enrich';
import { formatPhoneForDisplay, normalizePhone } from '../whatsapp-ingest/whatsapp-ingest-runner';
import { renderFicheContent, type FicheRenderData } from './fiche-renderer';

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
        // S24 P2 : route vers TickTick (hub unique), pas Todo.md miroir (écrasé).
        const title =
          (action.payload['task'] as string) ??
          (action.payload['title'] as string) ??
          pending.triage.summary;
        const date = (action.payload['date'] as string) ?? undefined;
        const description = (action.payload['description'] as string) ?? undefined;

        const result = await addTaskToTickTick({
          title,
          date,
          description,
          priority: mapTodoPriority(action.payload['priority']),
        });
        return result.status === 'error'
          ? { ok: false, error: result.error ?? 'addTaskToTickTick échoué' }
          : { ok: true };
      }

      case 'mark_processed': {
        const emailId = pending.email.id;
        const success = await markProcessed(emailId);
        return success ? { ok: true } : { ok: false, error: 'markProcessed échoué' };
      }

      // S23 — historique projet (cas validé manuellement si l'auto a échoué ou
      // si l'action a atterri dans la carte). Réutilise le helper projet-enricher.
      case 'append_projet_historique': {
        const code = action.payload['projetCode'] as string | undefined;
        if (!code) {
          return { ok: false, error: 'projetCode manquant pour append_projet_historique' };
        }
        const res = await appendProjetHistoriqueLine(code, {
          title: action.payload['title'] as string,
          content: action.payload['content'] as string,
          trigger,
        });
        return res.status === 'enriched' || res.status === 'no-fiche'
          ? { ok: true }
          : { ok: false, error: res.error ?? 'append_projet_historique échoué' };
      }

      // S23 — copie PJ (proposée, validée par Thomas). download Gmail + upload
      // Drive vers le sous-dossier résolu.
      case 'copy_attachment': {
        const messageId = action.payload['messageId'] as string | undefined;
        const attachmentId = action.payload['attachmentId'] as string | undefined;
        const attachmentName = action.payload['attachmentName'] as string | undefined;
        const baseFolderPath = action.payload['baseFolderPath'] as string | undefined;
        const subfolder = action.payload['subfolder'] as string | undefined;
        if (!messageId || !attachmentId || !attachmentName || !baseFolderPath || !subfolder) {
          return { ok: false, error: 'payload copy_attachment incomplet' };
        }
        const res = await executeCopyAttachment(
          messageId,
          {
            name: attachmentName,
            mimeType: (action.payload['attachmentMimeType'] as string) ?? 'application/octet-stream',
            id: attachmentId,
          },
          { baseFolderPath, subfolder },
        );
        return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'copy_attachment échoué' };
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
// No-match callback handlers (Jalon 4D-2)
// ============================================================

const VALID_CONTACT_TYPES: readonly ContactType[] = ['pro', 'famille', 'amis', 'autres'];

/**
 * Parse le callback data pour un bouton no-match.
 * Format attendu : "email_nomatch:<type>:<noMatchId>"
 */
/**
 * Parse les callbacks no-match. Formats supportés :
 *  - `email_nomatch:<type>:<id>` pour pro/famille/amis/autres/skip
 *  - `email_nomatch:link:<idx>:<id>` (1er clic, demande confirm)
 *  - `email_nomatch:link_yes:<idx>:<id>` (confirme)
 *  - `email_nomatch:link_cancel:<id>` (annule, re-render)
 */
function parseNoMatchCallbackData(data: string): {
  type: ContactType | 'skip' | 'link' | 'link_yes' | 'link_cancel';
  noMatchId: string;
  /** Index du hint dans `existingMatchHints` (link / link_yes uniquement). */
  hintIdx?: number;
} | null {
  if (!data.startsWith(NOMATCH_CALLBACK_PREFIX)) return null;
  const tokens = data.slice(NOMATCH_CALLBACK_PREFIX.length).split(':');
  if (tokens.length < 2) return null;
  const action = tokens[0]!;

  if (action === 'link' || action === 'link_yes') {
    if (tokens.length !== 3) return null;
    const hintIdx = parseInt(tokens[1]!, 10);
    const noMatchId = tokens[2]!;
    if (Number.isNaN(hintIdx) || hintIdx < 0 || !noMatchId) return null;
    return { type: action, noMatchId, hintIdx };
  }
  if (action === 'link_cancel') {
    if (tokens.length !== 2) return null;
    return { type: 'link_cancel', noMatchId: tokens[1]! };
  }

  // Actions classiques : pro/famille/amis/autres/skip
  if (tokens.length !== 2) return null;
  const noMatchId = tokens[1]!;
  if (action !== 'skip' && !(VALID_CONTACT_TYPES as readonly string[]).includes(action)) return null;
  if (!noMatchId) return null;
  return { type: action as ContactType | 'skip', noMatchId };
}

/**
 * Mapping type de contact → path vault.
 */
function contactTypeToVaultPath(type: ContactType): string {
  switch (type) {
    case 'pro':
      return VAULT_PATHS.contactsPro;
    case 'famille':
      return VAULT_PATHS.contactsFamille;
    case 'amis':
      return VAULT_PATHS.contactsAmis;
    case 'autres':
      return VAULT_PATHS.contactsAutres;
  }
}

/**
 * Extrait le local-part d'un email (avant le @).
 */
function extractLocalPart(email: string): string {
  const local = email.split('@')[0] ?? 'inconnu';
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || 'Inconnu';
}

/**
 * Construit le contenu de la fiche stub (mono-email) — fallback historique.
 * Utilisé si l'enrichissement (scan boîte + synthèse LLM) échoue ou ne trouve
 * rien : on ne bloque JAMAIS la création de fiche.
 */
async function buildStubFiche(
  noMatch: NoMatchPending,
  type: ContactType,
  today: string,
): Promise<{ displayName: string; content: string }> {
  const displayName = noMatch.nameFrom
    ? noMatch.nameFrom
    : extractLocalPart(noMatch.emailFrom);

  // S25 (2026-05-29) : rendu délégué à `fiche-renderer.ts` aligné sur les
  // templates `Contact pro.md` / `Contact relationnel.md` du vault.
  const renderData: FicheRenderData = {
    displayName,
    email: noMatch.emailFrom,
    rencontreVia: 'Email',
    userContext: noMatch.userContext ?? undefined,
  };

  const content = await renderFicheContent(type, renderData, {
    today,
    historiqueTitle: 'Premier contact email',
    historiqueContent: `Premier email reçu. ${noMatch.emailThreadRef}`,
  });

  return { displayName, content };
}

/**
 * Tente de construire une fiche ENRICHIE via l'orchestrateur cross-boîtes
 * (Gmail + Outlook), parsing nom LLM, domains.yml, synthèse + signature.
 *
 * Robustesse : retourne `null` à la moindre défaillance (scan vide, etc.) —
 * l'appelant retombe alors sur le stub. Ne throw jamais.
 */
async function buildEnrichedFiche(
  noMatch: NoMatchPending,
  type: ContactType,
  today: string,
): Promise<EnrichContactResult | null> {
  return enrichContact({
    email: noMatch.emailFrom,
    nameFrom: noMatch.nameFrom,
    type,
    today,
    emailThreadRef: noMatch.emailThreadRef,
    userContext: noMatch.userContext ?? null,
  });
}

/**
 * Traite un callback no-match : crée la fiche contact dans le vault.
 *
 * S23 : avant d'écrire la fiche, tente un enrichissement (scan boîte mail de
 * l'expéditeur + synthèse LLM). Si l'enrichissement échoue → fallback sur le
 * stub mono-email (la création n'est jamais bloquée).
 */
async function handleNoMatchCallback(
  noMatch: NoMatchPending,
  type: ContactType,
  callback: TelegramCallback,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const targetFolder = contactTypeToVaultPath(type);

  // S24 nuit — polissage LLM du userContext (Thomas a peut-être écrit en mode
  // brouillon vocal/clavier ; on reformule pour ton fiche, ZÉRO invention).
  // Fallback silencieux sur le texte brut si LLM KO.
  let workingNoMatch = noMatch;
  if (noMatch.userContext && noMatch.userContext.trim().length > 0) {
    const polished = await polishUserContext({
      rawText: noMatch.userContext,
      contactName: noMatch.nameFrom ?? extractLocalPart(noMatch.emailFrom),
      type,
    });
    workingNoMatch = { ...noMatch, userContext: polished };
  }

  // Enrichissement (await complet — pas de fire-and-forget) avec fallback stub.
  const enriched = await buildEnrichedFiche(workingNoMatch, type, today);
  const fiche = enriched ?? (await buildStubFiche(workingNoMatch, type, today));
  const enrichedUsed = enriched !== null;

  const filename = `${slugifyVaultFilename(fiche.displayName)}.md`;
  const target = `${targetFolder}/${filename}`;
  const content = fiche.content;

  const trigger = `email_nomatch:${type}:${noMatch.id}`;

  // S24 nuit (post-audit) — anti double-clic : re-vérifier que le pending
  // existe AVANT d'écrire. Le mutex Drive est intra-process ; un 2e clic
  // pendant le 1er traitement crée 2 fiches en doublon ou un message d'erreur
  // confus. Si le pending a déjà été supprimé, on ack en mode silencieux.
  const stillThere = await getNoMatch(noMatch.id);
  if (!stillThere) {
    console.warn(`[callback-handler] no-match ${noMatch.id} déjà traité (race / double-clic) — skip`);
    return;
  }

  // Créer le fichier via vault-client
  const success = await createVaultFile(targetFolder, filename, content, trigger);

  if (success) {
    invalidateContactCachesAfterWrite();
  } else {
    console.warn(`[callback-handler] createVaultFile échoué pour ${target}`);
    await sendSimpleMessage(
      callback.chat_id,
      `\u{274C} Erreur création fiche : ${target}`,
    );
    return;
  }

  // Audit JSONL
  await auditAction(
    enrichedUsed ? 'nomatch_create_enriched' : 'nomatch_create',
    type,
    noMatch.id,
    target,
    'ok',
  );

  // Supprimer le no-match pending
  await deleteNoMatch(noMatch.id);

  // Edit le message Telegram — preview enrichie : on affiche les champs captés.
  const { text: originalText } = buildNoMatchCard(noMatch);
  const time = currentTimeHHMM();
  const ficheLabel = enrichedUsed ? 'Fiche enrichie créée' : 'Fiche créée';
  let suffix = `\n\n\u{2705} ${ficheLabel} : ${target} à ${time}`;
  if (enriched) {
    const previewLines = buildEnrichPreviewLines(enriched.data);
    if (previewLines.length > 0) {
      suffix += `\n${previewLines.map((l) => escapeHtml(l)).join('\n')}`;
    }
    if (enriched.sources.length > 0) {
      suffix += `\n<i>${enriched.scanned} email(s) — ${escapeHtml(enriched.sources.join(', '))}</i>`;
    }
  }
  // S24 nuit (audit) — preview de la section « Qui c'est » polie. Rend
  // visible ce qu'Anya a écrit (texte de Thomas reformulé par Haiku).
  const quiCest = extractQuiCestPreview(content);
  if (quiCest) {
    suffix += `\n\n📝 <b>Qui c'est</b> (extrait) :\n<i>${escapeHtml(quiCest)}</i>`;
  }
  await editMessageText(callback.chat_id, callback.message_id, originalText + suffix);
}

/**
 * Traite un skip no-match : supprime le pending, edit le message.
 */
async function handleNoMatchSkip(
  noMatch: NoMatchPending,
  callback: TelegramCallback,
): Promise<void> {
  await deleteNoMatch(noMatch.id);

  await auditAction(
    'nomatch_skip',
    'skip',
    noMatch.id,
    null,
    'ok',
  );

  const { text: originalText } = buildNoMatchCard(noMatch);
  const time = currentTimeHHMM();
  await editMessageText(
    callback.chat_id,
    callback.message_id,
    originalText + `\n\n\u{23ED}\u{FE0F} Skippé à ${time}`,
  );
}

// ============================================================
// API publique
// ============================================================

/**
 * Traite un callback Telegram de validation email-ingest.
 *
 * Dispatche vers le handler approprié selon le préfixe du callback_data :
 * - email_val: → validation carte principale (valider/skip/voir/modifier)
 * - email_nomatch: → création fiche contact (pro/famille/amis/autres/skip)
 *
 * @param callback Les données du callback Telegram
 */
export async function handleTelegramCallback(callback: TelegramCallback): Promise<void> {
  // Toujours acquitter le callback pour retirer le spinner
  const answerPromise = answerCallbackQuery(callback.callback_query_id);

  // Dispatch selon le préfixe
  if (callback.data.startsWith(NOMATCH_CALLBACK_PREFIX)) {
    await handleNoMatchDispatch(callback);
    await answerPromise;
    return;
  }
  if (callback.data.startsWith(WA_NOMATCH_CALLBACK_PREFIX)) {
    await handleWhatsappNoMatchDispatch(callback);
    await answerPromise;
    return;
  }

  // Parser le callback data (validation principale)
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

// ============================================================
// No-match dispatch (Jalon 4D-2)
// ============================================================

/**
 * Dispatch interne pour les callbacks no-match.
 */
async function handleNoMatchDispatch(callback: TelegramCallback): Promise<void> {
  const parsed = parseNoMatchCallbackData(callback.data);
  if (!parsed) {
    console.warn(`[callback-handler] no-match callback data invalide : ${callback.data}`);
    return;
  }

  const { type, noMatchId, hintIdx } = parsed;

  try {
    const noMatch = await getNoMatch(noMatchId);
    if (!noMatch) {
      // S24 nuit (post-audit) — neutraliser le clavier au lieu de juste alerter :
      // sinon la carte (notamment en mode confirm Lier) reste cliquable avec
      // pending null → dead-end (chaque clic suivant relog la même erreur).
      await editMessageTextWithButtons(
        callback.chat_id,
        callback.message_id,
        '\u{26A0}\u{FE0F} Carte expirée ou déjà traitée. (Boutons désactivés.)',
        [],
      );
      return;
    }

    if (type === 'skip') {
      await handleNoMatchSkip(noMatch, callback);
    } else if (type === 'link') {
      await askNoMatchLinkConfirm(noMatch, hintIdx ?? 0, callback);
    } else if (type === 'link_yes') {
      await handleNoMatchLink(noMatch, hintIdx ?? 0, callback);
    } else if (type === 'link_cancel') {
      await restoreNoMatchCard(noMatch, callback);
    } else {
      await handleNoMatchCallback(noMatch, type, callback);
    }
  } catch (err) {
    console.warn(
      `[callback-handler] erreur traitement no-match ${type} pour ${noMatchId} : ${err instanceof Error ? err.message : String(err)}`,
    );
    await sendSimpleMessage(
      callback.chat_id,
      `\u{274C} Erreur lors de la création de fiche : ${err instanceof Error ? err.message : 'inconnue'}`,
    );
  }
}

// ============================================================
// No-match LINK (S24 nuit — ajoute l'email à une fiche existante au même nom)
// ============================================================

/**
 * Étape 1 du « Lier » : demande de confirmation. La carte est éditée pour
 * afficher la cible exacte et deux boutons [Oui, lier] / [Annuler].
 */
async function askNoMatchLinkConfirm(
  noMatch: NoMatchPending,
  hintIdx: number,
  callback: TelegramCallback,
): Promise<void> {
  const hint = noMatch.existingMatchHints?.[hintIdx];
  if (!hint) {
    await sendSimpleMessage(callback.chat_id, '\u{26A0}\u{FE0F} Fiche cible introuvable.');
    return;
  }
  const text =
    `\u{2753} <b>Confirmer le lien ?</b>\n\n` +
    `Email <code>${escapeHtml(noMatch.emailFrom)}</code> → ajouté à <code>alias_email</code> ` +
    `de la fiche <b>${escapeHtml(hint.displayName)}</b> (${escapeHtml(hint.folderPath)}/${escapeHtml(hint.filename)}).\n\n` +
    `<i>Action irréversible côté Drive — vérifie que c'est la bonne personne.</i>`;
  const keyboard = [
    [
      { text: '\u{2705} Oui, lier', callback_data: `${NOMATCH_CALLBACK_PREFIX}link_yes:${hintIdx}:${noMatch.id}` },
      { text: '\u{21A9}\u{FE0F} Annuler', callback_data: `${NOMATCH_CALLBACK_PREFIX}link_cancel:${noMatch.id}` },
    ],
  ];
  await editMessageTextWithButtons(callback.chat_id, callback.message_id, text, keyboard);
}

/**
 * Étape « Annuler » : restaure la carte d'origine (boutons + warning).
 */
async function restoreNoMatchCard(
  noMatch: NoMatchPending,
  callback: TelegramCallback,
): Promise<void> {
  const { text, inlineKeyboard } = buildNoMatchCard(noMatch);
  // Cast : `TelegramKeyboard` peut contenir des boutons url ; ici on a
  // uniquement des callback_data → cast sûr.
  await editMessageTextWithButtons(
    callback.chat_id,
    callback.message_id,
    text,
    inlineKeyboard as Array<Array<{ text: string; callback_data: string }>>,
  );
}

async function handleNoMatchLink(
  noMatch: NoMatchPending,
  hintIdx: number,
  callback: TelegramCallback,
): Promise<void> {
  const hint = noMatch.existingMatchHints?.[hintIdx];
  if (!hint) {
    await sendSimpleMessage(
      callback.chat_id,
      '\u{26A0}\u{FE0F} Aucune fiche cible mémorisée pour le lien — impossible.',
    );
    return;
  }

  try {
    // Lire la fiche existante.
    const read = await readFile(hint.folderPath, hint.filename);
    if (!read.success || !read.content) {
      // S24 nuit (post-audit) — fiche cible inaccessible (renommée, supprimée,
      // 401). Supprimer le pending casse la boucle « re-clic → même erreur »
      // sinon Thomas reste bloqué. Carte neutralisée + conseil utile.
      await deleteNoMatch(noMatch.id);
      await editMessageTextWithButtons(
        callback.chat_id,
        callback.message_id,
        `\u{274C} Fiche cible introuvable (${escapeHtml(hint.folderPath)}/${escapeHtml(hint.filename)}). ` +
          `Vérifie si elle a été renommée. (Carte fermée.)`,
        [],
      );
      return;
    }

    // Ajouter l'email à `alias_email` (créée après `email:` si absente,
    // idempotent si déjà présente).
    const newContent = addToFrontmatterList(
      read.content,
      'alias_email',
      noMatch.emailFrom,
      'email',
    );

    if (newContent === read.content) {
      // Email déjà présent → on supprime juste le pending et on note.
      await deleteNoMatch(noMatch.id);
      const { text: original } = buildNoMatchCard(noMatch);
      await editMessageText(
        callback.chat_id,
        callback.message_id,
        `${original}\n\n\u{1F517} ${noMatch.emailFrom} déjà présent dans la fiche ${hint.displayName} (rien à faire) — ${currentTimeHHMM()}.`,
      );
      return;
    }

    const writeOk = await writeFile(hint.folderPath, hint.filename, newContent);
    if (!writeOk.success) {
      await sendSimpleMessage(
        callback.chat_id,
        `\u{274C} Échec écriture fiche : ${writeOk.error ?? 'inconnue'}`,
      );
      return;
    }
    invalidateContactCachesAfterWrite();

    await auditAction(
      'nomatch_link_email',
      'pro',
      noMatch.id,
      `${hint.folderPath}/${hint.filename}`,
      'ok',
    );
    await deleteNoMatch(noMatch.id);

    const { text: original } = buildNoMatchCard(noMatch);
    const time = currentTimeHHMM();
    await editMessageText(
      callback.chat_id,
      callback.message_id,
      `${original}\n\n\u{1F517} ${noMatch.emailFrom} ajouté en alias_email à ${hint.displayName} à ${time}.`,
    );
  } catch (err) {
    console.warn(
      `[callback-handler] handleNoMatchLink erreur : ${err instanceof Error ? err.message : String(err)}`,
    );
    await sendSimpleMessage(
      callback.chat_id,
      `\u{274C} Erreur lors du lien : ${err instanceof Error ? err.message : 'inconnue'}`,
    );
  }
}

// ============================================================
// WhatsApp no-match (S24 soir — symétrie avec le no-match email)
// ============================================================

/**
 * Split heuristique `chatName` → `{prenom, nom}` :
 *  - "Jean Dupont" → prenom "Jean", nom "Dupont"
 *  - "Karim" seul → prenom "Karim", nom "" (slug = "Karim")
 *  - "Marc Antoine Gernot" → prenom "Marc", nom "Antoine Gernot"
 * Best-effort. Thomas peut corriger après création (la fiche est éditable).
 */
function splitChatName(chatName: string): { prenom: string; nom: string } {
  const t = chatName.trim();
  const ws = t.indexOf(' ');
  if (ws === -1) return { prenom: t, nom: '' };
  return { prenom: t.slice(0, ws), nom: t.slice(ws + 1).trim() };
}

/**
 * Construit une fiche WhatsApp à la création (depuis le pending no-match).
 * Pré-remplit téléphone + nom (best-effort), inclut le résumé du LLM dans
 * « Qui c'est » et le userContext en tête (S24 PR B, si fourni avant le clic).
 *
 * S25 (2026-05-29) : rendu délégué au helper `fiche-renderer.ts` aligné sur
 * les templates `Contact pro.md` / `Contact relationnel.md` du vault.
 */
async function buildWhatsappFiche(
  noMatch: WhatsappNoMatchPending,
  type: ContactType,
  today: string,
): Promise<{ displayName: string; content: string }> {
  const { prenom, nom } = splitChatName(noMatch.chatName);
  const displayName = nom ? `${prenom} ${nom}` : prenom;

  // Fallback ## Qui c'est : résumé LLM du chat si userContext absent.
  const fallbackQuiCest =
    noMatch.summary && noMatch.summary.trim().length > 0
      ? `_Premier échange WhatsApp (résumé Anya) :_ ${noMatch.summary.trim()}`
      : '_Contact ajouté depuis WhatsApp — à compléter._';

  const renderData: FicheRenderData = {
    displayName,
    telephone: formatPhoneForDisplay(noMatch.phone),
    rencontreVia: 'WhatsApp',
    userContext: noMatch.userContext ?? undefined,
    fallbackQuiCest,
  };

  const historiqueContent =
    `Fiche créée à partir d'un échange WhatsApp` +
    (noMatch.chatName ? ` avec « ${noMatch.chatName} »` : '') +
    '.';

  const content = await renderFicheContent(type, renderData, {
    today,
    historiqueTitle: 'Premier contact WhatsApp',
    historiqueContent,
  });

  return { displayName, content };
}

async function handleWhatsappNoMatchCallback(
  noMatch: WhatsappNoMatchPending,
  type: ContactType,
  callback: TelegramCallback,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const targetFolder = contactTypeToVaultPath(type);

  // S24 nuit — polissage LLM du userContext (cf. handleNoMatchCallback).
  let workingNoMatch = noMatch;
  if (noMatch.userContext && noMatch.userContext.trim().length > 0) {
    const polished = await polishUserContext({
      rawText: noMatch.userContext,
      contactName: noMatch.chatName || '(contact WhatsApp)',
      type,
    });
    workingNoMatch = { ...noMatch, userContext: polished };
  }

  const fiche = await buildWhatsappFiche(workingNoMatch, type, today);
  const filename = `${slugifyVaultFilename(fiche.displayName)}.md`;
  const target = `${targetFolder}/${filename}`;
  const trigger = `whatsapp_nomatch:${type}:${noMatch.id}`;

  // Anti double-clic : pending existe-t-il encore ?
  const stillThere = await getWhatsappNoMatch(noMatch.id);
  if (!stillThere) {
    console.warn(`[callback-handler] wa-no-match ${noMatch.id} déjà traité — skip`);
    return;
  }

  const success = await createVaultFile(targetFolder, filename, fiche.content, trigger);
  if (!success) {
    console.warn(`[callback-handler] createVaultFile (WhatsApp) échoué pour ${target}`);
    await sendSimpleMessage(callback.chat_id, `\u{274C} Erreur création fiche : ${target}`);
    return;
  }
  invalidateContactCachesAfterWrite();

  await auditAction(
    'whatsapp_nomatch_create',
    type,
    noMatch.id,
    target,
    'ok',
  );

  await deleteWhatsappNoMatch(noMatch.id);

  const { text: originalText } = buildWhatsappNoMatchCard(noMatch);
  const time = currentTimeHHMM();
  let suffix = `\n\n\u{2705} Fiche créée : ${target} à ${time}`;

  // S24 nuit (audit) — preview du « Qui c'est » polish, rend visible ce qui a
  // été écrit (incl. la reformulation Haiku du userContext fourni).
  const quiCest = extractQuiCestPreview(fiche.content);
  if (quiCest) {
    suffix += `\n\n📝 <b>Qui c'est</b> (extrait) :\n<i>${escapeHtml(quiCest)}</i>`;
  }

  // Comble l'asymétrie email vs WhatsApp : la fiche WhatsApp n'a pas d'email
  // donc pas de cross-boîtes possible (enrichContact a besoin d'un email).
  // Si Thomas connaît l'email du contact, il peut compléter via /enrichir
  // une fois la fiche créée — on lui glisse le conseil.
  suffix += `\n\n<i>💡 Si tu connais son email, complète la fiche avec :</i> <code>/enrichir ${escapeHtml(fiche.displayName)}</code>`;

  await editMessageText(callback.chat_id, callback.message_id, originalText + suffix);
}

async function handleWhatsappNoMatchSkip(
  noMatch: WhatsappNoMatchPending,
  callback: TelegramCallback,
): Promise<void> {
  await deleteWhatsappNoMatch(noMatch.id);
  await auditAction('whatsapp_nomatch_skip', 'pro', noMatch.id, noMatch.chatId, 'ok');

  const { text: originalText } = buildWhatsappNoMatchCard(noMatch);
  const time = currentTimeHHMM();
  await editMessageText(
    callback.chat_id,
    callback.message_id,
    `${originalText}\n\n\u{23ED}\u{FE0F} Skip — pas de fiche créée (${time}).`,
  );
}

/**
 * Étape 1 du « Lier » WhatsApp : demande de confirmation 2 étapes.
 */
async function askWhatsappNoMatchLinkConfirm(
  noMatch: WhatsappNoMatchPending,
  hintIdx: number,
  callback: TelegramCallback,
): Promise<void> {
  const hint = noMatch.existingMatchHints?.[hintIdx];
  if (!hint) {
    await sendSimpleMessage(callback.chat_id, '\u{26A0}\u{FE0F} Fiche cible introuvable.');
    return;
  }
  const text =
    `\u{2753} <b>Confirmer le lien ?</b>\n\n` +
    `Téléphone <code>${escapeHtml(formatPhoneForDisplay(noMatch.phone) || '?')}</code> → ajouté à <code>alias_telephone</code> ` +
    `de la fiche <b>${escapeHtml(hint.displayName)}</b> (${escapeHtml(hint.folderPath)}/${escapeHtml(hint.filename)}).\n\n` +
    `<i>Action irréversible côté Drive — vérifie que c'est la bonne personne.</i>`;
  const keyboard = [
    [
      { text: '\u{2705} Oui, lier', callback_data: `${WA_NOMATCH_CALLBACK_PREFIX}link_yes:${hintIdx}:${noMatch.id}` },
      { text: '\u{21A9}\u{FE0F} Annuler', callback_data: `${WA_NOMATCH_CALLBACK_PREFIX}link_cancel:${noMatch.id}` },
    ],
  ];
  await editMessageTextWithButtons(callback.chat_id, callback.message_id, text, keyboard);
}

async function restoreWhatsappNoMatchCard(
  noMatch: WhatsappNoMatchPending,
  callback: TelegramCallback,
): Promise<void> {
  const { text, inlineKeyboard } = buildWhatsappNoMatchCard(noMatch);
  await editMessageTextWithButtons(
    callback.chat_id,
    callback.message_id,
    text,
    inlineKeyboard as Array<Array<{ text: string; callback_data: string }>>,
  );
}

async function handleWhatsappNoMatchLink(
  noMatch: WhatsappNoMatchPending,
  hintIdx: number,
  callback: TelegramCallback,
): Promise<void> {
  const hint = noMatch.existingMatchHints?.[hintIdx];
  if (!hint || !noMatch.phone) {
    await sendSimpleMessage(
      callback.chat_id,
      '\u{26A0}\u{FE0F} Lien impossible (fiche cible ou téléphone manquant).',
    );
    return;
  }

  try {
    const read = await readFile(hint.folderPath, hint.filename);
    if (!read.success || !read.content) {
      // Fiche cible inaccessible → casse la boucle (audit S24 nuit).
      await deleteWhatsappNoMatch(noMatch.id);
      await editMessageTextWithButtons(
        callback.chat_id,
        callback.message_id,
        `\u{274C} Fiche cible introuvable (${escapeHtml(hint.folderPath)}/${escapeHtml(hint.filename)}). ` +
          `Vérifie si elle a été renommée. (Carte fermée.)`,
        [],
      );
      return;
    }

    const phoneFormatted = formatPhoneForDisplay(noMatch.phone);
    // S26 H2 — Dédup par hash 9-chiffres pour éviter doublon avec fiches
    // S24-S26 polluées (`alias_telephone: 664850631` + nouveau format
    // `+33 6 64 85 06 31` → mêmes 9 chiffres normalisés → no-op détecté).
    const newContent = addToFrontmatterList(
      read.content,
      'alias_telephone',
      phoneFormatted,
      'telephone',
      (v: string) => normalizePhone(v) ?? v.trim().toLowerCase(),
    );

    if (newContent === read.content) {
      await deleteWhatsappNoMatch(noMatch.id);
      const { text: original } = buildWhatsappNoMatchCard(noMatch);
      await editMessageText(
        callback.chat_id,
        callback.message_id,
        `${original}\n\n\u{1F517} ${phoneFormatted} déjà présent dans ${hint.displayName} (rien à faire) — ${currentTimeHHMM()}.`,
      );
      return;
    }

    const writeOk = await writeFile(hint.folderPath, hint.filename, newContent);
    if (!writeOk.success) {
      await sendSimpleMessage(
        callback.chat_id,
        `\u{274C} Échec écriture fiche : ${writeOk.error ?? 'inconnue'}`,
      );
      return;
    }
    invalidateContactCachesAfterWrite();

    await auditAction(
      'whatsapp_nomatch_link_phone',
      'pro',
      noMatch.id,
      `${hint.folderPath}/${hint.filename}`,
      'ok',
    );
    await deleteWhatsappNoMatch(noMatch.id);

    const { text: original } = buildWhatsappNoMatchCard(noMatch);
    const time = currentTimeHHMM();
    await editMessageText(
      callback.chat_id,
      callback.message_id,
      `${original}\n\n\u{1F517} ${phoneFormatted} ajouté en alias_telephone à ${hint.displayName} à ${time}.`,
    );
  } catch (err) {
    console.warn(
      `[callback-handler] handleWhatsappNoMatchLink erreur : ${err instanceof Error ? err.message : String(err)}`,
    );
    await sendSimpleMessage(
      callback.chat_id,
      `\u{274C} Erreur lien WhatsApp : ${err instanceof Error ? err.message : 'inconnue'}`,
    );
  }
}

async function handleWhatsappNoMatchDispatch(callback: TelegramCallback): Promise<void> {
  const parsed = parseWhatsappNoMatchCallback(callback.data);
  if (!parsed) {
    console.warn(`[callback-handler] wa_nomatch callback data invalide : ${callback.data}`);
    return;
  }
  const { action, noMatchId } = parsed;

  try {
    const noMatch = await getWhatsappNoMatch(noMatchId);
    if (!noMatch) {
      await editMessageTextWithButtons(
        callback.chat_id,
        callback.message_id,
        '\u{26A0}\u{FE0F} Carte WhatsApp expirée ou déjà traitée. (Boutons désactivés.)',
        [],
      );
      return;
    }
    if (action === 'skip') {
      await handleWhatsappNoMatchSkip(noMatch, callback);
    } else if (action === 'link') {
      await askWhatsappNoMatchLinkConfirm(noMatch, parsed.hintIdx ?? 0, callback);
    } else if (action === 'link_yes') {
      await handleWhatsappNoMatchLink(noMatch, parsed.hintIdx ?? 0, callback);
    } else if (action === 'link_cancel') {
      await restoreWhatsappNoMatchCard(noMatch, callback);
    } else {
      await handleWhatsappNoMatchCallback(noMatch, action, callback);
    }
  } catch (err) {
    console.warn(
      `[callback-handler] erreur wa_nomatch ${action} pour ${noMatchId} : ${err instanceof Error ? err.message : String(err)}`,
    );
    await sendSimpleMessage(
      callback.chat_id,
      `\u{274C} Erreur création fiche WhatsApp : ${err instanceof Error ? err.message : 'inconnue'}`,
    );
  }
}
