/**
 * Handler Telegram — désambiguïsation projet calendar-ingest (refonte S23).
 *
 * Callback prefix : `calproj:`
 * Format : `calproj:<pendingId>:<code|none>`
 *
 * Quand un event matche 2+ projets (ambigu), le runner :
 *   1. marque l'event traité (contacts + todo déjà faits) — pas de blocage
 *   2. persiste un pending (TTL 7j R3) + envoie une carte avec un bouton par
 *      projet candidat + « Aucun »
 *   3. l'historique projet est écrit SEULEMENT quand Thomas clique un projet.
 *
 * R3 : TTL pending 7 jours (store Drive dédié `calproj-pendings.json`).
 * R4 : ce handler + dispatch webhook + test E2E (préfixe `calproj:`).
 * R5 : l'enrichissement historique projet passe par appendToHistorique (PATCH).
 */

import { getAccessToken } from '../../drive-upload';
import { getOrCreateSubfolder } from '../../drive-upload';
import { resolvePath } from '../../vault-client/drive-resolver';
import { answerCallbackQuery, sendTelegramMessageWithButtons } from '../../telegram';
import { editMessageText } from '../telegram-cards';
import { enrichProjetHistorique } from '../../calendar-ingest/projet-enricher';
import type { EventProjection } from '../../calendar-ingest/types';

// ============================================================
// Constantes
// ============================================================

export const CAL_PROJET_CALLBACK_PREFIX = 'calproj:';

/** TTL pending 7 jours (R3 — jamais < 7j). */
export const CAL_PROJET_PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;
const STATE_FOLDER = '_Inbox/AnyaState';
const STORE_FILENAME = 'calproj-pendings.json';
const STORE_VERSION = 1;

// ============================================================
// Types
// ============================================================

/** Pending de désambiguïsation projet (un event ambigu). */
export interface CalProjetPending {
  /** ID unique (= eventId, stable → idempotent si re-envoyé) */
  id: string;
  /** Codes entité candidats (2+) */
  candidateCodes: string[];
  /** Nom canonique par code (pour libellé bouton) */
  candidateNames: Record<string, string>;
  /** Projection event (pour enrichir l'historique au clic) */
  projection: EventProjection;
  /** message_id de la carte Telegram (pour edit au clic) */
  telegramMessageId?: number;
  /** Timestamp ISO de création */
  createdAt: string;
}

interface CalProjetStore {
  version: number;
  pendings: Record<string, CalProjetPending>;
}

// ============================================================
// Mutex
// ============================================================

let currentLock: Promise<void> = Promise.resolve();

