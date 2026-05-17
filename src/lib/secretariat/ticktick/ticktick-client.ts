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
 * Liste les tâches d'un projet. Si projectId non fourni, liste toutes les tâches.
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

  return allTasks;
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
