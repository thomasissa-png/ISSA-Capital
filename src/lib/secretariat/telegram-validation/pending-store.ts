/**
 * Stockage des pending validations email-ingest dans Google Drive.
 *
 * Chemin Drive : _Inbox/AnyaState/pending-validations.json
 * Format : { version, pendings: { [uuid]: PendingValidation } }
 *
 * Mutex en mémoire pour sérialiser les accès au même fichier Drive.
 * purgeExpired retire les entrées > 7j (appelée automatiquement dans savePending).
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md section Jalon 4B.
 */

import type { PendingValidation } from './telegram-cards';
import type { NoMatchPending } from './no-match-card';
import type { WhatsappNoMatchPending } from './whatsapp-no-match-card';
import { getAccessToken } from '../drive-upload';
import { resolvePath } from '../vault-client/drive-resolver';
import { getOrCreateSubfolder } from '../drive-upload';

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;

/** Dossier Drive pour l'état Anya */
const STATE_FOLDER = '_Inbox/AnyaState';

/** Nom du fichier JSON de stockage */
const STORE_FILENAME = 'pending-validations.json';

/** Durée de vie max d'un pending (7 jours — usage humain : week-end, vacances) */
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

/** Version du format de stockage */
const STORE_VERSION = '2026-05-13';

// ============================================================
// Types internes
// ============================================================

interface PendingStore {
  version: string;
  pendings: Record<string, PendingValidation>;
}

// ============================================================
// Mutex en mémoire — sérialise les accès au fichier Drive
// ============================================================

let currentLock: Promise<void> = Promise.resolve();

/**
 * Sérialise les opérations sur le fichier pending-validations.json.
 * Chaque opération attend la fin de la précédente.
 */
async function withStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  let releaseLock: () => void;
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  const previousLock = currentLock;
  currentLock = newLock;

  await previousLock;

  try {
    return await operation();
  } finally {
    releaseLock!();
  }
}

// ============================================================
// Drive I/O
// ============================================================

/**
 * Résout ou crée le dossier AnyaState dans _Inbox.
 */
async function resolveStateFolderId(
  accessToken: string,
): Promise<string | null> {
  // Essayer le drive-resolver d'abord
  const resolved = await resolvePath(STATE_FOLDER);
  if (resolved.success && resolved.fileId) {
    return resolved.fileId;
  }

  // Créer le dossier si inexistant
  const inboxResult = await resolvePath('_Inbox');
  if (!inboxResult.success || !inboxResult.fileId) {
    const inboxId = process.env.DRIVE_INBOX_FOLDER_ID;
    if (!inboxId) {
      console.warn('[pending-store] ni _Inbox résolvable ni DRIVE_INBOX_FOLDER_ID configuré');
      return null;
    }
    return getOrCreateSubfolder(accessToken, inboxId, 'AnyaState');
  }

  return getOrCreateSubfolder(accessToken, inboxResult.fileId, 'AnyaState');
}

/**
 * Cherche le fichier pending-validations.json dans AnyaState.
 */
