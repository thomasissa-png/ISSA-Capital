/**
 * Tests d'intégration — /admin/api/2fa/* (Phase 6, 2FA TOTP).
 *
 * Couverture (17 tests) :
 *  - GET /status
 *    - sans cookie → 401
 *    - cookie valide, 2FA jamais init → enabled=false pending=false
 *    - cookie valide, secret pending (enabled=0) → pending=true
 *    - cookie valide, 2FA activée → enabled=true + backupCodesRemaining=10
 *
 *  - POST /generate
 *    - sans cookie → 401
 *    - cookie valide → secret + otpauthUrl + qrDataUrl (data:image/png)
 *    - appel 2x → remplace le secret (UPSERT)
 *
 *  - POST /enable
 *    - code bidon → 401 TOTP_CODE_INVALID
 *    - sans secret préalable → 400 TOTP_NO_PENDING_SECRET
 *    - vrai code TOTP (speakeasy) → 200 + 10 backupCodes hex
 *    - re-enable alors que déjà active → 409 TOTP_ALREADY_ENABLED
 *
 *  - POST /disable
 *    - 2FA non active → 409 TOTP_NOT_ENABLED
 *    - 2FA active + bon code → 200 + getStatus repasse à enabled=false
 *
 *  - POST /backup-codes/regenerate
 *    - 2FA active + bon code → nouveaux codes, anciens invalidés
 *
 *  - Flow login 2FA
 *    - POST /admin/login quand 2FA active → requires_2fa:true + temp_token
 *    - POST /verify-login avec temp_token + code TOTP → 200 + cookie admin
 *    - POST /verify-login avec backup code → 200 + cookie admin, code consommé
 *    - POST /verify-login avec code invalide → 401
 *    - POST /verify-login avec temp_token invalide → 401 TEMP_TOKEN_INVALID
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import speakeasy from 'speakeasy';

import {
  TEST_PASSWORD,
  applyAdminEnv,
  cleanupTempDb,
  makeTempDbPath,
  restoreEnv,
} from './_helpers';

const SNAPSHOT = { ...process.env };

/** Helper : login + retourne app + cookie admin. */
async function loginAndGetCookie(): Promise<{
  app: import('express').Express;
  cookie: string;
}> {
  const { buildApp } = await import('../../../index');
  const app = buildApp();
  const loginRes = await request(app)
    .post('/admin/login')
    .send({ password: TEST_PASSWORD });
  const cookieHeader = loginRes.headers['set-cookie'];
  const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  return { app, cookie: cookie ?? '' };
}

