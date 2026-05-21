/**
 * Handler — Telegram → TickTick (création de tâche, S20).
 *
 * Canal create-only Telegram → TickTick (cf. vault SOT
 * `08. Outils/Anya/Skills/Workflow Todo.md` + `docs/ia/ticktick-gap-analysis-s20.md`).
 *
 * Flow :
 *  1. Le webhook Telegram détecte un message texte commençant par `/todo`
 *     (ou intent `add_task` détecté par Sonnet 4 sur message libre).
 *  2. Le handler `handleAddTaskFromTelegram` parse le texte via Sonnet 4
 *     en structured output : `{ title, dueDate?, priority?, projectName? }`.
 *  3. Idempotence : dédup en mémoire via `sha1(chatId + messageId)` TTL 1h
 *     (anti-replay Telegram).
 *  4. Crée la tâche via `createTask()` avec tag `anya-telegram`.
 *  5. Répond avec une carte de confirmation + bouton inline "Annuler" qui
 *     déclenche `completeTask` côté TickTick (décision par défaut S20).
 *
 * Le titre est conservé verbatim (la phrase de Thomas n'est jamais reformulée).
 * Sonnet ne fait qu'ajouter les metadata (date, priorité, projet) si elles
 * sont explicitement présentes dans le texte.
 *
 * Préfixe callback `task_` — R4 stricte : handler dédié (`task.ts`) +
 * dispatch dans `webhook/route.ts` + test E2E.
 */

import { createHash } from 'node:crypto';
import { callAnthropic } from '../llm/client';
import { createTask, listProjects } from '../ticktick/ticktick-client';
import type { CreateTaskInput, TickTickTask } from '../ticktick/types';
import {
  sendTelegramMessage,
  sendTelegramMessageWithButtons,
} from '../telegram';

// ============================================================
// Constantes
// ============================================================

/** Tag appliqué à toutes les tâches créées via Telegram (convention Anya). */
export const ANYA_TELEGRAM_TAG = 'anya-telegram';

/** Préfixe callback_data — R4 : handler dédié + dispatch + test E2E. */
export const TASK_CALLBACK_PREFIX = 'task_';

/** TTL dédup création (anti-replay Telegram). */
const DEDUP_TTL_MS = 60 * 60 * 1_000; // 1h

/** Limites Telegram callback_data : 64 bytes. taskId TickTick = ~24 chars + préfixe. */
const MAX_CALLBACK_DATA_BYTES = 64;

// ============================================================
// Types
// ============================================================

/**
 * Sortie attendue de Sonnet pour l'intent `add_task`.
 * dueDate : ISO 8601 UTC ou undefined.
 * priority : mapping TickTick (0/1/3/5).
 */
export interface ParsedAddTask {
  intent: 'add_task';
  title: string;
  dueDate?: string;
  priority?: 0 | 1 | 3 | 5;
  projectName?: string;
}

/** Résultat du handler (utile pour tests + audit). */
export interface AddTaskResult {
  status: 'created' | 'skipped_duplicate' | 'error';
  taskId?: string;
  projectId?: string;
  error?: string;
}

// ============================================================
// Dédup mémoire (anti-replay Telegram)
// ============================================================

interface DedupEntry {
  taskId?: string;
  expiresAt: number;
}

const dedupCache = new Map<string, DedupEntry>();

function purgeExpired(now: number): void {
  for (const [key, entry] of dedupCache.entries()) {
    if (entry.expiresAt < now) dedupCache.delete(key);
  }
}

function dedupKey(chatId: number, messageId: number): string {
  return createHash('sha1').update(`${chatId}:${messageId}`, 'utf8').digest('hex');
}

/** Exposé pour tests (reset entre runs). */
export function _clearDedupCache(): void {
  dedupCache.clear();
}

// ============================================================
// Parser Sonnet — message libre → ParsedAddTask
// ============================================================

