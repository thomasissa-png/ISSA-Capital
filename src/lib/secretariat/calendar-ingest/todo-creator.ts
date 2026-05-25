/**
 * Todo-creator — création (ou mise à jour) du todo « CR à faire » dans TickTick
 * pour une réunion éligible (refonte S23).
 *
 * Décision verrouillée S23 §7 : UN SEUL todo par réunion éligible.
 *   - titre : « CR à faire — <sujet> (<date>) »
 *   - échéance : jour de la réunion (jour J, heure de début si timed)
 *   - projet TickTick : projet détecté (canonical name) sinon Inbox (undefined)
 *   - création silencieuse (pas de carte Telegram)
 *
 * TickTick = hub unique S20 : JAMAIS d'écriture dans `03. Tâches/Todo.md`
 * (miroir read-only régénéré).
 *
 * R8 (P0 #108) : date/heure via `parisLocalToTickTickFields` → isAllDay + timeZone
 * IANA Europe/Paris, jamais d'UTC implicite.
 *
 * Idempotence : si l'event est replanifié (event.updated change), le runner
 * réutilise le `todoId` stocké → `updateTask` plutôt que `createTask`.
 */

import { createTask, updateTask, listProjects } from '../ticktick/ticktick-client';
import { parisLocalToTickTickFields } from '../handlers/todo-from-telegram';
import type { EventProjection } from './types';

// ============================================================
// Types
// ============================================================

export interface TodoCreateResult {
  status: 'created' | 'updated' | 'error';
  todoId?: string;
  error?: string;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Construit le titre du todo : « CR à faire — <sujet> (<date>) ».
 * Tronque le sujet à 80 chars pour rester lisible dans TickTick.
 */
export function buildTodoTitle(projection: EventProjection): string {
  const subject = (projection.sujet || 'Réunion').trim().slice(0, 80);
  return `CR à faire — ${subject} (${projection.date})`;
}

/**
 * Construit le string ISO local Paris attendu par parisLocalToTickTickFields :
 *   - event timed → "YYYY-MM-DDTHH:mm:00"
 *   - event sans heure → "YYYY-MM-DDT00:00:00" (→ isAllDay true)
 */
export function buildParisLocalIso(projection: EventProjection): string {
  const heure = projection.heure ?? '00:00';
  return `${projection.date}T${heure}:00`;
}

/**
 * Résout le projectId TickTick par nom canonique (match exact puis contient,
 * case-insensitive). Retourne undefined si rien ne matche → tâche en Inbox.
 */
export async function resolveTickTickProjectId(
  projectName?: string,
): Promise<string | undefined> {
  if (!projectName) return undefined;
  try {
    const projects = await listProjects();
    const lower = projectName.toLowerCase();
    const match =
      projects.find((p) => p.name.toLowerCase() === lower) ??
      projects.find((p) => p.name.toLowerCase().includes(lower));
    return match?.id;
  } catch (err) {
    console.warn(
      `[todo-creator] listProjects échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

// ============================================================
// API publique
// ============================================================

/**
 * Crée (ou met à jour si `existingTodoId` fourni) le todo « CR à faire » TickTick.
 *
 * @param projection Projection de l'event (date, heure, sujet)
 * @param projectName Nom canonique du projet détecté (ex: "Versi Immobilier") ou undefined → Inbox
 * @param existingTodoId Si présent (event replanifié) → updateTask au lieu de create
 */
export async function createCrTodo(
  projection: EventProjection,
  projectName?: string,
  existingTodoId?: string,
): Promise<TodoCreateResult> {
  const title = buildTodoTitle(projection);
  const parisLocalIso = buildParisLocalIso(projection);
  const { dueDate, isAllDay, timeZone } = parisLocalToTickTickFields(parisLocalIso);
  const projectId = await resolveTickTickProjectId(projectName);

  try {
    // Update (event replanifié) : on a besoin du projectId pour le PATCH TickTick.
    if (existingTodoId) {
      const updated = await updateTask(existingTodoId, projectId ?? '', {
        title,
        dueDate,
      });
      return { status: 'updated', todoId: updated?.id ?? existingTodoId };
    }

    const task = await createTask({
      title,
      dueDate,
      isAllDay,
      timeZone,
      projectId,
    });
    return { status: 'created', todoId: task.id };
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
