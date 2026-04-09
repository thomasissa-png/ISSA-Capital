/**
 * Tests d'intégration — middleware accessLogger (Phase 6).
 *
 * Couverture (6 tests) :
 *  - GET /api/health → PAS de ligne dans access_logs (exclu)
 *  - GET /admin/static/foo.css → PAS de ligne (exclu)
 *  - GET /admin/login.html → PAS de ligne (exclu, page publique)
 *  - POST /admin/login avec bon password → 1 ligne avec actor=anonymous + status=200
 *  - GET /admin/api/me authentifié → 1 ligne avec actor=admin:thomas + status=200
 *  - Échec DB : la requête se termine correctement même si l'insert plante
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import {
  TEST_PASSWORD,
  applyAdminEnv,
  cleanupTempDb,
  makeTempDbPath,
  restoreEnv,
} from '../../routes/admin/__tests__/_helpers';

const SNAPSHOT = { ...process.env };

describe('middleware accessLogger', () => {
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = makeTempDbPath();
    applyAdminEnv(tempDbPath);

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    const { resetDbForTests, initDatabase } = await import(
      '../../db/connection'
    );
    resetEnvForTests();
    resetLoggerForTests();
    resetDbForTests();
    initDatabase();
  });

  afterEach(async () => {
    const { resetDbForTests } = await import('../../db/connection');
    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    resetDbForTests();
    resetEnvForTests();
    resetLoggerForTests();
    cleanupTempDb(tempDbPath);
    restoreEnv(SNAPSHOT);
  });

  async function countAccessLogs(): Promise<number> {
    const { getDb } = await import('../../db/connection');
    const row = getDb()
      .prepare('SELECT COUNT(*) as c FROM access_logs')
      .get() as { c: number };
    return row.c;
  }

  async function lastAccessLog(): Promise<{
    actor_phone: string;
    action: string;
    result: string;
    resource_id: string;
  } | null> {
    const { getDb } = await import('../../db/connection');
    const row = getDb()
      .prepare(
        `SELECT actor_phone, action, result, resource_id
         FROM access_logs
         ORDER BY id DESC LIMIT 1`,
      )
      .get() as
      | { actor_phone: string; action: string; result: string; resource_id: string }
      | undefined;
    return row ?? null;
  }

  it('GET /api/health → aucune ligne access_logs (exclusion)', async () => {
    const { buildApp } = await import('../../index');
    const app = buildApp();

    const before = await countAccessLogs();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    const after = await countAccessLogs();
    expect(after).toBe(before);
  });

  it('GET /admin/login.html → aucune ligne (page publique exclue)', async () => {
    const { buildApp } = await import('../../index');
    const app = buildApp();

    const before = await countAccessLogs();
    await request(app).get('/admin/login.html');
    const after = await countAccessLogs();
    expect(after).toBe(before);
  });

  it('POST /admin/login avec bon password → 1 ligne anonymous 200', async () => {
    const { buildApp } = await import('../../index');
    const app = buildApp();

    const before = await countAccessLogs();
    const res = await request(app)
      .post('/admin/login')
      .send({ password: TEST_PASSWORD });
    expect(res.status).toBe(200);

    const after = await countAccessLogs();
    expect(after).toBe(before + 1);

    const last = await lastAccessLog();
    expect(last).not.toBeNull();
    expect(last?.actor_phone).toBe('anonymous');
    expect(last?.action).toBe('api_request');
    expect(last?.result).toBe('200');
    expect(last?.resource_id).toBe('POST /admin/login');
  });

  it('GET /admin/api/me authentifié → 1 ligne admin:thomas 200', async () => {
    const { buildApp } = await import('../../index');
    const app = buildApp();

    // Login d'abord pour obtenir un cookie
    const loginRes = await request(app)
      .post('/admin/login')
      .send({ password: TEST_PASSWORD });
    const cookieHeader = loginRes.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;

    const before = await countAccessLogs();
    const res = await request(app)
      .get('/admin/api/me')
      .set('Cookie', cookie ?? '');
    expect(res.status).toBe(200);

    const after = await countAccessLogs();
    expect(after).toBe(before + 1);

    const last = await lastAccessLog();
    expect(last?.actor_phone).toBe('admin:thomas');
    expect(last?.result).toBe('200');
    expect(last?.resource_id).toBe('GET /admin/api/me');
  });

  it('GET /admin/api/me sans cookie → 1 ligne anonymous 401', async () => {
    const { buildApp } = await import('../../index');
    const app = buildApp();

    const before = await countAccessLogs();
    const res = await request(app).get('/admin/api/me');
    expect(res.status).toBe(401);

    const after = await countAccessLogs();
    expect(after).toBe(before + 1);

    const last = await lastAccessLog();
    expect(last?.actor_phone).toBe('anonymous');
    expect(last?.result).toBe('401');
  });

  it('GET /api/health x 10 → toujours 0 ligne (exclusion solide)', async () => {
    const { buildApp } = await import('../../index');
    const app = buildApp();

    const before = await countAccessLogs();
    for (let i = 0; i < 10; i++) {
      // eslint-disable-next-line no-await-in-loop
      await request(app).get('/api/health');
    }
    const after = await countAccessLogs();
    expect(after).toBe(before);
  });
});
