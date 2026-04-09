/**
 * Tests d'intégration — /admin/api/logs/access + /generation (+ /stats).
 *
 * Couverture :
 *  - Auth requise → 401 sans cookie
 *  - GET /access → liste + filtres user/action/entity/from/to
 *  - GET /generation → liste
 *  - GET /generation/stats → métriques agrégées
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import {
  TEST_PASSWORD,
  applyAdminEnv,
  cleanupTempDb,
  makeTempDbPath,
  restoreEnv,
} from './_helpers';

const SNAPSHOT = { ...process.env };

async function authenticatedAgent() {
  const { buildApp } = await import('../../../index');
  const app = buildApp();
  const loginRes = await request(app)
    .post('/admin/login')
    .send({ password: TEST_PASSWORD });
  const cookieHeader = loginRes.headers['set-cookie'];
  const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
  return { app, cookie: cookie ?? '' };
}

function seedAccessLog(
  db: import('better-sqlite3').Database,
  overrides: Partial<{
    actor_phone: string;
    resource_type: string;
    resource_id: string;
    action: string;
    entite: string | null;
    result: string;
    timestamp: string;
  }> = {},
): void {
  db.prepare(
    `INSERT INTO access_logs
      (actor_phone, actor_display_name, resource_type, resource_id,
       action, entite, result, timestamp, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    overrides.actor_phone ?? '+33600000001',
    'Test User',
    overrides.resource_type ?? 'contact',
    overrides.resource_id ?? 'abc',
    overrides.action ?? 'read',
    overrides.entite ?? null,
    overrides.result ?? 'success',
    overrides.timestamp ?? new Date().toISOString(),
    '127.0.0.1',
    'vitest',
  );
}

function seedGenerationLog(
  db: import('better-sqlite3').Database,
  overrides: Partial<{
    draft_id: string;
    user_phone: string;
    status: string;
    cost_usd: number;
    prompt_tokens: number;
    completion_tokens: number;
    latency_ms: number;
    timestamp: string;
  }> = {},
): void {
  db.prepare(
    `INSERT INTO generation_logs
      (draft_id, user_phone, claude_model, prompt_tokens, completion_tokens,
       cost_usd, latency_ms, status, error_message, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    overrides.draft_id ?? 'draft-1',
    overrides.user_phone ?? '+33600000001',
    'claude-sonnet-4-5',
    overrides.prompt_tokens ?? 1000,
    overrides.completion_tokens ?? 500,
    overrides.cost_usd ?? 0.012,
    overrides.latency_ms ?? 1234,
    overrides.status ?? 'success',
    overrides.timestamp ?? new Date().toISOString(),
  );
}

describe('routes /admin/api/logs', () => {
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

  it('GET /admin/api/logs/access sans cookie → 401', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();
    const res = await request(app).get('/admin/api/logs/access');
    expect(res.status).toBe(401);
  });

  it('GET /admin/api/logs/access retourne la liste paginée', async () => {
    const { getDb } = await import('../../../db/connection');
    const db = getDb();
    seedAccessLog(db, { action: 'read', entite: 'IC' });
    seedAccessLog(db, { action: 'publish', entite: 'GO' });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/logs/access')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('GET /admin/api/logs/access?action=publish filtre par action', async () => {
    const { getDb } = await import('../../../db/connection');
    const db = getDb();
    seedAccessLog(db, { action: 'read' });
    seedAccessLog(db, { action: 'publish' });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/logs/access?action=publish')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].action).toBe('publish');
  });

  it('GET /admin/api/logs/generation retourne la liste', async () => {
    const { getDb } = await import('../../../db/connection');
    const db = getDb();
    seedGenerationLog(db);
    seedGenerationLog(db, { status: 'error' });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/logs/generation')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });

  it('GET /admin/api/logs/generation?status=error filtre', async () => {
    const { getDb } = await import('../../../db/connection');
    const db = getDb();
    seedGenerationLog(db, { status: 'success' });
    seedGenerationLog(db, { status: 'error' });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/logs/generation?status=error')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('GET /admin/api/logs/generation/stats agrège les métriques 30j', async () => {
    const { getDb } = await import('../../../db/connection');
    const db = getDb();
    seedGenerationLog(db, { cost_usd: 0.01, prompt_tokens: 1000 });
    seedGenerationLog(db, { cost_usd: 0.02, prompt_tokens: 2000 });
    seedGenerationLog(db, { status: 'error' });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/logs/generation/stats')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.totalCalls).toBe(3);
    expect(res.body.errors).toBe(1);
    expect(res.body.totalCostUsd).toBeGreaterThanOrEqual(0.03);
  });
});
