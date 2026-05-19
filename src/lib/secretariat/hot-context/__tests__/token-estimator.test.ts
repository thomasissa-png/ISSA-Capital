/**
 * Tests token-estimator — cap warn 500.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateTokens,
  isCapExceeded,
  formatTokenDelta,
  TOKEN_CAP_WARN,
} from '../token-estimator';

describe('token-estimator — sous cap', () => {
  it('estimation sous 500 tokens → pas de warn', () => {
    const content = 'a'.repeat(200); // ~50 tokens
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThan(TOKEN_CAP_WARN);
    expect(isCapExceeded(tokens)).toBe(false);
    expect(formatTokenDelta(tokens)).not.toContain('dépassé');
  });
});

describe('token-estimator — au-dessus cap', () => {
  it('estimation au-dessus de 500 tokens → warn (mais ne bloque pas)', () => {
    const content = 'a'.repeat(3000); // ~750 tokens
    const tokens = estimateTokens(content);
    expect(tokens).toBeGreaterThan(TOKEN_CAP_WARN);
    expect(isCapExceeded(tokens)).toBe(true);
    expect(formatTokenDelta(tokens)).toContain('dépassé');
  });
});
