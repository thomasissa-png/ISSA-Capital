import { describe, expect, it } from 'vitest';
import { checkRateLimit } from './rateLimit';

describe('checkRateLimit', () => {
  it('autorise les premières requêtes et refuse au-delà du seuil', () => {
    const key = `test:${Math.random()}`;
    const first = checkRateLimit(key, { max: 3, windowMs: 60_000 });
    const second = checkRateLimit(key, { max: 3, windowMs: 60_000 });
    const third = checkRateLimit(key, { max: 3, windowMs: 60_000 });
    const fourth = checkRateLimit(key, { max: 3, windowMs: 60_000 });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(third.success).toBe(true);
    expect(fourth.success).toBe(false);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });
});
