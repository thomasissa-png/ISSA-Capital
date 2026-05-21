/**
 * Handler — Telegram → TickTick (S20 → S20.1 PREVIEW flow).
 *
 * Canal create-only Telegram → TickTick (cf. vault SOT
 * `08. Outils/Anya/Skills/Workflow Todo.md` + `docs/ia/ticktick-gap-analysis-s20.md`).
 *
 * Flow S20.1 (post-bugfix Thomas — fix Bug 1 "modification" + Bug 2 "Calendar
 * proposé") :
 *  1. Webhook détecte `/todo` OU texte intent-tâche (heuristique `looksLikeTask`).
 *  2. `parseAddTaskFromText` extrait `{ title, dueDate?, priority?, projectName? }`
 *     via Sonnet/Haiku 4.5 (titre VERBATIM, jamais reformulé).
 *  3. `previewAddTaskFromTelegram` affiche une carte PREVIEW avec 3 boutons :
 *       [✅ Valider]  [✏️ Modifier]  [❌ Annuler]
 *     + crée un pending dans `task-pending-store` (TTL 7j — R3).
 *  4. Callbacks (handler `task.ts`) :
 *       - `task_validate:<pendingId>` → `finalizeAddTaskFromPending` →
 *         createTask + edit carte "✅ Tâche créée" + bouton Annuler classique.
 *       - `task_modify:<pendingId>` → phase passe à 'awaiting_edit',
 *         le prochain message texte est re-parsé et re-preview.
 *       - `task_cancel_preview:<pendingId>` → drop pending, "❌ Tâche annulée."
 *  5. Le titre reste VERBATIM (la phrase de Thomas n'est jamais reformulée).
 *
 * Bug 2 (fix complémentaire dans webhook/route.ts) : le router obsolète
 * `handleInboxMessage` (Calendar/Todo.md) n'est plus appelé sur texte libre.
 * Sur un texte court, le webhook tente d'abord `looksLikeTask` → preview
 * TickTick, sinon fallback note Drive.
 *
 * Préfixes callback `task_*` — R4 stricte : handler dédié (`task.ts`) +
 * dispatch dans `webhook/route.ts` + tests E2E.
 */

import { createHash } from 'node:crypto';
import { callAnthropic } from '../llm/client';
import { createTask, listProjects } from '../ticktick/ticktick-client';
import type { CreateTaskInput, TickTickTask } from '../ticktick/types';
import {
  sendTelegramMessage,
  sendTelegramMessageWithButtons,
} from '../telegram';
import { editMessageTextWithButtons } from '../telegram-validation/telegram-cards';
import {
  generateTaskPendingId,
  saveTaskPending,
  getTaskPending,
  deleteTaskPending,
  type TaskPendingEntry,
} from '../task-pending-store';

// ============================================================
// Constantes
// ============================================================

/** Tag appliqué à toutes les tâches créées via Telegram (convention Anya). */
export const ANYA_TELEGRAM_TAG = 'anya-telegram';

/** Préfixe callback_data — R4 : handler dédié + dispatch + test E2E. */
export const TASK_CALLBACK_PREFIX = 'task_';

/**
 * Sous-préfixes callback_data — R4 stricte : chaque nouveau préfixe a son
 * handler dans `task.ts` + dispatch webhook + test E2E.
 *
 * Limites Telegram : callback_data ≤ 64 bytes. pendingId = 16 chars max.
 *   "task_validate:" (14) + 16 = 30 bytes ✅
 *   "task_modify:"   (12) + 16 = 28 bytes ✅
 *   "task_cancel_preview:" (20) + 16 = 36 bytes ✅
 *   "task_cancel:"   (12) + ~24 (taskId TickTick) = 36 bytes ✅
 */
export const TASK_VALIDATE_PREFIX = 'task_validate:';
export const TASK_MODIFY_PREFIX = 'task_modify:';
export const TASK_CANCEL_PREVIEW_PREFIX = 'task_cancel_preview:';

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
// S20.1 — PREVIEW flow (fix Bug 1 : modification possible)
// ============================================================

