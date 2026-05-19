/**
 * Reunion-writer — création / mise à jour des fiches Reunions/ vault.
 *
 * Algorithme :
 *   1. Résoudre fileId via googleEventId (recherche dans état + scan dossier)
 *   2. Si fileId trouvé → PATCH in-place R5 (préserve wikilinks Obsidian)
 *   3. Sinon → createFile vault (nouvelle fiche)
 *
 * R5 (P0 #99) : édition fichier Drive existant = PATCH in-place via
 *   `/upload/drive/v3/files/{fileId}?uploadType=media`. Jamais create+delete.
 *
 * R6 : tester 1 fichier avant batch — déjà encadré par le runner (le cron
 * traite 1 event à la fois, pas de batch parallèle).
 */

import { createVaultFile } from '../vault-client';
import {
  resolveFilePath,
  listMarkdownFiles,
} from '../vault-client/drive-resolver';
import { getAccessToken } from '../drive-upload';
import { readFileById } from '../vault-client/obsidian-file';
import { parseObsidianFile } from '../vault-client/frontmatter';
import type { ReunionVaultEntry } from './types';
import { serializeReunionMarkdown } from './event-mapper';

// ============================================================
// Constantes
// ============================================================

const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TIMEOUT_MS = 10_000;

// ============================================================
// Types résultat
// ============================================================

export interface WriteReunionResult {
  success: boolean;
  /** "created" | "updated" | "no-change" | "error" */
  op: 'created' | 'updated' | 'no-change' | 'error';
  /** Chemin logique vault (folderPath + filename + .md) */
  vaultPath?: string;
  /** fileId Drive */
  fileId?: string;
  error?: string;
}

// ============================================================
// Helpers — recherche fichier par googleEventId
// ============================================================

/**
 * Recherche un fichier Reunions/ existant par googleEventId (frontmatter).
 * Scan le dossier folderPath + lit chaque .md pour matcher.
 *
 * Cache lecture limité au dossier du mois (typiquement < 30 fichiers).
 *
 * @returns { fileId, filename, content } si trouvé, sinon null.
 */
export async function findReunionByEventId(
  folderPath: string,
  googleEventId: string,
): Promise<{ fileId: string; filename: string; content: string } | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  let files: Array<{ id: string; name: string }>;
  try {
    files = await listMarkdownFiles(folderPath);
  } catch {
    return null;
  }
  if (files.length === 0) return null;

  for (const file of files) {
    const readResult = await readFileById(accessToken, file.id);
    if (!readResult.success || !readResult.content) continue;

    const parsed = parseObsidianFile(readResult.content);
    const id = parsed.frontmatter?.fields?.['google_calendar_event_id'];
    if (typeof id === 'string' && id.trim() === googleEventId.trim()) {
      return {
        fileId: file.id,
        filename: file.name,
        content: readResult.content,
      };
    }
  }

  return null;
}

// ============================================================
// PATCH in-place (R5) — update fiche existante
// ============================================================

async function patchReunionFile(
  accessToken: string,
  fileId: string,
  newContent: string,
): Promise<boolean> {
  const url = `${DRIVE_UPLOAD_API}/${fileId}?uploadType=media&supportsAllDrives=true`;
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'text/markdown; charset=UTF-8',
      },
      body: newContent,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok;
  } catch (err) {
    console.warn(
      `[reunion-writer] PATCH fileId=${fileId} erreur : ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

// ============================================================
// API publique — writeReunion
// ============================================================

/**
 * Écrit (create ou update) une fiche réunion vault.
 *
 * Stratégie :
 *   1. Chercher fileId existant par googleEventId (frontmatter)
 *   2. Si trouvé : comparer contenu → no-change si identique, sinon PATCH
 *   3. Sinon : createVaultFile
 *
 * @param entry Projection vault de l'event
 * @param trigger Identifiant déclencheur pour audit log
 */
export async function writeReunion(
  entry: ReunionVaultEntry,
  trigger: string,
): Promise<WriteReunionResult> {
  const newContent = serializeReunionMarkdown(entry);
  const filename = `${entry.filename}.md`;
  const vaultPath = `${entry.folderPath}/${filename}`;

  // 1. Recherche par googleEventId
  const existing = await findReunionByEventId(
    entry.folderPath,
    entry.googleEventId,
  );

  if (existing) {
    // Comparer pour éviter PATCH inutile (no-change idempotent)
    if (existing.content.trim() === newContent.trim()) {
      return {
        success: true,
        op: 'no-change',
        vaultPath: `${entry.folderPath}/${existing.filename}`,
        fileId: existing.fileId,
      };
    }
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        success: false,
        op: 'error',
        error: 'pas de token OAuth2',
      };
    }
    const ok = await patchReunionFile(
      accessToken,
      existing.fileId,
      newContent,
    );
    if (!ok) {
      return {
        success: false,
        op: 'error',
        error: 'PATCH Drive échoué',
      };
    }
    return {
      success: true,
      op: 'updated',
      vaultPath: `${entry.folderPath}/${existing.filename}`,
      fileId: existing.fileId,
    };
  }

  // 2. Vérifier si un fichier portant le filename calculé existe déjà
  // (cas : filename collision sans match googleEventId — on évite l'écrasement)
  const resolved = await resolveFilePath(entry.folderPath, filename);
  if (resolved.success && resolved.fileId) {
    // Collision filename : on PATCH quand même (le filename est dérivé de la
    // date + sujet, donc même réunion). On ajoute googleEventId au frontmatter
    // via le nouveau contenu — sécurise les runs futurs.
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { success: false, op: 'error', error: 'pas de token OAuth2' };
    }
    const ok = await patchReunionFile(accessToken, resolved.fileId, newContent);
    return {
      success: ok,
      op: ok ? 'updated' : 'error',
      vaultPath,
      fileId: resolved.fileId,
      ...(ok ? {} : { error: 'PATCH Drive échoué (collision filename)' }),
    };
  }

  // 3. Création
  const created = await createVaultFile(
    entry.folderPath,
    filename,
    newContent,
    trigger,
  );
  if (!created) {
    return {
      success: false,
      op: 'error',
      error: 'createVaultFile échoué',
    };
  }
  return {
    success: true,
    op: 'created',
    vaultPath,
  };
}