const ADD_TASK_SYSTEM_PROMPT = `Tu extrais une tâche à créer depuis un message Telegram court.
Retourne UNIQUEMENT un JSON strict sans markdown :
{
  "intent": "add_task",
  "title": "texte de la tâche, VERBATIM (ne reformule pas)",
  "dueDate": "2026-05-30T09:00:00.000Z" | null,
  "priority": 5 | 3 | 1 | 0 | null,
  "projectName": "nom du projet TickTick mentionné" | null
}

Règles strictes :
- title : conserve la phrase brute, retire seulement le préfixe "/todo " ou "/task " s'il est présent.
- dueDate : uniquement si une date/heure explicite est mentionnée (demain, vendredi, dans 3 jours, 14h, etc.). Sinon null.
- priority : 5 = critique, 3 = important, 1 = priorité basse, 0 = défaut. Seulement si l'utilisateur l'indique explicitement. Sinon null.
- projectName : seulement si l'utilisateur cite un nom de projet. Sinon null.
- Pas de markdown autour du JSON. Pas d'explication.`;

/**
 * Parse un message texte Telegram en ParsedAddTask via Sonnet 4 (Haiku 4.5 suffit
 * pour cette extraction simple, coût ×5 inférieur).
 *
 * @param text Texte brut Telegram (avec ou sans préfixe `/todo`).
 * @param now Date de référence pour les expressions relatives (injectable en test).
 */
export async function parseAddTaskFromText(
  text: string,
  now: Date = new Date(),
): Promise<ParsedAddTask> {
  // Préfixe slash command optionnel (gère `/todo`, `/todo `, `/task ...`)
  const cleaned = text.trim().replace(/^\/(todo|task)(\s+|$)/i, '').trim();

  if (!cleaned) {
    return { intent: 'add_task', title: '' };
  }

  const userMessage = `Date de référence (now) : ${now.toISOString()}\n\nMessage : ${cleaned}`;

  try {
    const response = await callAnthropic({
      family: 'haiku',
      maxTokens: 512,
      system: ADD_TASK_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      responseFormat: 'json',
    });

    const raw = response.text ?? '';

    // Nettoyer markdown fences éventuels
    const jsonStr = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(jsonStr) as Partial<ParsedAddTask>;
    const priority = parsed.priority;
    const validPriority: 0 | 1 | 3 | 5 | undefined =
      priority === 0 || priority === 1 || priority === 3 || priority === 5
        ? priority
        : undefined;

    return {
      intent: 'add_task',
      title: typeof parsed.title === 'string' && parsed.title ? parsed.title : cleaned,
      dueDate: typeof parsed.dueDate === 'string' ? parsed.dueDate : undefined,
      priority: validPriority,
      projectName: typeof parsed.projectName === 'string' ? parsed.projectName : undefined,
    };
  } catch (err) {
    // Sonnet KO : fallback sur le texte brut comme titre (jamais bloquer Thomas)
    console.warn(
      `[todo-from-telegram] parse Sonnet échoué : ${err instanceof Error ? err.message : String(err)} — fallback titre brut`,
    );
    return { intent: 'add_task', title: cleaned };
  }
}

// ============================================================
// Resolver projet TickTick (lookup par nom)
// ============================================================

/**
 * Cherche un projectId TickTick par nom (match case-insensitive, contient).
 * Retourne undefined si rien ne matche (la tâche sera créée sans projectId
 * → Inbox TickTick, qui apparaîtra en section `## Inbox` du miroir).
 */
