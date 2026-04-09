/**
 * Service Telegram Bot API — envoi de messages et parsing webhook.
 *
 * Responsabilités :
 *  - Appel sortant `POST https://api.telegram.org/bot{token}/sendMessage`
 *    pour envoyer des messages texte et inline keyboards.
 *  - Appel `POST .../answerCallbackQuery` pour acquitter les boutons inline.
 *  - Parsing strict du payload webhook entrant via Zod.
 *  - Timeout explicite 10s via AbortController (règle fullstack agent).
 *  - Retry exponentiel (2 tentatives supplémentaires, backoff 1s/2s) sur
 *    erreurs réseau et HTTP 5xx. PAS de retry sur 4xx (auth/payload).
 *
 * Sécurité :
 *  - `env.TELEGRAM_BOT_TOKEN` n'est JAMAIS passé à un log.
 *  - Les payloads entrants sont validés via Zod.
 *
 * Source :
 *  - https://core.telegram.org/bots/api
 */

import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';
import {
  TelegramConfigError,
  TelegramHttpError,
  TelegramTimeoutError,
  TelegramUpdateSchema,
  TelegramParseError,
  type TelegramSendResult,
  type TelegramUpdate,
} from './telegram.types';

// ============================================================
// Constantes
// ============================================================

/** Telegram Bot API base URL. */
const TELEGRAM_API_BASE = 'https://api.telegram.org';
/** Timeout par tentative (10s — règle agent @fullstack pour APIs tierces). */
const TIMEOUT_MS = 10_000;
/** Nombre max de tentatives (1 initiale + 2 retries). */
const MAX_ATTEMPTS = 3;
/** Backoff indexé par tentative pour les retries (2e puis 3e). */
const BACKOFF_MS = [1_000, 2_000] as const;
/** Taille max du preview de body loggé en cas d'erreur. */
const BODY_PREVIEW_MAX = 500;
/** Limite Telegram sur un message texte. */
const TELEGRAM_TEXT_MAX = 4096;

// ============================================================
// Helpers internes
// ============================================================

async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function previewBody(body: string): string {
  if (body.length <= BODY_PREVIEW_MAX) {
    return body;
  }
  return `${body.slice(0, BODY_PREVIEW_MAX)}… [truncated, ${body.length} chars total]`;
}

/**
 * Retry policy : 5xx + 408 + 429 sont retriables.
 */
function isRetriableHttpStatus(status: number): boolean {
  if (status >= 500 && status < 600) {
    return true;
  }
  if (status === 408 || status === 429) {
    return true;
  }
  return false;
}

/**
 * Valide la configuration Telegram — throw `TelegramConfigError` si absente.
 */
function requireTelegramConfig(): { token: string } {
  const env = getEnv();
  if (
    env.TELEGRAM_BOT_TOKEN === undefined ||
    env.TELEGRAM_BOT_TOKEN.trim() === '' ||
    env.TELEGRAM_BOT_TOKEN === '__TO_FILL__'
  ) {
    throw new TelegramConfigError(
      'TELEGRAM_BOT_TOKEN manquant ou placeholder — impossible d\'appeler Telegram',
    );
  }
  return { token: env.TELEGRAM_BOT_TOKEN };
}

// ============================================================
// Options d'appel (pour injection tests)
// ============================================================

export interface SendOptions {
  /** Timeout custom (tests). */
  timeoutMs?: number;
  /** Nombre max de tentatives (tests). */
  maxAttempts?: number;
  /** Sleep no-op pour accélérer les tests. */
  sleep?: (ms: number) => Promise<void>;
}

// ============================================================
// Appel Telegram générique
// ============================================================

