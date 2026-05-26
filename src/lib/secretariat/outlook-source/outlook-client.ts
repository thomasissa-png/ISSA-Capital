/**
 * Client Microsoft Graph — Outlook (multi-boîtes Sarani / Versi).
 *
 * Auth par compte : refresh token (stocké VPS .env.local) → access token.
 *
 * 🔒 INVARIANT SÉCURITÉ (règle 11) — LECTURE + BROUILLON UNIQUEMENT. Ce module
 * n'expose et n'appelle JAMAIS d'endpoint d'envoi (`/sendMail`, `/send`). Anya
 * ne doit pas pouvoir envoyer d'email via Outlook, comme pour Gmail.
 */

import { loadEnvConfig } from '@next/env';

// Le runtime VPS (`next start`) ne peuple pas process.env depuis .env.local pour
// les accès dynamiques — on force le chargement ici (idempotent, best-effort).
let envLoaded = false;
function ensureEnv(): void {
  if (envLoaded) return;
  try {
    loadEnvConfig(process.cwd());
  } catch {
    /* best-effort */
  }
  envLoaded = true;
}

export type OutlookBox = 'sarani' | 'versi';
export const OUTLOOK_BOXES: readonly OutlookBox[] = ['sarani', 'versi'];

/** Scopes — lecture + brouillon, JAMAIS Mail.Send. */
const SCOPES = 'offline_access User.Read Mail.Read Mail.ReadWrite';

interface BoxCreds {
  clientId?: string;
  tenant: string;
  clientSecret?: string;
  refreshToken?: string;
}

function creds(box: OutlookBox): BoxCreds {
  ensureEnv();
  const s = box.toUpperCase();
  return {
    clientId: process.env[`OUTLOOK_CLIENT_ID_${s}`],
    tenant: process.env[`OUTLOOK_TENANT_ID_${s}`] ?? 'organizations',
    clientSecret: process.env[`OUTLOOK_CLIENT_SECRET_${s}`],
    refreshToken: process.env[`OUTLOOK_REFRESH_TOKEN_${s}`],
  };
}

/** Vrai si la boîte a toutes ses variables (creds + refresh token). */
export function isBoxConfigured(box: OutlookBox): boolean {
  const c = creds(box);
  return Boolean(c.clientId && c.clientSecret && c.refreshToken);
}

/**
 * Échange le refresh token contre un access token (grant refresh_token).
 * @returns access token, ou null si creds manquants / échec.
 */
export async function getAccessToken(box: OutlookBox): Promise<string | null> {
  const c = creds(box);
  if (!c.clientId || !c.clientSecret || !c.refreshToken) return null;

  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(c.tenant)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: c.clientId,
          client_secret: c.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: c.refreshToken,
          scope: SCOPES,
        }),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`[outlook-client] refresh ${box} HTTP ${res.status} — ${txt.slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (err) {
    console.warn(`[outlook-client] refresh ${box} erreur : ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

const GRAPH = 'https://graph.microsoft.com/v1.0';
const GRAPH_TIMEOUT_MS = 30_000;

/** Catégorie Outlook qui marque un message traité par Anya. */
export const OUTLOOK_TRAITE_CATEGORY = 'Anya/traité';

interface GraphRecipient {
  emailAddress?: { address?: string; name?: string };
}
export interface GraphMessage {
  id: string;
  conversationId?: string;
  internetMessageId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  webLink?: string;
  categories?: string[];
  hasAttachments?: boolean;
}

