/**
 * Tests unitaires du service d'authentification admin (Phase 5).
 *
 * Couverture :
 *  - hashPassword : hash valide + rejet input vide
 *  - verifyPassword : match OK, mismatch, hash malformé
 *  - generateJwt : token signé, payload correct, expiration
 *  - verifyJwt : token valide, token invalide, token expiré, payload malformé
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SNAPSHOT = { ...process.env };

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake-key-for-tests-only',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake_test_key',
  SESSION_TTL_HOURS: '24',
  JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long-for-tests',
  ADMIN_SESSION_TTL_HOURS: '24',
  DB_PATH: '/tmp/auth-test-not-used.db',
};

describe('services/auth', () => {
  beforeEach(async () => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    resetEnvForTests();
    resetLoggerForTests();
  });

  afterEach(async () => {
    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    resetEnvForTests();
    resetLoggerForTests();

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);
  });

  // -----------------------------------------------------------
  // hashPassword
  // -----------------------------------------------------------

  it('hashPassword retourne un hash bcrypt bien formé', async () => {
    const { hashPassword } = await import('../auth');
    const hash = await hashPassword('monMotDePasse');
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash.length).toBeGreaterThanOrEqual(59);
  });

  it('hashPassword throw sur string vide', async () => {
    const { hashPassword } = await import('../auth');
    await expect(hashPassword('')).rejects.toThrow();
  });

  // -----------------------------------------------------------
  // verifyPassword
  // -----------------------------------------------------------

  it('verifyPassword match un mot de passe correct', async () => {
    const { hashPassword, verifyPassword } = await import('../auth');
    const hash = await hashPassword('bonmotdepasse');
    expect(await verifyPassword('bonmotdepasse', hash)).toBe(true);
  });

  it('verifyPassword rejette un mot de passe incorrect', async () => {
    const { hashPassword, verifyPassword } = await import('../auth');
    const hash = await hashPassword('bonmotdepasse');
    expect(await verifyPassword('mauvais', hash)).toBe(false);
  });

  it('verifyPassword retourne false sur hash malformé (pas de throw)', async () => {
    const { verifyPassword } = await import('../auth');
    expect(await verifyPassword('pass', 'pas-un-hash')).toBe(false);
    expect(await verifyPassword('pass', '')).toBe(false);
  });

  it('verifyPassword retourne false sur plaintext vide', async () => {
    const { hashPassword, verifyPassword } = await import('../auth');
    const hash = await hashPassword('pass');
    expect(await verifyPassword('', hash)).toBe(false);
  });

  // -----------------------------------------------------------
  // generateJwt / verifyJwt
  // -----------------------------------------------------------

  it('generateJwt + verifyJwt : round-trip avec payload correct', async () => {
    const { generateJwt, verifyJwt } = await import('../auth');
    const { token, maxAgeMs } = generateJwt('thomas', 'admin');
    expect(typeof token).toBe('string');
    expect(maxAgeMs).toBe(24 * 3600 * 1000);

    const payload = verifyJwt(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('thomas');
    expect(payload?.role).toBe('admin');
    expect(typeof payload?.exp).toBe('number');
  });

  it('generateJwt supporte le rôle superadmin', async () => {
    const { generateJwt, verifyJwt } = await import('../auth');
    const { token } = generateJwt('thomas', 'superadmin');
    const payload = verifyJwt(token);
    expect(payload?.role).toBe('superadmin');
  });

  it('verifyJwt retourne null sur signature invalide', async () => {
    const { verifyJwt } = await import('../auth');
    expect(verifyJwt('not.a.valid.jwt')).toBeNull();
    expect(verifyJwt('')).toBeNull();
  });

  it('verifyJwt retourne null si signé avec un autre secret', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { verifyJwt } = await import('../auth');
    const token = jwt.sign(
      { sub: 'intrus', role: 'admin' },
      'un-autre-secret-de-taille-suffisante-pour-jwt',
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    expect(verifyJwt(token)).toBeNull();
  });

  it('verifyJwt retourne null si role invalide', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { verifyJwt } = await import('../auth');
    const token = jwt.sign(
      { sub: 'thomas', role: 'user' },
      VALID_ENV.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    expect(verifyJwt(token)).toBeNull();
  });

  it('verifyJwt retourne null si sub manquant', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { verifyJwt } = await import('../auth');
    const token = jwt.sign(
      { role: 'admin' },
      VALID_ENV.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '1h' },
    );
    expect(verifyJwt(token)).toBeNull();
  });

  it('verifyJwt retourne null sur token expiré', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { verifyJwt } = await import('../auth');
    const token = jwt.sign(
      { sub: 'thomas', role: 'admin' },
      VALID_ENV.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: -10 }, // déjà expiré
    );
    expect(verifyJwt(token)).toBeNull();
  });
});