/**
 * Heuristique de détection "ressemble à une tâche" sur un texte court libre
 * (fix Bug 2 : ne plus router vers Calendar/Todo.md).
 *
 * Règle simple :
 *  - parsed.dueDate présent → c'est une tâche datée (RDV, rappel, échéance).
 *  - OU le texte contient un verbe d'action FR (appeler, faire, relancer,
 *    envoyer, préparer, rappeler, rappelle-moi, acheter, payer, etc.).
 *
 * Tout le reste (ack, salut, note, "ok", "merci") → fallback note Drive.
 * Volontairement conservateur : mieux vaut fallback note qu'une carte preview
 * intempestive sur "ok".
 */
const TASK_VERBS_RE =
  /\b(appel(?:e|er|le)|relanc(?:e|er)|envoie|envoyer|fai(?:re|s)|prépare(?:r)?|rappel(?:le|le-moi|er)|achète(?:r)?|achete(?:r)?|paie(?:r)?|payer|réserve(?:r)?|reserve(?:r)?|réserver|book|booker|planifie(?:r)?|programme(?:r)?|organise(?:r)?|finir|finis|terminer|termine|envoyer|signer|signe|relire|lire|écrire|ecrire|écris|rédige(?:r)?|redige(?:r)?|appeler|téléphone(?:r)?|telephone(?:r)?|contacter|contacte|todo|à faire|a faire|tâche|tache)\b/i;

export function looksLikeTask(text: string, parsed: ParsedAddTask): boolean {
  if (parsed.dueDate) return true;
  if (!text || text.trim().length === 0) return false;
  // Très court (< 4 chars, type "ok", "ko", "ah") → jamais tâche.
  if (text.trim().length < 4) return false;
  return TASK_VERBS_RE.test(text);
}

// ============================================================
// PREVIEW — carte 3 boutons (Valider / Modifier / Annuler)
// ============================================================

/**
 * Construit le texte de la carte preview.
 * Affiche : titre verbatim, échéance (si parsée), priorité (si != normale),
 * projet (si nommé).
 */
function buildPreviewMessage(
  parsed: ParsedAddTask,
  projectName: string | null,
): string {
  const lines: string[] = [];
  lines.push(`📝 Tâche à créer (preview) :`);
  lines.push(`"${parsed.title}"`);
  const due = formatDueDate(parsed.dueDate);
  if (due) lines.push(`Échéance : ${due}`);
  if (parsed.priority !== undefined && parsed.priority !== 0) {
    lines.push(`Priorité : ${priorityLabel(parsed.priority)}`);
  }
  if (projectName) lines.push(`Projet : ${projectName}`);
  return lines.join('\n');
}

/**
 * Clavier 3 boutons sur 1 ligne (compact mobile) :
 *   [✅ Valider] [✏️ Modifier] [❌ Annuler]
 *
 * Garantie callback_data ≤ 64 bytes par bouton (cf TASK_*_PREFIX commentaires).
 */
function buildPreviewKeyboard(
  pendingId: string,
): Array<Array<{ text: string; callback_data: string }>> {
  return [
    [
      { text: '✅ Valider', callback_data: `${TASK_VALIDATE_PREFIX}${pendingId}` },
      { text: '✏️ Modifier', callback_data: `${TASK_MODIFY_PREFIX}${pendingId}` },
      { text: '❌ Annuler', callback_data: `${TASK_CANCEL_PREVIEW_PREFIX}${pendingId}` },
    ],
  ];
}

export interface PreviewAddTaskParams {
  chatId: number;
  /** message_id du message Telegram d'origine (utilisé pour dédup logger uniquement). */
  messageId: number;
  parsed: ParsedAddTask;
  /** Injectable pour tests. */
  now?: Date;
}

export interface PreviewAddTaskResult {
  status: 'preview_sent' | 'error';
  pendingId?: string;
  error?: string;
}

/**
 * Affiche une carte PREVIEW Telegram (sans créer la tâche) et stocke un pending.
 *
 * Bug 1 fix : permet à Thomas de Valider / Modifier / Annuler AVANT création.
 * Bug 3 fix : projectId+projectName mémorisés dans le pending pour cancel O(1).
 */
