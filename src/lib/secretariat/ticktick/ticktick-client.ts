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

  return tickTickFetch<TickTickTask>('/task', {
    method: 'POST',
    body: JSON.stringify(body),
  });
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
  const fromEnv = (process.env.TICKTICK_INBOX_PROJECT_ID ?? '').trim();
  if (fromEnv) return fromEnv;
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
    console.warn('[ticktick-client] inbox non résolu (définir TICKTICK_INBOX_PROJECT_ID si besoin)');
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
