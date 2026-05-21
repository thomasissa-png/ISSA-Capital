/**
 * Handler callback Telegram — préfixe `task_*` (S20 → S20.1, R4).
 *
 * Couvre 4 sous-actions :
 *  - `task_validate:<pendingId>`     → finalize création TickTick (PREVIEW flow).
 *  - `task_modify:<pendingId>`       → bascule preview en awaiting_edit.
 *  - `task_cancel_preview:<pendingId>` → drop pending preview (avant création).
 *  - `task_cancel:<taskId>`          → completeTask post-création (O(1) via pending).
 *
 * R4 stricte : préfixe `task_` = (a) handler dédié ici + (b) dispatch dans
 * `webhook/route.ts` + (c) tests E2E (`handlers/__tests__/task-handler.test.ts`).
 *
 * Pourquoi `completeTask` plutôt que delete API ? L'API publique TickTick
 * developer.ticktick.com n'expose pas de DELETE fiable. `completeTask` produit
 * un effet équivalent côté Thomas (la tâche disparaît du miroir au prochain
 * render — `status === 2` est filtré dans `mirror-renderer.ts`).
 *
 * Fix Bug 3 (S20.1) : `handleCancel` lookupait O(N) tous les projets pour
 * trouver le bon projectId. On stocke maintenant le couple (taskId, projectId)
 * dans `task-pending-store` à la création → lookup O(1). Fallback `listProjects`
 * conservé pour les anciennes tâches sans pending (TTL 7j expiré).
 */

import { completeTask, listProjects } from '../ticktick/ticktick-client';
import { answerCallbackQuery } from '../telegram';
import { editMessageText } from '../telegram-validation/telegram-cards';
import {
  finalizeAddTaskFromPending,
  startModifyPreview,
  cancelPreview,
  TASK_VALIDATE_PREFIX,
  TASK_MODIFY_PREFIX,
  TASK_CANCEL_PREVIEW_PREFIX,
} from './todo-from-telegram';
import { getTaskPending } from '../task-pending-store';

// ============================================================
// Constantes
// ============================================================

/** Préfixe partagé avec `todo-from-telegram.ts`. */
export const TASK_CALLBACK_PREFIX = 'task_';

/** Sous-préfixe pour l'annulation post-création (legacy S20). */
export const TASK_CANCEL_PREFIX = 'task_cancel:';

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
  status:
    | 'cancelled'
    | 'validated'
    | 'modify_pending'
    | 'preview_cancelled'
    | 'unknown_action'
    | 'error';
  taskId?: string;
  error?: string;
}

// ============================================================
// API publique — dispatcher principal
// ============================================================

/**
 * Dispatcher principal pour les callbacks `task_*`.
 * Ordre strict : sous-préfixes les plus spécifiques EN PREMIER
 * (`task_cancel_preview:` AVANT `task_cancel:` pour éviter le mismatch).
 */
export async function handleTaskCallback(
  params: TaskCallbackParams,
): Promise<TaskCallbackResult> {
  const { callbackQueryId, callbackData, chatId, messageId } = params;

  // Acquittement immédiat (best-effort, idempotent).
  await answerCallbackQuery(callbackQueryId);

  // S20.1 — PREVIEW flow : validate / modify / cancel_preview.
  if (callbackData.startsWith(TASK_VALIDATE_PREFIX)) {
    const pendingId = callbackData.slice(TASK_VALIDATE_PREFIX.length);
    return await handleValidate(pendingId);
  }

  if (callbackData.startsWith(TASK_MODIFY_PREFIX)) {
    const pendingId = callbackData.slice(TASK_MODIFY_PREFIX.length);
    return await handleModify(pendingId);
  }

  // IMPORTANT : tester `task_cancel_preview:` AVANT `task_cancel:` (préfixe inclus).
  if (callbackData.startsWith(TASK_CANCEL_PREVIEW_PREFIX)) {
    const pendingId = callbackData.slice(TASK_CANCEL_PREVIEW_PREFIX.length);
    return await handleCancelPreview(pendingId);
  }

  // S20 legacy — annulation post-création (carte "✅ Tâche créée" → completeTask).
  if (callbackData.startsWith(TASK_CANCEL_PREFIX)) {
    const taskId = callbackData.slice(TASK_CANCEL_PREFIX.length);
    return await handleCancel({ chatId, messageId, taskId });
  }

  // Action inconnue — log mais on ne casse pas le flow.
  console.warn(`[task-handler] action inconnue : ${callbackData}`);
  return { status: 'unknown_action' };
}

// ============================================================
// Sous-handlers PREVIEW flow (S20.1)
// ============================================================

