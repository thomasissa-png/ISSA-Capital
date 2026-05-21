/**
 * Store en mémoire pour les pendings `task_*` (S20.1 — Telegram → TickTick).
 *
 * Architecture (fix Bug 1 + Bug 3) :
 *   - Chaque tap `/todo` ou texte intent-tâche crée un pending PREVIEW avec un
 *     `pendingId` court (≤ 32 chars pour callback_data Telegram).
 *   - 3 boutons sur la carte preview : ✅ Valider / ✏️ Modifier / ❌ Annuler.
 *   - Sur Valider → `createTask` côté TickTick + on garde `taskId+projectId`
 *     dans le même pending pour permettre l'annulation O(1) (fix Bug 3 :
 *     plus de boucle `for (const pid of candidateIds)` dans `task.ts`).
 *   - Sur Modifier → on bascule `awaitingEdit=true` ; le prochain message
 *     texte est re-parsé et un nouveau preview remplace l'ancien.
 *   - Sur Annuler (preview) → drop pending, aucun call TickTick.
 *
 * Persistance : globalThis Map (re-créée par process worker, identique au
 * pattern `inbox-preview-store.ts`). TTL 7j strict (R3 — usage humain réel,
 * Thomas peut revenir 3 jours plus tard, jamais < 72h).
 *
 * Choix : pas d'I/O Drive (chaque tap doit rester < 100 ms).
 * Multi-pending : ok, plusieurs cartes peuvent cohabiter, le helper
 * `findLatestAwaitingEditForChat` prend la plus récente (createdAt desc).
 */

import type { ParsedAddTask } from './handlers/todo-from-telegram';

// ============================================================
// Types
// ============================================================

/**
 * Phase de vie d'un pending task :
 *   - 'preview'  : carte affichée, attente d'un tap bouton.
 *   - 'awaiting_edit' : Thomas a cliqué ✏️ Modifier, on attend son message texte.
 *   - 'created'  : tâche créée côté TickTick (taskId+projectId remplis),
 *                  carte affiche bouton Annuler ; le pending sert au cancel O(1).
 */
export type TaskPendingPhase = 'preview' | 'awaiting_edit' | 'created';

export interface TaskPendingEntry {
  /** Identifiant court (≤ 24 chars hex+base36) — safe pour callback_data Telegram. */
  pendingId: string;
  /** Phase courante du pending (preview / awaiting_edit / created). */
  phase: TaskPendingPhase;
  /** Draft parsé par Sonnet — patché si Thomas modifie via texte. */
  parsed: ParsedAddTask;
  /** Nom de projet résolu (pour affichage carte). null si Inbox TickTick. */
  projectName: string | null;
  /** projectId TickTick résolu (lookup O(1) au cancel — fix Bug 3). */
  projectId: string | null;
  /** taskId TickTick — rempli seulement après création (phase === 'created'). */
  taskId: string | null;
  /** chatId Telegram (vérifié à chaque callback, security). */
  chatId: number;
  /** message_id de la carte preview pour `editMessageText` in-place. */
  messageId: number;
  /** Date de création (timestamp ms). Sert au TTL et au tri "plus récent". */
  createdAt: number;
}

// ============================================================
// Constantes
// ============================================================

/** Préfixe clé du store globalThis. */
export const TASK_PENDING_KEY_PREFIX = 'task-pending:';

/** TTL pending — R3 : 7 jours strict, jamais < 72h. */
export const TASK_PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

// ============================================================
// Backing store — globalThis Map (survit aux re-évaluations Next.js)
// ============================================================

const STORE_KEY = '__issa_task_pending_store__' as const;

function getStore(): Map<string, TaskPendingEntry> {
  if (!(STORE_KEY in globalThis)) {
    (globalThis as Record<string, unknown>)[STORE_KEY] = new Map<
      string,
      TaskPendingEntry
    >();
  }
  return (globalThis as Record<string, unknown>)[STORE_KEY] as Map<
    string,
    TaskPendingEntry
  >;
}

function fullKey(pendingId: string): string {
  return `${TASK_PENDING_KEY_PREFIX}${pendingId}`;
}

// ============================================================
// API publique
// ============================================================

/**
 * Génère un pendingId court (~16 chars hex+base36).
 * Compatible callback_data Telegram (≤ 64 bytes total) :
 *   "task_validate:" (14) + 16 chars = 30 bytes ✅
 *   "task_cancel_preview:" (20) + 16 chars = 36 bytes ✅
 */
export function generateTaskPendingId(): string {
  return (
    Date.now().toString(36).slice(-8) +
    Math.random().toString(36).slice(2, 10)
  );
}

/** Purge interne — supprime les entrées expirées (best-effort à chaque write). */
function purgeExpired(): void {
  const store = getStore();
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > TASK_PENDING_TTL_MS) {
      store.delete(key);
    }
  }
}

/** Insère ou remplace une entrée. Purge les expirées au passage. */
export function saveTaskPending(entry: TaskPendingEntry): void {
  purgeExpired();
  getStore().set(fullKey(entry.pendingId), entry);
}

/**
 * Récupère une entrée par pendingId.
 * Retourne null si absente ou expirée (et la supprime dans ce cas).
 */
export function getTaskPending(pendingId: string): TaskPendingEntry | null {
  const store = getStore();
  const entry = store.get(fullKey(pendingId));
  if (!entry) return null;

  if (Date.now() - entry.createdAt > TASK_PENDING_TTL_MS) {
    store.delete(fullKey(pendingId));
    return null;
  }
  return entry;
}

/** Supprime une entrée (après validation finale, annulation, ou completion). */
export function deleteTaskPending(pendingId: string): void {
  getStore().delete(fullKey(pendingId));
}

/**
 * Trouve l'entrée la plus récente (createdAt max) pour un chatId donné
 * avec `phase === 'awaiting_edit'`. Utilisé par le webhook : si Thomas tape
 * pendant qu'une carte attend une modification, on re-preview.
 */
export function findLatestAwaitingEditForChat(
  chatId: number,
): TaskPendingEntry | null {
  const store = getStore();
  const now = Date.now();
  let best: TaskPendingEntry | null = null;

  for (const entry of store.values()) {
    if (entry.chatId !== chatId) continue;
    if (entry.phase !== 'awaiting_edit') continue;
    if (now - entry.createdAt > TASK_PENDING_TTL_MS) continue;
    if (!best || entry.createdAt > best.createdAt) {
      best = entry;
    }
  }
  return best;
}

// ============================================================
// Helpers de test
// ============================================================

/** Reset complet — UNIQUEMENT pour tests. */
export function _resetTaskPendingStoreForTests(): void {
  getStore().clear();
}

/** Lecture taille brute — UNIQUEMENT pour tests. */
export function _getTaskPendingStoreSizeForTests(): number {
  return getStore().size;
}