async function findStoreFileId(
  accessToken: string,
  folderId: string,
): Promise<string | null> {
  const q = `name='${STORE_FILENAME}' and '${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    files?: Array<{ id: string }>;
  };

  return data.files?.[0]?.id ?? null;
}

/**
 * Lit le contenu du store depuis Drive.
 */
async function readStore(
  accessToken: string,
  fileId: string,
): Promise<PendingStore> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    console.warn(`[pending-store] lecture échouée HTTP ${response.status}`);
    return { version: STORE_VERSION, pendings: {} };
  }

  try {
    const data = (await response.json()) as PendingStore;
    return data;
  } catch {
    console.warn('[pending-store] JSON invalide dans le store — reset');
    return { version: STORE_VERSION, pendings: {} };
  }
}

/**
 * Écrit le store complet sur Drive (update fichier existant).
 */
async function writeStore(
  accessToken: string,
  fileId: string,
  store: PendingStore,
): Promise<boolean> {
  const url = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(store, null, 2),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  return response.ok;
}

/**
 * Crée le fichier store sur Drive.
 */
async function createStoreFile(
  accessToken: string,
  folderId: string,
  store: PendingStore,
): Promise<string | null> {
  const metadata = JSON.stringify({
    name: STORE_FILENAME,
    parents: [folderId],
    mimeType: 'application/json',
  });

  const boundary = '===issa_pending_store===';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(store, null, 2) +
    `\r\n--${boundary}--`;

  const response = await fetch(
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

  if (!response.ok) return null;

  const data = (await response.json()) as { id?: string };
  return data.id ?? null;
}

/**
 * Charge le store depuis Drive, ou crée le fichier si inexistant.
 * Retourne { store, fileId } pour les opérations de lecture/écriture.
 */
async function loadOrCreateStore(
  accessToken: string,
): Promise<{ store: PendingStore; fileId: string } | null> {
  const folderId = await resolveStateFolderId(accessToken);
  if (!folderId) {
    console.warn('[pending-store] impossible de résoudre le dossier AnyaState');
    return null;
  }

  const existingFileId = await findStoreFileId(accessToken, folderId);

  if (existingFileId) {
    const store = await readStore(accessToken, existingFileId);
    return { store, fileId: existingFileId };
  }

  // Créer le fichier
  const emptyStore: PendingStore = { version: STORE_VERSION, pendings: {} };
  const newFileId = await createStoreFile(accessToken, folderId, emptyStore);
  if (!newFileId) {
    console.warn('[pending-store] impossible de créer le fichier store');
    return null;
  }

  return { store: emptyStore, fileId: newFileId };
}

// ============================================================
// API publique
// ============================================================

/**
 * Sauvegarde un pending dans le store Drive.
 * Purge automatiquement les entrées expirées avant l'ajout.
 */
export async function savePending(pending: PendingValidation): Promise<void> {
  await withStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[pending-store] savePending : pas de token OAuth2');
      return;
    }

    const result = await loadOrCreateStore(accessToken);
    if (!result) return;

    const { store, fileId } = result;

    // Purge des expirés avant ajout
    const now = Date.now();
    let purgedCount = 0;
    for (const [id, p] of Object.entries(store.pendings)) {
      if (now - new Date(p.createdAt).getTime() > PENDING_TTL_MS) {
        delete store.pendings[id];
        purgedCount++;
      }
    }
    if (purgedCount > 0) {
      console.warn(`[pending-store] purgé ${purgedCount} entrée(s) expirée(s)`);
    }

    // Ajouter le nouveau pending
    store.pendings[pending.id] = pending;

    const success = await writeStore(accessToken, fileId, store);
    if (!success) {
      console.warn(`[pending-store] écriture échouée pour pending ${pending.id}`);
    }
  });
}

/**
 * Récupère un pending par son ID.
 * @returns Le pending ou null si inexistant/expiré.
 */
export async function getPending(id: string): Promise<PendingValidation | null> {
  return withStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    const result = await loadOrCreateStore(accessToken);
    if (!result) return null;

    return result.store.pendings[id] ?? null;
  });
}

/**
 * Supprime un pending du store.
 */
export async function deletePending(id: string): Promise<void> {
  await withStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const result = await loadOrCreateStore(accessToken);
    if (!result) return;

    const { store, fileId } = result;

    if (!(id in store.pendings)) return;

    delete store.pendings[id];
    await writeStore(accessToken, fileId, store);
  });
}

/**
 * Purge les entrées expirées (> 7j) du store.
 * @returns Nombre d'entrées purgées.
 */
export async function purgeExpired(): Promise<number> {
  return withStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return 0;

    const result = await loadOrCreateStore(accessToken);
    if (!result) return 0;

    const { store, fileId } = result;
    const now = Date.now();
    let purgedCount = 0;

    for (const [id, p] of Object.entries(store.pendings)) {
      if (now - new Date(p.createdAt).getTime() > PENDING_TTL_MS) {
        delete store.pendings[id];
        purgedCount++;
      }
    }

    if (purgedCount > 0) {
      await writeStore(accessToken, fileId, store);
      console.warn(`[pending-store] purgeExpired : ${purgedCount} entrée(s) supprimée(s)`);
    }

    return purgedCount;
  });
}

/**
 * Liste tous les pendings actifs (non expirés).
 */
export async function listAllPending(): Promise<PendingValidation[]> {
  return withStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return [];

    const result = await loadOrCreateStore(accessToken);
    if (!result) return [];

    return Object.values(result.store.pendings);
  });
}

// ============================================================
// NoMatch store — Jalon 4D-2
// ============================================================

/** Nom du fichier JSON de stockage no-match */
const NOMATCH_STORE_FILENAME = 'nomatch-pendings.json';

interface NoMatchStore {
  version: string;
  pendings: Record<string, NoMatchPending>;
}

/** Mutex séparé pour le store no-match */
let currentNoMatchLock: Promise<void> = Promise.resolve();

async function withNoMatchStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  let releaseLock: () => void;
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  const previousLock = currentNoMatchLock;
  currentNoMatchLock = newLock;

  await previousLock;

  try {
    return await operation();
  } finally {
    releaseLock!();
  }
}

/**
 * Cherche le fichier nomatch-pendings.json dans AnyaState.
 */
async function findNoMatchStoreFileId(
  accessToken: string,
  folderId: string,
): Promise<string | null> {
  const q = `name='${NOMATCH_STORE_FILENAME}' and '${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    files?: Array<{ id: string }>;
  };

  return data.files?.[0]?.id ?? null;
}