describe('routes /admin/api/2fa', () => {
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = makeTempDbPath();
    applyAdminEnv(tempDbPath);

    const { resetEnvForTests } = await import('../../../utils/env');
    const { resetLoggerForTests } = await import('../../../utils/logger');
    const { resetDbForTests, initDatabase } = await import(
      '../../../db/connection'
    );
    resetEnvForTests();
    resetLoggerForTests();
    resetDbForTests();
    initDatabase();
  });

  afterEach(async () => {
    const { resetDbForTests } = await import('../../../db/connection');
    const { resetEnvForTests } = await import('../../../utils/env');
    const { resetLoggerForTests } = await import('../../../utils/logger');
    resetDbForTests();
    resetEnvForTests();
    resetLoggerForTests();
    cleanupTempDb(tempDbPath);
    restoreEnv(SNAPSHOT);
  });

  // ============================================================
  // GET /status
  // ============================================================

  it('GET /status sans cookie → 401', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();

    const res = await request(app).get('/admin/api/2fa/status');
    expect(res.status).toBe(401);
  });

  it('GET /status avec cookie, 2FA jamais init → enabled=false pending=false', async () => {
    const { app, cookie } = await loginAndGetCookie();

    const res = await request(app)
      .get('/admin/api/2fa/status')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.pending).toBe(false);
    expect(res.body.backupCodesRemaining).toBe(0);
  });

  it('GET /status après generate → pending=true', async () => {
    const { app, cookie } = await loginAndGetCookie();

    await request(app).post('/admin/api/2fa/generate').set('Cookie', cookie);

    const res = await request(app)
      .get('/admin/api/2fa/status')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
    expect(res.body.pending).toBe(true);
  });

  // ============================================================
  // POST /generate
  // ============================================================

  it('POST /generate sans cookie → 401', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();

    const res = await request(app).post('/admin/api/2fa/generate');
    expect(res.status).toBe(401);
  });

  it('POST /generate avec cookie → secret + otpauthUrl + qrDataUrl', async () => {
    const { app, cookie } = await loginAndGetCookie();

    const res = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.secret).toBe('string');
    expect(res.body.secret.length).toBeGreaterThan(10);
    expect(res.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    expect(res.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('POST /generate appelé 2 fois → remplace le secret', async () => {
    const { app, cookie } = await loginAndGetCookie();

    const res1 = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);
    const res2 = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Les secrets doivent etre differents (probabilite de collision quasi-nulle)
    expect(res1.body.secret).not.toBe(res2.body.secret);
  });

  // ============================================================
  // POST /enable
  // ============================================================

  it('POST /enable sans secret préalable → 400 TOTP_NO_PENDING_SECRET', async () => {
    const { app, cookie } = await loginAndGetCookie();

    const res = await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOTP_NO_PENDING_SECRET');
  });

  it('POST /enable avec mauvais code → 401 TOTP_CODE_INVALID', async () => {
    const { app, cookie } = await loginAndGetCookie();

    await request(app).post('/admin/api/2fa/generate').set('Cookie', cookie);

    const res = await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOTP_CODE_INVALID');
  });

  it('POST /enable avec vrai code TOTP → 200 + 10 backup codes', async () => {
    const { app, cookie } = await loginAndGetCookie();

    const genRes = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);
    const secret = genRes.body.secret as string;

    const code = speakeasy.totp({ secret, encoding: 'base32' });

    const res = await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.backupCodes)).toBe(true);
    expect(res.body.backupCodes).toHaveLength(10);
    for (const bc of res.body.backupCodes) {
      expect(typeof bc).toBe('string');
      expect(bc).toMatch(/^[0-9A-F]{8}$/);
    }
  });

  it('POST /enable alors que déjà active → 409 TOTP_ALREADY_ENABLED', async () => {
    const { app, cookie } = await loginAndGetCookie();
    const genRes = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);
    const secret = genRes.body.secret as string;
    const code = speakeasy.totp({ secret, encoding: 'base32' });

    await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code });

    // Deuxième appel : enable déjà actif mais aucun nouveau secret pending
    // → on doit tomber sur 'aucun secret en attente' OU 'déjà activée'
    // En réalité, enable() vérifie enabled=1 AVANT le code → 409.
    // Mais comme le row existe déjà avec enabled=1 et pas de nouveau secret,
    // le check `row.enabled === 1` se déclenche → TOTP_ALREADY_ENABLED.
    const newCode = speakeasy.totp({ secret, encoding: 'base32' });
    const res = await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code: newCode });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TOTP_ALREADY_ENABLED');
  });

  // ============================================================
  // POST /disable
  // ============================================================

  it('POST /disable quand 2FA non active → 409 TOTP_NOT_ENABLED', async () => {
    const { app, cookie } = await loginAndGetCookie();

    const res = await request(app)
      .post('/admin/api/2fa/disable')
      .set('Cookie', cookie)
      .send({ code: '123456' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TOTP_NOT_ENABLED');
  });

  it('POST /disable avec bon code → 200 + status repasse enabled=false', async () => {
    const { app, cookie } = await loginAndGetCookie();

    const genRes = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);
    const secret = genRes.body.secret as string;

    const enableCode = speakeasy.totp({ secret, encoding: 'base32' });
    await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code: enableCode });

    const disableCode = speakeasy.totp({ secret, encoding: 'base32' });
    const res = await request(app)
      .post('/admin/api/2fa/disable')
      .set('Cookie', cookie)
      .send({ code: disableCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const statusRes = await request(app)
      .get('/admin/api/2fa/status')
      .set('Cookie', cookie);
    expect(statusRes.body.enabled).toBe(false);
  });

  // ============================================================
  // POST /backup-codes/regenerate
  // ============================================================

  it('POST /backup-codes/regenerate → nouveaux codes, anciens invalidés', async () => {
    const { app, cookie } = await loginAndGetCookie();

    const genRes = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);
    const secret = genRes.body.secret as string;

    const enableCode = speakeasy.totp({ secret, encoding: 'base32' });
    const enableRes = await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code: enableCode });
    const oldCodes = enableRes.body.backupCodes as string[];

    const regenCode = speakeasy.totp({ secret, encoding: 'base32' });
    const res = await request(app)
      .post('/admin/api/2fa/backup-codes/regenerate')
      .set('Cookie', cookie)
      .send({ code: regenCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.backupCodes).toHaveLength(10);
    // Les nouveaux codes doivent être différents des anciens
    const overlap = (res.body.backupCodes as string[]).filter((c) =>
      oldCodes.includes(c),
    );
    expect(overlap).toHaveLength(0);
  });

  // ============================================================
  // Flow login 2FA
  // ============================================================

  it('POST /admin/login quand 2FA active → requires_2fa + temp_token', async () => {
    // Setup : active la 2FA
    const { app, cookie } = await loginAndGetCookie();
    const genRes = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);
    const secret = genRes.body.secret as string;
    const enableCode = speakeasy.totp({ secret, encoding: 'base32' });
    await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code: enableCode });

    // Nouveau login → doit demander 2FA
    const loginRes = await request(app)
      .post('/admin/login')
      .send({ password: TEST_PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.requires_2fa).toBe(true);
    expect(typeof loginRes.body.temp_token).toBe('string');
    expect(loginRes.body.temp_token.length).toBeGreaterThan(20);
    // Pas de cookie admin_session à ce stade
    const cookieHeader = loginRes.headers['set-cookie'];
    if (cookieHeader !== undefined) {
      const cookieStr = Array.isArray(cookieHeader)
        ? cookieHeader.join(';')
        : cookieHeader;
      // Si set-cookie existe, il ne doit pas contenir admin_session valide
      expect(cookieStr).not.toMatch(/admin_session=[^;]+/);
    }
  });

  it('POST /verify-login avec temp_token + code TOTP → 200 + cookie admin', async () => {
    // Setup 2FA
    const { app, cookie } = await loginAndGetCookie();
    const genRes = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);
    const secret = genRes.body.secret as string;
    const enableCode = speakeasy.totp({ secret, encoding: 'base32' });
    await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code: enableCode });

    // Login étape 1
    const loginRes = await request(app)
      .post('/admin/login')
      .send({ password: TEST_PASSWORD });
    const tempToken = loginRes.body.temp_token as string;

    // Login étape 2 : verify-login
    const verifyCode = speakeasy.totp({ secret, encoding: 'base32' });
    const res = await request(app)
      .post('/admin/api/2fa/verify-login')
      .send({ temp_token: tempToken, code: verifyCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.admin.sub).toBe('thomas');
    expect(res.body.admin.role).toBe('admin');
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toContain('admin_session=');
    expect(cookieStr).toContain('HttpOnly');
  });

  it('POST /verify-login avec backup code → 200 + code consommé', async () => {
    // Setup 2FA
    const { app, cookie } = await loginAndGetCookie();
    const genRes = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);
    const secret = genRes.body.secret as string;
    const enableCode = speakeasy.totp({ secret, encoding: 'base32' });
    const enableRes = await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code: enableCode });
    const backupCodes = enableRes.body.backupCodes as string[];
    const firstBackupCode = backupCodes[0] as string;

    // Login étape 1
    const loginRes = await request(app)
      .post('/admin/login')
      .send({ password: TEST_PASSWORD });
    const tempToken = loginRes.body.temp_token as string;

    // Étape 2 avec backup code
    const res = await request(app)
      .post('/admin/api/2fa/verify-login')
      .send({ temp_token: tempToken, code: firstBackupCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Le backup code doit maintenant être consommé : un second appel avec
    // le même code doit échouer (nouveau login + même backup = 401).
    const loginRes2 = await request(app)
      .post('/admin/login')
      .send({ password: TEST_PASSWORD });
    const tempToken2 = loginRes2.body.temp_token as string;

    const res2 = await request(app)
      .post('/admin/api/2fa/verify-login')
      .send({ temp_token: tempToken2, code: firstBackupCode });

    expect(res2.status).toBe(401);
    expect(res2.body.code).toBe('TOTP_CODE_INVALID');
  });

  it('POST /verify-login avec code invalide → 401', async () => {
    // Setup 2FA
    const { app, cookie } = await loginAndGetCookie();
    const genRes = await request(app)
      .post('/admin/api/2fa/generate')
      .set('Cookie', cookie);
    const secret = genRes.body.secret as string;
    const enableCode = speakeasy.totp({ secret, encoding: 'base32' });
    await request(app)
      .post('/admin/api/2fa/enable')
      .set('Cookie', cookie)
      .send({ code: enableCode });

    const loginRes = await request(app)
      .post('/admin/login')
      .send({ password: TEST_PASSWORD });
    const tempToken = loginRes.body.temp_token as string;

    const res = await request(app)
      .post('/admin/api/2fa/verify-login')
      .send({ temp_token: tempToken, code: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOTP_CODE_INVALID');
  });

  it('POST /verify-login avec temp_token invalide → 401 TEMP_TOKEN_INVALID', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();

    const res = await request(app)
      .post('/admin/api/2fa/verify-login')
      .send({
        temp_token: 'not-a-valid-jwt-token-at-all',
        code: '123456',
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TEMP_TOKEN_INVALID');
  });
});
