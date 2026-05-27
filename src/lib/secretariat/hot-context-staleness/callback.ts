/**
 * Handler callback Telegram — `hcstale:bump` / `hcstale:snooze` (hot-context V0).
 *
 * Mirroir des handlers health-monitor. Dispatch dans
 * `src/app/api/telegram/webhook/route.ts` (préfixe `hcstale:`).
 */

import { editMessageText } from '../telegram-validation/telegram-cards';
import { answerCallbackQuery } from '../telegram';
import { bumpHotContext, snoozeStaleness } from './runner';

export interface StalenessCallbackParams {
  callbackQueryId: string;
  callbackData: string;
  chatId: number;
  messageId: number;
}

export async function handleStalenessCallback(params: StalenessCallbackParams): Promise<void> {
  const { callbackQueryId, callbackData, chatId, messageId } = params;
  const action = callbackData.replace('hcstale:', '');

  try {
    if (action === 'bump') {
      const r = await bumpHotContext();
      await editMessageText(
        chatId,
        messageId,
        r.ok
          ? `✅ Hot context bumpé → ${r.week} (${r.date}). Pense à couper ce qui n'est plus actif.`
          : `❌ Bump échoué : ${r.error ?? 'erreur inconnue'}`,
      );
      await answerCallbackQuery(callbackQueryId, r.ok ? 'Frontmatter mis à jour' : 'Échec');
      return;
    }

    if (action === 'snooze') {
      await snoozeStaleness();
      await editMessageText(chatId, messageId, '💤 Rappel hot-context dans 24h.');
      await answerCallbackQuery(callbackQueryId, 'Snooze 24h');
      return;
    }

    await answerCallbackQuery(callbackQueryId, 'Action inconnue');
  } catch (err) {
    console.warn(
      `[hot-context-staleness] callback ${action} échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
    await answerCallbackQuery(callbackQueryId, 'Erreur traitement');
  }
}