/**
 * Lit le contenu du store no-match depuis Drive.
 */
async function readNoMatchStore(
  accessToken: string,
  fileId: string,
): Promise<NoMatchStore> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    console.warn(`[pending-store] lecture no-match échouée HTTP ${response.status}`);
    return { version: STORE_VERSION, pendings: {} };
  }

  try {
    const data = (await response.json()) as NoMatchStore;
    return data;
  } catch {
    console.warn('[pending-store] JSON no-match invalide dans le store — reset');
    return { version: STORE_VERSION, pendings: {} };
  }
}

/**
 * Écrit le store no-match complet sur Drive.
 */
async function writeNoMatchStore(
  accessToken: string,
  fileId: string,
  store: NoMatchStore,
): Promise<boolean> {
  const url = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(store, null, 2),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  return response.ok;
}

/**
 * Crée le fichier store no-match sur Drive.
 */
async function createNoMatchStoreFile(
  accessToken: string,
  folderId: string,
  store: NoMatchStore,
): Promise<string | null> {
  const metadata = JSON.stringify({
    name: NOMATCH_STORE_FILENAME,
    parents: [folderId],
    mimeType: 'application/json',
  });

  const boundary = '===issa_nomatch_store===';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(store, null, 2) +
    `\r\n--${boundary}--`;

  const response = await fetch(
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

  if (!response.ok) return null;

  const data = (await response.json()) as { id?: string };
  return data.id ?? null;
}

/**
 * Charge le store no-match depuis Drive, ou crée le fichier si inexistant.
 */
async function loadOrCreateNoMatchStore(
  accessToken: string,
): Promise<{ store: NoMatchStore; fileId: string } | null> {
  const folderId = await resolveStateFolderId(accessToken);
  if (!folderId) {
    console.warn('[pending-store] impossible de résoudre le dossier AnyaState pour no-match');
    return null;
  }

  const existingFileId = await findNoMatchStoreFileId(accessToken, folderId);

  if (existingFileId) {
    const store = await readNoMatchStore(accessToken, existingFileId);
    return { store, fileId: existingFileId };
  }

  // Créer le fichier
  const emptyStore: NoMatchStore = { version: STORE_VERSION, pendings: {} };
  const newFileId = await createNoMatchStoreFile(accessToken, folderId, emptyStore);
  if (!newFileId) {
    console.warn('[pending-store] impossible de créer le fichier no-match store');
    return null;
  }

  return { store: emptyStore, fileId: newFileId };
}

// ============================================================
// API publique — NoMatch
// ============================================================

/**
 * Sauvegarde un NoMatchPending dans le store Drive.
 * Purge automatiquement les entrées expirées avant l'ajout.
 */
export async function saveNoMatch(noMatch: NoMatchPending): Promise<void> {
  await withNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[pending-store] saveNoMatch : pas de token OAuth2');
      return;
    }

    const result = await loadOrCreateNoMatchStore(accessToken);
    if (!result) return;

    const { store, fileId } = result;

    // Purge des expirés avant ajout
    const now = Date.now();
    let purgedCount = 0;
    for (const [id, p] of Object.entries(store.pendings)) {
      if (now - new Date(p.createdAt).getTime() > PENDING_TTL_MS) {
        delete store.pendings[id];
        purgedCount++;
      }
    }
    if (purgedCount > 0) {
      console.warn(`[pending-store] purgé ${purgedCount} no-match entrée(s) expirée(s)`);
    }

    // Ajouter le nouveau no-match
    store.pendings[noMatch.id] = noMatch;

    const success = await writeNoMatchStore(accessToken, fileId, store);
    if (!success) {
      console.warn(`[pending-store] écriture échouée pour no-match ${noMatch.id}`);
    }
  });
}

