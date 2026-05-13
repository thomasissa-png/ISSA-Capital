/**
 * Lecture et écriture de fichiers .md Obsidian via Google Drive API.
 *
 * Préserve l'encodage UTF-8 réel (accents, caractères spéciaux).
 * Utilise le drive-resolver pour la résolution de chemin.
 * Utilise getAccessToken() de drive-upload.ts (mutualisation).
 *
 * Chaque opération d'écriture est sérialisée via write-lock.ts
 * pour éviter les conflits si deux handlers modifient le même fichier.
 */

import { getAccessToken } from '../drive-upload';
import { resolveFilePath, resolvePath, invalidateCache } from './drive-resolver';
import { withWriteLock } from './write-lock';

// ============================================================
// Constantes
// ============================================================

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;

// ============================================================
// Types
// ============================================================

export interface ReadFileResult {
  success: boolean;
  content?: string;
  fileId?: string;
  error?: string;
}

export interface WriteFileResult {
  success: boolean;
  fileId?: string;
  error?: string;
}

// ============================================================
// Lecture
// ============================================================

/**
 * Lit le contenu d'un fichier .md depuis Google Drive.
 *
 * @param folderPath Chemin logique du dossier (ex: "07. Contacts/01. Pro")
 * @param filename Nom du fichier (ex: "Martin Yhuel.md")
 * @returns Contenu du fichier (UTF-8) ou erreur
 */
export async function readFile(
  folderPath: string,
  filename: string,
): Promise<ReadFileResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      error: 'Drive désactivé — credentials OAuth2 manquants',
    };
  }

  // Résoudre le fileId
  const resolveResult = await resolveFilePath(folderPath, filename);
  if (!resolveResult.success || !resolveResult.fileId) {
    return {
      success: false,
      error: resolveResult.error ?? `Fichier "${filename}" non trouvé dans "${folderPath}"`,
    };
  }

  return readFileById(accessToken, resolveResult.fileId);
}

/**
 * Lit le contenu d'un fichier Drive par son ID.
 */
export async function readFileById(
  accessToken: string,
  fileId: string,
): Promise<ReadFileResult> {
  try {
    const url = `${DRIVE_FILES_API}/${fileId}?alt=media&supportsAllDrives=true`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Invalider le cache pour ce fileId
        // On ne connaît pas le path ici, mais l'appelant peut invalider
        return {
          success: false,
          fileId,
          error: `Fichier Drive ${fileId} non trouvé (404)`,
        };
      }
      return {
        success: false,
        fileId,
        error: `Drive download ${response.status}`,
      };
    }

    const content = await response.text();
    return { success: true, content, fileId };
  } catch (err) {
    return {
      success: false,
      fileId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================
// Écriture
// ============================================================

/**
 * Écrit (update) le contenu d'un fichier .md sur Google Drive.
 *
 * IMPORTANT : cette opération est sérialisée par path via write-lock.
 * Si un autre handler est en train de modifier le même fichier,
 * cette opération attend son tour.
 *
 * @param folderPath Chemin logique du dossier
 * @param filename Nom du fichier
 * @param content Nouveau contenu (UTF-8)
 * @returns Résultat de l'écriture
 */
export async function writeFile(
  folderPath: string,
  filename: string,
  content: string,
): Promise<WriteFileResult> {
  const lockPath = `${folderPath}/${filename}`;

  return withWriteLock(lockPath, async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        success: false,
        error: 'Drive désactivé — credentials OAuth2 manquants',
      };
    }

    // Résoudre le fileId
    const resolveResult = await resolveFilePath(folderPath, filename);
    if (!resolveResult.success || !resolveResult.fileId) {
      return {
        success: false,
        error:
          resolveResult.error ??
          `Fichier "${filename}" non trouvé dans "${folderPath}"`,
      };
    }

    return writeFileById(accessToken, resolveResult.fileId, content);
  });
}

/**
 * Écrit le contenu d'un fichier Drive par son ID.
 * N'utilise PAS le write-lock (c'est la responsabilité de l'appelant).
 */
export async function writeFileById(
  accessToken: string,
  fileId: string,
  content: string,
): Promise<WriteFileResult> {
  try {
    const url = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/markdown; charset=utf-8',
      },
      body: content,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      if (response.status === 404) {
        invalidateCache(`${fileId}`);
        return {
          success: false,
          fileId,
          error: `Fichier Drive ${fileId} non trouvé (404) lors de l'écriture`,
        };
      }
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        fileId,
        error: `Drive update ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    return { success: true, fileId };
  } catch (err) {
    return {
      success: false,
      fileId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================
// Création
// ============================================================

/**
 * Crée un nouveau fichier .md dans un dossier Drive.
 *
 * @param folderPath Chemin logique du dossier
 * @param filename Nom du fichier à créer (ex: "2026-05-13 — Sujet.md")
 * @param content Contenu initial (UTF-8)
 * @returns Résultat avec fileId du fichier créé
 */
export async function createFile(
  folderPath: string,
  filename: string,
  content: string,
): Promise<WriteFileResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      error: 'Drive désactivé — credentials OAuth2 manquants',
    };
  }

  // Résoudre le dossier parent
  const folderResult = await resolvePath(folderPath);
  if (!folderResult.success || !folderResult.fileId) {
    return {
      success: false,
      error: folderResult.error ?? `Dossier "${folderPath}" non trouvé`,
    };
  }

  try {
    // Upload multipart (metadata JSON + contenu)
    const metadata = JSON.stringify({
      name: filename,
      parents: [folderResult.fileId],
      mimeType: 'text/markdown',
    });

    const boundary = '===issa_vault_create===';
    const bodyParts =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata +
      '\r\n' +
      `--${boundary}\r\n` +
      'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
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
        body: bodyParts,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        error: `Drive create ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as { id?: string };
    return {
      success: true,
      fileId: data.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
