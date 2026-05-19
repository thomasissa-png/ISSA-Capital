/**
 * Handler Telegram — validation patches hot-context (S19 Phase B).
 *
 * Source de vérité : `docs/hot-context-spec.md` §6.
 *
 * Callback prefix : `hotcontext:`
 * Actions : `valid` | `modify` | `skip`
 *
 * Loop modify max 2 itérations (Thomas reformule texte libre → Anya re-propose).
 *
 * R3 (P1 #96) : TTL pending 7 jours dans le state hot-context.
 * R4 (P1 #97) : tout nouveau préfixe callback DOIT avoir :
 *   (a) ce handler (b) un dispatch webhook/route.ts (c) un test E2E.
 * R5 (P0 #99) : applier utilise PATCH in-place.
 */

import { editMessageText, sendSimpleMessage } from '../telegram-cards';
import { answerCallbackQuery } from '../../telegram';
import {
  loadHotContextState,
  saveHotContextState,
} from '../../hot-context/state-store';
import {
  applyPatchToDrive,
  renderPatchLine,
} from '../../hot-context/applier';
import { estimateTokens, formatTokenDelta } from '../../hot-context/token-estimator';
import { writeHotContextAudit } from '../../hot-context/audit';
import type { Patch } from '../../hot-context/types';

// ============================================================
// Constantes publiques
// ============================================================

export const HOT_CONTEXT_CALLBACK_PREFIX = 'hotcontext:';

export type HotContextAction = 'valid' | 'modify' | 'skip';

/** TTL pending hot-context (R3 — jamais < 7 jours). */
export const HOT_CONTEXT_PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

/** Loop modify : max 2 itérations. */
export const HOT_CONTEXT_MAX_MODIFY_ITERATIONS = 2;

// ============================================================
// Parsing callback
// ============================================================

export interface ParsedHotContextCallback {
  action: HotContextAction;
  patchId: string;
}

/** Format : `hotcontext:<action>:<patchId>` */
export function parseHotContextCallback(data: string): ParsedHotContextCallback | null {
  if (!data.startsWith(HOT_CONTEXT_CALLBACK_PREFIX)) return null;
  const rest = data.slice(HOT_CONTEXT_CALLBACK_PREFIX.length);
  const colonIdx = rest.indexOf(':');
  if (colonIdx === -1) return null;
  const action = rest.slice(0, colonIdx) as HotContextAction;
  const patchId = rest.slice(colonIdx + 1);
  if (action !== 'valid' && action !== 'modify' && action !== 'skip') return null;
  if (!patchId) return null;
  return { action, patchId };
}

// ============================================================
// Carte Telegram — preview
// ============================================================

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function prettyPayload(patch: Patch): string {
  return escapeHtml(renderPatchLine(patch));
}

export function buildPatchCardText(patch: Patch, fileTokensEstimate: number): string {
  const tokens = formatTokenDelta(fileTokensEstimate);
  return (
    `<b>Hot context — patch proposé</b>\n\n` +
    `Source : <code>${escapeHtml(patch.source)}</code> ${escapeHtml(patch.sourceId).slice(0, 80)}\n` +
    `Section : <b>${escapeHtml(patch.section)}</b> — action ${escapeHtml(patch.action)}\n\n` +
    `Patch :\n<pre>${prettyPayload(patch)}</pre>\n\n` +
    `Rationale : ${escapeHtml(patch.rationale).slice(0, 200)}\n` +
    `Tokens après merge : ${tokens}`
  );
}

export function buildPatchKeyboard(patchId: string): Array<
  Array<{ text: string; callback_data: string }>
> {
  return [
    [
      { text: 'Valider', callback_data: `${HOT_CONTEXT_CALLBACK_PREFIX}valid:${patchId}` },
      { text: 'Modifier', callback_data: `${HOT_CONTEXT_CALLBACK_PREFIX}modify:${patchId}` },
      { text: 'Skip', callback_data: `${HOT_CONTEXT_CALLBACK_PREFIX}skip:${patchId}` },
    ],
  ];
}

// ============================================================
// Envoi carte
// ============================================================

/**
 * Envoie la carte de validation à Thomas.
 * Persiste le pending dans le state (TTL 7j R3).
 *
 * @returns message_id Telegram, ou null si échec.
 */
