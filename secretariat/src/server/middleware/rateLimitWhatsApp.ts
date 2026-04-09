/**
 * Rate limiter inline pour les messages WhatsApp entrants (Phase 6).
 *
 * Spec plan @ia : 5 req/min, 20 req/h par numéro E.164.
 *
 * Contrairement au rate limiter Express global (par IP, utile pour les
 * clients HTTP externes), celui-ci est appelé INLINE depuis le handler
 * webhook WhatsApp (cf routes/whatsapp.ts) parce que :
 *  - Un seul webhook Meta peut contenir plusieurs messages (un par message)
 *  - L'IP n'a aucun sens côté Meta (toujours la même)
 *  - Le compteur doit être par numéro E.164 whitelisté
 *
 * Stratégie de stockage : **in-memory** (Map). Suffisant pour V1 avec un
 * worker unique sur Replit autoscale (1 instance). En Phase 7+, si on
 * bascule sur plusieurs workers, passer à Redis / SQLite.
 *
 * Comportement :
 *  - Si le compteur 1 min dépasse 5 → bloque + log access_logs
 *  - Si le compteur 1 h dépasse 20 → bloque + log access_logs
 *  - Le caller (whatsapp.ts) répond 200 silencieux à Meta (comme pour la
 *    whitelist — éviter les retries agressifs Meta)
 *
 * Sources :
 *   - docs/ia/secretariat-implementation-plan.md Phase 6 (rate limit WhatsApp)
 *   - docs/ia/secretariat-architecture.md Section 7.2
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
 * Structure : Map<phoneE164, timestamps[]>
 * timestamps = timestamps epoch ms des messages reçus, triés ASC.
 *
 * On purge les entrées plus anciennes que 1h à chaque check.
 * Si un numéro arrête de poster, sa clé reste en mémoire mais avec un
 * array vide après purge : le garbage collector JS récupère tout au
 * redémarrage du worker (Replit autoscale redémarre fréquemment).
 */
const counters = new Map<string, number[]>();

/**
 * Reset explicite — utilisé uniquement par les tests.
 * NE PAS appeler en runtime.
 */
export function resetRateLimitForTests(): void {
  counters.clear();
}

// ============================================================
// API
// ============================================================

export interface RateLimitResult {
  allowed: boolean;
  /** Raison du refus, lisible pour logs. */
  reason?: 'rate_limit_1min' | 'rate_limit_1hour';
  /** Nombre de messages dans la fenêtre 1min au moment du check. */
  count1min: number;
  /** Nombre de messages dans la fenêtre 1h au moment du check. */
  count1hour: number;
}

/**
 * Check du rate limit pour un numéro E.164. Incrémente le compteur si allowed.
 *
 * @param phoneE164 - Numéro normalisé (ex: `+33612345678`)
 * @param now - Instant de référence (injectable pour les tests)
 */
export function checkWhatsAppRateLimit(
  phoneE164: string,
  now: Date = new Date(),
): RateLimitResult {
  const nowMs = now.getTime();

  // Purge les timestamps expirés (> 1h).
  const existing = counters.get(phoneE164) ?? [];
  const cutoff1h = nowMs - WINDOW_1_HOUR_MS;
  const filtered = existing.filter((ts) => ts > cutoff1h);

  // Compteurs par fenêtre
  const cutoff1min = nowMs - WINDOW_1_MIN_MS;
  const count1min = filtered.filter((ts) => ts > cutoff1min).length;
  const count1hour = filtered.length;

  // Check fenêtre courte (1 min)
  if (count1min >= LIMIT_PER_MIN) {
    counters.set(phoneE164, filtered); // on garde l'historique purgé
    logBlocked(phoneE164, 'rate_limit_1min', {
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
    counters.set(phoneE164, filtered);
    logBlocked(phoneE164, 'rate_limit_1hour', {
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
  counters.set(phoneE164, filtered);

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
  phoneE164: string,
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
      phoneE164,
      null,
      'whatsapp_webhook',
      'incoming_message',
      'rate_limited',
      null,
      reason,
      new Date().toISOString(),
    );
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), phoneE164 },
      '[rateLimitWhatsApp] échec insert access_logs',
    );
  }

  log.warn(
    { phoneE164, reason, ...details },
    '[rateLimitWhatsApp] message bloqué pour dépassement de quota',
  );
}