export async function previewAddTaskFromTelegram(
  params: PreviewAddTaskParams,
): Promise<PreviewAddTaskResult> {
  const { chatId, parsed } = params;
  const now = params.now ?? new Date();

  // Title vide → message d'erreur immédiat, pas de preview.
  if (!parsed.title || parsed.title.trim().length === 0) {
    await sendTelegramMessage(
      chatId,
      "Je n'ai pas réussi à extraire de tâche depuis ton message. Réessaie avec un texte plus explicite, par ex : `/todo Relancer Martin demain matin`.",
    );
    return { status: 'error', error: 'title vide après parsing' };
  }

  // Résolution projet (best-effort, mémorisée dans le pending pour cancel O(1)).
  const projectId = (await resolveProjectIdByName(parsed.projectName)) ?? null;
  const projectName = parsed.projectName ?? null;

  // Envoi carte preview.
  const pendingId = generateTaskPendingId();
  const previewText = buildPreviewMessage(parsed, projectName);
  const keyboard = buildPreviewKeyboard(pendingId);

  const sent = await sendTelegramMessageWithButtons(chatId, previewText, keyboard);
  const messageId = sent?.messageId ?? 0;

  // Stocker le pending (TTL 7j — R3).
  const entry: TaskPendingEntry = {
    pendingId,
    phase: 'preview',
    parsed,
    projectName,
    projectId,
    taskId: null,
    chatId,
    messageId,
    createdAt: now.getTime(),
  };
  saveTaskPending(entry);

  return { status: 'preview_sent', pendingId };
}

// ============================================================
// FINALIZE — création réelle TickTick (appelée depuis task_validate)
// ============================================================

export interface FinalizeFromPendingResult {
  status: 'created' | 'already_created' | 'expired' | 'error';
  taskId?: string;
  projectId?: string;
  error?: string;
}

/**
 * Crée la tâche TickTick à partir d'un pending validé.
 *
 * Idempotent : si le pending est déjà en phase 'created' (double-tap Valider),
 * retourne `already_created` sans rappeler `createTask` (anti-doublon).
 *
 * Met à jour le pending avec taskId+projectId (utilisé par `task_cancel` O(1)).
 * Édite la carte Telegram in-place : "✅ Tâche créée + bouton Annuler".
 */
