/**
 * Envoi du brief du matin à Thomas via Telegram.
 *
 * Réutilise `sendTelegramMessage` (telegram.ts). Cible : TELEGRAM_CHAT_ID_THOMAS.
 * Même pattern de parsing/garde-fou que `sendCalendarRecapCard`.
 */

import { sendTelegramMessage } from '../telegram';

/**
 * Envoie le message du brief à Thomas.
 *
 * @returns true si envoyé, false sinon (chat ID manquant/invalide ou échec API).
 */
export async function sendMorningBrief(message: string): Promise<boolean> {
  const chatIdStr = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!chatIdStr) {
    console.warn('[morning-brief] TELEGRAM_CHAT_ID_THOMAS manquant — pas d’envoi');
    return false;
  }
  const chatId = parseInt(chatIdStr, 10);
  if (Number.isNaN(chatId)) {
    console.warn(`[morning-brief] TELEGRAM_CHAT_ID_THOMAS invalide : ${chatIdStr}`);
    return false;
  }

  const result = await sendTelegramMessage(chatId, message);
  if (!result.success) {
    console.warn(`[morning-brief] envoi échec : ${result.error ?? 'erreur inconnue'}`);
    return false;
  }
  return true;
}
