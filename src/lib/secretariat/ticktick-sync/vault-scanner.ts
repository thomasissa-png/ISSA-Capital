/**
 * Vault scanner — scan du vault Drive pour extraire les VaultTask actives.
 *
 * S18.2 — Scan étendu :
 *   - `Taches/Todo.md` (toujours scanné, source primaire)
 *   - INLINE tasks (`- [ ]`) dans tout `.md` du vault, AVEC exclusions :
 *       - dossiers : `Profil/`, `Archive/`, `archive/`, `_Inbox/`, `_Outbox/`,
 *         `AnyaLogs/` (n'importe quel niveau)
 *       - frontmatter contient `#hide-tcw` dans `tags`
 *       - chaque ligne avec `#hide-tcw` est filtrée par parser.ts (red line §9.6)
 *
 * Tous les paths passent par `vault-paths.ts` (R7).
 *
 * Performance : 1 read par fichier max. Le walker s'appuie sur listVaultFolder
 * (cache 1h) pour énumération + readVaultFile (cache TTL 1h, fallback stale).
 *
 * Tolérance pannes : Drive indisponible → return [] + warn (jamais throw).
 */

import { parseTaskLine } from './parser';
import type { VaultTask } from './types';
import { readVaultFile, listVaultFolder } from '../vault-reader';
import { VAULT_PATHS } from '../handlers/vault-paths';
import { listMarkdownFiles } from '../vault-client/drive-resolver';

// ============================================================
// Constantes
// ============================================================

/** Path Todo.md vault (depuis vault-paths.ts). */
const TODO_PATH = VAULT_PATHS.todoMd; // "03. Tâches/Todo.md"

/** Dossiers exclus du scan inline (case-insensitive, n'importe quel segment). */
const EXCLUDED_FOLDER_SEGMENTS: ReadonlyArray<string> = [
  'profil',
  'archive',
  '_inbox',
  '_outbox',
  'anyalogs',
  'anyastate',
];

/** Limite de profondeur du walker (protection runaway). */
const MAX_WALK_DEPTH = 8;

/** Limite de fichiers scannés par run (protection runaway). */
const MAX_FILES_PER_RUN = 500;

/** Frontmatter regex pour détecter `hide-tcw` dans `tags:`. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/u;
const HIDE_TAG = 'hide-tcw';

// ============================================================
// Helpers internes
// ============================================================

function splitPath(fullPath: string): { folderPath: string; filename: string } {
  const idx = fullPath.lastIndexOf('/');
  if (idx < 0) return { folderPath: '', filename: fullPath };
  return {
    folderPath: fullPath.slice(0, idx),
    filename: fullPath.slice(idx + 1),
  };
}

/** Test si un path logique contient un segment de dossier exclu. */
export function isExcludedPath(vaultPath: string): boolean {
  const segments = vaultPath.split('/').map((s) => s.toLowerCase().trim());
  for (const seg of segments) {
    if (EXCLUDED_FOLDER_SEGMENTS.includes(seg)) return true;
  }
  return false;
}

/** Test si un contenu markdown contient `#hide-tcw` dans son frontmatter. */
export function hasHideTagInFrontmatter(content: string): boolean {
  const m = content.match(FRONTMATTER_RE);
  if (!m || !m[1]) return false;
  const fm = m[1];
  // tags peuvent être en YAML list, inline list, ou string
  // On cherche bruteforce mais case-insensitive sur la valeur
  const lower = fm.toLowerCase();
  return lower.includes(HIDE_TAG);
}

// ============================================================
// API publique — scan d'un seul fichier
// ============================================================

/**
 * Scan d'un fichier markdown : extrait toutes les VaultTask valides.
 *
 * Gère les sauts de ligne `\n` et `\r\n`. La position `lineNumber` est
 * 1-indexed (cohérent avec les éditeurs de texte).
 *
 * Filtre red line §9.6 : si le frontmatter contient `hide-tcw` dans ses tags,
 * AUCUNE tâche n'est extraite de ce fichier.
 *
 * @param vaultPath Chemin logique (ex: "Taches/Todo.md")
 * @param content Contenu raw du fichier
 * @returns Liste de VaultTask (peut être vide)
 */
