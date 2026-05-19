/**
 * Handler Telegram — confirmation création projets TickTick (S18.1).
 *
 * Red line spec §8 step 4 : avant de créer 7 projets dans TickTick au
 * premier run, Anya doit obtenir confirmation explicite de Thomas via
 * Telegram (boutons [Créer] / [Annuler]).
 *
 * Callback prefix : `tickticksync_projects:`
 * Actions : `create` | `cancel`
 *
 * Le state TickTick (`SyncState`) est lu/écrit via state-store.
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
  createMissingProjects,
  missingProjects,
  projectsReady,
} from '../../ticktick-sync/project-manager';
import {
  loadSyncState,
  saveSyncState,
} from '../../ticktick-sync/state-store';

// ============================================================
// Constantes publiques
// ============================================================

export const TICKTICK_PROJECTS_CALLBACK_PREFIX = 'tickticksync_projects:';

export type TickTickProjectsAction = 'create' | 'cancel';

// ============================================================
// Parsing
// ============================================================

/**
 * Parse le callback data en action.
 * Format : `tickticksync_projects:<action>`
 */
export function parseTickTickProjectsCallback(
  data: string,
): { action: TickTickProjectsAction } | null {
  if (!data.startsWith(TICKTICK_PROJECTS_CALLBACK_PREFIX)) return null;
  const action = data.slice(TICKTICK_PROJECTS_CALLBACK_PREFIX.length);
  if (action !== 'create' && action !== 'cancel') return null;
  return { action };
}

// ============================================================
// Carte Telegram — formulation
// ============================================================

/** Texte HTML de la carte de confirmation. */
export function buildConfirmCardText(projectsToCreate: ReadonlyArray<string>): string {
  const list = projectsToCreate.map((n) => `• ${n}`).join('\n');
  return (
    `<b>Sync TickTick — premier run</b>\n\n` +
    `Je vais créer ${projectsToCreate.length} projets dans TickTick :\n` +
    `${list}\n\n` +
    `Confirmer ?`
  );
}

/** Inline keyboard standard de confirmation. */
export function buildConfirmKeyboard(): Array<
  Array<{ text: string; callback_data: string }>
> {
  return [
    [
      { text: 'Créer', callback_data: `${TICKTICK_PROJECTS_CALLBACK_PREFIX}create` },
      { text: 'Annuler', callback_data: `${TICKTICK_PROJECTS_CALLBACK_PREFIX}cancel` },
    ],
  ];
}

// ============================================================
// Envoi de la carte
// ============================================================

/**
 * Envoie la carte de confirmation à Thomas. Appelé par le cron au premier
 * run quand state.projects est vide.
 *
 * @returns true si l'envoi a réussi
 */
export async function sendTickTickProjectsConfirmCard(): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!token || token === '__TO_FILL__' || !chatId) {
    console.warn('[ticktick-projects-confirm] credentials Telegram manquants');
    return false;
  }

  const state = await loadSyncState();
  const missing = missingProjects(state);
  if (missing.length === 0) return true; // déjà créés, no-op

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildConfirmCardText(missing),
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buildConfirmKeyboard() },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch (err) {
    console.warn(
      `[ticktick-projects-confirm] envoi carte échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

// ============================================================
// Callback handler
// ============================================================

/**
 * Traite un callback Telegram pour la création de projets TickTick.
 *
 * @param params Paramètres du callback (data, ids Telegram)
 * @returns Message à logguer (pour debug)
 */
export async function handleTickTickProjectsCallback(params: {
  callback_query_id: string;
  data: string;
  message_id: number;
  chat_id: number | string;
}): Promise<string> {
  const parsed = parseTickTickProjectsCallback(params.data);
  if (!parsed) {
    await answerCallbackQuery(params.callback_query_id, 'Callback invalide');
    return 'invalid_callback';
  }

  // Acquittement immédiat (Telegram exige < 1s)
  await answerCallbackQuery(
    params.callback_query_id,
    parsed.action === 'create' ? 'Création en cours…' : 'Annulé',
  );

  if (parsed.action === 'cancel') {
    await editMessageText(
      params.chat_id,
      params.message_id,
      'Création projets TickTick annulée. Anya retentera au prochain cron.',
    );
    return 'cancelled';
  }

  // action = create
  const accessToken = process.env.TICKTICK_ACCESS_TOKEN;
  if (!accessToken || accessToken === '__TO_FILL__') {
    await editMessageText(
      params.chat_id,
      params.message_id,
      'Échec : TICKTICK_ACCESS_TOKEN manquant. Configurer Replit Secrets puis relancer.',
    );
    return 'no_token';
  }

  const state = await loadSyncState();

  try {
    const mapped = await createMissingProjects(accessToken, state);
    const ok = await saveSyncState(state);

    if (!ok) {
      await editMessageText(
        params.chat_id,
        params.message_id,
        `Projets mappés (${mapped.length}) mais sauvegarde state Drive échouée. Vérifier OAuth Drive.`,
      );
      return 'state_save_failed';
    }

    // Distinguer nouveaux vs réutilisés (S18.3 hotfix)
    const newCount = mapped.filter((m) => !m.reused).length;
    const reusedCount = mapped.filter((m) => m.reused).length;
    const ready = projectsReady(state);

    let status: string;
    if (!ready) {
      status = `${mapped.length} projet(s) mappé(s) (${newCount} créés, ${reusedCount} récupérés). État incomplet, retenter.`;
    } else if (newCount === 0 && reusedCount > 0) {
      status = `${reusedCount} projets récupérés depuis TickTick (existants). Sync activée.`;
    } else if (newCount > 0 && reusedCount > 0) {
      status = `${newCount} projet(s) créé(s), ${reusedCount} récupéré(s). Sync activée.`;
    } else {
      status = `${newCount} projet(s) créé(s). Sync activée.`;
    }

    await editMessageText(params.chat_id, params.message_id, status);
    return 'created';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // **Hotfix S18.3** : sauve l'état partiel AVANT de répondre au user.
    // `createMissingProjects` mutate state incrémentalement → si crash au
    // 5ème projet, les 4 précédents (créés ou récupérés) sont dans state.
    // Sans ce save, on les re-tente au prochain run → boucle d'erreur.
    await saveSyncState(state).catch(() => {
      // best-effort : si le save lui-même échoue, on log mais on remonte
      // l'erreur originale de création (plus actionable pour Thomas)
    });

    // Compteur partiel pour Thomas (combien de projets ok avant le crash)
    const mappedCount = Object.keys(state.projects).length;
    const totalCount = 7;
    await sendSimpleMessage(
      params.chat_id,
      `Erreur création projets TickTick (${mappedCount}/${totalCount} mappés avant échec) : ${msg.slice(0, 200)}`,
    );
    return `error: ${msg}`;
  }
}
