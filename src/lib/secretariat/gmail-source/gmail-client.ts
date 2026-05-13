/**
 * Client Gmail API mutualisé — email-ingest Anya.
 *
 * Réutilise getAccessToken() de drive-upload.ts (mutualisation S13).
 * NE PAS dupliquer le code OAuth — import unique.
 *
 * Règle CLAUDE.md n22 : console.warn pour tous les logs diagnostic.
 * Règle CLAUDE.md n23 : listing complet + filtre local (pas de query stricte).
 */

import { getAccessToken } from '../drive-upload';

// ============================================================
// Constantes
// ============================================================

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const TIMEOUT_MS = 10_000;

// ============================================================
// Types
// ============================================================

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  body?: { attachmentId?: string; size?: number; data?: string };
  headers?: GmailHeader[];
  parts?: GmailMessagePart[];
}

export interface GmailMessageRaw {
  id: string;
  threadId?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailMessagePart;
}

interface GmailListResponse {
  messages?: Array<{ id: string; threadId?: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

// ============================================================
// API publique
// ============================================================

/**
 * Liste les messages Gmail correspondant à une query.
 *
 * @param query Query Gmail (ex: '-label:Anya/traité is:inbox newer_than:7d')
 * @param maxResults Nombre maximum de résultats (défaut 50)
 * @returns Liste d'IDs de messages
 */
export async function listMessages(
  query: string,
  maxResults = 50,
): Promise<Array<{ id: string; threadId?: string }>> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('[gmail-client] pas de token OAuth2 — Gmail désactivé');
    return [];
  }

  const userId = process.env.GMAIL_USER_EMAIL ?? 'me';
  const url = new URL(`${GMAIL_API}/users/${encodeURIComponent(userId)}/messages`);
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(maxResults));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.warn(`[gmail-client] listMessages HTTP ${response.status} — ${errText.slice(0, 300)}`);
    return [];
  }

  const data = (await response.json()) as GmailListResponse;
  console.warn(`[gmail-client] listMessages : ${data.messages?.length ?? 0} résultats (estimé: ${data.resultSizeEstimate ?? '?'})`);
  return data.messages ?? [];
}

/**
 * Récupère le détail d'un message Gmail.
 *
 * @param messageId ID du message
 * @returns Message brut avec payload, ou null en cas d'erreur
 */
export async function getMessage(messageId: string): Promise<GmailMessageRaw | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const userId = process.env.GMAIL_USER_EMAIL ?? 'me';
  const url = `${GMAIL_API}/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}?format=full`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.warn(`[gmail-client] getMessage(${messageId}) HTTP ${response.status} — ${errText.slice(0, 300)}`);
    return null;
  }

  return (await response.json()) as GmailMessageRaw;
}

/**
 * Modifie les labels d'un message Gmail (ajouter ou retirer).
 *
 * @param messageId ID du message
 * @param addLabelIds Labels à ajouter
 * @param removeLabelIds Labels à retirer
 * @returns true si succès
 */
export async function modifyLabels(
  messageId: string,
  addLabelIds: string[],
  removeLabelIds: string[] = [],
): Promise<boolean> {
  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  const userId = process.env.GMAIL_USER_EMAIL ?? 'me';
  const url = `${GMAIL_API}/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}/modify`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      addLabelIds,
      removeLabelIds,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.warn(`[gmail-client] modifyLabels(${messageId}) HTTP ${response.status} — ${errText.slice(0, 300)}`);
    return false;
  }

  return true;
}

/**
 * Liste tous les labels du compte Gmail.
 *
 * Règle CLAUDE.md n23 : listing complet + filtre local (pas de query par nom).
 *
 * @returns Liste des labels { id, name }
 */
export async function listLabels(): Promise<Array<{ id: string; name: string }>> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('[gmail-client] pas de token OAuth2 pour listLabels');
    return [];
  }

  const userId = process.env.GMAIL_USER_EMAIL ?? 'me';
  const url = `${GMAIL_API}/users/${encodeURIComponent(userId)}/labels`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.warn(`[gmail-client] listLabels HTTP ${response.status} — ${errText.slice(0, 300)}`);
    return [];
  }

  const data = (await response.json()) as {
    labels?: Array<{ id: string; name: string }>;
  };

  const labels = data.labels ?? [];
  console.warn(`[gmail-client] listLabels : ${labels.length} labels visibles`);
  return labels;
}

