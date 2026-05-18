/**
 * Polling TickTick — détection des changements de tâches.
 *
 * L'API publique developer.ticktick.com NE SUPPORTE PAS de webhooks.
 * À la place, on poll toutes les 15 min via GitHub Actions cron, on
 * compare avec le snapshot précédent (stocké sur disque), et on émet
 * des events synthétiques :
 *   - task.created.external : nouvelle tâche pas créée par Anya
 *   - task.updated          : titre/dueDate/priority modifié
 *   - task.completed        : status passé à 2
 *
 * Pour l'instant, les handlers loguent uniquement. L'intégration
 * Telegram (notification Thomas) est un TODO post-MVP — facile à
 * brancher : remplacer `logEvent` par un appel sendTelegramMessage.
 *
 * Bascule webhook → polling : S15.2.1 (2026-05-18).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { TickTickTask } from './types';
import { listTasks } from './ticktick-client';

// ============================================================
// Constantes
// ============================================================

/**
 * Répertoire de persistance — pattern aligné sur conversation-store.ts.
 * Priorité 1 : /home/runner/issa-data/ (persistant Replit)
 * Fallback   : /tmp/issa-secretariat/ (volatile mais OK en dev/test)
 */
const STORE_DIR = existsSync('/home/runner')
  ? '/home/runner/issa-data'
  : '/tmp/issa-secretariat';

const SNAPSHOT_PATH = resolve(STORE_DIR, 'ticktick-snapshot.json');

/** Préfixe des tags Anya — voir email-ingest/ticktick-integration.ts */
const ANYA_TAG_PREFIX = 'anya-';

// ============================================================
// Types
// ============================================================

/**
 * Snapshot minimal d'une tâche — on garde seulement les champs nécessaires
 * au diff. Évite d'exploser la taille du fichier pour 100+ tâches.
 */
export interface TaskSnapshot {
  id: string;
  projectId: string;
  title: string;
  status: number;
  priority: number;
  dueDate?: string;
  tags?: string[];
}

/** Map id → snapshot, pour O(1) lookup */
export type SnapshotStore = Record<string, TaskSnapshot>;

/** Wrapper avec metadata (version + timestamp) */
interface SnapshotFile {
  version: 1;
  lastPollAt: number;
  tasks: SnapshotStore;
}

export type TickTickEventType =
  | 'task.completed'
  | 'task.updated'
  | 'task.created.external';

export interface TickTickEvent {
  type: TickTickEventType;
  taskId: string;
  /** Snapshot avant changement (undefined pour created.external) */
  before?: TaskSnapshot;
  /** Snapshot après changement (undefined si la tâche a disparu, rare) */
  after?: TaskSnapshot;
  /** True si la tâche a été créée par Anya (tag anya-*) */
  createdByAnya?: boolean;
}

export interface PollStats {
  totalTasks: number;
  events: number;
  completed: number;
  updated: number;
  createdExternal: number;
  completedByAnya: number;
  durationMs: number;
  error?: string;
}

// ============================================================
// Snapshot store — lecture/écriture sur disque
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

/**
 * Charge le snapshot précédent. Retourne un store vide si :
 *   - le fichier n'existe pas (premier run)
 *   - le fichier est corrompu (JSON invalide)
 *   - la version est inconnue (futur changement de schéma)
 */
