/**
 * Handler callback Telegram — health_snooze:<itemId>
 *
 * Thomas clique "Rappeler dans 7 jours" sur une carte d'alerte santé.
 * Pose snoozedUntil = now + 7j sur toutes les entries de notification
 * (dedup-store) pour cet item.
 *
 * Pas de recordOAuthCallback — Thomas n'a PAS renouvelé, juste snoozé.
 *
 * Jalon S15.5E — Task C.
 */

import { snooze } from '../../health-monitor/dedup-store';
import { MONITORED_ITEMS } from '../../health-monitor/monitored-items';
import { editMessageText } from '../telegram-cards';
import { answerCallbackQuery } from '../../telegram';
import type { HealthCallbackParams } from './health-renewed';

// ============================================================
// Handler
// ============================================================

/**
 * Traite le callback health_snooze:<itemId>.
 *
 * 1. Parse itemId
 * 2. Vérifie que l'itemId existe dans MONITORED_ITEMS
 * 3. snooze(itemId, 7) — pose snoozedUntil = now + 7j
 * 4. Edit le message Telegram (texte + suppression boutons)
 */
export async function handleHealthSnooze(params: HealthCallbackParams): Promise<void> {
  const { callbackQueryId, callbackData, chatId, messageId } = params;
  const itemId = callbackData.replace('health_snooze:', '');

  // Vérifier que l'item existe
  const item = MONITORED_ITEMS.find((i) => i.id === itemId);
  if (!item) {
    await answerCallbackQuery(callbackQueryId, 'Item inconnu');
    return;
  }

  try {
    // Snooze 7 jours
    snooze(itemId, 7);

    // Edit le message : remplacer texte + supprimer boutons
    await editMessageText(
      chatId,
      messageId,
      `Rappel dans 7 jours pour ${item.label}`,
    );
  } catch (err) {
    console.warn(
      `[health-snooze] erreur traitement ${itemId} : ${err instanceof Error ? err.message : String(err)}`,
    );
    await answerCallbackQuery(callbackQueryId, 'Erreur traitement');
  }
}
