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

import {
  editMessageText,
  editMessageTextWithButtons,
  sendSimpleMessage,
} from '../telegram-cards';
import { answerCallbackQuery } from '../../telegram';
import {
  loadHotContextState,
  saveHotContextState,
} from '../../hot-context/state-store';
import {
  applyPatchToDrive,
  applyPatchOnAst,
  renderPatchLine,
  HOT_CONTEXT_FOLDER,
  HOT_CONTEXT_FILENAME,
} from '../../hot-context/applier';
import { parseHotContext, serializeHotContext } from '../../hot-context/parser';
import { readFile } from '../../vault-client/obsidian-file';
import { estimateTokens, formatTokenDelta, TOKEN_CAP_WARN } from '../../hot-context/token-estimator';
import { writeHotContextAudit } from '../../hot-context/audit';
import { patchHotContextPayloadFromInstruction } from '../../hot-context/signal-detector';
import type { HotContextState, Patch, PendingPatchRecord } from '../../hot-context/types';

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

/**
 * Calcule la VRAIE projection de tokens post-merge (défaut 3).
 *
 * À partir du contenu LIVE du briefing, applique le patch sur l'AST puis
 * estime les tokens du résultat sérialisé. Si le patch est idempotent / no-op
 * (applyPatchOnAst retourne l'AST inchangé ou null) → retourne la taille
 * actuelle du fichier (pas de delta).
 *
 * @param liveContent Contenu live de `hot-context.md` ('' si indisponible).
 * @param patch Patch courant proposé.
 * @returns Estimation tokens projetée (entier).
 */
export function computeProjectedTokens(liveContent: string, patch: Patch): number {
  const currentTokens = estimateTokens(liveContent);
  try {
    const ast = parseHotContext(liveContent);
    const astAfter = applyPatchOnAst(ast, patch);
    // null (section invalide) ou idempotent (ast inchangé) → taille actuelle.
    if (astAfter === null || astAfter === ast) return currentTokens;
    const projected = serializeHotContext(astAfter);
    return estimateTokens(projected);
  } catch {
    return currentTokens;
  }
}

/**
 * Formate le statut cap explicite AVANT validation (défaut 3).
 * Ex: « 312 tokens (cap 500 ✅) » ou « 540 tokens (⚠️ cap 500 dépassé) ».
 */
export function formatProjectedTokenStatus(projectedTokens: number): string {
  if (projectedTokens > TOKEN_CAP_WARN) {
    return `${projectedTokens} tokens (⚠️ cap ${TOKEN_CAP_WARN} dépassé)`;
  }
  return `${projectedTokens} tokens (cap ${TOKEN_CAP_WARN} ✅)`;
}

/**
 * Construit le texte de la carte de validation.
 *
 * @param patch Patch proposé.
 * @param projectedTokens Projection tokens post-merge (défaut 3 — PAS la taille
 *   avant patch). Calculée via `computeProjectedTokens`.
 */
export function buildPatchCardText(patch: Patch, projectedTokens: number): string {
  const tokens = formatProjectedTokenStatus(projectedTokens);
  return (
    `<b>Hot context — patch proposé</b>\n\n` +
    `Source : <code>${escapeHtml(patch.source)}</code> ${escapeHtml(patch.sourceId).slice(0, 80)}\n` +
    `Section : <b>${escapeHtml(patch.section)}</b> — action ${escapeHtml(patch.action)}\n\n` +
    `Patch :\n<pre>${prettyPayload(patch)}</pre>\n\n` +
    `Rationale : ${escapeHtml(patch.rationale).slice(0, 200)}\n` +
    `Tokens après merge : ${tokens}`
  );
}

/**
 * Charge le contenu live du briefing (best-effort) pour calculer la projection.
 * '' si indisponible (token absent, fichier introuvable).
 */
