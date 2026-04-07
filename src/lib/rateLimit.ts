/**
 * Rate limiter in-memory simple — pas de Redis.
 * Stocke les timestamps par IP dans une Map. Autosuffisant pour un site vitrine
 * déployé sur une instance unique Replit. Si scale horizontal : migrer vers upstash.
 *
 * Les valeurs par défaut (5 req / 10 min) sont configurables via les env vars
 * RATE_LIMIT_MAX et RATE_LIMIT_WINDOW_MS.
 */

type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

// Garbage collection simple : nettoie les entrées expirées toutes les 5 minutes.
let gcInterval: ReturnType<typeof setInterval> | null = null;
function ensureGc(windowMs: number): void {
  if (gcInterval) return;
  const interval = Math.max(windowMs, 60_000);
  gcInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (value.resetAt < now) store.delete(key);
    }
  }, interval);
  // Unref pour ne pas bloquer le process Node.
  if (typeof gcInterval === 'object' && gcInterval !== null && 'unref' in gcInterval) {
    (gcInterval as { unref: () => void }).unref();
  }
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  options: { max?: number; windowMs?: number } = {},
): RateLimitResult {
  const max = options.max ?? Number(process.env.RATE_LIMIT_MAX ?? 5);
  const windowMs = options.windowMs ?? Number(process.env.RATE_LIMIT_WINDOW_MS ?? 600_000);
  ensureGc(windowMs);

  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: max - 1,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= max) {
    return {
      success: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  store.set(key, existing);
  return {
    success: true,
    remaining: max - existing.count,
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };
}
