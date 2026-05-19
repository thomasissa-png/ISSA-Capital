/**
 * Audit JSONL — événements hot-context.
 *
 * Source de vérité : `docs/hot-context-spec.md` §4.
 *
 * Chemin Drive : `_Inbox/AnyaLogs/YYYY-MM-DD.jsonl` (mêmes fichiers que le reste
 * de l'audit Anya — un fichier par jour, append-only).
 *
 * Le type `op` de `vault-client/audit-log.ts` est figé sur les opérations
 * vault classiques. Pour ne pas l'élargir (risque cascade), on écrit ici un
 * appender JSONL hot-context dédié, mais on partage le même dossier.
 *
 * Events §4 :
 *  - hot-context-signal-detected
 *  - hot-context-signal-skipped-already-processed
 *  - hot-context-patch-proposed
 *  - hot-context-patch-applied
 *  - hot-context-patch-skipped
 *  - hot-context-patch-modified
 */

import { getAccessToken, getOrCreateSubfolder } from '../drive-upload';
import { resolvePath } from '../vault-client/drive-resolver';

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;
const LOGS_FOLDER = '_Inbox/AnyaLogs';

// ============================================================
// Types
// ============================================================

export type HotContextEvent =
  | 'hot-context-signal-detected'
  | 'hot-context-signal-skipped-already-processed'
  | 'hot-context-patch-proposed'
  | 'hot-context-patch-applied'
  | 'hot-context-patch-skipped'
  | 'hot-context-patch-modified';

export interface HotContextAuditEntry {
  ts: string;
  event: HotContextEvent;
  payload: Record<string, unknown>;
}

// ============================================================
// Drive helpers
// ============================================================

async function resolveOrCreateLogsFolder(accessToken: string): Promise<string | null> {
  const resolved = await resolvePath(LOGS_FOLDER);
  if (resolved.success && resolved.fileId) return resolved.fileId;
  const inboxResult = await resolvePath('_Inbox');
  if (inboxResult.success && inboxResult.fileId) {
    return getOrCreateSubfolder(accessToken, inboxResult.fileId, 'AnyaLogs');
  }
  const fallbackInboxId = process.env.DRIVE_INBOX_FOLDER_ID;
  if (!fallbackInboxId) return null;
  return getOrCreateSubfolder(accessToken, fallbackInboxId, 'AnyaLogs');
}

async function findLogFile(
  accessToken: string,
  folderId: string,
  filename: string,
): Promise<{ id: string; content: string } | null> {
  const q = `name='${filename}' and '${folderId}' in parents and trashed=false`;
  const url = `${DRIVE_FILES_API}?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { files?: Array<{ id: string }> };
  const fileId = data.files?.[0]?.id;
  if (!fileId) return null;
  // Lire contenu existant
  const readUrl = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const readRes = await fetch(readUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const content = readRes.ok ? await readRes.text() : '';
  return { id: fileId, content };
}

async function patchLogFile(
  accessToken: string,
  fileId: string,
  newContent: string,
): Promise<boolean> {
  const url = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-ndjson; charset=utf-8',
    },
    body: newContent,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return response.ok;
}

async function createLogFile(
  accessToken: string,
  folderId: string,
  filename: string,
  content: string,
): Promise<boolean> {
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
    mimeType: 'application/x-ndjson',
  });
  const boundary = '===issa_hot_context_audit===';
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata +
    '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/x-ndjson; charset=UTF-8\r\n\r\n' +
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
  return response.ok;
}

// ============================================================
// API publique
// ============================================================

/**
 * Append une entrée d'audit hot-context dans le JSONL du jour.
 * Ne throw jamais — best-effort logging.
 */
export async function writeHotContextAudit(
  event: HotContextEvent,
  payload: Record<string, unknown>,
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[hot-context-audit] pas de token OAuth2 — log perdu');
      return false;
    }
    const folderId = await resolveOrCreateLogsFolder(accessToken);
    if (!folderId) return false;

    const today = new Date().toISOString().slice(0, 10);
    const filename = `${today}.jsonl`;
    const entry: HotContextAuditEntry = {
      ts: new Date().toISOString(),
      event,
      payload,
    };
    const jsonLine = JSON.stringify(entry) + '\n';

    const existing = await findLogFile(accessToken, folderId, filename);
    if (existing) {
      const newContent = existing.content + jsonLine;
      return patchLogFile(accessToken, existing.id, newContent);
    }
    return createLogFile(accessToken, folderId, filename, jsonLine);
  } catch (err) {
    console.warn(
      `[hot-context-audit] erreur écriture : ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}
