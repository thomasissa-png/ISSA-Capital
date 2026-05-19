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
import { listMarkdownFiles, listSubfolders } from '../vault-client/drive-resolver';

// ============================================================
// Constantes
// ============================================================

/** Path Todo.md vault (depuis vault-paths.ts). */
const TODO_PATH = VAULT_PATHS.todoMd; // "03. Tâches/Todo.md"

/** Dossiers exclus du scan inline (case-insensitive, n'importe quel segment).
 *
 * S18.3b — extension : tout segment commençant par `_` est exclu en plus
 * de la liste explicite (cf. isExcludedPath).
 */
const EXCLUDED_FOLDER_SEGMENTS: ReadonlyArray<string> = [
  'profil',
  'archive',
  '_inbox',
  '_outbox',
  'anyalogs',
  'anyastate',
  '_historique',
  '_zhistorique',
];

/** Limite de profondeur du walker (protection runaway). S18.3b : porté à 10. */
const MAX_WALK_DEPTH = 10;

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

/** Test si un path logique contient un segment de dossier exclu.
 *
 * S18.3b — règle étendue :
 *  - segment dans EXCLUDED_FOLDER_SEGMENTS (liste explicite)
 *  - OU segment commence par `_` (convention vault Anya : `_zHistorique`,
 *    `_Archive`, `_Inbox`, etc. — tous les "containers techniques")
 *
 * Le segment de niveau racine `_Inbox` doit toujours être exclu (logs Anya).
 */
