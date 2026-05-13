/**
 * Audit trail JSONL pour les opérations vault Anya.
 *
 * Avant chaque écriture vault, une ligne JSON est ajoutée dans
 * _Inbox/AnyaLogs/YYYY-MM-DD.jsonl sur Google Drive.
 *
 * Format :
 * {"ts":"2026-05-13T14:32:11Z","op":"append_historique","target":"07. Contacts/...","trigger":"gmail_thread_19xx","payload":{...},"status":"pending"}
 *
 * Le log est écrit AVANT l'opération vault (status=pending),
 * puis mis à jour APRÈS (status=success ou status=error).
 * En pratique, on append une nouvelle ligne (pas de mise à jour in-place
 * dans le JSONL — le statut final est une 2e ligne).
 *
 * Rotation : 90 jours (implémentée dans le cron poller, pas ici).
 */

import { getAccessToken } from '../drive-upload';
import { getOrCreateSubfolder } from '../drive-upload';
import { resolvePath } from './drive-resolver';

// ============================================================
// Types
// ============================================================

export interface AuditLogEntry {
  /** Timestamp ISO 8601 */
  ts: string;
  /** Type d'opération */
  op:
    | 'append_historique'
    | 'update_frontmatter'
    | 'create_file'
    | 'create_bien_stub'
    | 'classify_note';
  /** Chemin logique du fichier cible dans le vault */
  target: string;
  /** Identifiant du déclencheur (ex: gmail_thread_id, telegram_message_id) */
  trigger: string;
  /** Données de l'opération (contenu ajouté, champs modifiés) */
  payload: Record<string, unknown>;
  /** Statut de l'opération */
  status: 'pending' | 'success' | 'error';
  /** Message d'erreur si status=error */
  errorMessage?: string;
}

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;

/** Dossier des logs dans le vault */
const LOGS_FOLDER = '_Inbox/AnyaLogs';

// ============================================================
// Implémentation
// ============================================================

/**
 * Écrit une entrée d'audit dans le fichier JSONL du jour.
 *
 * Si le fichier n'existe pas, il est créé.
 * Si le dossier AnyaLogs n'existe pas, il est créé.
 *
 * @param entry Entrée d'audit à logger
 * @returns true si l'écriture a réussi, false sinon (ne throw jamais)
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn('[audit-log] pas de token OAuth2 — log perdu');
      return false;
    }

    // Résoudre le dossier AnyaLogs
    const logsFolderId = await resolveOrCreateLogsFolder(accessToken);
    if (!logsFolderId) {
      console.warn('[audit-log] impossible de résoudre/créer le dossier AnyaLogs');
      return false;
    }

    // Nom du fichier : YYYY-MM-DD.jsonl
    const today = new Date().toISOString().slice(0, 10);
    const filename = `${today}.jsonl`;

    // Chercher si le fichier existe déjà
    const fileId = await findLogFile(accessToken, logsFolderId, filename);

    // Sérialiser l'entrée en JSON (une seule ligne)
    const jsonLine = JSON.stringify(entry) + '\n';

    if (fileId) {
      // Append au fichier existant
      return await appendToLogFile(accessToken, fileId, jsonLine);
    } else {
      // Créer le fichier avec la première ligne
      return await createLogFile(accessToken, logsFolderId, filename, jsonLine);
    }
  } catch (err) {
    console.warn(
      `[audit-log] erreur écriture : ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

/**
 * Construit une entrée d'audit avec le timestamp courant.
 */
export function buildAuditEntry(
  op: AuditLogEntry['op'],
  target: string,
  trigger: string,
  payload: Record<string, unknown>,
  status: AuditLogEntry['status'] = 'pending',
  errorMessage?: string,
): AuditLogEntry {
  return {
    ts: new Date().toISOString(),
    op,
    target,
    trigger,
    payload,
    status,
    ...(errorMessage ? { errorMessage } : {}),
  };
}

// ============================================================
// Fonctions internes Drive
// ============================================================

/**
 * Résout ou crée le dossier AnyaLogs dans _Inbox.
 */
async function resolveOrCreateLogsFolder(
  accessToken: string,
): Promise<string | null> {
  // D'abord essayer de résoudre via le drive-resolver
  const resolved = await resolvePath(LOGS_FOLDER);
  if (resolved.success && resolved.fileId) {
    return resolved.fileId;
  }

  // Si le dossier n'existe pas, le créer
  // D'abord résoudre _Inbox
  const inboxResult = await resolvePath('_Inbox');
  if (!inboxResult.success || !inboxResult.fileId) {
    // Fallback sur DRIVE_INBOX_FOLDER_ID
    const inboxId = process.env.DRIVE_INBOX_FOLDER_ID;
    if (!inboxId) {
      console.warn('[audit-log] ni _Inbox résolvable ni DRIVE_INBOX_FOLDER_ID configuré');
      return null;
    }
    return getOrCreateSubfolder(accessToken, inboxId, 'AnyaLogs');
  }

  return getOrCreateSubfolder(accessToken, inboxResult.fileId, 'AnyaLogs');
}

/**
 * Cherche un fichier JSONL dans le dossier AnyaLogs.
 */
async function findLogFile(
  accessToken: string,
  folderId: string,
  filename: string,
): Promise<string | null> {
  const escapedName = filename.replace(/'/g, "\\'");
  const q = `name='${escapedName}' and '${folderId}' in parents and trashed=false`;
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
 * Append du contenu à un fichier JSONL existant (lecture + écriture).
 */
async function appendToLogFile(
  accessToken: string,
  fileId: string,
  newContent: string,
): Promise<boolean> {
  // Lire le contenu actuel
  const readUrl = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;
  const readResponse = await fetch(readUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!readResponse.ok) return false;

  const existing = await readResponse.text();
  const updated = existing + newContent;

  // Écrire le contenu mis à jour
  const writeUrl = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;
  const writeResponse = await fetch(writeUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/jsonl',
    },
    body: updated,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  return writeResponse.ok;
}

/**
 * Crée un nouveau fichier JSONL dans le dossier AnyaLogs.
 */
async function createLogFile(
  accessToken: string,
  folderId: string,
  filename: string,
  content: string,
): Promise<boolean> {
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
    'Content-Type: application/jsonl\r\n\r\n' +
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