export function extractTasksFromContent(
  vaultPath: string,
  content: string,
): VaultTask[] {
  // Red line §9.6 : skip complet si frontmatter hide-tcw
  if (hasHideTagInFrontmatter(content)) return [];

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

// ============================================================
// API publique — scan complet du vault
// ============================================================

/**
 * Scan Todo.md uniquement (mode rapide). Retourné en S18.1.
 */
async function scanTodoMd(): Promise<VaultTask[]> {
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

/**
 * Walker récursif : énumère les fichiers .md du vault à partir des dossiers
 * "racine projet" connus. On NE PARTAGE PAS le walker avec Todo.md (déjà fait).
 *
 * Limite la profondeur et le nombre de fichiers pour éviter runaway.
 */
async function walkVaultMarkdownFiles(
  rootFolders: ReadonlyArray<string>,
): Promise<Array<{ folderPath: string; filename: string; vaultPath: string }>> {
  const queue: Array<{ path: string; depth: number }> = rootFolders.map(
    (p) => ({ path: p, depth: 0 }),
  );
  const out: Array<{ folderPath: string; filename: string; vaultPath: string }> = [];
  let scanned = 0;

  while (queue.length > 0 && out.length < MAX_FILES_PER_RUN) {
    const entry = queue.shift();
    if (!entry) break;
    const { path: folderPath, depth } = entry;

    // Exclusion
    if (isExcludedPath(folderPath)) continue;
    if (depth > MAX_WALK_DEPTH) continue;

    // listMarkdownFiles renvoie les .md d'un dossier (pas récursif)
    // listVaultFolder ne renvoie que .md (cache TTL 1h) — on l'utilise.
    try {
      const files = await listVaultFolder(folderPath);
      for (const f of files) {
        if (out.length >= MAX_FILES_PER_RUN) break;
        const vaultPath = `${folderPath}/${f.name}`;
        // Skip Todo.md (scanné séparément, dans une autre voie)
        if (vaultPath === TODO_PATH) continue;
        out.push({ folderPath, filename: f.name, vaultPath });
      }
    } catch (err) {
      console.warn(
        `[vault-scanner] listing ${folderPath} échoué : ${err instanceof Error ? err.message : String(err)}`,
      );
      // Continue — un dossier inaccessible n'empêche pas le scan global
    }

    scanned++;
    // NOTE : pour V1, on ne descend PAS récursivement dans les sous-dossiers
    // via le walker (limite OAuth quotas). Les sous-dossiers connus doivent
    // être listés dans `rootFolders`. L'extension récursive viendra avec
    // listMarkdownFiles + résolution dossiers enfants → S18.3.
  }

  return out;
}

/**
 * Liste les dossiers racine connus à scanner pour les inline tasks.
 * On reste limité à un set explicite pour éviter d'énumérer tout le Drive
 * (qui aurait un coût important et activerait le rate limit Google).
 *
 * Stratégie V1 : on couvre les emplacements naturels de tâches inline :
 *   - Réunions de l'année en cours (mois courant uniquement)
 *   - Projets Perso/Pro (premier niveau seulement)
 *
 * Stratégie complète (récursif full vault) : S18.3 quand Thomas validera
 * via boucle visuelle.
 */
function getInlineScanRoots(): string[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return [
    `06. Réunions/${year}/${month}`,
    '02. Projets/01. Perso',
    '02. Projets/02. Pro',
    '04. Notes',
  ];
}

/**
 * Scan complet du vault — Todo.md + inline tasks (S18.2).
 *
 * @returns Liste de VaultTask actives + completed (filtrage status fait par
 *   les push/pull engines).
 */
export async function scanVault(): Promise<VaultTask[]> {
  const all: VaultTask[] = [];

  // 1. Todo.md (source primaire, toujours scanné)
  const todoTasks = await scanTodoMd();
  all.push(...todoTasks);

  // 2. Inline tasks dans les dossiers connus
  try {
    const candidates = await walkVaultMarkdownFiles(getInlineScanRoots());
    for (const c of candidates) {
      // Re-vérif exclusion sur le path complet (defensive)
      if (isExcludedPath(c.vaultPath)) continue;
      try {
        const fileResult = await readVaultFile(c.folderPath, c.filename);
        if (!fileResult.success || !fileResult.content) continue;
        const tasks = extractTasksFromContent(c.vaultPath, fileResult.content);
        all.push(...tasks);
      } catch (err) {
        console.warn(
          `[vault-scanner] read ${c.vaultPath} échoué : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  } catch (err) {
    console.warn(
      `[vault-scanner] walker erreur : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return all;
}

// ============================================================
// Test helpers
// ============================================================

export const _scannerInternals = {
  TODO_PATH,
  EXCLUDED_FOLDER_SEGMENTS,
  MAX_WALK_DEPTH,
  MAX_FILES_PER_RUN,
  splitPath,
  isExcludedPath,
  hasHideTagInFrontmatter,
  getInlineScanRoots,
};

// Exposé pour `listMarkdownFiles` ré-export éventuel
export { listMarkdownFiles };