/**
 * Récupère un NoMatchPending par son ID.
 * @returns Le no-match ou null si inexistant/expiré.
 */
export async function getNoMatch(id: string): Promise<NoMatchPending | null> {
  return withNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;

    const result = await loadOrCreateNoMatchStore(accessToken);
    if (!result) return null;

    return result.store.pendings[id] ?? null;
  });
}

/** Cherche un NoMatchPending par cardMessageId (reply Telegram → contexte, S24 soir). */
export async function findNoMatchByCardMessageId(
  messageId: number,
): Promise<NoMatchPending | null> {
  return withNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;
    const result = await loadOrCreateNoMatchStore(accessToken);
    if (!result) return null;
    for (const p of Object.values(result.store.pendings)) {
      if (p.cardMessageId === messageId) return p;
    }
    return null;
  });
}

/** Met à jour le userContext d'un NoMatchPending (S24 soir). */
export async function updateNoMatchUserContext(
  id: string,
  userContext: string,
): Promise<boolean> {
  return withNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return false;
    const result = await loadOrCreateNoMatchStore(accessToken);
    if (!result) return false;
    const { store, fileId } = result;
    const existing = store.pendings[id];
    if (!existing) return false;
    store.pendings[id] = { ...existing, userContext };
    return writeNoMatchStore(accessToken, fileId, store);
  });
}

/**
 * Liste tous les NoMatchPending actifs (non expirés), triés du plus récent
 * au plus ancien. Utilisé par la commande `/pending` (S24 nuit).
 */
export async function listActiveNoMatch(): Promise<NoMatchPending[]> {
  return withNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return [];
    const result = await loadOrCreateNoMatchStore(accessToken);
    if (!result) return [];
    const now = Date.now();
    return Object.values(result.store.pendings)
      .filter((p) => now - new Date(p.createdAt).getTime() <= PENDING_TTL_MS)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });
}

/**
 * Supprime un NoMatchPending du store.
 */
export async function deleteNoMatch(id: string): Promise<void> {
  await withNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const result = await loadOrCreateNoMatchStore(accessToken);
    if (!result) return;

    const { store, fileId } = result;

    if (!(id in store.pendings)) return;

    delete store.pendings[id];
    await writeNoMatchStore(accessToken, fileId, store);
  });
}

/**
 * Purge les entrées no-match expirées (> 7j).
 * @returns Nombre d'entrées purgées.
 */
