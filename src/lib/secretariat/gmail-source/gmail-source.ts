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
