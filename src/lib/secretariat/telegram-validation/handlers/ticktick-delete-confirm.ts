/**
 * Handler Telegram — confirmation suppression vault suite à un delete TickTick.
 *
 * Red line spec §9.2 : Anya NE SUPPRIME JAMAIS silencieusement une tâche du
 * vault. Quand le pull-engine détecte qu'une tâche présente dans le state
 * a disparu côté TickTick, il envoie une carte Telegram à Thomas :
 *
 *   "Tâche '<title>' supprimée dans TickTick. Supprimer aussi du vault ?"
 *   [Oui]  [Garder]  [Voir]
 *
 * Callback prefix : `tickticksync_delete:`
 * Actions : `yes` | `keep` | `view`
 *
 * TTL pending : 7j (R3 P1 #96 — usage humain week-end/vacances).
 *
 * **R4 (P1 #97)** : tout nouveau préfixe callback Telegram DOIT avoir :
 *   (a) un handler ici
 *   (b) un dispatch dans `webhook/route.ts`
 *   (c) un test E2E callback → handler
 */

import {
  editMessageText,
  sendSimpleMessage,
} from '../telegram-cards';
import { answerCallbackQuery } from '../../telegram';
import {
  loadSyncState,
  saveSyncState,
} from '../../ticktick-sync/state-store';
import type { PendingDelete, SyncState } from '../../ticktick-sync/types';
import { removeLineByNumber } from '../../ticktick-sync/pull-engine';
import { resolveFilePath } from '../../vault-client/drive-resolver';
import { updateFileContent, getAccessToken } from '../../drive-upload';
import { listMarkdownFiles } from '../../vault-client/drive-resolver';
import { logAuditEntry } from '../../ticktick-sync/audit-logger';
import { parseTaskLine } from '../../ticktick-sync/parser';
import { createTask as createTickTickTask } from '../../ticktick/ticktick-client';
import { readVaultFile } from '../../vault-reader';

// ============================================================
// Constantes publiques
// ============================================================

export const TICKTICK_DELETE_CALLBACK_PREFIX = 'tickticksync_delete:';

export type TickTickDeleteAction = 'yes' | 'keep' | 'view';

/** TTL pending delete : 7 jours (R3). */
export const DELETE_PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

// ============================================================
// Parsing
// ============================================================

/**
 * Parse le callback data en action + ticktickId.
 * Format : `tickticksync_delete:<action>:<ticktickId>`
 */
export function parseTickTickDeleteCallback(
  data: string,
): { action: TickTickDeleteAction; ticktickId: string } | null {
  if (!data.startsWith(TICKTICK_DELETE_CALLBACK_PREFIX)) return null;
  const rest = data.slice(TICKTICK_DELETE_CALLBACK_PREFIX.length);
  const idx = rest.indexOf(':');
  if (idx < 0) return null;
  const action = rest.slice(0, idx) as TickTickDeleteAction;
  const ticktickId = rest.slice(idx + 1);
  if (action !== 'yes' && action !== 'keep' && action !== 'view') return null;
  if (!ticktickId) return null;
  return { action, ticktickId };
}

// ============================================================
// Pending TTL — purge automatique > 7j
// ============================================================

export function purgeExpiredDeletes(
  state: SyncState,
  now: Date = new Date(),
): number {
  if (!state.pendingDeletes) return 0;
  const cutoff = now.getTime() - DELETE_PENDING_TTL_MS;
  let purged = 0;
  for (const [id, pending] of Object.entries(state.pendingDeletes)) {
    const ts = Date.parse(pending.createdAt);
    if (Number.isNaN(ts) || ts < cutoff) {
      delete state.pendingDeletes[id];
      purged++;
    }
  }
  return purged;
}

// ============================================================
// Carte Telegram — formulation
// ============================================================

export function buildDeleteCardText(pending: PendingDelete): string {
  const safeTitle = pending.title.replace(/[<>]/g, '');
  return (
    `<b>TickTick — tâche supprimée</b>\n\n` +
    `La tâche <b>${safeTitle}</b> a été supprimée dans TickTick.\n` +
    `Vault : <code>${pending.vaultPath}:L${pending.lineNumber}</code>\n\n` +
    `Supprimer aussi du vault ?`
  );
}