export function loadSnapshot(): SnapshotStore {
  try {
    if (!existsSync(SNAPSHOT_PATH)) {
      return {};
    }
    const raw = readFileSync(SNAPSHOT_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SnapshotFile>;

    if (parsed.version !== 1 || !parsed.tasks || typeof parsed.tasks !== 'object') {
      console.warn('[ticktick-poll] snapshot version inconnue ou corrompu, reset');
      return {};
    }

    return parsed.tasks;
  } catch {
    console.warn('[ticktick-poll] snapshot corrompu (JSON invalide), reset');
    return {};
  }
}

/**
 * Persiste le snapshot. Best-effort — un échec d'écriture loggue mais
 * ne throw pas (le cron suivant retentera).
 */
export function saveSnapshot(tasks: SnapshotStore): void {
  try {
    ensureStoreDir();
    const file: SnapshotFile = {
      version: 1,
      lastPollAt: Date.now(),
      tasks,
    };
    writeFileSync(SNAPSHOT_PATH, JSON.stringify(file, null, 2), 'utf8');
  } catch (err) {
    console.warn(
      `[ticktick-poll] erreur écriture snapshot : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ============================================================
// Diff — produit la liste d'events
// ============================================================

function toSnapshot(task: TickTickTask): TaskSnapshot {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    tags: task.tags,
  };
}

function isAnyaTask(snapshot: TaskSnapshot): boolean {
  return (snapshot.tags ?? []).some((t) => t.startsWith(ANYA_TAG_PREFIX));
}

/**
 * Compare deux snapshots et retourne true s'il y a un changement
 * matériel (titre/priorité/dueDate). status est traité séparément
 * pour produire l'event spécifique task.completed.
 */
function hasUpdate(before: TaskSnapshot, after: TaskSnapshot): boolean {
  return (
    before.title !== after.title ||
    before.priority !== after.priority ||
    before.dueDate !== after.dueDate
  );
}

export function diffSnapshots(
  before: SnapshotStore,
  afterTasks: TickTickTask[],
): TickTickEvent[] {
  const events: TickTickEvent[] = [];

  for (const task of afterTasks) {
    const after = toSnapshot(task);
    const prev = before[task.id];

    if (!prev) {
      // Nouvelle tâche — externe seulement si pas tag Anya
      // (Anya crée des tasks via createTickTickTaskForEmail, on les voit
      // aussi apparaître au prochain poll, mais on ne veut pas les ré-émettre)
      if (!isAnyaTask(after)) {
        events.push({
          type: 'task.created.external',
          taskId: task.id,
          after,
        });
      }
      continue;
    }

    // Complétion : status est passé à 2 (et n'était pas déjà à 2)
    if (prev.status !== 2 && after.status === 2) {
      events.push({
        type: 'task.completed',
        taskId: task.id,
        before: prev,
        after,
        createdByAnya: isAnyaTask(after),
      });
      continue;
    }

    // Update titre/priorité/dueDate (sans changement de status)
    if (prev.status === after.status && hasUpdate(prev, after)) {
      events.push({
        type: 'task.updated',
        taskId: task.id,
        before: prev,
        after,
      });
    }
  }

  // NB : suppressions (présent avant, absent après) — on les ignore
  //      volontairement. L'API TickTick filtre les tâches complétées
  //      d'un projet selon les params, et une absence pourrait être
  //      un faux positif (filtre). Trop risqué d'émettre un faux event.

  return events;
}

// ============================================================
// Handlers d'events (extensibles)
// ============================================================

function logEvent(event: TickTickEvent): void {
  const taskTitle = event.after?.title ?? event.before?.title ?? 'Tâche inconnue';

  switch (event.type) {
    case 'task.completed':
      if (event.createdByAnya) {
        console.warn(
          `[ticktick-poll] tâche Anya complétée : "${taskTitle}" (id=${event.taskId})`,
        );
      } else {
        console.warn(
          `[ticktick-poll] tâche externe complétée : "${taskTitle}" (id=${event.taskId})`,
        );
      }
      break;

    case 'task.updated':
      console.warn(
        `[ticktick-poll] tâche mise à jour : "${taskTitle}" (id=${event.taskId})`,
      );
      break;

    case 'task.created.external':
      console.warn(
        `[ticktick-poll] nouvelle tâche externe : "${taskTitle}" (id=${event.taskId})`,
      );
      break;
  }
}

// ============================================================
// API publique
// ============================================================

/**
 * Pipeline principal : list → diff → handle → save.
 *
 * Best-effort : si listTasks throw (TickTick down, OAuth expiré, etc.),
 * on retourne des stats avec error et on ne touche pas au snapshot.
 * Le cron suivant retentera dans 15 min.
 *
 * @param projectId Si fourni, ne poll que ce projet (sinon : tous)
 */
export async function pollTickTickTasks(projectId?: string): Promise<PollStats> {
  const t0 = Date.now();
  const stats: PollStats = {
    totalTasks: 0,
    events: 0,
    completed: 0,
    updated: 0,
    createdExternal: 0,
    completedByAnya: 0,
    durationMs: 0,
  };

  let tasks: TickTickTask[];
  try {
    tasks = await listTasks(projectId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[ticktick-poll] erreur listTasks : ${message}`);
    stats.error = message;
    stats.durationMs = Date.now() - t0;
    return stats;
  }

  stats.totalTasks = tasks.length;

  const previous = loadSnapshot();
  const events = diffSnapshots(previous, tasks);
  stats.events = events.length;

  for (const event of events) {
    try {
      logEvent(event);
    } catch (err) {
      // Un handler ne doit jamais casser le pipeline
      console.warn(
        `[ticktick-poll] erreur handler event : ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    switch (event.type) {
      case 'task.completed':
        stats.completed++;
        if (event.createdByAnya) stats.completedByAnya++;
        break;
      case 'task.updated':
        stats.updated++;
        break;
      case 'task.created.external':
        stats.createdExternal++;
        break;
    }
  }

  // Persister le nouveau snapshot (toutes les tâches actuelles)
  const newStore: SnapshotStore = {};
  for (const task of tasks) {
    newStore[task.id] = toSnapshot(task);
  }
  saveSnapshot(newStore);

  stats.durationMs = Date.now() - t0;
  return stats;
}

// ============================================================
// Exports pour tests
// ============================================================

export const __testing = {
  SNAPSHOT_PATH,
  toSnapshot,
  isAnyaTask,
  hasUpdate,
};
