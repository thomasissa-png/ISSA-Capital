/**
 * Pending store CR write-back — persistance JSONL append-only sur Drive.
 *
 * Chemin Drive : `_Inbox/AnyaState/cr-writeback-pending.jsonl`
 *
 * Contexte (S25, P0 #1 — reprise secretariat) :
 *   Quand `writeBackCrToFiche` ne trouve pas la fiche Projet, on alerte Thomas
 *   par Telegram (déjà en place) ET on persiste un "pending" ici. Un cron
 *   (cron-cr-writeback-retry) rejoue chaque pending toutes les 2h, max 3 fois.
 *   Après 3 échecs → alerte critique + retrait du store (abandon propre).
 *
 * R5 (P0 #99) : édition fichier Drive existant = PATCH in-place via
 * `/upload/drive/v3/files/{fileId}?uploadType=media`. JAMAIS create+delete.
 * Mutex en mémoire (calqué sur ticktick-sync/state-store.ts S14).
 *
 * Format JSONL append-only : une entrée = une ligne JSON. Une ligne corrompue
 * est ignorée (warn) sans crasher la lecture — robuste face aux écritures
 * concurrentes interrompues.
 */

import { getAccessToken, getOrCreateSubfolder } from '../drive-upload';
import { resolvePath } from '../vault-client/drive-resolver';

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;

const STATE_FOLDER = '_Inbox/AnyaState';

/** Nom du fichier JSONL pending. */
export const PENDING_FILENAME = 'cr-writeback-pending.jsonl';

// ============================================================
// Types
// ============================================================

export interface PendingCrWritebackEntry {
  /** UUID unique de l'entrée (gen côté append). */
  id: string;
  /** Code entité (IC, GO, VI, VV...). */
  entiteCode: string;
  /** fileId Drive du PDF CR — nécessaire pour rejouer writeBackCrToFiche. */
  crFileId: string;
  /** Lien Google Drive webViewLink du PDF. */
  crWebViewLink: string;
  /** Nom de fichier du PDF. */
  crFilename: string;
  /** Date du CR au format YYYY-MM-DD. */
  crDate: string;
  /** Titre du CR. */
  crTitle: string;
  /** Liste optionnelle des participants (pour traçabilité). */
  participants?: string[];
  /** ISO 8601 de la création du pending. */
  createdAt: string;
  /** Nombre de tentatives effectuées (commence à 0). */
  attempts: number;
  /** Dernière erreur observée (si attempts > 0). */
  lastError?: string;
}

/** Payload accepté par appendPending — `id`, `createdAt`, `attempts` sont générés. */
export type AppendPendingInput = Omit<
  PendingCrWritebackEntry,
  'id' | 'createdAt' | 'attempts' | 'lastError'
>;

// ============================================================
// Mutex en mémoire (sérialise écritures Drive)
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
  if (resolved.success && resolved.fileId) {
    return resolved.fileId;
  }

  const inboxResult = await resolvePath('_Inbox');
  if (inboxResult.success && inboxResult.fileId) {
    return getOrCreateSubfolder(accessToken, inboxResult.fileId, 'AnyaState');
  }

  const fallbackInboxId = process.env.DRIVE_INBOX_FOLDER_ID;
  if (!fallbackInboxId) {
    console.warn(
      '[cr-writeback-pending] _Inbox introuvable + DRIVE_INBOX_FOLDER_ID absent',
    );
    return null;
  }
  return getOrCreateSubfolder(accessToken, fallbackInboxId, 'AnyaState');
}