async function withLock<T>(operation: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = currentLock;
  currentLock = next;
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

export function _resetCalProjetLockForTests(): void {
  currentLock = Promise.resolve();
}

// ============================================================
// Drive I/O
// ============================================================

async function resolveStateFolderId(accessToken: string): Promise<string | null> {
  const resolved = await resolvePath(STATE_FOLDER);
  if (resolved.success && resolved.fileId) return resolved.fileId;
  const inbox = await resolvePath('_Inbox');
  if (inbox.success && inbox.fileId) {
    return getOrCreateSubfolder(accessToken, inbox.fileId, 'AnyaState');
  }
  const fallback = process.env.DRIVE_INBOX_FOLDER_ID;
  if (!fallback) return null;
  return getOrCreateSubfolder(accessToken, fallback, 'AnyaState');
}

async function findStoreFileId(
  accessToken: string,
  folderId: string,
): Promise<string | null> {
  const q = `name='${STORE_FILENAME}' and '${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

async function readStore(accessToken: string, fileId: string): Promise<CalProjetStore> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { version: STORE_VERSION, pendings: {} };
  try {
    const data = (await res.json()) as CalProjetStore;
    if (!data.pendings) return { version: STORE_VERSION, pendings: {} };
    return data;
  } catch {
    return { version: STORE_VERSION, pendings: {} };
  }
}

async function writeStore(
  accessToken: string,
  fileId: string,
  store: CalProjetStore,
): Promise<boolean> {
  const url = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(store, null, 2),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return res.ok;
}

async function createStoreFile(
  accessToken: string,
  folderId: string,
  store: CalProjetStore,
): Promise<string | null> {
  const metadata = JSON.stringify({
    name: STORE_FILENAME,
    parents: [folderId],
    mimeType: 'application/json',
  });
  const boundary = '===issa_calproj_store===';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(store, null, 2) +
    `\r\n--${boundary}--`;
  const res = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

async function loadOrCreate(
  accessToken: string,
): Promise<{ store: CalProjetStore; fileId: string } | null> {
  const folderId = await resolveStateFolderId(accessToken);
  if (!folderId) return null;
  const existing = await findStoreFileId(accessToken, folderId);
  if (existing) return { store: await readStore(accessToken, existing), fileId: existing };
  const empty: CalProjetStore = { version: STORE_VERSION, pendings: {} };
  const newId = await createStoreFile(accessToken, folderId, empty);
  if (!newId) return null;
  return { store: empty, fileId: newId };
}

function purgeExpired(store: CalProjetStore): number {
  const now = Date.now();
  let purged = 0;
  for (const [id, p] of Object.entries(store.pendings)) {
    if (now - new Date(p.createdAt).getTime() > CAL_PROJET_PENDING_TTL_MS) {
      delete store.pendings[id];
      purged++;
    }
  }
  return purged;
}

// ============================================================
// Store — API
// ============================================================

export async function saveCalProjetPending(pending: CalProjetPending): Promise<boolean> {
  return withLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return false;
    const loaded = await loadOrCreate(accessToken);
    if (!loaded) return false;
    purgeExpired(loaded.store);
    loaded.store.pendings[pending.id] = pending;
    return writeStore(accessToken, loaded.fileId, loaded.store);
  });
}

export async function getCalProjetPending(id: string): Promise<CalProjetPending | null> {
  return withLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;
    const loaded = await loadOrCreate(accessToken);
    if (!loaded) return null;
    return loaded.store.pendings[id] ?? null;
  });
}

export async function deleteCalProjetPending(id: string): Promise<void> {
  await withLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const loaded = await loadOrCreate(accessToken);
    if (!loaded) return;
    if (!(id in loaded.store.pendings)) return;
    delete loaded.store.pendings[id];
    await writeStore(accessToken, loaded.fileId, loaded.store);
  });
}

// ============================================================
// Carte Telegram
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Construit le texte de la carte de désambiguïsation (texte brut).
 *
 * `sendTelegramMessageWithButtons` n'envoie pas `parse_mode: HTML` → on reste en
 * texte brut. L'échappement HTML est réservé aux confirmations via `editMessageText`
 * (qui, lui, est en HTML).
 */
export function buildCalProjetCardText(pending: CalProjetPending): string {
  const names = pending.candidateCodes
    .map((c) => pending.candidateNames[c] ?? c)
    .join(', ');
  return (
    `Réunion — projet à confirmer\n\n` +
    `Sujet : ${pending.projection.sujet}\n` +
    `Date : ${pending.projection.date}\n\n` +
    `Plusieurs projets détectés : ${names}.\n` +
    `Lequel rattacher à l'historique ?`
  );
}

/** Construit le clavier : un bouton par projet candidat + « Aucun ». */
export function buildCalProjetKeyboard(
  pending: CalProjetPending,
): Array<Array<{ text: string; callback_data: string }>> {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (const code of pending.candidateCodes) {
    const label = pending.candidateNames[code] ?? code;
    rows.push([
      {
        text: label,
        callback_data: `${CAL_PROJET_CALLBACK_PREFIX}${pending.id}:${code}`,
      },
    ]);
  }
  rows.push([
    {
      text: 'Aucun',
      callback_data: `${CAL_PROJET_CALLBACK_PREFIX}${pending.id}:none`,
    },
  ]);
  return rows;
}

/**
 * Envoie la carte de désambiguïsation à Thomas et persiste le pending (TTL 7j).
 *
 * @returns true si carte envoyée + pending persisté.
 */
