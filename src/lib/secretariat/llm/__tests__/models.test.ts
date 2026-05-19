/**
 * Tests `models.ts` — constantes + override par env.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  HAIKU_4_5,
  SONNET_4,
  resolveSonnetModel,
  resolveHaikuModel,
  resolveModelByFamily,
} from '../models';

describe('models — constantes', () => {
  it('HAIKU_4_5 = claude-haiku-4-5-20251001', () => {
    expect(HAIKU_4_5).toBe('claude-haiku-4-5-20251001');
  });

  it('SONNET_4 = claude-sonnet-4-20250514', () => {
    expect(SONNET_4).toBe('claude-sonnet-4-20250514');
  });
});

describe('models — resolveSonnetModel', () => {
  const original = process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;
    } else {
      process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = original;
    }
  });

  it('retourne SONNET_4 par défaut', () => {
    delete process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;
    expect(resolveSonnetModel()).toBe(SONNET_4);
  });

  it('respecte l override env', () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = 'claude-sonnet-4-6';
    expect(resolveSonnetModel()).toBe('claude-sonnet-4-6');
  });

  it('ignore une valeur vide ou whitespace', () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = '   ';
    expect(resolveSonnetModel()).toBe(SONNET_4);
  });
});

describe('models — resolveHaikuModel', () => {
  const original = process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU;
    } else {
      process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU = original;
    }
  });

  it('retourne HAIKU_4_5 par défaut', () => {
    delete process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU;
    expect(resolveHaikuModel()).toBe(HAIKU_4_5);
  });

  it('respecte l override env', () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU = 'claude-haiku-5-0-20260101';
    expect(resolveHaikuModel()).toBe('claude-haiku-5-0-20260101');
  });
});

describe('models — resolveModelByFamily', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;
    delete process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU;
  });

  it('sonnet → Sonnet 4 par défaut', () => {
    expect(resolveModelByFamily('sonnet')).toBe(SONNET_4);
  });

  it('haiku → Haiku 4.5 par défaut', () => {
    expect(resolveModelByFamily('haiku')).toBe(HAIKU_4_5);
  });
});
