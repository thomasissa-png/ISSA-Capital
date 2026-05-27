/**
 * Mirror renderer — régénère `03. Tâches/Todo.md` depuis TickTick (S20).
 *
 * Modèle architectural (cf. vault SOT `08. Outils/Anya/Skills/Workflow Todo.md`
 * + `docs/ia/ticktick-gap-analysis-s20.md`) :
 *   - TickTick = hub unique create-only.
 *   - `Todo.md` = miroir read-only régénéré toutes les 15min (aligné cron poll).
 *   - Les canaux create-only (Email, Telegram, Plaud, TickTick natif) poussent
 *     vers TickTick ; ce module ne fait que lire TickTick et écrire le miroir.
 *
 * Algorithme (cf. gap analysis §3.2) :
 *   1. listTasks() (TickTick API) → toutes les tâches actives.
 *   2. Filtrer `status !== 2` (pas complétées).
 *   3. Grouper par `projectId` via listProjects() → sections markdown
 *      (titre = nom projet TickTick).
 *   4. Tâches sans projet → section `## Inbox` en tête.
 *   5. Ordonnancement intra-section : dueDate asc puis priority desc.
 *   6. Sérialiser chaque tâche via `ticktick-sync/serializer.ts` réutilisé
 *      (le module S18 reste en place pendant le kill switch).
 *   7. Composer le fichier complet avec header AUTO-GENERATED + timestamp.
 *   8. Calculer hash sha1 → no-op si identique au dernier hash en state.
 *   9. PATCH in-place R5 sur Drive (`updateFileContent`).
 *
 * Le fileId est résolu dynamiquement via `vault-client/drive-resolver` (R1/R7,
 * pas de hardcoded). Si le fichier n'existe pas dans Drive, on retourne un
 * warning sans throw (le poll continue de tourner).
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TickTickProject, TickTickTask } from './types';
import { listProjects, listTasks } from './ticktick-client';
import { serializeTaskToLine } from '../ticktick-sync/serializer';
import type { VaultTask } from '../ticktick-sync/types';
import { resolveFilePath, listMarkdownFiles } from '../vault-client/drive-resolver';
import { updateFileContent } from '../drive-upload';

// ============================================================
// Constantes
// ============================================================

/** Chemin logique du miroir dans le vault Drive. */
export const TODO_MIRROR_FOLDER = '03. Tâches';
export const TODO_MIRROR_FILENAME = 'Todo.md';
export const TODO_MIRROR_PATH = `${TODO_MIRROR_FOLDER}/${TODO_MIRROR_FILENAME}`;

/** Nom de la section pour les tâches sans projet TickTick. */
const INBOX_SECTION = 'Inbox';

/** Préfixe header AUTO-GENERATED. */
const AUTO_GEN_HEADER_LINE = '<!-- AUTO-GENERATED depuis TickTick. NE PAS ÉDITER. Régénéré toutes les 15min. -->';

/**
 * Répertoire de persistance du hash (idempotence).
 * Aligné sur `ticktick/poll.ts` (mêmes conventions Replit).
 */
const STORE_DIR = existsSync('/home/runner')
  ? '/home/runner/issa-data'
  : '/tmp/issa-secretariat';

const MIRROR_STATE_PATH = resolve(STORE_DIR, 'ticktick-mirror-state.json');

// ============================================================
// Types
// ============================================================

export interface MirrorRenderStats {
  /** Nombre total de tâches actives reçues de TickTick. */
  totalTasks: number;
  /** Nombre de sections générées. */
  sections: number;
  /** True si le contenu a changé depuis la dernière régénération. */
  changed: boolean;
  /** True si le PATCH Drive a réussi. */
  patched: boolean;
  /** Hash sha1 du contenu généré. */
  contentHash: string;
  /** Erreur éventuelle (pipeline best-effort, jamais de throw vers l'appelant). */
  error?: string;
  /** Durée totale en ms. */
  durationMs: number;
}

interface MirrorState {
  version: 1;
  /** Hash sha1 du dernier contenu écrit dans Drive (pour no-op). */
  lastContentHash: string;
  /** ISO timestamp dernière régénération réussie. */
  lastRenderedAt: string;
}

// ============================================================
// State hash — lecture/écriture sur disque (idempotence)
// ============================================================

function ensureStoreDir(): void {
  try {
    if (!existsSync(STORE_DIR)) {
      mkdirSync(STORE_DIR, { recursive: true });
    }
  } catch {
    // /tmp peut ne pas être disponible dans certains environnements de test
  }
}