export async function purgeExpiredNoMatch(): Promise<number> {
  return withNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return 0;

    const result = await loadOrCreateNoMatchStore(accessToken);
    if (!result) return 0;

    const { store, fileId } = result;
    const now = Date.now();
    let purgedCount = 0;

    for (const [id, p] of Object.entries(store.pendings)) {
      if (now - new Date(p.createdAt).getTime() > PENDING_TTL_MS) {
        delete store.pendings[id];
        purgedCount++;
      }
    }

    if (purgedCount > 0) {
      await writeNoMatchStore(accessToken, fileId, store);
      console.warn(`[pending-store] purgeExpiredNoMatch : ${purgedCount} entrée(s) supprimée(s)`);
    }

    return purgedCount;
  });
}

// ============================================================
// Store WhatsApp no-match (S24 soir)
// — pattern identique au no-match email, fichier Drive distinct
// ============================================================

const WA_NOMATCH_STORE_FILENAME = 'whatsapp-nomatch-pendings.json';

interface WhatsappNoMatchStore {
  version: string;
  pendings: Record<string, WhatsappNoMatchPending>;
}

let currentWaNoMatchLock: Promise<void> = Promise.resolve();

async function withWaNoMatchStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  let releaseLock: () => void;
  const newLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const previousLock = currentWaNoMatchLock;
  currentWaNoMatchLock = newLock;
  await previousLock;
  try {
    return await operation();
  } finally {
    releaseLock!();
  }
}

