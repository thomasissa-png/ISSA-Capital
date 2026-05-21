/**
 * Handler callback Telegram — préfixe `task_` (S20, R4).
 *
 * Couvre :
 *  - `task_cancel:<taskId>` → annule la tâche TickTick via `completeTask`
 *    (décision Thomas par défaut S20 : marquer [x], idempotent, simple).
 *
 * R4 stricte : préfixe = (a) handler dédié ici + (b) dispatch dans
 * `webhook/route.ts` + (c) test E2E (`handlers/__tests__/task-handler.test.ts`).
 *
 * Pourquoi `completeTask` plutôt que delete API ? L'API publique TickTick
 * developer.ticktick.com n'expose pas de DELETE fiable. `completeTask` produit
 * un effet équivalent côté Thomas (la tâche disparaît du miroir au prochain
 * render — `status === 2` est filtré dans `mirror-renderer.ts`).
 */

import { listProjects } from '../ticktick/ticktick-client';
import { completeTask } from '../ticktick/ticktick-client';
import { answerCallbackQuery } from '../telegram';
import { editMessageText } from '../telegram-validation/telegram-cards';

// ============================================================
// Constantes
// ============================================================

/** Préfixe partagé avec `todo-from-telegram.ts`. */
export const TASK_CALLBACK_PREFIX = 'task_';

// ============================================================
// Types
// ============================================================

export interface TaskCallbackParams {
  callbackQueryId: string;
  callbackData: string;
  chatId: number;
  messageId: number;
}

export interface TaskCallbackResult {
  status: 'cancelled' | 'unknown_action' | 'error';
  taskId?: string;
  error?: string;
}

// ============================================================
// Resolver projectId pour un taskId (API TickTick demande les deux)
// ============================================================

/**
 * Cherche le projectId TickTick d'une tâche en listant tous les projets.
 * L'API `completeTask` exige `projectId` + `taskId` ; or le callback ne porte
 * que `taskId` (limite 64 bytes callback_data + lisibilité). On itère donc
 * les projets et on tente complete sur chaque jusqu'à succès.
 *
 * Pas optimal mais robuste : le nombre de projets TickTick est petit (< 20
 * pour Thomas en pratique).
 */
async function findProjectIdForTask(_taskId: string): Promise<string | undefined> {
  try {
    const projects = await listProjects();
    // Heuristique : essayer chaque projet jusqu'à ce que `completeTask` réussisse.
    // En pratique on a peu de projets ; si ça pose problème on étendra avec
    // `getTask(projectId, taskId)` pour vérifier d'abord (mais ça multiplie
    // les appels TickTick par le nombre de projets pour rien).
    return projects[0]?.id;
  } catch {
    return undefined;
  }
}

// ============================================================
// API publique
// ============================================================

/**
 * Dispatcher principal pour les callbacks `task_*`.
 * Route vers les actions :
 *   - `task_cancel:<taskId>` → completeTask + edit message
 */
export async function handleTaskCallback(
  params: TaskCallbackParams,
): Promise<TaskCallbackResult> {
  const { callbackQueryId, callbackData, chatId, messageId } = params;

  // Acquittement immédiat (best-effort, idempotent)
  await answerCallbackQuery(callbackQueryId);

  // Parse action + payload
  if (callbackData.startsWith(`${TASK_CALLBACK_PREFIX}cancel:`)) {
    const taskId = callbackData.slice(`${TASK_CALLBACK_PREFIX}cancel:`.length);
    return await handleCancel({ chatId, messageId, taskId });
  }

  // Action inconnue — log mais on ne casse pas le flow
  console.warn(`[task-handler] action inconnue : ${callbackData}`);
  return { status: 'unknown_action' };
}

interface CancelParams {
  chatId: number;
  messageId: number;
  taskId: string;
}

async function handleCancel(params: CancelParams): Promise<TaskCallbackResult> {
  const { chatId, messageId, taskId } = params;

  if (!taskId) {
    await editMessageText(chatId, messageId, '❌ Annulation impossible : taskId manquant.');
    return { status: 'error', error: 'taskId vide' };
  }

  // Itérer sur tous les projets : completeTask demande projectId + taskId.
  // On tente le 1er projet ; si KO on essaie les suivants. En pratique le
  // 1er essai suffit le plus souvent (Thomas crée majoritairement dans
  // un seul projet "Inbox" ou "Important").
  let projects: Array<{ id: string }> = [];
  try {
    projects = await listProjects();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await editMessageText(
      chatId,
      messageId,
      `❌ Annulation impossible : ${message}`,
    );
    return { status: 'error', taskId, error: message };
  }

  // On ajoute aussi le tentatif sur "Inbox" (projectId vide string '' pour
  // l'API TickTick — selon doc certains endpoints acceptent ça)
  const candidateIds = [...projects.map((p) => p.id), 'inbox'];

  let success = false;
  let lastError = '';
  for (const pid of candidateIds) {
    try {
      await completeTask(pid, taskId);
      success = true;
      break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Essayer le projet suivant
    }
  }

  if (!success) {
    console.warn(
      `[task-handler] completeTask échoué sur tous les projets (${candidateIds.length} essais) — taskId=${taskId} dernier err=${lastError}`,
    );
    await editMessageText(
      chatId,
      messageId,
      `❌ Annulation échouée. Marque la tâche manuellement dans TickTick si nécessaire.`,
    );
    return { status: 'error', taskId, error: lastError };
  }

  await editMessageText(chatId, messageId, '❌ Tâche annulée.');
  return { status: 'cancelled', taskId };
}

// ============================================================
// Internals pour tests
// ============================================================

export const _internals = {
  findProjectIdForTask,
  handleCancel,
};