export function buildDeleteKeyboard(
  ticktickId: string,
): Array<Array<{ text: string; callback_data: string }>> {
  return [
    [
      { text: 'Oui (supprimer)', callback_data: `${TICKTICK_DELETE_CALLBACK_PREFIX}yes:${ticktickId}` },
      { text: 'Garder', callback_data: `${TICKTICK_DELETE_CALLBACK_PREFIX}keep:${ticktickId}` },
    ],
    [
      { text: 'Voir dans Obsidian', callback_data: `${TICKTICK_DELETE_CALLBACK_PREFIX}view:${ticktickId}` },
    ],
  ];
}

/** Construit le deep-link Obsidian `obsidian://open?vault=...&file=...` */
export function buildObsidianDeepLink(vaultPath: string): string {
  const vaultName = process.env.OBSIDIAN_VAULT_NAME ?? 'ThomasIssa';
  const file = encodeURIComponent(vaultPath);
  const vault = encodeURIComponent(vaultName);
  return `obsidian://open?vault=${vault}&file=${file}`;
}

// ============================================================
// Envoi de la carte (appelé par pull-engine)
// ============================================================

export async function sendDeleteConfirmCard(params: {
  ticktickId: string;
  taskKey: string;
  title: string;
  vaultPath: string;
  lineNumber: number;
  projectId?: string;
}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!token || token === '__TO_FILL__' || !chatId) {
    console.warn('[ticktick-delete-confirm] credentials Telegram manquants');
    return false;
  }

  const state = await loadSyncState();
  if (!state.pendingDeletes) state.pendingDeletes = {};

  // Si déjà en pending (idempotence) : on n'envoie pas une 2e carte
  if (state.pendingDeletes[params.ticktickId]) {
    return true;
  }

  const pending: PendingDelete = {
    ticktickId: params.ticktickId,
    taskKey: params.taskKey,
    title: params.title,
    vaultPath: params.vaultPath,
    lineNumber: params.lineNumber,
    createdAt: new Date().toISOString(),
  };
  if (params.projectId) pending.projectId = params.projectId;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildDeleteCardText(pending),
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buildDeleteKeyboard(params.ticktickId) },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return false;

    // Capture message_id pour edit ultérieur
    try {
      const data = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number; chat?: { id?: number } };
      };
      if (data.result?.message_id) {
        pending.telegramMessageId = data.result.message_id;
        pending.telegramChatId = data.result.chat?.id ?? chatId;
      }
    } catch {
      // Pas grave — message_id manquant signifie qu'on ne pourra pas éditer
    }

    state.pendingDeletes[params.ticktickId] = pending;
    await saveSyncState(state);
    return true;
  } catch (err) {
    console.warn(
      `[ticktick-delete-confirm] envoi carte échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

// ============================================================
// Callback handler
// ============================================================

export async function handleTickTickDeleteCallback(params: {
  callback_query_id: string;
  data: string;
  message_id: number;
  chat_id: number | string;
}): Promise<string> {
  const parsed = parseTickTickDeleteCallback(params.data);
  if (!parsed) {
    await answerCallbackQuery(params.callback_query_id, 'Callback invalide');
    return 'invalid_callback';
  }

  await answerCallbackQuery(
    params.callback_query_id,
    parsed.action === 'yes'
      ? 'Suppression vault…'
      : parsed.action === 'keep'
        ? 'Conservé'
        : 'Ouverture Obsidian…',
  );

  const state = await loadSyncState();
  purgeExpiredDeletes(state);
  const pending = state.pendingDeletes?.[parsed.ticktickId];

  if (!pending) {
    await editMessageText(
      params.chat_id,
      params.message_id,
      'Pending expiré ou inconnu (TTL 7j). Vérifier l\'état TickTick ↔ vault.',
    );
    return 'pending_not_found';
  }

  // ============================================================
  // Action: view → renvoie deep-link Obsidian (pas d'edit, pas de save state)
  // ============================================================
  if (parsed.action === 'view') {
    const deepLink = buildObsidianDeepLink(pending.vaultPath);
    await sendSimpleMessage(
      params.chat_id,
      `<b>Ouvrir dans Obsidian</b>\n<a href="${deepLink}">${pending.vaultPath}:L${pending.lineNumber}</a>`,
    );
    return 'view_sent';
  }

  // ============================================================
  // Action: keep → re-create EFFECTIVE dans TickTick (S18.3b livrable 3)
  // ============================================================
  if (parsed.action === 'keep') {
    const recreated = await recreateTaskInTickTick(pending);

    if (recreated.ok && recreated.newTicktickId) {
      // Succès : on patch le state avec le nouvel ID, on clear le pending
      if (state.pendingDeletes) delete state.pendingDeletes[parsed.ticktickId];
      // Remplace l'entry state.tasks[taskKey] avec le nouvel ID
      const oldEntry = state.tasks[pending.taskKey];
      if (oldEntry) {
        state.tasks[pending.taskKey] = {
          ...oldEntry,
          ticktickId: recreated.newTicktickId,
          projectId: recreated.newProjectId ?? oldEntry.projectId,
          lastSyncedAt: new Date().toISOString(),
        };
      }
      await saveSyncState(state);

      await logAuditEntry({
        direction: 'push',
        op: 'recreate',
        ticktickId: recreated.newTicktickId,
        vaultPath: pending.vaultPath,
        lineNumber: pending.lineNumber,
        status: 'success',
        details: {
          previousTicktickId: parsed.ticktickId,
          title: pending.title,
        },
      });

      await editMessageText(
        params.chat_id,
        params.message_id,
        `Tâche '${pending.title}' re-créée dans TickTick (ID <code>${recreated.newTicktickId}</code>). Continuité préservée.`,
      );
      return 'recreated';
    }

    // Échec : fallback V1 (clear state.tasks pour que prochain push crée)
    console.warn(`[ticktick-delete-confirm] recreate échec : ${recreated.error ?? 'unknown'}`);
    await logAuditEntry({
      direction: 'push',
      op: 'recreate',
      ticktickId: parsed.ticktickId,
      vaultPath: pending.vaultPath,
      lineNumber: pending.lineNumber,
      status: 'error',
      errorMessage: recreated.error ?? 'recreate_failed',
    });

    if (state.pendingDeletes) delete state.pendingDeletes[parsed.ticktickId];
    if (state.tasks[pending.taskKey]) delete state.tasks[pending.taskKey];
    await saveSyncState(state);
    await editMessageText(
      params.chat_id,
      params.message_id,
      `Tâche conservée dans le vault. Re-création TickTick a échoué (${recreated.error?.slice(0, 80) ?? 'erreur'}) — sera retentée au prochain cron push.`,
    );
    return 'kept_fallback';
  }

  // ============================================================
  // Action: yes → DELETE ligne vault via PATCH in-place R5
  // ============================================================
  if (parsed.action === 'yes') {
    try {
      const ok = await deleteLineFromVault(pending.vaultPath, pending.lineNumber);
      if (!ok) {
        await editMessageText(
          params.chat_id,
          params.message_id,
          `Échec suppression vault (Drive). Fichier : ${pending.vaultPath}:L${pending.lineNumber}`,
        );
        return 'delete_failed';
      }
      // Clear pending + state.tasks[key]
      if (state.pendingDeletes) delete state.pendingDeletes[parsed.ticktickId];
      if (state.tasks[pending.taskKey]) delete state.tasks[pending.taskKey];
      await saveSyncState(state);
      await logAuditEntry({
        direction: 'pull',
        op: 'delete',
        ticktickId: parsed.ticktickId,
        vaultPath: pending.vaultPath,
        lineNumber: pending.lineNumber,
        status: 'success',
        details: { title: pending.title, source: 'telegram_confirm' },
      });
      await editMessageText(
        params.chat_id,
        params.message_id,
        `Tâche supprimée du vault. ${pending.vaultPath}:L${pending.lineNumber}`,
      );
      return 'deleted';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sendSimpleMessage(
        params.chat_id,
        `Erreur suppression vault : ${msg.slice(0, 200)}`,
      );
      return `error: ${msg}`;
    }
  }

  return 'noop';
}

// ============================================================
// Helper — delete line from vault file (PATCH in-place R5)
// ============================================================

async function deleteLineFromVault(
  vaultPath: string,
  lineNumber: number,
): Promise<boolean> {
  // Trouver le fileId Drive du fichier
  const idx = vaultPath.lastIndexOf('/');
  const folder = idx > 0 ? vaultPath.slice(0, idx) : '';
  const filename = idx > 0 ? vaultPath.slice(idx + 1) : vaultPath;

  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  // 1. Résoudre le folder
  const folderRes = await resolveFilePath(folder, filename);
  let fileId = folderRes.success ? folderRes.fileId : undefined;

  // 2. Si non trouvé via resolveFilePath, scanner le dossier
  if (!fileId) {
    try {
      const files = await listMarkdownFiles(folder);
      const f = files.find((x) => x.name.toLowerCase() === filename.toLowerCase());
      if (f) fileId = f.id;
    } catch { /* ignore */ }
  }

  if (!fileId) return false;

  // 3. Lire contenu actuel
  const readUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  const readRes = await fetch(readUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!readRes.ok) return false;
  const content = await readRes.text();

  // 4. Supprimer la ligne
  const newContent = removeLineByNumber(content, lineNumber);
  if (newContent === content) return false; // ligne déjà absente

  // 5. PATCH in-place R5
  const patchRes = await updateFileContent(fileId, newContent, 'text/markdown');
  return patchRes.success;
}

// ============================================================
// Helper — re-create EFFECTIVE de la tâche dans TickTick (S18.3b livrable 3)
// ============================================================

/**
 * Re-crée la tâche dans TickTick à partir de sa ligne vault actuelle.
 *
 * Pipeline :
 *  1. Lit la ligne vault à `pending.vaultPath:pending.lineNumber`
 *  2. Parse via parseTaskLine → VaultTask
 *  3. Détermine projectId via PROJECT_TAG_MAPPING + state.projects
 *  4. Appelle ticktick createTask → nouvel ID
 *
 * Retourne ok=true + nouvel ID, ou ok=false + error (fallback clear côté caller).
 */
async function recreateTaskInTickTick(
  pending: PendingDelete,
): Promise<{ ok: boolean; newTicktickId?: string; newProjectId?: string; error?: string }> {
  try {
    // 1. Lire la ligne vault actuelle
    const idx = pending.vaultPath.lastIndexOf('/');
    const folder = idx > 0 ? pending.vaultPath.slice(0, idx) : '';
    const filename = idx > 0 ? pending.vaultPath.slice(idx + 1) : pending.vaultPath;
    const fileResult = await readVaultFile(folder, filename);
    if (!fileResult.success || !fileResult.content) {
      return { ok: false, error: `Fichier vault introuvable : ${pending.vaultPath}` };
    }

    const lines = fileResult.content.split(/\r?\n/u);
    const rawLine = lines[pending.lineNumber - 1];
    if (!rawLine) {
      return { ok: false, error: `Ligne ${pending.lineNumber} absente du fichier` };
    }

    // 2. Parse via parseTaskLine
    const parsed = parseTaskLine(rawLine, {
      vaultPath: pending.vaultPath,
      lineNumber: pending.lineNumber,
    });
    if (!parsed) {
      return { ok: false, error: 'Ligne vault non parsable comme tâche' };
    }

    // 3. Résoudre projectId (priorité : state.projects[parsed.projectName], fallback pending.projectId)
    const state = await loadSyncState();
    let projectId: string | undefined = state.projects[parsed.projectName];
    if (!projectId) {
      // Fallback : conserver l'ancien projectId si disponible
      projectId = pending.projectId;
    }
    if (!projectId) {
      return { ok: false, error: `projectId introuvable pour "${parsed.projectName}"` };
    }

    // 4. createTask TickTick
    const created = await createTickTickTask({
      title: parsed.title,
      projectId,
      priority: parsed.priority,
      dueDate: parsed.dueDate,
      tags: parsed.tags,
    });

    if (!created.id) {
      return { ok: false, error: 'TickTick createTask: pas d\'ID retourné' };
    }

    return {
      ok: true,
      newTicktickId: created.id,
      newProjectId: created.projectId ?? projectId,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Export pour tests
export const _ticktickDeleteConfirmInternals = {
  recreateTaskInTickTick,
};
