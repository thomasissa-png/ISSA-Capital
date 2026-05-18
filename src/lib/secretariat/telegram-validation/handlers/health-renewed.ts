/**
 * Handler callback Telegram — health_renewed:<itemId>
 *
 * Thomas clique "Marqué comme renouvelé" sur une carte d'alerte santé.
 * Supprime les entries de notification (dedup-store) et reset le timestamp OAuth
 * si c'est un item OAuth.
 *
 * Jalon S15.5E — Task C.
 */

import { resetItem } from '../../health-monitor/dedup-store';
import { recordOAuthCallback } from '../../health-monitor/oauth-timestamps';
import type { OAuthProvider } from '../../health-monitor/oauth-timestamps';
import { MONITORED_ITEMS } from '../../health-monitor/monitored-items';
import { editMessageText } from '../telegram-cards';
import { answerCallbackQuery } from '../../telegram';

// ============================================================
// Constantes
// ============================================================

/** Mapping itemId → OAuthProvider pour les items qui nécessitent un reset OAuth */
const OAUTH_ITEM_MAP: Record<string, OAuthProvider> = {
  ticktick_access_token: 'ticktick',
  gmail_oauth_consent: 'gmail',
  drive_oauth_consent: 'drive',
};

// ============================================================
// Types (aligné sur le pattern callback-handler.ts)
// ============================================================

export interface HealthCallbackParams {
  callbackQueryId: string;
  callbackData: string;
  chatId: number;
  messageId: number;
}

// ============================================================
// Handler
// ============================================================

/**
 * Traite le callback health_renewed:<itemId>.
 *
 * 1. Parse itemId
 * 2. Vérifie que l'itemId existe dans MONITORED_ITEMS
 * 3. resetItem (supprime toutes les entries dedup)
 * 4. Si OAuth item → recordOAuthCallback pour reset le timestamp
 * 5. Edit le message Telegram (texte + suppression boutons)
 */
export async function handleHealthRenewed(params: HealthCallbackParams): Promise<void> {
  const { callbackQueryId, callbackData, chatId, messageId } = params;
  const itemId = callbackData.replace('health_renewed:', '');

  // Vérifier que l'item existe
  const item = MONITORED_ITEMS.find((i) => i.id === itemId);
  if (!item) {
    await answerCallbackQuery(callbackQueryId, 'Item inconnu');
    return;
  }

  try {
    // Supprimer toutes les entries de notification pour cet item
    resetItem(itemId);

    // Si c'est un item OAuth, reset le timestamp d'obtention
    const provider = OAUTH_ITEM_MAP[itemId];
    if (provider) {
      recordOAuthCallback(provider);
    }

    // Edit le message : remplacer texte + supprimer boutons
    await editMessageText(
      chatId,
      messageId,
      `[OK] Marqué comme renouvelé — ${item.label}`,
    );
  } catch (err) {
    console.warn(
      `[health-renewed] erreur traitement ${itemId} : ${err instanceof Error ? err.message : String(err)}`,
    );
    await answerCallbackQuery(callbackQueryId, 'Erreur traitement');
  }
}