async function loadLiveBriefingContent(): Promise<string> {
  try {
    const read = await readFile(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME);
    if (!read.success || read.content === undefined) return '';
    return read.content;
  } catch {
    return '';
  }
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

/**
 * Clavier sans bouton Modifier (défaut 2 — cap de loop atteint). Après
 * HOT_CONTEXT_MAX_MODIFY_ITERATIONS reformulations, Thomas ne peut plus que
 * Valider ou Skip.
 */
export function buildPatchKeyboardNoModify(patchId: string): Array<
  Array<{ text: string; callback_data: string }>
> {
  return [
    [
      { text: 'Valider', callback_data: `${HOT_CONTEXT_CALLBACK_PREFIX}valid:${patchId}` },
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
  // Défaut 3 — projection réelle post-merge depuis le contenu live (pas la
  // taille périmée `state.lastFileTokensEstimate`).
  const liveContent = await loadLiveBriefingContent();
  const projectedTokens = computeProjectedTokens(liveContent, patch);
  const cardText = buildPatchCardText(patch, projectedTokens);

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

  // Purge TTL + persiste pending (phase 'preview' par défaut, modifyCount 0)
  purgeExpiredPendings(state);
  state.pendingPatches[patch.patchId] = {
    patchId: patch.patchId,
    patch,
    proposedAt: new Date().toISOString(),
    telegramMessageId: messageId ?? undefined,
    phase: 'preview',
    modifyCount: 0,
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

/**
 * Re-propose une carte de validation pour un patch reformulé (défaut 2 — loop
 * Modifier). Édite le message Telegram existant (même message_id que la carte
 * d'origine), remet la phase à `preview`, et persiste le pending sous le NOUVEAU
 * patchId (le payload a changé → patchId recalculé par
 * `patchHotContextPayloadFromInstruction`).
 *
 * Si `modifyCount` a atteint le cap, le clavier n'affiche QUE Valider/Skip
 * (plus de bouton Modifier) — la consigne explicite l'absence de loop restante.
 *
 * @param oldPatchId Ancien patchId (pending d'origine) à retirer du state.
 * @param patch Patch reformulé (nouveau patchId).
 * @param messageId message_id de la carte Telegram à éditer.
 * @param chatId chat cible.
 * @param modifyCount Nombre de reformulations déjà appliquées (post-incrément).
 */
export async function repreviewHotContextPatchCard(params: {
  oldPatchId: string;
  patch: Patch;
  messageId: number;
  chatId: number | string;
  modifyCount: number;
}): Promise<void> {
  const { oldPatchId, patch, messageId, chatId, modifyCount } = params;
  const capReached = modifyCount >= HOT_CONTEXT_MAX_MODIFY_ITERATIONS;

  const liveContent = await loadLiveBriefingContent();
  const projectedTokens = computeProjectedTokens(liveContent, patch);
  const cardText = buildPatchCardText(patch, projectedTokens);

  const keyboard = capReached
    ? buildPatchKeyboardNoModify(patch.patchId)
    : buildPatchKeyboard(patch.patchId);

  await editMessageTextWithButtons(chatId, messageId, cardText, keyboard);

  // Persiste le nouveau pending (phase 'preview'), retire l'ancien si le
  // patchId a changé.
  const state = await loadHotContextState();
  purgeExpiredPendings(state);
  if (oldPatchId !== patch.patchId) {
    delete state.pendingPatches[oldPatchId];
  }
  state.pendingPatches[patch.patchId] = {
    patchId: patch.patchId,
    patch,
    proposedAt: new Date().toISOString(),
    telegramMessageId: messageId,
    phase: 'preview',
    modifyCount,
  };
  await saveHotContextState(state);

  void writeHotContextAudit('hot-context-patch-modified', {
    patchId: patch.patchId,
    originalPayload: oldPatchId,
    modifiedPayload: patch.payload,
  });
}

/**
 * Trouve le pending hot-context en phase `awaiting_edit` le plus récent.
 * Utilisateur unique Thomas → on prend le pending awaiting_edit avec le
 * `proposedAt` le plus récent (un seul attendu en pratique).
 *
 * @returns Le pending ou null si aucun n'est en attente d'édition.
 */
export function findAwaitingEditPending(state: HotContextState): PendingPatchRecord | null {
  let latest: PendingPatchRecord | null = null;
  for (const pending of Object.values(state.pendingPatches)) {
    if (pending.phase !== 'awaiting_edit') continue;
    if (latest === null || pending.proposedAt > latest.proposedAt) {
      latest = pending;
    }
  }
  return latest;
}

/**
 * Traite un texte libre de Thomas comme instruction de reformulation d'un
 * patch hot-context en phase `awaiting_edit` (défaut 2 — loop Modifier).
 *
 * Pipeline :
 *  1. Charge le state, trouve le pending `awaiting_edit` le plus récent.
 *     Aucun → retourne `no_awaiting` (le webhook continue son routage normal).
 *  2. Patche PARTIELLEMENT le payload via `patchHotContextPayloadFromInstruction`.
 *  3. Si rien n'a changé (instruction non comprise / wikilink perdu) → demande
 *     une reformulation, conserve le pending `awaiting_edit` (Thomas peut retaper).
 *  4. Sinon → incrémente modifyCount + re-propose la carte (phase 'preview').
 *     Si modifyCount atteint le cap → carte sans bouton Modifier.
 *
 * IMPORTANT (webhook) : appeler ce handler APRÈS les checks inbox-edit et task
 * awaiting_edit. Ne JAMAIS shadow ces routages — si aucun pending hot-context
 * `awaiting_edit`, retourner `no_awaiting` pour que le webhook poursuive.
 *
 * @returns code court : 'no_awaiting' | 'unchanged' | 'repreviewed'.
 */
export async function handleHotContextEditText(
  chatId: number | string,
  text: string,
): Promise<'no_awaiting' | 'unchanged' | 'repreviewed'> {
  // Résilience webhook (R-non-régression) : ce handler est appelé sur CHAQUE
  // texte libre AVANT le fallback note/CR. Toute exception (state-store KO,
  // Drive down, LLM crash) DOIT dégrader en `no_awaiting` pour que le webhook
  // poursuive son routage normal — JAMAIS aborter la requête.
  let state: HotContextState;
  try {
    state = await loadHotContextState();
  } catch (err) {
    console.warn(
      `[hot-context-patch] chargement state échoué (routage hot-context skip) : ${err instanceof Error ? err.message : String(err)}`,
    );
    return 'no_awaiting';
  }
  purgeExpiredPendings(state);
  const pending = findAwaitingEditPending(state);
  if (!pending) return 'no_awaiting';

  // Un pending awaiting_edit existe → le texte EST une instruction de modify.
  // Tout échec downstream (LLM, re-preview, save) ne doit pas aborter le
  // webhook : on dégrade en `unchanged` (texte consommé, Thomas peut retaper).
  try {
    const messageId = pending.telegramMessageId;
    const before = pending.patch;
    const patched = await patchHotContextPayloadFromInstruction(before, text);

    // Comparaison : si le payload n'a pas bougé → instruction non comprise.
    const unchanged =
      JSON.stringify(before.payload) === JSON.stringify(patched.payload);

    if (unchanged) {
      await sendSimpleMessage(
        chatId,
        `Je n'ai pas compris la modification (ou elle retirerait le wikilink obligatoire). Reformule, ou clique Skip sur la carte.`,
      );
      // On conserve le pending en awaiting_edit pour permettre une nouvelle tentative.
      void writeHotContextAudit('hot-context-patch-modified', {
        patchId: before.patchId,
        originalPayload: before.payload,
        modifiedPayload: null,
      });
      return 'unchanged';
    }

    const nextModifyCount = (pending.modifyCount ?? 0) + 1;

    if (messageId === undefined) {
      // Pas de message à éditer (cas dégradé) : on persiste quand même le patch
      // reformulé en phase preview et on informe Thomas.
      if (before.patchId !== patched.patchId) {
        delete state.pendingPatches[before.patchId];
      }
      state.pendingPatches[patched.patchId] = {
        patchId: patched.patchId,
        patch: patched,
        proposedAt: new Date().toISOString(),
        phase: 'preview',
        modifyCount: nextModifyCount,
      };
      await saveHotContextState(state);
      await sendSimpleMessage(chatId, `Patch reformulé. Renvoie une carte si besoin.`);
      return 'repreviewed';
    }

    await repreviewHotContextPatchCard({
      oldPatchId: before.patchId,
      patch: patched,
      messageId,
      chatId,
      modifyCount: nextModifyCount,
    });
    return 'repreviewed';
  } catch (err) {
    console.warn(
      `[hot-context-patch] reformulation échouée : ${err instanceof Error ? err.message : String(err)}`,
    );
    return 'unchanged';
  }
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

  // MODIFY (loop max 2) — défaut 2 : passe le pending en `awaiting_edit`. Le
  // prochain texte libre de Thomas sera capté par le webhook (route.ts) et
  // traité comme instruction de reformulation via
  // `patchHotContextPayloadFromInstruction`.
  if (parsed.action === 'modify') {
    const alreadyModified = pending.modifyCount ?? 0;
    if (alreadyModified >= HOT_CONTEXT_MAX_MODIFY_ITERATIONS) {
      // Cap atteint : on refuse une nouvelle entrée en mode modify.
      await editMessageTextWithButtons(
        params.chat_id,
        params.message_id,
        buildPatchCardText(
          pending.patch,
          computeProjectedTokens(await loadLiveBriefingContent(), pending.patch),
        ) + `\n\n(Limite de ${HOT_CONTEXT_MAX_MODIFY_ITERATIONS} reformulations atteinte — Valider ou Skip.)`,
        buildPatchKeyboardNoModify(pending.patch.patchId),
      );
      return 'modify_cap_reached';
    }

    pending.phase = 'awaiting_edit';
    pending.telegramMessageId = params.message_id;
    state.pendingPatches[parsed.patchId] = pending;
    await saveHotContextState(state);

    await editMessageText(
      params.chat_id,
      params.message_id,
      `✏️ Envoie ta reformulation en texte libre (ex: « plutôt vendredi », « ajoute [[X]] »). Loop max ${HOT_CONTEXT_MAX_MODIFY_ITERATIONS}.`,
    );
    void writeHotContextAudit('hot-context-patch-modified', {
      patchId: parsed.patchId,
      originalPayload: pending.patch.payload,
      modifiedPayload: null,
    });
    return 'modify_awaiting_edit';
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
