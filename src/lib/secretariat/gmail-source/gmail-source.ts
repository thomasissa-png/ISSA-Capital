/**
 * Source Gmail — email-ingest Anya.
 *
 * Méthodes principales :
 *   - listUnprocessed() : emails inbox non traités (< 7 jours)
 *   - fetchDetail(messageId) : normalise en EmailMessage
 *   - markProcessed(messageId) : pose label "Anya/traité"
 *   - markFailed(messageId) : pose label "Anya/à-revoir"
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md section Jalon 2.
 */

import type { EmailMessage } from './types';
import {
  listMessages,
  getMessage,
  modifyLabels,
  getHeader,
  getThreadMessages,
  parseEmailAddress,
  parseEmailAddresses,
  extractBodyPlain,
  extractAttachments,
} from './gmail-client';
import { resolveTraiteLabel, resolveARevoir } from './label-resolver';

// ============================================================
// Constantes
// ============================================================

const DEFAULT_LOOKBACK_DAYS = 7;

// ============================================================
// API publique
// ============================================================

/**
 * Liste les emails Gmail non traités dans l'inbox.
 *
 * Query: '-label:Anya/traité is:inbox newer_than:7d'
 * (label name configurable via GMAIL_LABEL_TRAITE)
 *
 * @param maxResults Nombre maximum de messages (défaut 50)
 * @returns Liste d'IDs de messages non traités
 */
export async function listUnprocessed(
  maxResults = 50,
): Promise<Array<{ id: string; threadId?: string }>> {
  const labelName = process.env.GMAIL_LABEL_TRAITE ?? 'Anya/traité';
  const lookbackDays = parseInt(process.env.EMAIL_INGEST_LOOKBACK_DAYS ?? String(DEFAULT_LOOKBACK_DAYS), 10);
  const query = `-label:${labelName} is:inbox newer_than:${lookbackDays}d`;

  console.warn(`[gmail-source] listUnprocessed query: "${query}"`);
  return listMessages(query, maxResults);
}

/**
 * Récupère le détail d'un message et le normalise en EmailMessage.
 *
 * @param messageId ID du message Gmail
 * @returns EmailMessage normalisé, ou null en cas d'erreur
 */
export async function fetchDetail(messageId: string): Promise<EmailMessage | null> {
  const raw = await getMessage(messageId);
  if (!raw) return null;

  const from = getHeader(raw, 'From');
  const to = getHeader(raw, 'To');
  const cc = getHeader(raw, 'Cc');
  const subject = getHeader(raw, 'Subject') ?? '(sans objet)';
  const date = getHeader(raw, 'Date');
  // Header RFC 2822 — sert d'In-Reply-To / References pour rattacher le brouillon au fil.
  const messageIdHeader = getHeader(raw, 'Message-ID') ?? getHeader(raw, 'Message-Id') ?? undefined;

  const parsedFrom = from ? parseEmailAddress(from) : { email: 'unknown@unknown.com' };
  const parsedTo = parseEmailAddresses(to);
  const parsedCc = parseEmailAddresses(cc);

  const bodyPlain = extractBodyPlain(raw);
  const attachments = extractAttachments(raw);

  // Date de réception : internalDate (ms epoch) ou header Date
  let receivedAt: Date;
  if (raw.internalDate) {
    receivedAt = new Date(parseInt(raw.internalDate, 10));
  } else if (date) {
    receivedAt = new Date(date);
    if (isNaN(receivedAt.getTime())) {
      receivedAt = new Date();
    }
  } else {
    receivedAt = new Date();
  }

  // Lien direct vers le message dans Gmail web
  const rawRef = `https://mail.google.com/mail/u/0/#inbox/${messageId}`;

  return {
    source: 'gmail',
    id: messageId,
    // gmail-source connaît déjà le threadId (raw.threadId) — on l'expose pour
    // le threading du brouillon et la détection « déjà répondu ».
    threadId: raw.threadId ?? undefined,
    messageIdHeader,
    from: parsedFrom,
    to: parsedTo,
    cc: parsedCc,
    subject,
    bodyPlain,
    receivedAt,
    attachments,
    rawRef,
  };
}

/**
 * Détermine si un message du thread a été envoyé par le compte (label SENT).
 *
 * Sert au runner email-ingest : si Thomas a déjà répondu dans le fil, on
 * documente l'email mais on ne crée PAS de brouillon (S23).
 *
 * Stratégie : `users.threads.get` (format minimal) → vrai si AU MOINS un message
 * du thread porte le label `SENT`. En cas d'échec API ou de threadId absent,
 * retourne `false` (ne bloque pas la création de brouillon — fail-open : mieux
 * vaut un brouillon en trop qu'un email sans réponse préparée).
 *
 * @param threadId ID du thread Gmail (EmailMessage.threadId)
 * @returns true si un message SENT existe dans le thread
 */
export async function hasReplyFromMe(threadId: string | undefined): Promise<boolean> {
  if (!threadId) return false;

  const messages = await getThreadMessages(threadId);
  if (messages.length === 0) {
    // Thread vide / API KO → indéterminé → fail-open (pas « déjà répondu »).
    return false;
  }

  return messages.some((m) => m.labelIds.includes('SENT'));
}

/**
 * Marque un message comme traité en posant le label "Anya/traité".
 *
 * @param messageId ID du message
 * @returns true si le label a été posé avec succès
 */
export async function markProcessed(messageId: string): Promise<boolean> {
  const labelId = await resolveTraiteLabel();
  if (!labelId) {
    console.warn(`[gmail-source] impossible de résoudre le label traité — message ${messageId} non marqué`);
    return false;
  }

  const success = await modifyLabels(messageId, [labelId]);
  if (success) {
    console.warn(`[gmail-source] message ${messageId} marqué comme traité`);
  }
  return success;
}

/**
 * Marque un message comme en erreur en posant le label "Anya/à-revoir".
 *
 * @param messageId ID du message
 * @returns true si le label a été posé avec succès
 */
export async function markFailed(messageId: string): Promise<boolean> {
  const labelId = await resolveARevoir();
  if (!labelId) {
    console.warn(`[gmail-source] impossible de résoudre le label à-revoir — message ${messageId} non marqué`);
    return false;
  }

  const success = await modifyLabels(messageId, [labelId]);
  if (success) {
    console.warn(`[gmail-source] message ${messageId} marqué comme à-revoir`);
  }
  return success;
}
