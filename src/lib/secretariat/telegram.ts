/**
 * Client Telegram Bot API — version allégée pour le webhook Next.js.
 *
 * Envoie des messages texte via l'API sendMessage.
 * Timeout explicite 10s, retry simple (1 retry sur 5xx).
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

interface TelegramSendResult {
  success: boolean;
  error?: string;
}

/**
 * Envoie un message texte à un chat Telegram.
 * Tronque à 4096 caractères (limite Telegram).
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  }

  const safeText =
    text.length > 4096 ? `${text.slice(0, 4084)}… [tronqué]` : text;

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: safeText,
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        return { success: true };
      }

      // Retry uniquement sur 5xx et si c'est la première tentative
      if (response.status >= 500 && attempt === 1) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        error: `Telegram API ${response.status}: ${errorBody.slice(0, 200)}`,
      };
    } catch (err) {
      clearTimeout(timer);

      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { success: false, error: 'Échec après 2 tentatives' };
}

/**
 * Acquitte un callback_query Telegram (retire le spinner du bouton).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  }

  const url = `${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text ?? '',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      return { success: true };
    }
    return {
      success: false,
      error: `Telegram API ${response.status}`,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
