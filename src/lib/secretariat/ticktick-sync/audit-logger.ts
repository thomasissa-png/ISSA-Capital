/**
 * Audit logger sync vault ↔ TickTick (red line spec §9.4).
 *
 * Chaque opération sync (push/pull/project create/delete prompt) est loggée
 * en append-only dans un fichier JSONL daté :
 *
 *   `_Inbox/AnyaLogs/ticktick-sync-YYYY-MM-DD.jsonl`
 *
 * Format JSONL strict (1 entrée = 1 ligne JSON minifiée + `\n`).
 *
 * Red lines :
 *   - R5 (P0 #99) : PATCH in-place via updateFileContent. Jamais create+delete.
 *     Si le fichier du jour n'existe pas, il est créé une seule fois via
 *     uploadToInbox.
 *   - **L'audit ne doit JAMAIS bloquer le pipeline sync.** Toutes les erreurs
 *     sont warn console, jamais throw. Si Drive est down, on continue.
 *   - R7 : pas de hardcoded fileId. On résout via vault-paths.ts + Drive
 *     resolver. fileId du jour mis en cache mémoire (clé = date).
 *
 * Concurrence : mutex mémoire (cf. state-store.ts) pour sérialiser les
 * append au sein du même process. Si plusieurs process tournent en parallèle
 * (cron push + cron pull), le PATCH Drive est atomique côté Google : pas de
 * perte mais possible race sur le contenu. C'est acceptable pour un log.
 */

import { updateFileContent, getAccessToken, uploadToInbox, getOrCreateSubfolder } from '../drive-upload';
import { resolvePath } from '../vault-client/drive-resolver';
import { VAULT_PATHS } from '../handlers/vault-paths';

// ============================================================
// Types publics
// ============================================================

export type SyncDirection = 'push' | 'pull';
export type SyncOp =
  | 'create'
  | 'update'
  | 'complete'
  | 'delete'
  | 'recreate'
  | 'skip'
  | 'conflict-resolved'
  | 'delete-prompt'
  | 'project-create';

export interface AuditEntry {
  /** ISO timestamp UTC */
  timestamp: string;
  direction: SyncDirection;
  op: SyncOp;
  ticktickId?: string;
  vaultPath?: string;
  lineNumber?: number;
  vaultHash?: string;
  status: 'success' | 'error' | 'skipped';
  errorMessage?: string;
  details?: Record<string, unknown>;
}

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const TIMEOUT_MS = 10_000;

/** Dossier Drive logique pour les logs audit (R7 via vault-paths). */
const LOGS_FOLDER = VAULT_PATHS.inboxAnyaLogs; // "_Inbox/AnyaLogs"

// ============================================================
// Cache fileId du jour
// ============================================================

interface CachedFileId {
  /** Clé : YYYY-MM-DD UTC */
  date: string;
  fileId: string;
}

let cachedFileIdOfDay: CachedFileId | null = null;

/** Reset cache (tests uniquement). */
export function _resetAuditLoggerCacheForTests(): void {
  cachedFileIdOfDay = null;
  currentLock = Promise.resolve();
}

// ============================================================
// Mutex mémoire — sérialise les écritures dans le même process
// ============================================================

let currentLock: Promise<void> = Promise.resolve();

async function withAuditLock<T>(operation: () => Promise<T>): Promise<T> {
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
// Helpers internes
// ============================================================

/** Retourne la date du jour au format YYYY-MM-DD UTC. */
function todayUtcKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Nom du fichier JSONL du jour. */
function filenameForDay(dateKey: string): string {
  return `ticktick-sync-${dateKey}.jsonl`;
}

/** Sérialise une entrée en ligne JSONL (minifiée + \n). */
export function serializeEntry(entry: AuditEntry): string {
  return JSON.stringify(entry) + '\n';
}

/** Parse un buffer JSONL en entries. Ligne invalide → skip + warn. */
export function parseJsonlBuffer(buf: string): AuditEntry[] {
  if (!buf) return [];
  const out: AuditEntry[] = [];
  const lines = buf.split(/\r?\n/u);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t) as AuditEntry;
      // Validation minimale
      if (obj && typeof obj === 'object' && typeof obj.timestamp === 'string') {
        out.push(obj);
      }
    } catch {
      // ligne corrompue : skip
    }
  }
  return out;
}

