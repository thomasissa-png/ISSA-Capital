/**
 * State store calendar-ingest — _Inbox/AnyaState/calendar-ingest-state.json
 *
 * R5 (P0 #99) : édition fichier Drive existant = PATCH in-place via
 * `/upload/drive/v3/files/{fileId}?uploadType=media`. Jamais create+delete.
 *
 * Pattern aligné sur ticktick-sync/state-store.ts (S18.1).
 * Mutex en mémoire pour sérialiser accès concurrents.
 */

import {
  emptyCalendarIngestState,
  type CalendarIngestState,
} from './types';
import { getAccessToken, getOrCreateSubfolder } from '../drive-upload';
import { resolvePath } from '../vault-client/drive-resolver';

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;

const STATE_FOLDER = '_Inbox/AnyaState';
export const STATE_FILENAME = 'calendar-ingest-state.json';

// ============================================================
// Mutex
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
// Drive helpers
// ============================================================

async function resolveStateFolderId(
  accessToken: string,
): Promise<string | null> {
  const resolved = await resolvePath(STATE_FOLDER);
  if (resolved.success && resolved.fileId) return resolved.fileId;

  const inboxResult = await resolvePath('_Inbox');
  if (inboxResult.success && inboxResult.fileId) {
    return getOrCreateSubfolder(accessToken, inboxResult.fileId, 'AnyaState');
  }

  const fallbackInboxId = process.env.DRIVE_INBOX_FOLDER_ID;
  if (!fallbackInboxId) {
    console.warn(
      '[calendar-ingest-state] _Inbox introuvable + DRIVE_INBOX_FOLDER_ID absent',
    );
    return null;
  }
  return getOrCreateSubfolder(accessToken, fallbackInboxId, 'AnyaState');
}

async function findStateFileId(
  accessToken: string,
  folderId: string,
): Promise<string | null> {
  const q = `name='${STATE_FILENAME}' and '${folderId}' in parents and trashed=false`;
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
): Promise<CalendarIngestState> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    console.warn(
      `[calendar-ingest-state] lecture HTTP ${response.status} — reset`,
    );
    return emptyCalendarIngestState();
  }
  try {
    const data = (await response.json()) as Partial<CalendarIngestState>;
    if (data.version !== 1 || !data.processedEvents) {
      console.warn('[calendar-ingest-state] schéma inconnu — reset');
      return emptyCalendarIngestState();
    }
    return data as CalendarIngestState;
  } catch {
    console.warn('[calendar-ingest-state] JSON invalide — reset');
    return emptyCalendarIngestState();
  }
}

/** PATCH in-place R5 — préserve fileId. */
async function patchStateFile(
  accessToken: string,
  fileId: string,
  state: CalendarIngestState,
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
  state: CalendarIngestState,
): Promise<string | null> {
  const metadata = JSON.stringify({
    name: STATE_FILENAME,
    parents: [folderId],
    mimeType: 'application/json',
  });
  const boundary = '===issa_calendar_ingest_state===';
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

export async function loadCalendarIngestState(): Promise<CalendarIngestState> {
  return withStateLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[calendar-ingest-state] pas de token — state vide');
      return emptyCalendarIngestState();
    }
    const folderId = await resolveStateFolderId(accessToken);
    if (!folderId) return emptyCalendarIngestState();
    const fileId = await findStateFileId(accessToken, folderId);
    if (!fileId) return emptyCalendarIngestState();
    return readStateFile(accessToken, fileId);
  });
}

export async function saveCalendarIngestState(
  state: CalendarIngestState,
): Promise<boolean> {
  return withStateLock(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[calendar-ingest-state] pas de token — save skip');
      return false;
    }
    const folderId = await resolveStateFolderId(accessToken);
    if (!folderId) return false;

    const fileId = await findStateFileId(accessToken, folderId);
    if (fileId) {
      return patchStateFile(accessToken, fileId, state);
    }
    const newId = await createStateFile(accessToken, folderId, state);
    return newId !== null;
  });
}

// ============================================================
// Test helpers
// ============================================================

export function _resetCalendarIngestStateLockForTests(): void {
  currentLock = Promise.resolve();
}
