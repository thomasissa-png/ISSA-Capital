/**
 * Audit log JSONL pour calendar-ingest.
 *
 * Format : 1 ligne JSON par event traité, dans Drive
 *   `_Inbox/AnyaLogs/calendar-ingest-YYYY-MM-DD.jsonl` (1 fichier par jour).
 *
 * Aligné sur ticktick-sync/audit-log.ts (S18.1) :
 *   - R5 PATCH in-place
 *   - Non-bloquant (warn + return false si Drive indisponible)
 *   - 1 fichier par jour UTC
 *   - Mutex en mémoire
 *
 * Schéma de ligne (CalendarIngestResult enrichi, refonte S23) :
 *   { ts, eventId, summary, date, op, participantsTotal, contactsEnriched,
 *     projectsEnriched, projectAmbiguous, todoCreated, errors }
 *
 * Ops S23 : 'processed' | 'cancelled' | 'skipped' | 'no-change' | 'error'.
 * (Plus de 'reunion-*' — fiches réunion abandonnées.)
 */

import type { CalendarIngestResult } from './types';
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
// Mutex
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
// Helpers
// ============================================================

export function auditLogFilename(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `calendar-ingest-${yyyy}-${mm}-${dd}.jsonl`;
}

export function auditLogPath(date: Date = new Date()): string {
  return `${ANYA_LOGS}/${auditLogFilename(date)}`;
}

export interface CalendarAuditEntry extends CalendarIngestResult {
  ts: string;
}

export function serializeCalendarAuditEntry(
  entry: Omit<CalendarAuditEntry, 'ts'> & { ts?: string },
): string {
  const enriched: CalendarAuditEntry = {
    ts: entry.ts ?? new Date().toISOString(),
    eventId: entry.eventId,
    summary: entry.summary,
    date: entry.date,
    op: entry.op,
    participantsTotal: entry.participantsTotal,
    contactsEnriched: entry.contactsEnriched,
    projectsEnriched: entry.projectsEnriched ?? [],
    projectAmbiguous: entry.projectAmbiguous ?? false,
    todoCreated: entry.todoCreated ?? false,
    errors: entry.errors ?? [],
  };
  return JSON.stringify(enriched);
}

// ============================================================
// Drive I/O
// ============================================================

async function resolveLogsFolderId(
  accessToken: string,
): Promise<string | null> {
  const resolved = await resolvePath(ANYA_LOGS);
  if (resolved.success && resolved.fileId) return resolved.fileId;

  const inboxResult = await resolvePath(INBOX_ROOT);
  if (inboxResult.success && inboxResult.fileId) {
    return getOrCreateSubfolder(accessToken, inboxResult.fileId, 'AnyaLogs');
  }
  const fallbackInboxId = process.env.DRIVE_INBOX_FOLDER_ID;
  if (!fallbackInboxId) {
    console.warn(
      '[calendar-audit] _Inbox introuvable + DRIVE_INBOX_FOLDER_ID absent',
    );
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
  const boundary = '===issa_calendar_audit_log===';
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
// API publique
// ============================================================

export async function appendCalendarAuditLog(
  entry: Omit<CalendarAuditEntry, 'ts'> & { ts?: string },
): Promise<boolean> {
  const line = serializeCalendarAuditEntry(entry);

  return withAuditLock(async () => {
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return false;

      const folderId = await resolveLogsFolderId(accessToken);
      if (!folderId) return false;

      const filename = auditLogFilename();
      const existingFileId = await findLogFileId(
        accessToken,
        folderId,
        filename,
      );

      if (existingFileId) {
        const previous = await readLogFile(accessToken, existingFileId);
        const newContent =
          previous.length > 0 && !previous.endsWith('\n')
            ? `${previous}\n${line}\n`
            : `${previous}${line}\n`;
        const ok = await patchLogFile(accessToken, existingFileId, newContent);
        if (!ok) console.warn(`[calendar-audit] PATCH ${filename} échec`);
        return ok;
      }

      const newId = await createLogFile(
        accessToken,
        folderId,
        filename,
        `${line}\n`,
      );
      if (!newId) console.warn(`[calendar-audit] CREATE ${filename} échec`);
      return newId !== null;
    } catch (err) {
      console.warn(
        `[calendar-audit] erreur non-fatale : ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  });
}

// ============================================================
// Test helpers
// ============================================================

export function _resetCalendarAuditLogLockForTests(): void {
  currentLock = Promise.resolve();
}