async function findPendingFileId(
  accessToken: string,
  folderId: string,
): Promise<string | null> {
  const q = `name='${PENDING_FILENAME}' and '${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

async function readPendingFileRaw(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    console.warn(
      `[cr-writeback-pending] lecture HTTP ${response.status} — contenu vide`,
    );
    return '';
  }
  return response.text();
}

/** PATCH in-place R5 — préserve fileId. */
async function patchPendingFile(
  accessToken: string,
  fileId: string,
  content: string,
): Promise<boolean> {
  const url = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-ndjson',
    },
    body: content,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return response.ok;
}

async function createPendingFile(
  accessToken: string,
  folderId: string,
  content: string,
): Promise<string | null> {
  const metadata = JSON.stringify({
    name: PENDING_FILENAME,
    parents: [folderId],
    mimeType: 'application/x-ndjson',
  });

  const boundary = '===issa_cr_writeback_pending===';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/x-ndjson\r\n\r\n' +
    content +
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
// Parsing JSONL résilient
// ============================================================

/**
 * Parse un contenu JSONL en liste d'entrées valides.
 * Une ligne vide est ignorée. Une ligne corrompue (JSON invalide ou schéma
 * incomplet) est warn-loguée et ignorée — pas de throw.
 */
function parseJsonl(content: string): PendingCrWritebackEntry[] {
  if (!content) return [];
  const out: PendingCrWritebackEntry[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Partial<PendingCrWritebackEntry>;
      if (
        typeof parsed.id !== 'string' ||
        typeof parsed.entiteCode !== 'string' ||
        typeof parsed.crFileId !== 'string' ||
        typeof parsed.crWebViewLink !== 'string' ||
        typeof parsed.crFilename !== 'string' ||
        typeof parsed.crDate !== 'string' ||
        typeof parsed.crTitle !== 'string' ||
        typeof parsed.createdAt !== 'string' ||
        typeof parsed.attempts !== 'number'
      ) {
        console.warn(
          '[cr-writeback-pending] ligne ignorée (schéma incomplet)',
        );
        continue;
      }
      out.push(parsed as PendingCrWritebackEntry);
    } catch {
      console.warn('[cr-writeback-pending] ligne ignorée (JSON invalide)');
    }
  }
  return out;
}

/** Sérialise une liste d'entrées en JSONL (une ligne par entrée, \n final). */
function serializeJsonl(entries: PendingCrWritebackEntry[]): string {
  if (entries.length === 0) return '';
  return entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
}

// ============================================================
// Helpers Drive haut niveau
// ============================================================

interface DriveAccess {
  accessToken: string;
  folderId: string;
  fileId: string | null;
}

async function openDrive(): Promise<DriveAccess | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('[cr-writeback-pending] pas de token OAuth2');
    return null;
  }
  const folderId = await resolveStateFolderId(accessToken);
  if (!folderId) return null;
  const fileId = await findPendingFileId(accessToken, folderId);
  return { accessToken, folderId, fileId };
}

async function writePendingAll(
  access: DriveAccess,
  entries: PendingCrWritebackEntry[],
): Promise<boolean> {
  const content = serializeJsonl(entries);
  if (access.fileId) {
    return patchPendingFile(access.accessToken, access.fileId, content);
  }
  const newId = await createPendingFile(
    access.accessToken,
    access.folderId,
    content,
  );
  return newId !== null;
}

// ============================================================
// API publique
// ============================================================

/**
 * Ajoute une entrée pending au store. Génère `id` (UUID), `createdAt` (ISO)
 * et `attempts: 0`.
 *
 * Stratégie : lecture intégrale + concat + PATCH in-place (sous mutex).
 * On évite l'append HTTP partiel (Drive ne supporte pas de "append" natif).
 *
 * @returns true si l'écriture a réussi, false sinon (token absent, Drive KO).
 */
export async function appendPending(input: AppendPendingInput): Promise<boolean> {
  return withStateLock(async () => {
    try {
      const access = await openDrive();
      if (!access) return false;

      const existingRaw = access.fileId
        ? await readPendingFileRaw(access.accessToken, access.fileId)
        : '';
      const existing = parseJsonl(existingRaw);

      const entry: PendingCrWritebackEntry = {
        ...input,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        attempts: 0,
      };

      return writePendingAll(access, [...existing, entry]);
    } catch (err) {
      console.warn(
        `[cr-writeback-pending] appendPending échoué : ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  });
}

/**
 * Lit toutes les entrées pending du store.
 *
 * Robuste : fichier absent → []. Drive inaccessible → []. Lignes corrompues
 * ignorées (warn). Jamais de throw — utilisable directement depuis un cron.
 */
export async function readPending(): Promise<PendingCrWritebackEntry[]> {
  return withStateLock(async () => {
    try {
      const access = await openDrive();
      if (!access || !access.fileId) return [];
      const raw = await readPendingFileRaw(access.accessToken, access.fileId);
      return parseJsonl(raw);
    } catch (err) {
      console.warn(
        `[cr-writeback-pending] readPending échoué : ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  });
}

/**
 * Supprime l'entrée d'id donné (réécriture intégrale du fichier sans la ligne).
 *
 * @returns true si l'opération a réussi (que l'id ait existé ou non).
 */
export async function removePending(id: string): Promise<boolean> {
  return withStateLock(async () => {
    try {
      const access = await openDrive();
      if (!access) return false;
      if (!access.fileId) return true; // rien à supprimer

      const raw = await readPendingFileRaw(access.accessToken, access.fileId);
      const entries = parseJsonl(raw);
      const filtered = entries.filter((e) => e.id !== id);

      // Optimisation : si rien n'a changé, ne pas réécrire
      if (filtered.length === entries.length) return true;

      return writePendingAll(access, filtered);
    } catch (err) {
      console.warn(
        `[cr-writeback-pending] removePending échoué : ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  });
}

/**
 * Met à jour le compteur d'attempts et la dernière erreur d'une entrée.
 *
 * @returns true si l'entrée a été mise à jour, false sinon (id absent, Drive KO).
 */
export async function updatePendingAttempt(
  id: string,
  patch: { attempts: number; lastError?: string },
): Promise<boolean> {
  return withStateLock(async () => {
    try {
      const access = await openDrive();
      if (!access || !access.fileId) return false;

      const raw = await readPendingFileRaw(access.accessToken, access.fileId);
      const entries = parseJsonl(raw);

      let found = false;
      const updated = entries.map((e) => {
        if (e.id !== id) return e;
        found = true;
        return {
          ...e,
          attempts: patch.attempts,
          lastError: patch.lastError,
        };
      });

      if (!found) return false;

      return writePendingAll(access, updated);
    } catch (err) {
      console.warn(
        `[cr-writeback-pending] updatePendingAttempt échoué : ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  });
}

// ============================================================
// Test helpers
// ============================================================

/** Reset mutex en mémoire (tests). */
export function _resetPendingStoreLockForTests(): void {
  currentLock = Promise.resolve();
}

export const _internals = {
  parseJsonl,
  serializeJsonl,
  PENDING_FILENAME,
};