async function findWaNoMatchStoreFileId(
  accessToken: string,
  folderId: string,
): Promise<string | null> {
  const q = `name='${WA_NOMATCH_STORE_FILENAME}' and '${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

async function readWaNoMatchStore(
  accessToken: string,
  fileId: string,
): Promise<WhatsappNoMatchStore> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    console.warn(`[pending-store] lecture wa-nomatch échouée HTTP ${response.status}`);
    return { version: STORE_VERSION, pendings: {} };
  }
  try {
    return (await response.json()) as WhatsappNoMatchStore;
  } catch {
    console.warn('[pending-store] JSON wa-nomatch invalide — reset');
    return { version: STORE_VERSION, pendings: {} };
  }
}

async function writeWaNoMatchStore(
  accessToken: string,
  fileId: string,
  store: WhatsappNoMatchStore,
): Promise<boolean> {
  const url = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(store, null, 2),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return response.ok;
}

async function createWaNoMatchStoreFile(
  accessToken: string,
  folderId: string,
  store: WhatsappNoMatchStore,
): Promise<string | null> {
  const metadata = JSON.stringify({
    name: WA_NOMATCH_STORE_FILENAME,
    parents: [folderId],
    mimeType: 'application/json',
  });
  const boundary = '===issa_wa_nomatch_store===';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(store, null, 2) +
    `\r\n--${boundary}--`;
  const response = await fetch(
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
  if (!response.ok) return null;
  const data = (await response.json()) as { id?: string };
  return data.id ?? null;
}

async function loadOrCreateWaNoMatchStore(
  accessToken: string,
): Promise<{ store: WhatsappNoMatchStore; fileId: string } | null> {
  const folderId = await resolveStateFolderId(accessToken);
  if (!folderId) {
    console.warn('[pending-store] impossible de résoudre AnyaState pour wa-nomatch');
    return null;
  }
  const existingFileId = await findWaNoMatchStoreFileId(accessToken, folderId);
  if (existingFileId) {
    const store = await readWaNoMatchStore(accessToken, existingFileId);
    return { store, fileId: existingFileId };
  }
  const emptyStore: WhatsappNoMatchStore = { version: STORE_VERSION, pendings: {} };
  const newFileId = await createWaNoMatchStoreFile(accessToken, folderId, emptyStore);
  if (!newFileId) {
    console.warn('[pending-store] impossible de créer le fichier wa-nomatch store');
    return null;
  }
  return { store: emptyStore, fileId: newFileId };
}

/** Sauvegarde un WhatsappNoMatchPending dans le store Drive (purge expirés). */
export async function saveWhatsappNoMatch(noMatch: WhatsappNoMatchPending): Promise<void> {
  await withWaNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[pending-store] saveWhatsappNoMatch : pas de token OAuth2');
      return;
    }
    const result = await loadOrCreateWaNoMatchStore(accessToken);
    if (!result) return;
    const { store, fileId } = result;

    const now = Date.now();
    let purgedCount = 0;
    for (const [id, p] of Object.entries(store.pendings)) {
      if (now - new Date(p.createdAt).getTime() > PENDING_TTL_MS) {
        delete store.pendings[id];
        purgedCount++;
      }
    }
    if (purgedCount > 0) {
      console.warn(`[pending-store] purgé ${purgedCount} wa-nomatch entrée(s) expirée(s)`);
    }

    store.pendings[noMatch.id] = noMatch;
    const success = await writeWaNoMatchStore(accessToken, fileId, store);
    if (!success) {
      console.warn(`[pending-store] écriture échouée pour wa-nomatch ${noMatch.id}`);
    }
  });
}

/** Récupère un WhatsappNoMatchPending par ID. */
export async function getWhatsappNoMatch(id: string): Promise<WhatsappNoMatchPending | null> {
  return withWaNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;
    const result = await loadOrCreateWaNoMatchStore(accessToken);
    if (!result) return null;
    return result.store.pendings[id] ?? null;
  });
}

/** Cherche un WhatsappNoMatchPending par cardMessageId (utile au reply Telegram, PR B). */
export async function findWhatsappNoMatchByCardMessageId(
  messageId: number,
): Promise<WhatsappNoMatchPending | null> {
  return withWaNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return null;
    const result = await loadOrCreateWaNoMatchStore(accessToken);
    if (!result) return null;
    for (const p of Object.values(result.store.pendings)) {
      if (p.cardMessageId === messageId) return p;
    }
    return null;
  });
}

/** Met à jour le userContext d'un WhatsappNoMatchPending (utilisé par PR B). */
export async function updateWhatsappNoMatchUserContext(
  id: string,
  userContext: string,
): Promise<boolean> {
  return withWaNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return false;
    const result = await loadOrCreateWaNoMatchStore(accessToken);
    if (!result) return false;
    const { store, fileId } = result;
    const existing = store.pendings[id];
    if (!existing) return false;
    store.pendings[id] = { ...existing, userContext };
    return writeWaNoMatchStore(accessToken, fileId, store);
  });
}

/** Supprime un WhatsappNoMatchPending du store. */
/**
 * Liste tous les WhatsappNoMatchPending actifs (non expirés). Pour `/pending`.
 */
export async function listActiveWhatsappNoMatch(): Promise<WhatsappNoMatchPending[]> {
  return withWaNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return [];
    const result = await loadOrCreateWaNoMatchStore(accessToken);
    if (!result) return [];
    const now = Date.now();
    return Object.values(result.store.pendings)
      .filter((p) => now - new Date(p.createdAt).getTime() <= PENDING_TTL_MS)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });
}

export async function deleteWhatsappNoMatch(id: string): Promise<void> {
  await withWaNoMatchStoreLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;
    const result = await loadOrCreateWaNoMatchStore(accessToken);
    if (!result) return;
    const { store, fileId } = result;
    if (!(id in store.pendings)) return;
    delete store.pendings[id];
    await writeWaNoMatchStore(accessToken, fileId, store);
  });
}

// ============================================================
// Test helpers
// ============================================================

/**
 * Remet les mutex à zéro. Uniquement pour les tests.
 * En production, les opérations en cours seraient perdues.
 */
export function _resetLockForTests(): void {
  currentLock = Promise.resolve();
  currentNoMatchLock = Promise.resolve();
  currentWaNoMatchLock = Promise.resolve();
}
