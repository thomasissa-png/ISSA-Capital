/**
 * Client TickTick API — CRUD tâches bidirectionnel.
 *
 * API Reference : https://developer.ticktick.com/api#/openapi
 * Base URL : https://api.ticktick.com/open/v1
 *
 * Fonctions exposées :
 *   - createTask(input) → TickTickTask
 *   - getTask(projectId, taskId) → TickTickTask
 *   - updateTask(projectId, taskId, patch) → TickTickTask
 *   - completeTask(projectId, taskId) → void
 *   - listTasks(projectId?) → TickTickTask[]
 *   - listProjects() → TickTickProject[]
 *
 * Jalon 5C — Session 15.
 */

import type {
  TickTickTask,
  TickTickProject,
  CreateTaskInput,
  UpdateTaskInput,
} from './types';
import { getTickTickAccessToken } from './oauth';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

// ============================================================
// Constantes
// ============================================================

const BASE_URL = 'https://api.ticktick.com/open/v1';

// ============================================================
// Helpers
// ============================================================

async function tickTickFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getTickTickAccessToken();
  if (!token) {
    throw new Error('TickTick non authentifié — OAuth initial requis via /api/secretariat/ticktick/oauth/init');
  }

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    // S26 hotfix — timeout obligatoire : sans lui, un createTask qui stalle
    // (réseau TickTick) fige processOneEmail → tout le run email-ingest.
    signal: options.signal ?? AbortSignal.timeout(30_000),
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TickTick API ${options.method ?? 'GET'} ${path} échoué (${response.status}): ${text}`);
  }

  // Certaines réponses sont vides (ex: complete)
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return undefined as unknown as T;
  }

  return (await response.json()) as T;
}

// ============================================================
// Auto-résolution de l'Inbox (S24, OPTION B — sans env var)
// ============================================================

/**
 * Cache process de l'ID du projet Inbox. L'API Open ne liste PAS l'Inbox via
 * `/project`, MAIS une tâche créée SANS `projectId` y atterrit et la réponse
 * porte alors le vrai `projectId` de l'Inbox → on le capte au vol (cf. createTask).
 *
 * Persistance double (S24 soir) :
 *  - `globalThis` pour survivre aux re-évaluations Next.js entre requêtes.
 *  - fichier disque pour survivre aux REDÉMARRAGES du service (sinon : après
 *    chaque restart, l'inbox redevient invisible jusqu'à la prochaine écriture
 *    → poll/morning-brief manquaient les tâches de l'inbox).
 */
const INBOX_ID_CACHE_KEY = '__issa_ticktick_inbox_id__' as const;
const INBOX_PERSIST_PATH = (process.env.TICKTICK_INBOX_CACHE_FILE ?? '').trim()
  || `${process.env.HOME ?? '/tmp'}/.anya-ticktick-inbox.json`;

function readPersistedInboxId(): string | null {
  try {
    if (!existsSync(INBOX_PERSIST_PATH)) return null;
    const raw = readFileSync(INBOX_PERSIST_PATH, 'utf8');
    const data = JSON.parse(raw) as { inboxId?: string };
    return data.inboxId && typeof data.inboxId === 'string' ? data.inboxId : null;
  } catch (err) {
    console.warn(
      `[ticktick-client] lecture cache inbox ${INBOX_PERSIST_PATH} KO : ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

