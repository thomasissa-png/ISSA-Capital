/**
 * Adaptateurs de source email (multi-comptes S23).
 *
 * Découple le runner email-ingest du fournisseur : Gmail (Thomas) + Outlook 365
 * (Sarani, Versi). Le runner boucle sur `getActiveSources()` et applique le même
 * pipeline (triage → handlers → cohérence → brouillon) à chaque compte.
 *
 * 🔒 Lecture + brouillon uniquement (Gmail drafts.create, Outlook createReply).
 * Aucun adaptateur n'expose d'envoi.
 */

import type { EmailMessage } from '../gmail-source/types';
import * as gmail from '../gmail-source/gmail-source';
import { createDraft as gmailCreateDraft } from '../gmail-source/gmail-client';
import * as outlook from '../outlook-source/outlook-source';
import {
  createReplyDraft as outlookCreateReplyDraft,
  isBoxConfigured,
  OUTLOOK_BOXES,
  type OutlookBox,
} from '../outlook-source/outlook-client';

export interface AdapterDraftResult {
  success: boolean;
  draftId?: string;
  url?: string;
  error?: string;
}

export interface EmailSourceAdapter {
  /** Identifiant compte ('gmail-thomas', 'outlook-sarani', …). */
  accountId: string;
  /** Libellé lisible (logs). */
  label: string;
  listUnprocessed(): Promise<Array<{ id: string; threadId?: string }>>;
  fetchDetail(id: string): Promise<EmailMessage | null>;
  markProcessed(id: string): Promise<boolean>;
  markFailed(id: string): Promise<boolean>;
  hasReplyFromMe(email: EmailMessage): Promise<boolean>;
  /** Adresses du propriétaire de la boîte (garde « destinataire direct » S24). */
  getSelfAddresses(): Promise<string[]>;
  /** Crée un BROUILLON de réponse threadé. Jamais d'envoi. */
  createReplyDraft(email: EmailMessage, subject: string, body: string): Promise<AdapterDraftResult>;
}

const gmailAdapter: EmailSourceAdapter = {
  accountId: 'gmail-thomas',
  label: 'Gmail',
  listUnprocessed: () => gmail.listUnprocessed(),
  fetchDetail: (id) => gmail.fetchDetail(id),
  markProcessed: (id) => gmail.markProcessed(id),
  markFailed: (id) => gmail.markFailed(id),
  hasReplyFromMe: (email) => gmail.hasReplyFromMe(email.threadId),
  getSelfAddresses: () => gmail.getSelfAddresses(),
  createReplyDraft: async (email, subject, body) => {
    const r = await gmailCreateDraft({
      to: email.from.email,
      subject,
      body,
      threadId: email.threadId,
      inReplyTo: email.messageIdHeader,
    });
    return { success: r.success, draftId: r.draftId, url: r.gmailUrl, error: r.error };
  },
};

function outlookAdapter(box: OutlookBox): EmailSourceAdapter {
  return {
    accountId: `outlook-${box}`,
    label: `Outlook ${box}`,
    listUnprocessed: () => outlook.listUnprocessed(box),
    fetchDetail: (id) => outlook.fetchDetail(box, id),
    markProcessed: (id) => outlook.markProcessed(box, id),
    // Outlook n'a pas de label "à-revoir" séparé : on marque traité pour éviter
    // une reprise en boucle sur échec de triage (rare).
    markFailed: (id) => outlook.markProcessed(box, id),
    hasReplyFromMe: (email) => outlook.hasReplyFromMe(box, email.threadId),
    getSelfAddresses: () => outlook.getSelfAddresses(box),
    createReplyDraft: async (email, _subject, body) => {
      // Outlook : createReply a besoin de l'ID du message d'origine (email.id),
      // le sujet/destinataire sont gérés automatiquement par Graph.
      const r = await outlookCreateReplyDraft(box, email.id, body);
      return { success: r.success, draftId: r.draftId, url: r.webLink, error: r.error };
    },
  };
}

/**
 * Sources actives : Gmail toujours + chaque boîte Outlook dont les secrets
 * (creds + refresh token) sont configurés.
 */
export function getActiveSources(): EmailSourceAdapter[] {
  const sources: EmailSourceAdapter[] = [gmailAdapter];
  for (const box of OUTLOOK_BOXES) {
    if (isBoxConfigured(box)) sources.push(outlookAdapter(box));
  }
  return sources;
}