// ============================================================
// Helpers d'extraction — parser les headers et body d'un message
// ============================================================

/**
 * Extrait la valeur d'un header du payload Gmail.
 */
export function getHeader(message: GmailMessageRaw, headerName: string): string | null {
  const headers = message.payload?.headers ?? [];
  const header = headers.find(
    (h) => h.name.toLowerCase() === headerName.toLowerCase(),
  );
  return header?.value ?? null;
}

/**
 * Parse une adresse email du format "Nom <email@domain.com>" ou "email@domain.com".
 */
export function parseEmailAddress(raw: string): { email: string; name?: string } {
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return {
      name: match[1]!.replace(/^["']|["']$/g, '').trim(),
      email: match[2]!.toLowerCase().trim(),
    };
  }
  return { email: raw.toLowerCase().trim() };
}

/**
 * Parse une liste d'adresses email séparées par des virgules.
 * Gère les virgules dans les noms entre guillemets et les chevrons < >.
 */
export function parseEmailAddresses(raw: string | null): Array<{ email: string; name?: string }> {
  if (!raw) return [];
  // Split intelligemment : virgule hors des < > et hors des guillemets "..."
  const addresses: string[] = [];
  let angleBracketDepth = 0;
  let inQuote = false;
  let current = '';
  for (const char of raw) {
    if (char === '"' && angleBracketDepth === 0) {
      inQuote = !inQuote;
      current += char;
      continue;
    }
    if (char === '<' && !inQuote) angleBracketDepth++;
    else if (char === '>' && !inQuote) angleBracketDepth--;
    else if (char === ',' && angleBracketDepth === 0 && !inQuote) {
      if (current.trim()) addresses.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) addresses.push(current.trim());
  return addresses.map(parseEmailAddress);
}

/**
 * Extrait le corps texte brut d'un message Gmail (recursive sur les parts MIME).
 *
 * Priorise text/plain. Si absent, extrait text/html et strippe les balises.
 */
export function extractBodyPlain(message: GmailMessageRaw): string {
  const parts = collectParts(message.payload);

  // 1. Chercher text/plain
  const plainPart = parts.find((p) => p.mimeType === 'text/plain');
  if (plainPart?.body?.data) {
    return decodeBase64Url(plainPart.body.data);
  }

  // 2. Fallback text/html → strip tags
  const htmlPart = parts.find((p) => p.mimeType === 'text/html');
  if (htmlPart?.body?.data) {
    return stripHtml(decodeBase64Url(htmlPart.body.data));
  }

  // 3. Dernier recours : body au niveau racine
  if (message.payload?.body?.data) {
    const decoded = decodeBase64Url(message.payload.body.data);
    if (message.payload.mimeType === 'text/html') {
      return stripHtml(decoded);
    }
    return decoded;
  }

  return '';
}

/**
 * Extrait la liste des pièces jointes d'un message.
 */
export function extractAttachments(
  message: GmailMessageRaw,
): Array<{ name: string; mimeType: string; sizeBytes: number; id: string }> {
  const parts = collectParts(message.payload);
  const attachments: Array<{ name: string; mimeType: string; sizeBytes: number; id: string }> = [];

  for (const part of parts) {
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      attachments.push({
        name: part.filename,
        mimeType: part.mimeType ?? 'application/octet-stream',
        sizeBytes: part.body.size ?? 0,
        id: part.body.attachmentId,
      });
    }
  }

  return attachments;
}

// ============================================================
// Utilitaires internes
// ============================================================

/**
 * Collecte récursivement toutes les parts MIME d'un message.
 */
function collectParts(part?: GmailMessagePart): GmailMessagePart[] {
  if (!part) return [];
  const result: GmailMessagePart[] = [part];
  if (part.parts) {
    for (const sub of part.parts) {
      result.push(...collectParts(sub));
    }
  }
  return result;
}

/**
 * Décode une chaîne base64url (format Gmail API).
 */
function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Supprime les balises HTML et décode les entités basiques.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