/** Résout le fileId du fichier du jour. Crée si absent. */
async function resolveOrCreateLogFile(
  accessToken: string,
  dateKey: string,
): Promise<string | null> {
  // 1. Cache mémoire
  if (cachedFileIdOfDay && cachedFileIdOfDay.date === dateKey) {
    return cachedFileIdOfDay.fileId;
  }

  // 2. Résoudre dossier _Inbox/AnyaLogs (créer si absent)
  let folderId: string | null = null;
  const folderResolved = await resolvePath(LOGS_FOLDER);
  if (folderResolved.success && folderResolved.fileId) {
    folderId = folderResolved.fileId;
  } else {
    // _Inbox existe-t-il ?
    const inboxResolved = await resolvePath('_Inbox');
    if (inboxResolved.success && inboxResolved.fileId) {
      folderId = await getOrCreateSubfolder(accessToken, inboxResolved.fileId, 'AnyaLogs');
    } else {
      const fallback = process.env.DRIVE_INBOX_FOLDER_ID;
      if (fallback) {
        folderId = await getOrCreateSubfolder(accessToken, fallback, 'AnyaLogs');
      }
    }
  }
  if (!folderId) {
    console.warn('[audit-logger] dossier _Inbox/AnyaLogs introuvable');
    return null;
  }

  const filename = filenameForDay(dateKey);

  // 3. Chercher le fichier existant
  const q = `name='${filename}' and '${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.ok) {
      const data = (await response.json()) as { files?: Array<{ id: string }> };
      const found = data.files?.[0]?.id;
      if (found) {
        cachedFileIdOfDay = { date: dateKey, fileId: found };
        return found;
      }
    }
  } catch (err) {
    console.warn(
      `[audit-logger] listing échec : ${err instanceof Error ? err.message : String(err)}`,
    );
    // Continue vers create
  }

  // 4. Pas trouvé → CREATE (1 seule fois) via uploadToInbox
  try {
    const result = await uploadToInbox(
      Buffer.from('', 'utf-8'),
      filename,
      'AnyaLogs',
      'application/x-ndjson',
    );
    if (result.success && result.fileId) {
      cachedFileIdOfDay = { date: dateKey, fileId: result.fileId };
      return result.fileId;
    }
    console.warn(`[audit-logger] create fichier échoué : ${result.error ?? 'unknown'}`);
    return null;
  } catch (err) {
    console.warn(
      `[audit-logger] create exception : ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/** Lit le contenu actuel d'un fichier Drive. */
async function readFileContent(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      return '';
    }
    return await response.text();
  } catch (err) {
    console.warn(
      `[audit-logger] read exception : ${err instanceof Error ? err.message : String(err)}`,
    );
    return '';
  }
}

// ============================================================
// API publique
// ============================================================

/**
 * Log une entrée d'audit. **Ne throw jamais** — warn console en cas d'échec.
 *
 * @param entry Entrée à logger (timestamp optionnel — défaut now())
 */
export async function logAuditEntry(
  entry: Omit<AuditEntry, 'timestamp'> & { timestamp?: string },
): Promise<void> {
  const fullEntry: AuditEntry = {
    timestamp: entry.timestamp ?? new Date().toISOString(),
    direction: entry.direction,
    op: entry.op,
    status: entry.status,
    ...(entry.ticktickId !== undefined ? { ticktickId: entry.ticktickId } : {}),
    ...(entry.vaultPath !== undefined ? { vaultPath: entry.vaultPath } : {}),
    ...(entry.lineNumber !== undefined ? { lineNumber: entry.lineNumber } : {}),
    ...(entry.vaultHash !== undefined ? { vaultHash: entry.vaultHash } : {}),
    ...(entry.errorMessage !== undefined ? { errorMessage: entry.errorMessage } : {}),
    ...(entry.details !== undefined ? { details: entry.details } : {}),
  };

  try {
    await withAuditLock(async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        console.warn('[audit-logger] pas de token OAuth — audit skip');
        return;
      }

      const dateKey = todayUtcKey(new Date(fullEntry.timestamp));
      const fileId = await resolveOrCreateLogFile(accessToken, dateKey);
      if (!fileId) {
        console.warn('[audit-logger] fileId introuvable — audit skip');
        return;
      }

      // Append : read + concat + PATCH in-place
      const existing = await readFileContent(accessToken, fileId);
      const next = existing + serializeEntry(fullEntry);
      const patched = await updateFileContent(fileId, next, 'application/x-ndjson');
      if (!patched.success) {
        console.warn(
          `[audit-logger] PATCH échoué : ${patched.error ?? 'unknown'}`,
        );
        // Invalider cache si erreur → forcer relookup
        if (cachedFileIdOfDay && cachedFileIdOfDay.fileId === fileId) {
          cachedFileIdOfDay = null;
        }
      }
    });
  } catch (err) {
    // Red line : audit ne bloque jamais le pipeline
    console.warn(
      `[audit-logger] exception non-bloquante : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Lit les entrées du log du jour. Retourne [] si erreur.
 */
export async function readTodayLog(now: Date = new Date()): Promise<AuditEntry[]> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return [];

    const dateKey = todayUtcKey(now);
    const fileId = await resolveOrCreateLogFile(accessToken, dateKey);
    if (!fileId) return [];

    const content = await readFileContent(accessToken, fileId);
    return parseJsonlBuffer(content);
  } catch (err) {
    console.warn(
      `[audit-logger] readTodayLog erreur : ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

// ============================================================
// Test helpers
// ============================================================

export const _auditLoggerInternals = {
  todayUtcKey,
  filenameForDay,
  serializeEntry,
  parseJsonlBuffer,
};
