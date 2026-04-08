/**
 * Tests unitaires — validation des variables d'environnement.
 *
 * Objectif : garantir que le schéma Zod rejette les valeurs manquantes /
 * invalides et accepte un set minimal valide.
 *
 * Stratégie : on snapshot process.env, on le mute pour chaque test,
 * on reset le cache env via resetEnvForTests().
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadEnv, resetEnvForTests } from '../env';

const SNAPSHOT = { ...process.env };

const VALID_ENV = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake-key-for-tests-only',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake_test_key',
  DB_PATH: ':memory:',
  SESSION_TTL_HOURS: '24',
} as const;

function setEnv(overrides: Record<string, string | undefined>): void {
  // Vider process.env puis appliquer le snapshot minimal requis par les tests
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  for (const [k, v] of Object.entries(VALID_ENV)) {
    process.env[k] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

describe('env schema', () => {
  beforeEach(() => {
    resetEnvForTests();
  });

  afterEach(() => {
    // Restaure l'env original
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);
    resetEnvForTests();
    vi.restoreAllMocks();
  });

  it('accepte un set de variables valide', () => {
    setEnv({});
    const env = loadEnv();

    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3001);
    expect(env.ANTHROPIC_API_KEY).toMatch(/^sk-ant-/);
    expect(env.CRAFT_IC_KEY).toMatch(/^pdk_/);
    expect(env.DB_PATH).toBe(':memory:');
  });

  it('rejette ANTHROPIC_API_KEY manquante', () => {
    setEnv({ ANTHROPIC_API_KEY: undefined });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    loadEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalled();
    const output = stderrSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('ANTHROPIC_API_KEY');
  });

  it('rejette ANTHROPIC_API_KEY avec mauvais préfixe', () => {
    setEnv({ ANTHROPIC_API_KEY: 'not-a-real-key' });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    loadEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = stderrSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('sk-ant-');
  });

  it('rejette CRAFT_IC_KEY avec mauvais préfixe', () => {
    setEnv({ CRAFT_IC_KEY: 'wrong-prefix' });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    loadEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = stderrSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('pdk_');
  });

  it('rejette CRAFT_IC_BASE_URL non-URL', () => {
    setEnv({ CRAFT_IC_BASE_URL: 'pas-une-url' });

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    loadEnv();

    expect(exitSpy).toHaveBeenCalledWith(1);
    const output = stderrSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(output).toContain('CRAFT_IC_BASE_URL');
  });

  it('accepte les variables WhatsApp manquantes en Phase 1', () => {
    setEnv({
      WHATSAPP_CLOUD_API_TOKEN: undefined,
      WHATSAPP_PHONE_ID: undefined,
      WHATSAPP_VERIFY_TOKEN: undefined,
    });

    const env = loadEnv();
    expect(env.WHATSAPP_CLOUD_API_TOKEN).toBeUndefined();
    expect(env.WHATSAPP_PHONE_ID).toBeUndefined();
  });

  it('applique les valeurs par défaut (PORT, LOG_LEVEL)', () => {
    setEnv({ PORT: undefined, LOG_LEVEL: undefined });
    const env = loadEnv();

    expect(env.PORT).toBe(3001);
    expect(env.LOG_LEVEL).toBe('info');
  });
});
