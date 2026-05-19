/**
 * State store hot-context — persistance JSON dans Drive.
 *
 * Chemin Drive : `_Inbox/AnyaState/hot-context-state.json`
 * Format : voir `HotContextState` dans `types.ts`.
 *
 * R5 (P0 #99) : édition fichier Drive existant = PATCH in-place via
 * `/upload/drive/v3/files/{fileId}?uploadType=media`. Jamais create+delete.
 *
 * Mutex en mémoire pour sérialiser les accès — pattern identique à
 * `ticktick-sync/state-store.ts` (S18.1) et `pending-store.ts` (S14).
 */

import { emptyHotContextState, type HotContextState } from './types';
import { getAccessToken, getOrCreateSubfolder } from '../drive-upload';
import { resolvePath } from '../vault-client/drive-resolver';

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;

/** Dossier Drive logique. */
const STATE_FOLDER = '_Inbox/AnyaState';

/** Nom du fichier JSON state. */
export const HOT_CONTEXT_STATE_FILENAME = 'hot-context-state.json';

// ============================================================
// Mutex en mémoire
// ============================================================

let currentLock: Promise<void> = Promise.resolve();

async function withStateLock<T>(operation: () => Promise<T>): Promise<T> {
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

// ============================================================
// Drive I/O — utilitaires
// ============================================================

async function resolveStateFolderId(accessToken: string): Promise<string | null> {
  const resolved = await resolvePath(STATE_FOLDER);
  if (resolved.success && resolved.fileId) return resolved.fileId;

  const inboxResult = await resolvePath('_Inbox');
  if (inboxResult.success && inboxResult.fileId) {
    return getOrCreateSubfolder(accessToken, inboxResult.fileId, 'AnyaState');
  }

  const fallbackInboxId = process.env.DRIVE_INBOX_FOLDER_ID;
  if (!fallbackInboxId) {
    console.warn('[hot-context-state] _Inbox introuvable + DRIVE_INBOX_FOLDER_ID absent');
    return null;
  }
  return getOrCreateSubfolder(accessToken, fallbackInboxId, 'AnyaState');
}

async function findStateFileId(
  accessToken: string,
  folderId: string,
): Promise<string | null> {
  const q = `name='${HOT_CONTEXT_STATE_FILENAME}' and '${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

async function readStateFile(
  accessToken: string,
  fileId: string,
): Promise<HotContextState> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    console.warn(`[hot-context-state] lecture HTTP ${response.status} — reset`);
    return emptyHotContextState();
  }
  try {
    const data = (await response.json()) as Partial<HotContextState>;
    if (
      data.schemaVersion !== 1 ||
      !data.processedSignals ||
      !data.pendingPatches ||
      !data.lastScanAt
    ) {
      console.warn('[hot-context-state] schéma inconnu — reset');
      return emptyHotContextState();
    }
    return data as HotContextState;
  } catch {
    console.warn('[hot-context-state] JSON invalide — reset');
    return emptyHotContextState();
  }
}

/** PATCH in-place R5 — préserve fileId. */
async function patchStateFile(
  accessToken: string,
  fileId: string,
  state: HotContextState,
): Promise<boolean> {
  const url = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(state, null, 2),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return response.ok;
}

async function createStateFile(
  accessToken: string,
  folderId: string,
  state: HotContextState,
): Promise<string | null> {
  const metadata = JSON.stringify({
    name: HOT_CONTEXT_STATE_FILENAME,
    parents: [folderId],
    mimeType: 'application/json',
  });
  const boundary = '===issa_hot_context_state===';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(state, null, 2) +
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

// ============================================================
// API publique
// ============================================================

/**
 * Lit le state depuis Drive. Retourne `emptyHotContextState()` si absent.
 * Pas de cache mémoire — sécurité atomique cron 5min.
 */
export async function loadHotContextState(): Promise<HotContextState> {
  return withStateLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[hot-context-state] pas de token OAuth2 — state vide');
      return emptyHotContextState();
    }
    const folderId = await resolveStateFolderId(accessToken);
    if (!folderId) return emptyHotContextState();
    const fileId = await findStateFileId(accessToken, folderId);
    if (!fileId) return emptyHotContextState();
    return readStateFile(accessToken, fileId);
  });
}

/**
 * Sauvegarde le state dans Drive. PATCH in-place si fichier existe (R5),
 * sinon CREATE.
 *
 * @returns true si l'opération a réussi
 */
export async function saveHotContextState(state: HotContextState): Promise<boolean> {
  return withStateLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[hot-context-state] pas de token OAuth2 — save skip');
      return false;
    }
    const folderId = await resolveStateFolderId(accessToken);
    if (!folderId) return false;
    const fileId = await findStateFileId(accessToken, folderId);
    if (fileId) return patchStateFile(accessToken, fileId, state);
    const newId = await createStateFile(accessToken, folderId, state);
    return newId !== null;
  });
}

// ============================================================
// Test helpers
// ============================================================

/** Reset mutex en mémoire (tests). */
export function _resetHotContextLockForTests(): void {
  currentLock = Promise.resolve();
}