export async function sendHotContextPatchCard(patch: Patch): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!token || token === '__TO_FILL__' || !chatId) {
    console.warn('[hot-context-patch] credentials Telegram manquants');
    return null;
  }

  const state = await loadHotContextState();
  const cardText = buildPatchCardText(patch, state.lastFileTokensEstimate);

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  let messageId: number | null = null;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: cardText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buildPatchKeyboard(patch.patchId) },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn(`[hot-context-patch] sendMessage HTTP ${response.status}`);
      return null;
    }
    const data = (await response.json()) as { ok: boolean; result?: { message_id?: number } };
    messageId = data.result?.message_id ?? null;
  } catch (err) {
    console.warn(
      `[hot-context-patch] envoi carte échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }

  // Purge TTL + persiste pending
  purgeExpiredPendings(state);
  state.pendingPatches[patch.patchId] = {
    patchId: patch.patchId,
    patch,
    proposedAt: new Date().toISOString(),
    telegramMessageId: messageId ?? undefined,
  };
  await saveHotContextState(state);

  void writeHotContextAudit('hot-context-patch-proposed', {
    patchId: patch.patchId,
    section: patch.section,
    action: patch.action,
    telegramMessageId: messageId,
  });

  return messageId;
}

/** Purge in-memory des pendings expirés (≥ 7j). Modifie state directement. */
export function purgeExpiredPendings(state: {
  pendingPatches: Record<string, { proposedAt: string }>;
}): number {
  const now = Date.now();
  let purged = 0;
  for (const [id, p] of Object.entries(state.pendingPatches)) {
    if (now - new Date(p.proposedAt).getTime() > HOT_CONTEXT_PENDING_TTL_MS) {
      delete state.pendingPatches[id];
      purged++;
    }
  }
  return purged;
}

// ============================================================
// Callback handler
// ============================================================

export interface HandleHotContextCallbackParams {
  callback_query_id: string;
  data: string;
  message_id: number;
  chat_id: number | string;
}

/**
 * Dispatch un callback Telegram `hotcontext:` vers la bonne action.
 *
 * @returns code court pour debug/logging (ex. 'patched', 'skipped', 'unknown_patch').
 */
export async function handleHotContextPatchCallback(
  params: HandleHotContextCallbackParams,
): Promise<string> {
  const parsed = parseHotContextCallback(params.data);
  if (!parsed) {
    await answerCallbackQuery(params.callback_query_id, 'Callback invalide');
    return 'invalid_callback';
  }

  // Ack rapide (Telegram < 1s)
  await answerCallbackQuery(
    params.callback_query_id,
    parsed.action === 'valid'
      ? 'Patch en cours…'
      : parsed.action === 'modify'
        ? 'Mode modification…'
        : 'Skippé',
  );

  const state = await loadHotContextState();
  purgeExpiredPendings(state);

  const pending = state.pendingPatches[parsed.patchId];
  if (!pending) {
    await editMessageText(
      params.chat_id,
      params.message_id,
      'Patch introuvable ou expiré (TTL 7j dépassé).',
    );
    void writeHotContextAudit('hot-context-patch-skipped', {
      patchId: parsed.patchId,
      reason: 'ttl-expired',
    });
    await saveHotContextState(state);
    return 'unknown_patch_or_expired';
  }

  // SKIP
  if (parsed.action === 'skip') {
    delete state.pendingPatches[parsed.patchId];
    state.processedSignals[pending.patch.signalId] = {
      signalId: pending.patch.signalId,
      processedAt: new Date().toISOString(),
      outcome: 'rejected',
    };
    await saveHotContextState(state);
    await editMessageText(
      params.chat_id,
      params.message_id,
      `Patch skip - ${pending.patch.section}/${pending.patch.action}.`,
    );
    void writeHotContextAudit('hot-context-patch-skipped', {
      patchId: parsed.patchId,
      reason: 'thomas-skip',
    });
    return 'skipped';
  }

  // MODIFY (loop max 2)
  if (parsed.action === 'modify') {
    // V1 : on stocke un flag dans le pending (proposedAt sert d'ancre).
    // L'implémentation full loop (réception du texte libre, re-propose Haiku
    // sur reformulation) sera dans une session ultérieure. Pour V1, on
    // informe Thomas que le mode modify est noté et on garde le pending.
    await editMessageText(
      params.chat_id,
      params.message_id,
      `Mode Modifier - envoie ta reformulation en texte libre (loop max ${HOT_CONTEXT_MAX_MODIFY_ITERATIONS}). En attendant, le patch reste pending.`,
    );
    void writeHotContextAudit('hot-context-patch-modified', {
      patchId: parsed.patchId,
      originalPayload: pending.patch.payload,
      modifiedPayload: null,
    });
    return 'modify_pending';
  }

  // VALID — applique
  try {
    const applyResult = await applyPatchToDrive(pending.patch, estimateTokens);

    if (!applyResult.success) {
      await editMessageText(
        params.chat_id,
        params.message_id,
        `Echec patch : ${applyResult.error ?? 'inconnu'}`,
      );
      await sendSimpleMessage(
        params.chat_id,
        `Le patch hot-context a échoué : ${applyResult.error ?? 'erreur inconnue'}. Le pending reste actif pour retry.`,
      );
      return 'apply_failed';
    }

    // Idempotence : déjà appliqué (no-op silencieux)
    if (applyResult.alreadyApplied) {
      delete state.pendingPatches[parsed.patchId];
      state.processedSignals[pending.patch.signalId] = {
        signalId: pending.patch.signalId,
        processedAt: new Date().toISOString(),
        outcome: 'patched',
      };
      state.lastFileTokensEstimate = applyResult.fileTokensAfter;
      await saveHotContextState(state);
      await editMessageText(
        params.chat_id,
        params.message_id,
        `Patch deja present (idempotence) - state synchronise.`,
      );
      return 'already_applied';
    }

    // Succès
    delete state.pendingPatches[parsed.patchId];
    state.processedSignals[pending.patch.signalId] = {
      signalId: pending.patch.signalId,
      processedAt: new Date().toISOString(),
      outcome: 'patched',
    };
    state.lastFileTokensEstimate = applyResult.fileTokensAfter;
    await saveHotContextState(state);

    const tokensInfo = formatTokenDelta(applyResult.fileTokensAfter);
    const warnSuffix = applyResult.capWarnTriggered ? ' (cap warn dépassé)' : '';
    await editMessageText(
      params.chat_id,
      params.message_id,
      `Patche - ${pending.patch.section}/${pending.patch.action}. Fichier : ${tokensInfo}${warnSuffix}`,
    );

    void writeHotContextAudit('hot-context-patch-applied', {
      patchId: parsed.patchId,
      fileTokensBefore: applyResult.fileTokensBefore,
      fileTokensAfter: applyResult.fileTokensAfter,
      capWarnTriggered: applyResult.capWarnTriggered,
    });

    return 'patched';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await editMessageText(
      params.chat_id,
      params.message_id,
      `Erreur apply : ${msg.slice(0, 200)}`,
    );
    return `error: ${msg}`;
  }
}
