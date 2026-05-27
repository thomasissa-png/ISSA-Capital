/**
 * Helper partagé — créer une tâche dans TickTick (hub unique).
 *
 * Contexte S24 P2 : plusieurs handlers email-ingest / inbox appendaient leurs
 * tâches dans `03. Tâches/Todo.md` via `appendToTodoInbox`. Or `Todo.md` est
 * désormais un MIROIR read-only régénéré depuis TickTick (S20, PR #39) :
 * toute ligne ajoutée directement y est ÉCRASÉE au prochain render → les tâches
 * (quittance à générer, fiche bien à compléter, tâche Telegram) disparaissaient.
 *
 * Ce module route ces tâches vers `createTask` (TickTick = SOT) dans le projet
 * par défaut. En cas d'échec API, fallback `appendToTodoInbox` (visible jusqu'au
 * prochain render) + alerte Telegram à Thomas — la tâche n'est jamais perdue
 * silencieusement.
 */

import { createTask } from './ticktick-client';
import type { CreateTaskInput } from './types';
import { parisLocalToTickTickFields } from '../handlers/todo-from-telegram';
import { appendToTodoInbox } from '../drive-todo';
import { sendTelegramMessage } from '../telegram';

// ============================================================
// Constantes
// ============================================================

/**
 * Projet « Important » TickTick — défaut quand `TICKTICK_DEFAULT_PROJECT_ID`
 * n'est pas posé sur le VPS (mémo S24 : 6a0c57dc8f088bc89e671119).
 */
export const TICKTICK_IMPORTANT_PROJECT_ID = '6a0c57dc8f088bc89e671119';

/** Tag de traçabilité des tâches créées par l'ingestion automatique. */
export const ANYA_INBOX_TAG = 'anya-inbox';

// ============================================================
// Types
// ============================================================

export interface AddTaskToTickTickInput {
  title: string;
  /**
   * Date d'échéance. Accepte `YYYY-MM-DD` (journée entière) ou une ISO heure
   * locale Paris `YYYY-MM-DDTHH:mm:ss` (convertie DST-safe en aval).
   */
  date?: string;
  description?: string;
  /** Priorité TickTick (0=aucune, 1=basse, 3=moyenne, 5=haute). */
  priority?: number;
  /** Tags additionnels (sinon `anya-inbox`). */
  tags?: string[];
}

export interface AddTaskToTickTickResult {
  /** `created` = TickTick OK ; `fallback_todo` = TickTick KO mais tâche posée dans le miroir + alerte ; `error` = rien posé. */
  status: 'created' | 'fallback_todo' | 'error';
  taskId?: string;
  error?: string;
}

// ============================================================
// Helpers internes
// ============================================================

/** Résout le projet par défaut : env override, sinon « Important » hardcodé. */
export function resolveDefaultProjectId(): string {
  const fromEnv = (process.env.TICKTICK_DEFAULT_PROJECT_ID ?? '').trim();
  return fromEnv || TICKTICK_IMPORTANT_PROJECT_ID;
}

/** Normalise une date d'entrée vers le format attendu par `parisLocalToTickTickFields`. */
function toParisLocalIso(date?: string): string | undefined {
  if (!date) return undefined;
  // `YYYY-MM-DD` → journée entière (00:00:00 → isAllDay détecté en aval).
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return `${date}T00:00:00`;
  return date;
}

async function alertFallback(title: string, reason: string): Promise<void> {
  const chatIdRaw = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!chatIdRaw) return;
  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId)) return;
  await sendTelegramMessage(
    chatId,
    `\u{26A0}\u{FE0F} TickTick indisponible — tâche « ${title} » posée en secours dans Todo.md ` +
      `(miroir : peut disparaître au prochain rafraîchissement, à recréer dans TickTick).\n` +
      `Raison : ${reason.slice(0, 200)}`,
  ).catch(() => undefined);
}

// ============================================================
// API publique
// ============================================================

/**
 * Crée une tâche dans TickTick (projet par défaut) avec fallback Todo.md + alerte.
 *
 * Ne throw jamais : toute erreur API est capturée et convertie en fallback.
 */
export async function addTaskToTickTick(
  input: AddTaskToTickTickInput,
): Promise<AddTaskToTickTickResult> {
  const title = input.title.trim();
  if (!title) {
    return { status: 'error', error: 'titre vide' };
  }

  const tz = parisLocalToTickTickFields(toParisLocalIso(input.date));
  const taskInput: CreateTaskInput = {
    title,
    content: input.description,
    priority: input.priority ?? 0,
    projectId: resolveDefaultProjectId(),
    dueDate: tz.dueDate,
    isAllDay: tz.isAllDay,
    timeZone: tz.timeZone,
    tags: input.tags ?? [ANYA_INBOX_TAG],
  };

  try {
    const task = await createTask(taskInput);
    return { status: 'created', taskId: task.id };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(
      `[ticktick-inbox-task] createTask échoué (${reason}) — fallback Todo.md + alerte`,
    );
    await appendToTodoInbox(title, input.date, input.description).catch(() => undefined);
    await alertFallback(title, reason);
    return { status: 'fallback_todo', error: reason };
  }
}

/** Mappe une priorité textuelle handler (`P0`/`P1`/`P2`) vers la priorité TickTick. */
export function mapTodoPriority(p: unknown): number {
  switch (p) {
    case 'P0':
      return 5;
    case 'P1':
      return 3;
    case 'P2':
      return 1;
    default:
      return typeof p === 'number' ? p : 0;
  }
}