async function postToTelegram(
  method: string,
  body: Record<string, unknown>,
  options: SendOptions,
): Promise<TelegramSendResult> {
  const log = getLogger();
  const { token } = requireTelegramConfig();

  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;

  const url = `${TELEGRAM_API_BASE}/bot${token}/${method}`;
  const bodyJson = JSON.stringify(body);
  const startedAt = Date.now();

  let lastError: TelegramSendResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: bodyJson,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const rawBody = await response.text();

      if (!response.ok) {
        const shouldRetry =
          isRetriableHttpStatus(response.status) && attempt < maxAttempts;

        if (shouldRetry) {
          const backoff =
            BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0;
          log.warn(
            {
              httpStatus: response.status,
              attempt,
              nextRetryInMs: backoff,
              bodyPreview: previewBody(rawBody),
            },
            '[telegram] échec HTTP retriable — retry prévu',
          );
          await sleep(backoff);
          continue;
        }

        const err = new TelegramHttpError(
          response.status,
          `Telegram API a répondu ${response.status}`,
          previewBody(rawBody),
        );
        log.error(
          {
            httpStatus: response.status,
            attempt,
            bodyPreview: previewBody(rawBody),
            durationMs: Date.now() - startedAt,
          },
          '[telegram] échec définitif envoi',
        );
        lastError = {
          success: false,
          error: err.message,
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
          attempts: attempt,
        };
        return lastError;
      }

      // ---- Succès 2xx : extraire l'id message (optionnel) ----
      let messageId: number | undefined;
      try {
        const parsed = JSON.parse(rawBody) as {
          ok?: boolean;
          result?: { message_id?: number };
        };
        messageId = parsed.result?.message_id;
      } catch {
        // Body non-JSON toléré si HTTP 200.
      }

      const durationMs = Date.now() - startedAt;
      log.info(
        {
          attempt,
          httpStatus: response.status,
          durationMs,
          hasMessageId: messageId !== undefined,
        },
        '[telegram] message envoyé',
      );

      const result: TelegramSendResult = {
        success: true,
        httpStatus: response.status,
        durationMs,
        attempts: attempt,
      };
      if (messageId !== undefined) {
        result.messageId = messageId;
      }
      return result;
    } catch (err) {
      clearTimeout(timer);

      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('aborted'));

      if (isAbort) {
        const timeoutErr = new TelegramTimeoutError(timeoutMs);
        const shouldRetry = attempt < maxAttempts;
        if (shouldRetry) {
          const backoff =
            BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0;
          log.warn(
            { attempt, timeoutMs, nextRetryInMs: backoff },
            '[telegram] timeout — retry prévu',
          );
          await sleep(backoff);
          continue;
        }
        log.error(
          { attempt, timeoutMs, durationMs: Date.now() - startedAt },
          '[telegram] timeout définitif',
        );
        return {
          success: false,
          error: timeoutErr.message,
          durationMs: Date.now() - startedAt,
          attempts: attempt,
        };
      }

      // Erreur réseau (DNS, ECONNREFUSED, etc.)
      const errorMessage = err instanceof Error ? err.message : String(err);
      const shouldRetry = attempt < maxAttempts;

      if (shouldRetry) {
        const backoff =
          BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0;
        log.warn(
          { attempt, errorMessage, nextRetryInMs: backoff },
          '[telegram] erreur réseau — retry prévu',
        );
        await sleep(backoff);
        continue;
      }

      log.error(
        { attempt, errorMessage, durationMs: Date.now() - startedAt },
        '[telegram] erreur réseau définitive',
      );
      return {
        success: false,
        error: `Erreur réseau Telegram : ${errorMessage}`,
        durationMs: Date.now() - startedAt,
        attempts: attempt,
      };
    }
  }

  return (
    lastError ?? {
      success: false,
      error: 'Échec inconnu (aucune tentative effectuée)',
      durationMs: Date.now() - startedAt,
      attempts: 0,
    }
  );
}

// ============================================================
// API publique
// ============================================================

/**
 * Envoie un message texte simple à un chat Telegram.
 *
 * Ne throw pas : retourne un `TelegramSendResult` dont le caller doit
 * tester `success`. Cohérent avec `sendMessage` WhatsApp.
 *
 * Si le texte dépasse 4096 caractères (limite Telegram), il est tronqué et
 * suffixé `… [tronqué]`.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: SendOptions = {},
): Promise<TelegramSendResult> {
  const safeText =
    text.length > TELEGRAM_TEXT_MAX
      ? `${text.slice(0, TELEGRAM_TEXT_MAX - 12)}… [tronqué]`
      : text;

  return postToTelegram(
    'sendMessage',
    {
      chat_id: chatId,
      text: safeText,
      parse_mode: 'HTML',
    },
    options,
  );
}

/**
 * Envoie un message avec inline keyboard à 3 boutons pour la confirmation
 * d'un brouillon (Valider/Modifier/Annuler).
 *
 * Les callback_data encodent le draftId pour que le dispatcher webhook
 * puisse retrouver la session et router l'action.
 *
 * Docs : https://core.telegram.org/bots/api#inlinekeyboardmarkup
 */
export async function sendTelegramConfirmation(
  chatId: string | number,
  draftId: string,
  previewText: string,
  options: SendOptions = {},
): Promise<TelegramSendResult> {
  // Telegram limite le texte à 4096 chars — on tronque si nécessaire.
  const safeBody =
    previewText.length > TELEGRAM_TEXT_MAX
      ? `${previewText.slice(0, TELEGRAM_TEXT_MAX - 4)}…`
      : previewText;

  return postToTelegram(
    'sendMessage',
    {
      chat_id: chatId,
      text: safeBody,
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Valider', callback_data: `validate:${draftId}` },
            { text: 'Modifier', callback_data: `modify:${draftId}` },
            { text: 'Annuler', callback_data: `cancel:${draftId}` },
          ],
        ],
      },
    },
    options,
  );
}

/**
 * Acquitte un callback_query Telegram.
 * Obligatoire pour retirer le "spinner" sur le bouton côté client Telegram.
 *
 * Docs : https://core.telegram.org/bots/api#answercallbackquery
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  options: SendOptions = {},
): Promise<TelegramSendResult> {
  return postToTelegram(
    'answerCallbackQuery',
    {
      callback_query_id: callbackQueryId,
      text: text ?? '',
    },
    options,
  );
}

/**
 * Parse et valide un payload webhook entrant de Telegram.
 *
 * @throws `TelegramParseError` si le payload ne matche pas le schéma Zod.
 */
export function parseTelegramUpdate(body: unknown): TelegramUpdate {
  const parsed = TelegramUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const bodyPreview = previewBody(
      typeof body === 'string' ? body : JSON.stringify(body ?? {}),
    );
    throw new TelegramParseError(
      `Payload webhook Telegram invalide : ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ')}`,
      bodyPreview,
    );
  }
  return parsed.data;
}
