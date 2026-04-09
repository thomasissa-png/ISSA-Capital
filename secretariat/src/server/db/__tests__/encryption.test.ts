/**
 * Tests unitaires — db/encryption (Phase 6 préparatoire).
 *
 * Couverture (4 tests) :
 *  - isDbEncrypted() false si DB_ENCRYPTION_KEY absent
 *  - isDbEncrypted() false si placeholder __TO_FILL__
 *  - isDbEncrypted() false si clé trop courte
 *  - isDbEncrypted() true si clé valide (32+ chars)
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isDbEncrypted } from '../encryption';

const SNAPSHOT = { ...process.env };

const VALID_BASE_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake',
  DB_PATH: '/tmp/issa-enc-test.db',
  SESSION_TTL_HOURS: '24',
};

async function applyEnv(overrides: Record<string, string> = {}): Promise<void> {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, VALID_BASE_ENV, overrides);
  const { resetEnvForTests } = await import('../../utils/env');
  const { resetLoggerForTests } = await import('../../utils/logger');
  resetEnvForTests();
  resetLoggerForTests();
}

describe('db/encryption — isDbEncrypted', () => {
  beforeEach(async () => {
    await applyEnv();
  });

  afterEach(async () => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);
    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    resetEnvForTests();
    resetLoggerForTests();
  });

  it('retourne false si DB_ENCRYPTION_KEY absent', () => {
    expect(isDbEncrypted()).toBe(false);
  });

  it('retourne false si la clé est un placeholder __TO_FILL__', async () => {
    await applyEnv({ DB_ENCRYPTION_KEY: '__TO_FILL__' });
    expect(isDbEncrypted()).toBe(false);
  });

  it('retourne false si la clé est trop courte', async () => {
    await applyEnv({ DB_ENCRYPTION_KEY: 'short_key' });
    expect(isDbEncrypted()).toBe(false);
  });

  it('retourne true si la clé fait >= 32 caractères', async () => {
    await applyEnv({
      DB_ENCRYPTION_KEY:
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // 64 hex
    });
    expect(isDbEncrypted()).toBe(true);
  });
});