export function loadMirrorState(): MirrorState | null {
  try {
    if (!existsSync(MIRROR_STATE_PATH)) return null;
    const raw = readFileSync(MIRROR_STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<MirrorState>;
    if (parsed.version !== 1 || typeof parsed.lastContentHash !== 'string') {
      return null;
    }
    return {
      version: 1,
      lastContentHash: parsed.lastContentHash,
      lastRenderedAt: parsed.lastRenderedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveMirrorState(state: MirrorState): void {
  try {
    ensureStoreDir();
    writeFileSync(MIRROR_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.warn(
      `[ticktick-mirror] erreur écriture state : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ============================================================
// Conversion TickTickTask → VaultTask (pour serializer)
// ============================================================

/**
 * Convertit une TickTickTask en VaultTask pour réutiliser
 * `serializeTaskToLine` (S18). Position fictive (le miroir n'a pas de notion
 * de ligne source ; la position ne sert qu'au push S18, désactivé).
 */
function ticktickToVaultTask(task: TickTickTask): VaultTask {
  // Priority TickTick : 0 | 1 | 3 | 5 (cf. types.ts S18)
  // Statut TickTick : 0 = active, 2 = completed
  const priority = (
    [0, 1, 3, 5].includes(task.priority) ? task.priority : 0
  ) as 0 | 1 | 3 | 5;

  // dueDate ISO si présent, isAllDay déduit (si l'heure est 00:00 UTC → all day)
  let isAllDay = true;
  if (task.dueDate) {
    const time = task.dueDate.slice(11, 16);
    isAllDay = time === '00:00' || task.isAllDay === true;
  }

  return {
    title: task.title ?? '',
    status: task.status === 2 ? 2 : 0,
    priority,
    dueDate: task.dueDate,
    isAllDay,
    tags: Array.isArray(task.tags) ? task.tags : [],
    // projectName non utilisé en sortie du serializer mais requis par le type
    projectName: 'Important',
    repeatFlag: task.repeatFlag,
    position: { vaultPath: TODO_MIRROR_PATH, lineNumber: 0 },
  };
}

// ============================================================
// Rendu markdown
// ============================================================

/**
 * Comparateur d'ordonnancement intra-section : dueDate asc, puis priority desc.
 * Tâches sans dueDate placées en fin de section.
 */
export function compareTasksForRender(a: TickTickTask, b: TickTickTask): number {
  const aDue = a.dueDate ?? '';
  const bDue = b.dueDate ?? '';
  if (aDue && !bDue) return -1;
  if (!aDue && bDue) return 1;
  if (aDue !== bDue) return aDue < bDue ? -1 : 1;
  // Egalité dueDate (ou les deux absents) → priority desc (5 avant 1)
  return (b.priority ?? 0) - (a.priority ?? 0);
}

/**
 * Construit le contenu markdown complet du miroir.
 * Tâches groupées par projectId, section Inbox en tête pour les orphelines.
 *
 * @param tasks Toutes les tâches TickTick (actives ET complétées — on filtre ici).
 * @param projects Liste des projets TickTick (pour résoudre projectId → nom).
 * @param now Timestamp ISO pour le header (injectable pour tests).
 */
export function renderMirrorMarkdown(
  tasks: TickTickTask[],
  projects: TickTickProject[],
  now: Date = new Date(),
): string {
  // Filtrer : exclure status === 2 (complétées)
  const active = tasks.filter((t) => t.status !== 2);

  // Map projectId → name
  const projectName = new Map<string, string>();
  for (const p of projects) {
    projectName.set(p.id, p.name);
  }

  // Grouper par projectId (clé '' pour orphelines)
  const grouped = new Map<string, TickTickTask[]>();
  for (const t of active) {
    const key = t.projectId && projectName.has(t.projectId) ? t.projectId : '';
    const arr = grouped.get(key) ?? [];
    arr.push(t);
    grouped.set(key, arr);
  }

  // Trier chaque groupe
  for (const arr of grouped.values()) {
    arr.sort(compareTasksForRender);
  }

  // Composer markdown
  const lines: string[] = [];
  lines.push(AUTO_GEN_HEADER_LINE);
  lines.push(`<!-- Dernière régénération : ${now.toISOString()}. Source : TickTick API. -->`);
  lines.push('');

  // Sections par projet d'abord (ordre alpha FR = Critique → Important → Priorité
  // basse, soit du plus chaud au moins chaud), puis l'Inbox en DERNIER.
  const projectSections: Array<{ name: string; tasks: TickTickTask[] }> = [];
  for (const [projectId, arr] of grouped.entries()) {
    if (projectId === '') continue;
    const name = projectName.get(projectId) ?? projectId;
    projectSections.push({ name, tasks: arr });
  }
  projectSections.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  for (const section of projectSections) {
    lines.push(`## ${section.name}`);
    lines.push('');
    for (const t of section.tasks) {
      lines.push(serializeTaskToLine(ticktickToVaultTask(t)));
    }
    lines.push('');
  }

  // Section Inbox EN DERNIER (orphelines : tâches sans projet connu = Inbox).
  const orphans = grouped.get('') ?? [];
  if (orphans.length > 0) {
    lines.push(`## ${INBOX_SECTION}`);
    lines.push('');
    for (const t of orphans) {
      lines.push(serializeTaskToLine(ticktickToVaultTask(t)));
    }
    lines.push('');
  }

  // Trailing newline + section count info
  return lines.join('\n').replace(/\n+$/, '\n');
}

/** Calcule le hash sha1 hex du contenu. */
export function hashContent(content: string): string {
  return createHash('sha1').update(content, 'utf8').digest('hex');
}

// ============================================================
// Résolution fileId Drive (R1/R7 — pas de hardcoded)
// ============================================================

/**
 * Résout le fileId Drive de `03. Tâches/Todo.md`.
 * Retourne null si le fichier n'existe pas (pas de création — le miroir
 * suppose que Thomas a déjà le fichier dans son vault).
 */
async function resolveTodoMirrorFileId(): Promise<string | null> {
  const resolved = await resolveFilePath(TODO_MIRROR_FOLDER, TODO_MIRROR_FILENAME);
  if (resolved.success && resolved.fileId) return resolved.fileId;

  // Fallback : list folder + match case-insensitive
  try {
    const files = await listMarkdownFiles(TODO_MIRROR_FOLDER);
    const match = files.find(
      (f) => f.name.toLowerCase() === TODO_MIRROR_FILENAME.toLowerCase(),
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}

// ============================================================
// API publique — régénération
// ============================================================

/**
 * Régénère le miroir `03. Tâches/Todo.md` depuis TickTick.
 *
 * Best-effort : toute erreur (TickTick API down, Drive PATCH KO, fileId
 * introuvable) est capturée et retournée dans `stats.error`. Jamais de throw
 * vers l'appelant — le cron poll doit continuer même si la régénération échoue.
 *
 * @param now Injectable pour tests (timestamp du header).
 */
export async function regenerateTodoMirror(
  now: Date = new Date(),
): Promise<MirrorRenderStats> {
  const t0 = Date.now();
  const stats: MirrorRenderStats = {
    totalTasks: 0,
    sections: 0,
    changed: false,
    patched: false,
    contentHash: '',
    durationMs: 0,
  };

  try {
    // 1. Fetch TickTick : projets + tâches
    const [projects, tasks] = await Promise.all([
      listProjects(),
      listTasks(),
    ]);

    stats.totalTasks = tasks.filter((t) => t.status !== 2).length;

    // 2. Render markdown
    const content = renderMirrorMarkdown(tasks, projects, now);
    stats.contentHash = hashContent(content);
    stats.sections = (content.match(/^## /gm) ?? []).length;

    // 3. Idempotence — no-op si contenu identique
    const previous = loadMirrorState();
    if (previous && previous.lastContentHash === stats.contentHash) {
      stats.changed = false;
      stats.patched = false;
      console.warn(
        `[ticktick-mirror] no-op (hash inchangé) — ${stats.totalTasks} tâches actives`,
      );
      stats.durationMs = Date.now() - t0;
      return stats;
    }

    stats.changed = true;

    // 4. Résoudre fileId Drive
    const fileId = await resolveTodoMirrorFileId();
    if (!fileId) {
      stats.error = `fileId introuvable pour ${TODO_MIRROR_PATH} — vérifier que le fichier existe dans le vault Drive`;
      console.warn(`[ticktick-mirror] ${stats.error}`);
      stats.durationMs = Date.now() - t0;
      return stats;
    }

    // 5. PATCH in-place R5
    const result = await updateFileContent(fileId, content, 'text/markdown');
    if (!result.success) {
      stats.error = `Drive PATCH échoué : ${result.error ?? 'inconnu'}`;
      console.warn(`[ticktick-mirror] ${stats.error}`);
      stats.durationMs = Date.now() - t0;
      return stats;
    }

    stats.patched = true;

    // 6. Persister le hash
    saveMirrorState({
      version: 1,
      lastContentHash: stats.contentHash,
      lastRenderedAt: now.toISOString(),
    });

    console.warn(
      `[ticktick-mirror] régénéré — ${stats.totalTasks} tâches, ${stats.sections} sections, ${Date.now() - t0}ms`,
    );
  } catch (err) {
    stats.error = err instanceof Error ? err.message : String(err);
    console.warn(`[ticktick-mirror] erreur : ${stats.error}`);
  }

  stats.durationMs = Date.now() - t0;
  return stats;
}

// ============================================================
// Exports pour tests
// ============================================================

export const __testing = {
  MIRROR_STATE_PATH,
  ticktickToVaultTask,
  resolveTodoMirrorFileId,
};