function writePersistedInboxId(id: string): void {
  try {
    writeFileSync(INBOX_PERSIST_PATH, JSON.stringify({ inboxId: id }), 'utf8');
  } catch (err) {
    console.warn(
      `[ticktick-client] écriture cache inbox ${INBOX_PERSIST_PATH} KO : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function getCachedInboxId(): string | null {
  const fromMemory =
    ((globalThis as Record<string, unknown>)[INBOX_ID_CACHE_KEY] as string | undefined) ?? null;
  if (fromMemory) return fromMemory;
  // Cache mémoire vide (premier appel après restart) → tenter le disque.
  const fromDisk = readPersistedInboxId();
  if (fromDisk) {
    (globalThis as Record<string, unknown>)[INBOX_ID_CACHE_KEY] = fromDisk;
    console.warn(`[ticktick-client] inbox restaurée du cache disque : ${fromDisk}`);
    return fromDisk;
  }
  return null;
}
function setCachedInboxId(id: string): void {
  (globalThis as Record<string, unknown>)[INBOX_ID_CACHE_KEY] = id;
  writePersistedInboxId(id);
}
/** Réinitialise le cache Inbox (tests). */
export function _clearInboxIdCache(): void {
  delete (globalThis as Record<string, unknown>)[INBOX_ID_CACHE_KEY];
  try {
    if (existsSync(INBOX_PERSIST_PATH)) unlinkSync(INBOX_PERSIST_PATH);
  } catch {
    // best-effort
  }
}

// ============================================================
// API publique — Tâches
// ============================================================

/**
 * Crée une nouvelle tâche TickTick.
 */
export async function createTask(input: CreateTaskInput): Promise<TickTickTask> {
  const body = {
    title: input.title,
    content: input.content,
    desc: input.desc,
    dueDate: input.dueDate,
    startDate: input.startDate,
    priority: input.priority ?? 0,
    projectId: input.projectId,
    tags: input.tags,
    isAllDay: input.isAllDay,
    timeZone: input.timeZone,
  };

  const task = await tickTickFetch<TickTickTask>('/task', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  // OPTION B : une tâche créée SANS projectId atterrit dans l'Inbox → la réponse
  // révèle son ID. On le mémorise pour le poll/miroir (plus besoin d'env var).
  if (!input.projectId && task?.projectId && !getCachedInboxId()) {
    setCachedInboxId(task.projectId);
    console.warn(`[ticktick-client] inbox auto-résolu via createTask : ${task.projectId}`);
  }

  return task;
}

/**
 * Récupère une tâche par ID.
 */
export async function getTask(projectId: string, taskId: string): Promise<TickTickTask> {
  return tickTickFetch<TickTickTask>(`/project/${projectId}/task/${taskId}`);
}

/**
 * Met à jour une tâche existante.
 */
export async function updateTask(
  taskId: string,
  projectId: string,
  patch: UpdateTaskInput,
): Promise<TickTickTask> {
  const body = {
    id: taskId,
    projectId,
    ...patch,
  };

  return tickTickFetch<TickTickTask>('/task/' + taskId, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Marque une tâche comme complétée.
 */
export async function completeTask(projectId: string, taskId: string): Promise<void> {
  await tickTickFetch<void>(`/project/${projectId}/task/${taskId}/complete`, {
    method: 'POST',
  });
}

/**
 * Résout l'ID du projet Inbox TickTick. L'API Open ne liste PAS toujours l'Inbox
 * dans `/project` → on tente, dans l'ordre :
 *   1. `TICKTICK_INBOX_PROJECT_ID` (override explicite — le plus fiable).
 *   2. un projet nommé « Inbox » remonté par `/project`.
 * Retourne null si non résolu (l'Inbox est alors simplement sautée).
 */
function resolveInboxProjectId(projects: TickTickProject[]): string | null {
  // 1. Override explicite (le plus fiable).
  const fromEnv = (process.env.TICKTICK_INBOX_PROJECT_ID ?? '').trim();
  if (fromEnv) return fromEnv;
  // 2. Auto-résolu (OPTION B) : capté au vol lors d'un createTask sans projectId.
  const cached = getCachedInboxId();
  if (cached) return cached;
  // 3. Dernier recours : un projet nommé « Inbox » remonté par /project.
  const byName = projects.find((p) => (p.name ?? '').trim().toLowerCase() === 'inbox');
  return byName?.id ?? null;
}

/**
 * Liste les tâches d'un projet. Si projectId non fourni, liste toutes les tâches
 * de TOUS les projets + l'Inbox (les tâches créées en mobile via « + » et par le
 * workflow n8n y atterrissent — sinon jamais ramenées dans Todo.md).
 */
export async function listTasks(projectId?: string): Promise<TickTickTask[]> {
  if (projectId) {
    const data = await tickTickFetch<{ tasks: TickTickTask[] }>(`/project/${projectId}/data`);
    return data.tasks ?? [];
  }

  // Sans projectId : lister les projets puis agréger
  const projects = await listProjects();
  const allTasks: TickTickTask[] = [];

  for (const project of projects) {
    try {
      const data = await tickTickFetch<{ tasks: TickTickTask[] }>(`/project/${project.id}/data`);
      if (data.tasks) {
        allTasks.push(...data.tasks);
      }
    } catch {
      // Skip les projets en erreur (fermés, etc.)
      console.warn(`[ticktick-client] erreur listing tâches projet ${project.id}`);
    }
  }

  // Inbox : non listé par /project → fetch dédié (best-effort, n'interrompt jamais le poll).
  const inboxId = resolveInboxProjectId(projects);
  if (inboxId) {
    try {
      const data = await tickTickFetch<{ tasks: TickTickTask[] }>(`/project/${inboxId}/data`);
      const n = data.tasks?.length ?? 0;
      if (data.tasks) allTasks.push(...data.tasks);
      console.warn(`[ticktick-client] inbox ${inboxId} → ${n} tâche(s)`);
    } catch (err) {
      console.warn(
        `[ticktick-client] inbox ${inboxId} inaccessible — ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`,
      );
    }
  } else {
    console.warn(
      '[ticktick-client] inbox non résolu — sera auto-résolu au prochain createTask sans projectId (ou définir TICKTICK_INBOX_PROJECT_ID)',
    );
  }

  // Dédup par id (au cas où l'Inbox serait aussi remontée par /project).
  const seen = new Set<string>();
  return allTasks.filter((t) => {
    const id = (t as { id?: string }).id ?? '';
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

// ============================================================
// API publique — Projets
// ============================================================

/**
 * Liste tous les projets (listes) TickTick.
 */
export async function listProjects(): Promise<TickTickProject[]> {
  return tickTickFetch<TickTickProject[]>('/project');
}
