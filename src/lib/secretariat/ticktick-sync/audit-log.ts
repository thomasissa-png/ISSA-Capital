/**
 * Audit log JSONL pour sync vault ↔ TickTick — red line §4 spec.
 *
 * Format : 1 ligne JSON par opération, stockée dans Drive
 *   `_Inbox/AnyaLogs/ticktick-sync-YYYY-MM-DD.jsonl` (1 fichier par jour).
 *
 * Règles dures :
 *   - R5 (P0 #99) : édition fichier Drive existant = PATCH in-place via
 *     `/upload/drive/v3/files/{fileId}?uploadType=media`. Jamais create+delete.
 *   - Non-bloquant : si Drive échoue → console.warn + return false.
 *     L'audit log NE DOIT JAMAIS interrompre la sync.
 *   - 1 fichier / jour (UTC) — append nouvelle ligne à la fin du contenu existant.
 *   - UTF-8 réel (accents préservés, pas d'escapes \u00xx).
 *
 * Mutex en mémoire pour sérialiser les écritures concurrentes au même fichier
 * Drive sur un même worker (pattern aligné sur state-store.ts).
 *
 * Critère §11.6 de la spec : "Audit JSONL : chaque op tracée avec ts, op, status".
 */

import type { AuditOp, AuditDirection, AuditEntry, AuditStatus } from './types';
import { getAccessToken, getOrCreateSubfolder } from '../drive-upload';
import { resolvePath } from '../vault-client/drive-resolver';
import { ANYA_LOGS, INBOX_ROOT } from '../vault-client/vault-paths';

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;

// ============================================================
// Mutex (sérialise écritures au même fichier sur un worker)
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
// Path helpers
// ============================================================

/**
 * Retourne le nom de fichier de log pour une date donnée (UTC).
 * Format : `ticktick-sync-YYYY-MM-DD.jsonl`.
 */
export function auditLogFilename(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `ticktick-sync-${yyyy}-${mm}-${dd}.jsonl`;
}

/**
 * Retourne le chemin Drive complet du log pour une date donnée.
 * Ex : `_Inbox/AnyaLogs/ticktick-sync-2026-05-19.jsonl`.
 */
export function auditLogPath(date: Date = new Date()): string {
  return `${ANYA_LOGS}/${auditLogFilename(date)}`;
}

// ============================================================
// Drive I/O (interne, non-exporté — sauf reset tests)
// ============================================================

async function resolveLogsFolderId(accessToken: string): Promise<string | null> {
  const resolved = await resolvePath(ANYA_LOGS);
  if (resolved.success && resolved.fileId) {
    return resolved.fileId;
  }

  const inboxResult = await resolvePath(INBOX_ROOT);
  if (inboxResult.success && inboxResult.fileId) {
    return getOrCreateSubfolder(accessToken, inboxResult.fileId, 'AnyaLogs');
  }

  const fallbackInboxId = process.env.DRIVE_INBOX_FOLDER_ID;
  if (!fallbackInboxId) {
    console.warn('[audit-log] _Inbox introuvable + DRIVE_INBOX_FOLDER_ID absent');
    return null;
  }
  return getOrCreateSubfolder(accessToken, fallbackInboxId, 'AnyaLogs');
}

async function findLogFileId(
  accessToken: string,
  folderId: string,
  filename: string,
): Promise<string | null> {
  const q = `name='${filename}' and '${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return null;

  const data = (await response.json()) as { files?: Array<{ id: string }> };
  return data.files?.[0]?.id ?? null;
}

async function readLogFile(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return '';
  return response.text();
}

/** PATCH in-place R5 — préserve fileId. */
async function patchLogFile(
  accessToken: string,
  fileId: string,
  content: string,
): Promise<boolean> {
  const url = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/jsonl; charset=UTF-8',
    },
    body: content,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return response.ok;
}

async function createLogFile(
  accessToken: string,
  folderId: string,
  filename: string,
  content: string,
): Promise<string | null> {
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
    mimeType: 'application/jsonl',
  });

  const boundary = '===issa_audit_log===';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/jsonl; charset=UTF-8\r\n\r\n' +
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
// API publique — appendAuditLog
// ============================================================

/**
 * Sérialise une entrée audit en JSON 1 ligne (sans newline final).
 * `ts` est forcé à ISO 8601 UTC si absent.
 */
export function serializeAuditEntry(
  entry: Omit<AuditEntry, 'ts'> & { ts?: string },
): string {
  const enriched: AuditEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    op: entry.op,
    direction: entry.direction,
    status: entry.status,
    ...(entry.taskId ? { taskId: entry.taskId } : {}),
    ...(entry.vaultPath ? { vaultPath: entry.vaultPath } : {}),
    ...(entry.vaultLine ? { vaultLine: entry.vaultLine } : {}),
    ...(entry.error ? { error: entry.error } : {}),
    ...(entry.stats ? { stats: entry.stats } : {}),
  };
  return JSON.stringify(enriched);
}

/**
 * Ajoute une ligne au fichier d'audit du jour. Non-bloquant : retourne false
 * en cas d'erreur Drive ou de credentials manquants, sans throw.
 *
 * Pattern d'append idempotent :
 *   1. Trouver fileId du fichier du jour (ou null)
 *   2. Si fileId présent : lire contenu + append + PATCH in-place
 *   3. Si fileId absent : créer fichier avec la ligne comme contenu initial
 */
export async function appendAuditLog(
  entry: Omit<AuditEntry, 'ts'> & { ts?: string },
): Promise<boolean> {
  const line = serializeAuditEntry(entry);

  return withAuditLock(async () => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        // Silencieux : en local/test sans OAuth, ce cas est attendu.
        // En prod le token est toujours présent (cron Vercel + secret).
        return false;
      }

      const folderId = await resolveLogsFolderId(accessToken);
      if (!folderId) {
        console.warn('[audit-log] folder AnyaLogs introuvable — skip');
        return false;
      }

      const filename = auditLogFilename();
      const existingFileId = await findLogFileId(accessToken, folderId, filename);

      if (existingFileId) {
        const previous = await readLogFile(accessToken, existingFileId);
        const newContent =
          previous.length > 0 && !previous.endsWith('\n')
            ? `${previous}\n${line}\n`
            : `${previous}${line}\n`;
        const ok = await patchLogFile(accessToken, existingFileId, newContent);
        if (!ok) console.warn(`[audit-log] PATCH ${filename} échec`);
        return ok;
      }

      const newId = await createLogFile(accessToken, folderId, filename, `${line}\n`);
      if (!newId) console.warn(`[audit-log] CREATE ${filename} échec`);
      return newId !== null;
    } catch (err) {
      // Robuste : un audit qui échoue ne casse jamais la sync.
      console.warn(
        `[audit-log] erreur non-fatale : ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  });
}

// ============================================================
// Test helpers
// ============================================================

/** Reset mutex en mémoire (tests). */
export function _resetAuditLogLockForTests(): void {
  currentLock = Promise.resolve();
}

export const _auditLogInternals = {
  resolveLogsFolderId,
  findLogFileId,
  readLogFile,
  patchLogFile,
  createLogFile,
};

// Re-export types pour ergonomie
export type { AuditOp, AuditDirection, AuditEntry, AuditStatus };
