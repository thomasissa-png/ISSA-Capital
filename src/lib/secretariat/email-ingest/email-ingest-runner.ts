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
import { createTickTickTaskForEmail } from './ticktick-integration';

// ============================================================
// Types
// ============================================================

export interface IngestStats {
  totalListed: number;
  preFilteredSpam: number;
  haikuSpam: number;
  pendingCreated: number;
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
  const actions = await handler(triage, detail);

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
