/**
 * Source Outlook (Microsoft Graph) — normalise vers EmailMessage, par boîte.
 *
 * Miroir de gmail-source.ts pour Outlook 365 (Sarani / Versi). Mêmes
 * signatures logiques : listUnprocessed / fetchDetail / markProcessed /
 * hasReplyFromMe / createDraft — exposées via un adaptateur par boîte.
 *
 * 🔒 Lecture + brouillon uniquement (createReplyDraft). Aucun envoi.
 */

import type { EmailMessage, EmailAttachment, EmailAddress } from '../gmail-source/types';
import {
  type OutlookBox,
  type GraphMessage,
  listInboxUnprocessed,
  getMessageFull,
  addTraiteCategory,
  conversationHasOwnerReply,
  getAccessToken,
  getOwnerEmail,
} from './outlook-client';

function addr(r: { emailAddress?: { address?: string; name?: string } } | undefined): EmailAddress {
  const a = r?.emailAddress;
  return { email: a?.address ?? 'unknown@unknown.com', name: a?.name };
}

function addrs(rs: Array<{ emailAddress?: { address?: string; name?: string } }> | undefined): EmailAddress[] {
  return (rs ?? []).map((r) => addr(r));
}

/** Strip basique de HTML résiduel (le body est déjà demandé en texte via Prefer). */
function toPlain(body: GraphMessage['body'], fallback: string): string {
  const c = body?.content ?? fallback ?? '';
  if (body?.contentType === 'html') {
    return c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return c;
}

/** Normalise un message Graph complet en EmailMessage. */
export function normalizeGraphMessage(box: OutlookBox, m: GraphMessage): EmailMessage {
  const attachments: EmailAttachment[] = m.hasAttachments
    ? [] // détail des PJ récupéré séparément si besoin (coherence-actions)
    : [];
  return {
    source: 'outlook',
    account: `outlook-${box}`,
    id: m.id,
    threadId: m.conversationId ?? undefined,
    messageIdHeader: m.internetMessageId ?? undefined,
    from: addr(m.from),
    to: addrs(m.toRecipients),
    cc: addrs(m.ccRecipients),
    subject: m.subject ?? '(sans objet)',
    bodyPlain: toPlain(m.body, m.bodyPreview ?? ''),
    receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime) : new Date(),
    attachments,
    rawRef: m.webLink ?? `outlook:${box}:${m.id}`,
  };
}

// ============================================================
// Fonctions par boîte (miroir gmail-source)
// ============================================================

export async function listUnprocessed(
  box: OutlookBox,
): Promise<Array<{ id: string; threadId?: string }>> {
  const lookback = parseInt(process.env.EMAIL_INGEST_LOOKBACK_DAYS ?? '7', 10);
  const msgs = await listInboxUnprocessed(box, lookback);
  console.warn(`[outlook-source] ${box} listUnprocessed : ${msgs.length} message(s)`);
  return msgs.map((m) => ({ id: m.id, threadId: m.conversationId }));
}

export async function fetchDetail(box: OutlookBox, id: string): Promise<EmailMessage | null> {
  const m = await getMessageFull(box, id);
  if (!m) return null;
  return normalizeGraphMessage(box, m);
}

export async function markProcessed(box: OutlookBox, id: string): Promise<boolean> {
  return addTraiteCategory(box, id);
}

export async function hasReplyFromMe(box: OutlookBox, threadId: string | undefined): Promise<boolean> {
  return conversationHasOwnerReply(box, threadId);
}

/**
 * Adresse du propriétaire de la boîte (Sarani / Versi) pour la garde
 * « destinataire direct » (S24). [] si token/résolution KO → fail-open.
 */
export async function getSelfAddresses(box: OutlookBox): Promise<string[]> {
  const token = await getAccessToken(box);
  if (!token) return [];
  const email = await getOwnerEmail(box, token);
  return email ? [email] : [];
}
