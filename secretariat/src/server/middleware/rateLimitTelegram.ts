/**
 * Rate limiter inline pour les messages Telegram entrants.
 *
 * Même spec que rateLimitWhatsApp.ts : 5 req/min, 20 req/h par identifiant.
 * L'identifiant est un `chat_id` (number) au lieu d'un phone E.164.
 *
 * Stratégie de stockage : **in-memory** (Map). Suffisant pour V1 avec un
 * worker unique sur Replit autoscale (1 instance).
 *
 * Comportement :
 *  - Si le compteur 1 min dépasse 5 → bloque + log access_logs
 *  - Si le compteur 1 h dépasse 20 → bloque + log access_logs
 *  - Le caller (telegram route) répond 200 silencieux à Telegram
 *
 * Sources :
 *   - middleware/rateLimitWhatsApp.ts (pattern identique)
 */

import { getDb } from '../db/connection';
import { getLogger } from '../utils/logger';

// ============================================================
// Configuration
// ============================================================

const WINDOW_1_MIN_MS = 60 * 1000;
const WINDOW_1_HOUR_MS = 60 * 60 * 1000;

const LIMIT_PER_MIN = 5;
const LIMIT_PER_HOUR = 20;

// ============================================================
// État en mémoire
// ============================================================

/**
 * Structure : Map<chatId (as string), timestamps[]>
 * timestamps = timestamps epoch ms des messages reçus, triés ASC.
 */
const counters = new Map<string, number[]>();

/**
 * Reset explicite — utilisé uniquement par les tests.
 * NE PAS appeler en runtime.
 */
export function resetTelegramRateLimitForTests(): void {
  counters.clear();
}

// ============================================================
// API
// ============================================================

export interface TelegramRateLimitResult {
  allowed: boolean;
  /** Raison du refus, lisible pour logs. */
  reason?: 'rate_limit_1min' | 'rate_limit_1hour';
  /** Nombre de messages dans la fenêtre 1min au moment du check. */
  count1min: number;
  /** Nombre de messages dans la fenêtre 1h au moment du check. */
  count1hour: number;
}

/**
 * Check du rate limit pour un chat_id Telegram. Incrémente le compteur si allowed.
 *
 * @param chatId - Identifiant du chat Telegram
 * @param now - Instant de référence (injectable pour les tests)
 */
export function checkTelegramRateLimit(
  chatId: number,
  now: Date = new Date(),
): TelegramRateLimitResult {
  const key = String(chatId);
  const nowMs = now.getTime();

  // Purge les timestamps expirés (> 1h).
  const existing = counters.get(key) ?? [];
  const cutoff1h = nowMs - WINDOW_1_HOUR_MS;
  const filtered = existing.filter((ts) => ts > cutoff1h);

  // Compteurs par fenêtre
  const cutoff1min = nowMs - WINDOW_1_MIN_MS;
  const count1min = filtered.filter((ts) => ts > cutoff1min).length;
  const count1hour = filtered.length;

  // Check fenêtre courte (1 min)
  if (count1min >= LIMIT_PER_MIN) {
    counters.set(key, filtered);
    logBlocked(chatId, 'rate_limit_1min', {
      count1min,
      count1hour,
      limit: LIMIT_PER_MIN,
    });
    return {
      allowed: false,
      reason: 'rate_limit_1min',
      count1min,
      count1hour,
    };
  }

  // Check fenêtre longue (1 h)
  if (count1hour >= LIMIT_PER_HOUR) {
    counters.set(key, filtered);
    logBlocked(chatId, 'rate_limit_1hour', {
      count1min,
      count1hour,
      limit: LIMIT_PER_HOUR,
    });
    return {
      allowed: false,
      reason: 'rate_limit_1hour',
      count1min,
      count1hour,
    };
  }

  // Allowed : on incrémente
  filtered.push(nowMs);
  counters.set(key, filtered);

  return {
    allowed: true,
    count1min: count1min + 1,
    count1hour: count1hour + 1,
  };
}

/**
 * Log un message bloqué dans access_logs pour audit.
 * Best-effort : si l'insert échoue, log pino mais ne throw pas.
 */
function logBlocked(
  chatId: number,
  reason: 'rate_limit_1min' | 'rate_limit_1hour',
  details: { count1min: number; count1hour: number; limit: number },
): void {
  const log = getLogger();
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO access_logs
         (actor_phone, actor_display_name, resource_type, resource_id,
          action, entite, result, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      `telegram:${chatId}`,
      null,
      'telegram_webhook',
      'incoming_message',
      'rate_limited',
      null,
      reason,
      new Date().toISOString(),
    );
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), chatId },
      '[rateLimitTelegram] échec insert access_logs',
    );
  }

  log.warn(
    { chatId, reason, ...details },
    '[rateLimitTelegram] message bloqué pour dépassement de quota',
  );
}
