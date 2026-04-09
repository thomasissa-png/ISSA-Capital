/**
 * Tests d'intégration — POST /admin/login, /logout, GET /admin/api/me.
 *
 * Couverture :
 *  - POST /admin/login avec bon mot de passe → 200 + cookie
 *  - POST /admin/login avec mauvais mot de passe → 401
 *  - POST /admin/login avec body invalide → 400
 *  - POST /admin/login sans ADMIN_PASSWORD_HASH → 503
 *  - POST /admin/logout → clear cookie
 *  - GET /admin/api/me sans cookie → 401
 *  - GET /admin/api/me avec cookie valide → 200 + infos admin
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import {
  TEST_PASSWORD,
  VALID_ADMIN_ENV,
  applyAdminEnv,
  cleanupTempDb,
  makeTempDbPath,
  restoreEnv,
} from './_helpers';

const SNAPSHOT = { ...process.env };

describe('routes /admin/login + /logout + /api/me', () => {
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

  it('POST /admin/login avec le bon mot de passe → 200 + cookie set', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();

    const res = await request(app)
      .post('/admin/login')
      .send({ password: TEST_PASSWORD });

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

  it('POST /admin/login avec mauvais mot de passe → 401', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();

    const res = await request(app)
      .post('/admin/login')
      .send({ password: 'mauvais' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_FAILED');
  });

  it('POST /admin/login avec body invalide → 400', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();

    const res = await request(app).post('/admin/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /admin/login sans ADMIN_PASSWORD_HASH → 503', async () => {
    const { resetEnvForTests } = await import('../../../utils/env');
    delete process.env.ADMIN_PASSWORD_HASH;
    resetEnvForTests();

    const { buildApp } = await import('../../../index');
    const app = buildApp();

    const res = await request(app)
      .post('/admin/login')
      .send({ password: TEST_PASSWORD });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('POST /admin/logout retourne 200 et clear cookie', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();

    const res = await request(app).post('/admin/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const setCookie = res.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toContain('admin_session=');
  });

  it('GET /admin/api/me sans cookie → 401', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();

    const res = await request(app).get('/admin/api/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it('GET /admin/api/me avec cookie valide → 200 + infos admin', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();

    const loginRes = await request(app)
      .post('/admin/login')
      .send({ password: TEST_PASSWORD });
    const cookieHeader = loginRes.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;

    const res = await request(app)
      .get('/admin/api/me')
      .set('Cookie', cookie ?? '');
    expect(res.status).toBe(200);
    expect(res.body.sub).toBe('thomas');
    expect(res.body.role).toBe('admin');
  });

  it('env fixture VALID_ADMIN_ENV contient bien JWT_SECRET >= 32', () => {
    expect(VALID_ADMIN_ENV.JWT_SECRET!.length).toBeGreaterThanOrEqual(32);
  });
});