async function handleValidate(pendingId: string): Promise<TaskCallbackResult> {
  if (!pendingId) {
    return { status: 'error', error: 'pendingId vide' };
  }
  const result = await finalizeAddTaskFromPending(pendingId);
  switch (result.status) {
    case 'created':
    case 'already_created':
      return { status: 'validated', taskId: result.taskId };
    case 'expired':
      return { status: 'error', error: result.error ?? 'pending expiré' };
    case 'error':
      return { status: 'error', error: result.error };
  }
}

async function handleModify(pendingId: string): Promise<TaskCallbackResult> {
  if (!pendingId) {
    return { status: 'error', error: 'pendingId vide' };
  }
  const result = await startModifyPreview(pendingId);
  if (result.status === 'awaiting_edit') {
    return { status: 'modify_pending' };
  }
  return { status: 'error', error: result.error };
}

async function handleCancelPreview(pendingId: string): Promise<TaskCallbackResult> {
  if (!pendingId) {
    return { status: 'error', error: 'pendingId vide' };
  }
  const result = await cancelPreview(pendingId);
  if (result.status === 'cancelled') {
    return { status: 'preview_cancelled' };
  }
  return { status: 'error', error: result.error };
}

// ============================================================
// Sous-handler legacy (S20) — task_cancel post-création
// ============================================================

interface CancelParams {
  chatId: number;
  messageId: number;
  taskId: string;
}

/**
 * Annule une tâche déjà créée (carte "✅ Tâche créée" + bouton Annuler).
 *
 * Fix Bug 3 : on lookup d'abord le pending store pour récupérer projectId
 * en O(1). Fallback `listProjects` uniquement si pending expiré (TTL 7j).
 */
async function handleCancel(params: CancelParams): Promise<TaskCallbackResult> {
  const { chatId, messageId, taskId } = params;

  if (!taskId) {
    await editMessageText(chatId, messageId, '❌ Annulation impossible : taskId manquant.');
    return { status: 'error', error: 'taskId vide' };
  }

  // 1. Lookup O(1) dans le pending-store : si Thomas a validé la tâche dans
  //    les 7 derniers jours, on connaît son projectId exact.
  const projectId = findProjectIdFromPendingsByTaskId(taskId);

  if (projectId) {
    try {
      await completeTask(projectId, taskId);
      await editMessageText(chatId, messageId, '❌ Tâche annulée.');
      return { status: 'cancelled', taskId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[task-handler] completeTask O(1) échoué (projectId=${projectId} taskId=${taskId}) : ${message}`,
      );
      // Fallback boucle ci-dessous (au cas où le projectId stocké soit obsolète).
    }
  }

  // 2. Fallback legacy : pending expiré ou projectId stocké KO.
  //    On itère sur tous les projets (coût acceptable : Thomas < 20 projets,
  //    cas rare = tâche créée > 7j et toujours non-annulée).
  let projects: Array<{ id: string }> = [];
  try {
    projects = await listProjects();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await editMessageText(chatId, messageId, `❌ Annulation impossible : ${message}`);
    return { status: 'error', taskId, error: message };
  }

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
    }
  }

  if (!success) {
    console.warn(
      `[task-handler] completeTask échoué sur tous les projets (${candidateIds.length} essais, fallback legacy) — taskId=${taskId} dernier err=${lastError}`,
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
// Helpers internes
// ============================================================

/**
 * Lookup O(1) : cherche un pending dont `taskId` correspond. Retourne le
 * projectId associé (rempli au moment de la création via
 * `finalizeAddTaskFromPending`).
 *
 * Itère sur le store en mémoire (Map de quelques entrées, jamais plus de
 * quelques dizaines en pratique pour Thomas → O(N) sur store, mais zéro
 * appel TickTick → O(1) côté réseau, ce qui est le sens de "O(1)" ici).
 */
function findProjectIdFromPendingsByTaskId(taskId: string): string | undefined {
  // On scan le store globalThis directement via une helper exposée.
  // Pour éviter d'exporter trop d'internals du store, on délègue à un
  // helper local qui appelle `getTaskPending` à l'identique d'une recherche.
  // En pratique on utilise le STORE_KEY globalThis directement ici.
  const store = (globalThis as Record<string, unknown>)['__issa_task_pending_store__'] as
    | Map<string, { taskId: string | null; projectId: string | null; createdAt: number }>
    | undefined;
  if (!store) return undefined;

  const now = Date.now();
  const TTL = 7 * 24 * 60 * 60 * 1_000;

  for (const entry of store.values()) {
    if (entry.taskId !== taskId) continue;
    if (now - entry.createdAt > TTL) continue;
    return entry.projectId ?? undefined;
  }
  return undefined;
}

// ============================================================
// Internals pour tests
// ============================================================

export const _internals = {
  handleCancel,
  handleValidate,
  handleModify,
  handleCancelPreview,
  findProjectIdFromPendingsByTaskId,
};

// Pour qu'un import externe accède au pendingId helper (déjà appelé via
// `getTaskPending`), pas besoin d'export supplémentaire ici.
void getTaskPending;