async function resolveProjectIdByName(name?: string): Promise<string | undefined> {
  if (!name) return undefined;
  try {
    const projects = await listProjects();
    const lower = name.toLowerCase();
    const match =
      projects.find((p) => p.name.toLowerCase() === lower) ??
      projects.find((p) => p.name.toLowerCase().includes(lower));
    return match?.id;
  } catch (err) {
    console.warn(
      `[todo-from-telegram] listProjects échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
    return undefined;
  }
}

// ============================================================
// Carte Telegram de confirmation
// ============================================================

function priorityLabel(p?: 0 | 1 | 3 | 5): string {
  switch (p) {
    case 5:
      return 'Critique';
    case 3:
      return 'Important';
    case 1:
      return 'Basse';
    default:
      return 'Normale';
  }
}

function formatDueDate(iso?: string): string | null {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    // Format FR court : "vendredi 30 mai à 09:00" → simplifié "30/05/2026 09:00"
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = date.getUTCFullYear();
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const min = String(date.getUTCMinutes()).padStart(2, '0');
    if (hh === '00' && min === '00') return `${dd}/${mm}/${yyyy}`;
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return null;
  }
}

function buildConfirmationMessage(
  task: TickTickTask,
  parsed: ParsedAddTask,
  projectName?: string,
): string {
  const lines: string[] = [];
  lines.push(`✅ Tâche créée : "${task.title}"`);
  const due = formatDueDate(parsed.dueDate);
  if (due) lines.push(`Échéance : ${due}`);
  lines.push(`Priorité : ${priorityLabel(parsed.priority)}`);
  if (projectName) lines.push(`Projet : ${projectName}`);
  return lines.join('\n');
}

function buildCancelButton(taskId: string): { text: string; callback_data: string } | null {
  const callbackData = `${TASK_CALLBACK_PREFIX}cancel:${taskId}`;
  // Telegram limite à 64 bytes — on skip le bouton plutôt qu'envoyer une payload tronquée
  if (Buffer.byteLength(callbackData, 'utf8') > MAX_CALLBACK_DATA_BYTES) {
    console.warn(
      `[todo-from-telegram] callback_data trop long (${Buffer.byteLength(callbackData, 'utf8')} bytes), bouton Annuler skip`,
    );
    return null;
  }
  return { text: 'Annuler', callback_data: callbackData };
}

// ============================================================
// API publique — handler principal
// ============================================================

export interface HandleAddTaskParams {
  chatId: number;
  messageId: number;
  parsed: ParsedAddTask;
  /** Injectable pour tests. */
  now?: Date;
}

/**
 * Crée une tâche TickTick depuis un message Telegram parsé.
 *
 * Idempotent : si la combinaison `chatId + messageId` a déjà été traitée dans
 * les 60 dernières minutes, la création est skippée (anti-replay GH Actions /
 * retry Telegram).
 *
 * Best-effort : toute erreur (TickTick down, Telegram KO) est capturée. On
 * répond toujours quelque chose à Thomas (succès ou message d'erreur clair).
 */
export async function handleAddTaskFromTelegram(
  params: HandleAddTaskParams,
): Promise<AddTaskResult> {
  const { chatId, messageId, parsed } = params;
  const now = params.now ?? new Date();
  const nowMs = now.getTime();

  purgeExpired(nowMs);

  // 1. Dédup
  const key = dedupKey(chatId, messageId);
  const existing = dedupCache.get(key);
  if (existing && existing.expiresAt > nowMs) {
    console.warn(
      `[todo-from-telegram] dédup hit (chat=${chatId} msg=${messageId}) — skip création`,
    );
    return { status: 'skipped_duplicate', taskId: existing.taskId };
  }

  // 2. Title vide → message d'erreur, pas de création
  if (!parsed.title || parsed.title.trim().length === 0) {
    await sendTelegramMessage(
      chatId,
      "Je n'ai pas réussi à extraire de tâche depuis ton message. Réessaie avec un texte plus explicite, par ex : `/todo Relancer Martin demain matin`.",
    );
    return { status: 'error', error: 'title vide après parsing' };
  }

  // 3. Resolver projet (best-effort)
  const projectId = await resolveProjectIdByName(parsed.projectName);

  // 4. Création TickTick
  const input: CreateTaskInput = {
    title: parsed.title,
    priority: parsed.priority ?? 0,
    dueDate: parsed.dueDate,
    projectId,
    tags: [ANYA_TELEGRAM_TAG],
  };

  let task: TickTickTask;
  try {
    task = await createTask(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[todo-from-telegram] createTask échoué : ${message}`);
    await sendTelegramMessage(
      chatId,
      `Impossible de créer la tâche : ${message}`,
    );
    return { status: 'error', error: message };
  }

  // 5. Réserver le dédup (taskId connu maintenant)
  dedupCache.set(key, {
    taskId: task.id,
    expiresAt: nowMs + DEDUP_TTL_MS,
  });

  // 6. Carte de confirmation Telegram
  const confirmText = buildConfirmationMessage(task, parsed, parsed.projectName);
  const cancelButton = buildCancelButton(task.id);
  if (cancelButton) {
    await sendTelegramMessageWithButtons(chatId, confirmText, [[cancelButton]]);
  } else {
    await sendTelegramMessage(chatId, confirmText);
  }

  return { status: 'created', taskId: task.id, projectId };
}

// ============================================================
// Internals pour tests
// ============================================================

export const _internals = {
  dedupKey,
  buildConfirmationMessage,
  buildCancelButton,
  formatDueDate,
  priorityLabel,
  resolveProjectIdByName,
};