export async function finalizeAddTaskFromPending(
  pendingId: string,
): Promise<FinalizeFromPendingResult> {
  const entry = getTaskPending(pendingId);
  if (!entry) {
    return { status: 'expired', error: 'pending introuvable ou expiré (TTL 7j)' };
  }

  // Anti double-validation : si déjà créé, ne pas rappeler createTask.
  if (entry.phase === 'created' && entry.taskId) {
    return { status: 'already_created', taskId: entry.taskId, projectId: entry.projectId ?? undefined };
  }

  const { parsed, projectId, projectName, chatId, messageId } = entry;

  const input: CreateTaskInput = {
    title: parsed.title,
    priority: parsed.priority ?? 0,
    dueDate: parsed.dueDate,
    projectId: projectId ?? undefined,
    tags: [ANYA_TELEGRAM_TAG],
  };

  let task: TickTickTask;
  try {
    task = await createTask(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[todo-from-telegram] createTask échoué (preview→create) : ${message}`);
    await editMessageTextWithButtons(chatId, messageId, `❌ Impossible de créer la tâche : ${message}`, []);
    return { status: 'error', error: message };
  }

  // Patch pending : phase=created + taskId mémorisé (pour cancel O(1) — fix Bug 3).
  const updated: TaskPendingEntry = {
    ...entry,
    phase: 'created',
    taskId: task.id,
    projectId: task.projectId ?? projectId,
  };
  saveTaskPending(updated);

  // Re-render carte "✅ Tâche créée" + bouton Annuler classique (task_cancel).
  const confirmText = buildConfirmationMessage(task, parsed, projectName ?? undefined);
  const cancelButton = buildCancelButton(task.id);
  const keyboard = cancelButton ? [[cancelButton]] : [];
  await editMessageTextWithButtons(chatId, messageId, confirmText, keyboard);

  return { status: 'created', taskId: task.id, projectId: updated.projectId ?? undefined };
}

// ============================================================
// MODIFY — phase preview → awaiting_edit (handler appelé sur task_modify)
// ============================================================

/**
 * Bascule un pending en phase `awaiting_edit` et édite la carte Telegram
 * pour demander à Thomas de retaper la version corrigée.
 *
 * Le webhook détectera le prochain message texte via
 * `findLatestAwaitingEditForChat(chatId)` et appellera `reparseAndPreview`.
 */
export async function startModifyPreview(
  pendingId: string,
): Promise<{ status: 'awaiting_edit' | 'expired' | 'error'; error?: string }> {
  const entry = getTaskPending(pendingId);
  if (!entry) {
    return { status: 'expired', error: 'pending introuvable ou expiré' };
  }
  if (entry.phase === 'created') {
    return { status: 'error', error: 'tâche déjà créée — modification impossible' };
  }

  const updated: TaskPendingEntry = { ...entry, phase: 'awaiting_edit' };
  saveTaskPending(updated);

  await editMessageTextWithButtons(
    entry.chatId,
    entry.messageId,
    `✏️ Tape la version corrigée de la tâche (avec date/heure/priorité si besoin) :`,
    [
      [
        {
          text: '❌ Annuler',
          callback_data: `${TASK_CANCEL_PREVIEW_PREFIX}${pendingId}`,
        },
      ],
    ],
  );

  return { status: 'awaiting_edit' };
}

// ============================================================
// CANCEL PREVIEW — drop pending, aucun appel TickTick
// ============================================================

/**
 * Annule un preview (Thomas a cliqué ❌ Annuler AVANT validation).
 * Drop le pending, édite la carte Telegram pour confirmer.
 */
export async function cancelPreview(
  pendingId: string,
): Promise<{ status: 'cancelled' | 'expired' | 'error'; error?: string }> {
  const entry = getTaskPending(pendingId);
  if (!entry) {
    return { status: 'expired', error: 'pending introuvable ou expiré' };
  }
  if (entry.phase === 'created') {
    return { status: 'error', error: 'tâche déjà créée — utilise le bouton Annuler classique' };
  }

  deleteTaskPending(pendingId);
  await editMessageTextWithButtons(entry.chatId, entry.messageId, `❌ Tâche annulée.`, []);
  return { status: 'cancelled' };
}

// ============================================================
// REPARSE — réception du nouveau texte après task_modify
// ============================================================

/**
 * Après que Thomas a cliqué ✏️ Modifier puis tapé un nouveau texte, on :
 *  1. Drop l'ancien pending (clean state).
 *  2. Re-parse via Sonnet/Haiku.
 *  3. Re-affiche une carte preview (nouvelle ligne Telegram, nouveau pendingId).
 *
 * On ne fait PAS d'editMessageText sur l'ancienne carte : Telegram n'autorise
 * pas d'éditer une carte avec un nouveau message_id (chaque preview est un
 * nouveau message). L'ancienne carte (qui affiche "Tape la version corrigée")
 * est laissée telle quelle (cleanup soft).
 */
export async function reparseAndPreviewFromEdit(params: {
  chatId: number;
  newText: string;
  oldPendingId: string;
  now?: Date;
}): Promise<PreviewAddTaskResult> {
  const { chatId, newText, oldPendingId } = params;
  const now = params.now ?? new Date();

  // Drop l'ancien pending (l'utilisateur a explicitement remplacé sa demande).
  deleteTaskPending(oldPendingId);

  // Re-parse + re-preview.
  const parsed = await parseAddTaskFromText(newText, now);
  return await previewAddTaskFromTelegram({
    chatId,
    messageId: 0,
    parsed,
    now,
  });
}

// ============================================================
// Internals pour tests
// ============================================================

export const _internals = {
  dedupKey,
  buildConfirmationMessage,
  buildCancelButton,
  buildPreviewMessage,
  buildPreviewKeyboard,
  formatDueDate,
  priorityLabel,
  resolveProjectIdByName,
};