/** Récupère l'email propriétaire de la boîte (cache process). */
const ownerEmailCache: Partial<Record<OutlookBox, string>> = {};
export async function getOwnerEmail(box: OutlookBox, token: string): Promise<string | null> {
  if (ownerEmailCache[box]) return ownerEmailCache[box]!;
  try {
    const res = await fetch(`${GRAPH}/me?$select=mail,userPrincipalName`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const me = (await res.json()) as { mail?: string; userPrincipalName?: string };
    const email = me.mail ?? me.userPrincipalName ?? null;
    if (email) ownerEmailCache[box] = email;
    return email;
  } catch {
    return null;
  }
}

/**
 * Liste les messages inbox récents NON traités (catégorie Anya/traité absente).
 * Lecture seule.
 */
export async function listInboxUnprocessed(
  box: OutlookBox,
  lookbackDays = 7,
  max = 25,
): Promise<GraphMessage[]> {
  const token = await getAccessToken(box);
  if (!token) return [];
  const since = new Date(Date.now() - lookbackDays * 86400_000).toISOString();
  const select =
    'id,conversationId,internetMessageId,subject,from,receivedDateTime,categories,hasAttachments';
  const url =
    `${GRAPH}/me/mailFolders/inbox/messages` +
    `?$select=${select}&$top=${max}&$orderby=receivedDateTime desc` +
    `&$filter=${encodeURIComponent(`receivedDateTime ge ${since}`)}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[outlook-client] list ${box} HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { value?: GraphMessage[] };
    const all = data.value ?? [];
    // Exclut ceux déjà marqués traités (filtrage client : $filter sur categories
    // est capricieux côté Graph).
    return all.filter((m) => !(m.categories ?? []).includes(OUTLOOK_TRAITE_CATEGORY));
  } catch (err) {
    console.warn(`[outlook-client] list ${box} erreur : ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/** Récupère un message complet, corps en TEXTE (Prefer header). Lecture seule. */
export async function getMessageFull(box: OutlookBox, id: string): Promise<GraphMessage | null> {
  const token = await getAccessToken(box);
  if (!token) return null;
  const select =
    'id,conversationId,internetMessageId,subject,body,from,toRecipients,ccRecipients,receivedDateTime,webLink,categories,hasAttachments';
  try {
    const res = await fetch(`${GRAPH}/me/messages/${id}?$select=${select}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.body-content-type="text"',
      },
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[outlook-client] get ${box} ${id} HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as GraphMessage;
  } catch (err) {
    console.warn(`[outlook-client] get ${box} erreur : ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Marque un message traité (ajoute la catégorie Anya/traité). */
export async function addTraiteCategory(box: OutlookBox, id: string): Promise<boolean> {
  const token = await getAccessToken(box);
  if (!token) return false;
  try {
    // Lire les catégories existantes pour ne pas les écraser.
    const cur = await fetch(`${GRAPH}/me/messages/${id}?$select=categories`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    const existing = cur.ok ? (((await cur.json()) as GraphMessage).categories ?? []) : [];
    if (existing.includes(OUTLOOK_TRAITE_CATEGORY)) return true;
    const res = await fetch(`${GRAPH}/me/messages/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: [...existing, OUTLOOK_TRAITE_CATEGORY] }),
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    if (res.ok) console.warn(`[outlook-client] ${box} message ${id} marqué traité`);
    return res.ok;
  } catch (err) {
    console.warn(`[outlook-client] mark ${box} erreur : ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Vrai si le propriétaire a déjà répondu dans la conversation (un message du
 * dossier Éléments envoyés porte ce conversationId). Fail-open : false si KO.
 */
export async function conversationHasOwnerReply(
  box: OutlookBox,
  conversationId: string | undefined,
): Promise<boolean> {
  if (!conversationId) return false;
  const token = await getAccessToken(box);
  if (!token) return false;
  try {
    const url =
      `${GRAPH}/me/mailFolders('sentitems')/messages` +
      `?$select=id&$top=1&$filter=${encodeURIComponent(`conversationId eq '${conversationId}'`)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { value?: unknown[] };
    return (data.value ?? []).length > 0;
  } catch {
    return false;
  }
}

export interface OutlookDraftResult {
  success: boolean;
  draftId?: string;
  webLink?: string;
  error?: string;
}

/**
 * Crée un BROUILLON de réponse threadé (createReply), puis remplace le corps.
 *
 * 🔒 NE JAMAIS appeler /send ni /sendMail. createReply crée un brouillon dans
 * la conversation ; Thomas l'enverra manuellement depuis Outlook.
 */
export async function createReplyDraft(
  box: OutlookBox,
  messageId: string,
  body: string,
): Promise<OutlookDraftResult> {
  const token = await getAccessToken(box);
  if (!token) return { success: false, error: 'pas de token' };
  try {
    // 1. createReply → brouillon dans le fil.
    const replyRes = await fetch(`${GRAPH}/me/messages/${messageId}/createReply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    if (!replyRes.ok) {
      const t = await replyRes.text().catch(() => '');
      return { success: false, error: `createReply HTTP ${replyRes.status}: ${t.slice(0, 150)}` };
    }
    const draft = (await replyRes.json()) as { id?: string; webLink?: string };
    if (!draft.id) return { success: false, error: 'createReply sans id' };

    // 2. Remplacer le corps du brouillon par notre rédaction (texte).
    const patchRes = await fetch(`${GRAPH}/me/messages/${draft.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: { contentType: 'text', content: body } }),
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => '');
      return { success: false, error: `PATCH body HTTP ${patchRes.status}: ${t.slice(0, 150)}` };
    }
    console.warn(`[outlook-client] ${box} brouillon créé : draftId=${draft.id}`);
    return { success: true, draftId: draft.id, webLink: draft.webLink };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface ConnectivityResult {
  ok: boolean;
  email?: string;
  error?: string;
}

/**
 * Vérifie qu'une boîte est joignable : refresh token → access token → GET /me.
 * Lecture seule, aucun envoi.
 */
export async function checkConnectivity(box: OutlookBox): Promise<ConnectivityResult> {
  if (!isBoxConfigured(box)) {
    return { ok: false, error: 'config incomplète (creds ou refresh token manquant)' };
  }
  const token = await getAccessToken(box);
  if (!token) return { ok: false, error: 'échec refresh token' };

  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, error: `/me HTTP ${res.status}` };
    const me = (await res.json()) as { mail?: string; userPrincipalName?: string };
    return { ok: true, email: me.mail ?? me.userPrincipalName ?? '(inconnu)' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