export async function sendCalProjetCard(pending: CalProjetPending): Promise<boolean> {
  const chatIdStr = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!chatIdStr) {
    console.warn('[cal-projet-confirm] TELEGRAM_CHAT_ID_THOMAS manquant — carte skip');
    return false;
  }
  const chatId = parseInt(chatIdStr, 10);
  if (isNaN(chatId)) return false;

  const sent = await sendTelegramMessageWithButtons(
    chatId,
    buildCalProjetCardText(pending),
    buildCalProjetKeyboard(pending),
  );
  if (!sent.success) {
    console.warn(`[cal-projet-confirm] envoi carte échoué : ${sent.error ?? 'inconnu'}`);
    return false;
  }

  pending.telegramMessageId = sent.messageId;
  return saveCalProjetPending(pending);
}

// ============================================================
// Parsing callback
// ============================================================

export interface ParsedCalProjetCallback {
  pendingId: string;
  choice: string; // code entité ou 'none'
}

/** Format : `calproj:<pendingId>:<code|none>`. */
export function parseCalProjetCallback(data: string): ParsedCalProjetCallback | null {
  if (!data.startsWith(CAL_PROJET_CALLBACK_PREFIX)) return null;
  const rest = data.slice(CAL_PROJET_CALLBACK_PREFIX.length);
  const lastColon = rest.lastIndexOf(':');
  if (lastColon === -1) return null;
  const pendingId = rest.slice(0, lastColon);
  const choice = rest.slice(lastColon + 1);
  if (!pendingId || !choice) return null;
  return { pendingId, choice };
}

// ============================================================
// Callback handler
// ============================================================

export interface HandleCalProjetCallbackParams {
  callback_query_id: string;
  data: string;
  message_id: number;
  chat_id: number | string;
}

/**
 * Dispatch un callback `calproj:` :
 *   - choix d'un code → enrichit l'historique projet + supprime le pending
 *   - « none » → supprime le pending, pas d'historique
 *
 * @returns code court pour debug ('enriched' | 'none' | 'expired' | 'invalid' | 'error').
 */
export async function handleCalProjetCallback(
  params: HandleCalProjetCallbackParams,
): Promise<string> {
  const parsed = parseCalProjetCallback(params.data);
  if (!parsed) {
    await answerCallbackQuery(params.callback_query_id, 'Callback invalide');
    return 'invalid';
  }

  await answerCallbackQuery(
    params.callback_query_id,
    parsed.choice === 'none' ? 'Aucun projet' : 'Rattachement…',
  );

  const pending = await getCalProjetPending(parsed.pendingId);
  if (!pending) {
    await editMessageText(
      params.chat_id,
      params.message_id,
      'Demande introuvable ou expirée (TTL 7j dépassé).',
    );
    return 'expired';
  }

  // Choix « Aucun » → on ne rattache rien.
  if (parsed.choice === 'none') {
    await deleteCalProjetPending(parsed.pendingId);
    await editMessageText(
      params.chat_id,
      params.message_id,
      `Aucun projet rattaché — ${escapeHtml(pending.projection.sujet)}.`,
    );
    return 'none';
  }

  // Choix d'un code candidat.
  if (!pending.candidateCodes.includes(parsed.choice)) {
    await editMessageText(
      params.chat_id,
      params.message_id,
      'Choix invalide pour cette réunion.',
    );
    return 'invalid';
  }

  const result = await enrichProjetHistorique(
    parsed.choice,
    pending.projection,
    pending.id,
  );

  if (result.status === 'enriched') {
    await deleteCalProjetPending(parsed.pendingId);
    await editMessageText(
      params.chat_id,
      params.message_id,
      `Historique projet mis à jour : ${escapeHtml(result.ficheName ?? parsed.choice)}.`,
    );
    return 'enriched';
  }

  // no-fiche ou error : on garde le pending (retry possible) + message clair.
  await editMessageText(
    params.chat_id,
    params.message_id,
    result.status === 'no-fiche'
      ? `Fiche projet introuvable pour ${escapeHtml(parsed.choice)} — rien écrit.`
      : `Échec mise à jour historique : ${escapeHtml(result.error ?? 'erreur')}.`,
  );
  if (result.status === 'no-fiche') {
    await deleteCalProjetPending(parsed.pendingId);
  }
  return 'error';
}