export function isExcludedPath(vaultPath: string): boolean {
  const segments = vaultPath.split('/').map((s) => s.toLowerCase().trim());
  for (const seg of segments) {
    if (!seg) continue;
    if (EXCLUDED_FOLDER_SEGMENTS.includes(seg)) return true;
    if (seg.startsWith('_')) return true;
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
 * Walker récursif complet (S18.3b) : énumère les fichiers .md du vault à
 * partir des dossiers racine "permis", en descendant via `listSubfolders`
 * jusqu'à MAX_WALK_DEPTH (10).
 *
 * Exclusions strictes :
 *  - segment dossier dans EXCLUDED_FOLDER_SEGMENTS
 *  - OU segment commence par `_` (containers techniques vault)
 *
 * Limite de fichiers par run pour éviter runaway sur un vault gonflé.
 * Métriques retournées via les compteurs internes (loggés en fin de scan).
 */
async function walkVaultMarkdownFiles(
  rootFolders: ReadonlyArray<string>,
): Promise<{
  files: Array<{ folderPath: string; filename: string; vaultPath: string }>;
  metrics: {
    foldersWalked: number;
    foldersExcluded: number;
    filesDiscovered: number;
    depthLimitHits: number;
  };
}> {
  const queue: Array<{ path: string; depth: number }> = rootFolders.map(
    (p) => ({ path: p, depth: 0 }),
  );
  const out: Array<{ folderPath: string; filename: string; vaultPath: string }> = [];
  const seenFolders = new Set<string>();
  const metrics = {
    foldersWalked: 0,
    foldersExcluded: 0,
    filesDiscovered: 0,
    depthLimitHits: 0,
  };

  while (queue.length > 0 && out.length < MAX_FILES_PER_RUN) {
    const entry = queue.shift();
    if (!entry) break;
    const { path: folderPath, depth } = entry;

    // Deduplication (un dossier listé 2 fois ne fait rien)
    if (seenFolders.has(folderPath)) continue;
    seenFolders.add(folderPath);

    // Exclusion stricte
    if (isExcludedPath(folderPath)) {
      metrics.foldersExcluded++;
      continue;
    }
    if (depth > MAX_WALK_DEPTH) {
      metrics.depthLimitHits++;
      console.warn(`[vault-scanner] profondeur max atteinte (>${MAX_WALK_DEPTH}) à ${folderPath}`);
      continue;
    }

    metrics.foldersWalked++;

    // 1. Lister les .md du dossier
    try {
      const files = await listVaultFolder(folderPath);
      for (const f of files) {
        if (out.length >= MAX_FILES_PER_RUN) break;
        const vaultPath = `${folderPath}/${f.name}`;
        // Skip Todo.md (scanné séparément)
        if (vaultPath === TODO_PATH) continue;
        out.push({ folderPath, filename: f.name, vaultPath });
        metrics.filesDiscovered++;
      }
    } catch (err) {
      console.warn(
        `[vault-scanner] listing ${folderPath} échoué : ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 2. Descente récursive : sous-dossiers non exclus
    try {
      const subfolders = await listSubfolders(folderPath);
      for (const sf of subfolders) {
        const childPath = `${folderPath}/${sf.name}`;
        if (isExcludedPath(childPath)) {
          metrics.foldersExcluded++;
          continue;
        }
        queue.push({ path: childPath, depth: depth + 1 });
      }
    } catch (err) {
      console.warn(
        `[vault-scanner] listSubfolders ${folderPath} échoué : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { files: out, metrics };
}

/**
 * Liste les dossiers racine du vault à scanner récursivement (S18.3b).
 *
 * On démarre depuis les racines TOP-LEVEL connues du vault Anya. Le walker
 * descend récursivement (MAX_WALK_DEPTH = 10) en excluant tout segment
 * commençant par `_` ou présent dans EXCLUDED_FOLDER_SEGMENTS (Profil,
 * Archive, _Inbox, _Outbox, AnyaLogs, AnyaState, _zHistorique, etc.).
 *
 * Structure vault (référence) :
 *   00. Me           ← contient Profil/ (EXCLU)
 *   01. Reunions     ← OK (récursif)
 *   02. Projets      ← OK (récursif : Perso, Pro)
 *   03. Taches       ← contient Todo.md (scanné séparément, .md autres OK)
 *   04. Notes        ← OK (récursif)
 *   05. ...
 *   06. Réunions     ← OK (récursif : par année/mois)
 *   07. Contacts     ← OK (récursif)
 *   08. Outils       ← OK (récursif)
 *   _Inbox, _Outbox  ← EXCLU (préfixe _)
 *
 * Note : le walker se charge des exclusions, on liste simplement les racines.
 */
function getInlineScanRoots(): string[] {
  return [
    '00. Me',
    '01. Reunions',
    '02. Projets',
    '03. Tâches',
    '04. Notes',
    '05. Notes',
    '06. Réunions',
    '07. Contacts',
    '08. Outils',
  ];
}

/**
 * Scan complet du vault — Todo.md + inline tasks récursif (S18.3b).
 *
 * @returns Liste de VaultTask actives + completed (filtrage status fait par
 *   les push/pull engines).
 */
export async function scanVault(): Promise<VaultTask[]> {
  const t0 = Date.now();
  const all: VaultTask[] = [];

  // 1. Todo.md (source primaire, toujours scanné)
  const todoTasks = await scanTodoMd();
  all.push(...todoTasks);

  // 2. Inline tasks dans tout le vault (récursif, exclusions strictes)
  let filesRead = 0;
  let filesSkippedFmHide = 0;
  let filesReadFailed = 0;
  let metrics = {
    foldersWalked: 0,
    foldersExcluded: 0,
    filesDiscovered: 0,
    depthLimitHits: 0,
  };

  try {
    const walkResult = await walkVaultMarkdownFiles(getInlineScanRoots());
    metrics = walkResult.metrics;

    for (const c of walkResult.files) {
      // Re-vérif exclusion sur le path complet (defensive — un dossier permis
      // pourrait contenir un sous-fichier nommé `_xxx.md`)
      if (isExcludedPath(c.vaultPath)) continue;
      try {
        const fileResult = await readVaultFile(c.folderPath, c.filename);
        if (!fileResult.success || !fileResult.content) {
          filesReadFailed++;
          continue;
        }
        // Comptage hide-tcw frontmatter
        if (hasHideTagInFrontmatter(fileResult.content)) {
          filesSkippedFmHide++;
          continue;
        }
        const tasks = extractTasksFromContent(c.vaultPath, fileResult.content);
        all.push(...tasks);
        filesRead++;
      } catch (err) {
        filesReadFailed++;
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

  const durationMs = Date.now() - t0;
  console.info(
    `[vault-scanner] scan terminé — dossiers parcourus=${metrics.foldersWalked}, ` +
      `exclus=${metrics.foldersExcluded}, fichiers découverts=${metrics.filesDiscovered}, ` +
      `lus=${filesRead}, skip frontmatter hide-tcw=${filesSkippedFmHide}, ` +
      `read fail=${filesReadFailed}, tâches retenues=${all.length}, ` +
      `depthLimitHits=${metrics.depthLimitHits}, durationMs=${durationMs}`,
  );

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
