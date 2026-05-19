/**
 * Vault scanner — scan du vault Drive pour extraire les VaultTask actives.
 *
 * Sources scannées (S18.1 MVP — extensible S18.2+) :
 *   - `Taches/Todo.md` (priorité 1, fichier dédié)
 *
 * Sources additionnelles à activer en S18.2 (inline tasks) :
 *   - tout `*.md` du vault avec `- [ ]` inline, sauf :
 *       - `_Inbox/`, `Profil/`, `Archive/`
 *       - frontmatter contenant `hide-tcw`
 *
 * Pour le MVP S18.1, on commence par `Todo.md` uniquement pour valider la
 * boucle end-to-end. L'extension inline tasks est explicitement prévue
 * mais reportée — éviter de scanner des milliers de fichiers tant que la
 * mécanique n'est pas validée par Thomas.
 *
 * Tous les paths passent par `vault-paths.ts` (R7).
 */

import { parseTaskLine } from './parser';
import type { VaultTask } from './types';
import { readVaultFile } from '../vault-reader';
import { VAULT_PATHS } from '../handlers/vault-paths';

// ============================================================
// Constantes
// ============================================================

/** Path Todo.md vault (depuis vault-paths.ts). */
const TODO_PATH = VAULT_PATHS.todoMd; // "03. Tâches/Todo.md"

/** Sépare le folderPath du filename. */
function splitPath(fullPath: string): { folderPath: string; filename: string } {
  const idx = fullPath.lastIndexOf('/');
  if (idx < 0) return { folderPath: '', filename: fullPath };
  return {
    folderPath: fullPath.slice(0, idx),
    filename: fullPath.slice(idx + 1),
  };
}

// ============================================================
// API publique
// ============================================================

/**
 * Scan d'un fichier markdown : extrait toutes les VaultTask valides.
 *
 * Gère les sauts de ligne `\n` et `\r\n`. La position `lineNumber` est
 * 1-indexed (cohérent avec les éditeurs de texte).
 *
 * @param vaultPath Chemin logique (ex: "Taches/Todo.md")
 * @param content Contenu raw du fichier
 * @returns Liste de VaultTask (peut être vide)
 */
export function extractTasksFromContent(
  vaultPath: string,
  content: string,
): VaultTask[] {
  const tasks: VaultTask[] = [];
  const lines = content.split(/\r?\n/u);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const task = parseTaskLine(line, {
      vaultPath,
      lineNumber: i + 1,
    });
    if (task) tasks.push(task);
  }

  return tasks;
}

/**
 * Scan complet du vault — S18.1 MVP : Todo.md seulement.
 *
 * Lecture live via vault-reader (cache TTL 5min côté reader).
 * Si Drive indisponible → return [] + warn (jamais throw).
 *
 * @returns Liste de VaultTask actives + completed (filtrage status fait
 *   par le push-engine).
 */
export async function scanVault(): Promise<VaultTask[]> {
  const { folderPath, filename } = splitPath(TODO_PATH);

  try {
    const fileResult = await readVaultFile(folderPath, filename);
    if (!fileResult.success || !fileResult.content) {
      console.warn(
        `[vault-scanner] Todo.md introuvable : ${fileResult.error ?? 'unknown'}`,
      );
      return [];
    }

    return extractTasksFromContent(TODO_PATH, fileResult.content);
  } catch (err) {
    console.warn(
      `[vault-scanner] erreur scan Todo.md : ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

// ============================================================
// Test helpers
// ============================================================

export const _scannerInternals = {
  TODO_PATH,
  splitPath,
};
