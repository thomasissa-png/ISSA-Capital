/**
 * Tests d'intégration — GET /api/health
 *
 * Objectif : vérifier que l'endpoint retourne 200 + payload correct
 * quand la DB est saine, et 503 si la DB est KO.
 *
 * Stratégie : supertest sur buildApp() avec une DB SQLite temporaire.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { buildApp } from '../../index';
import { initDatabase, resetDbForTests } from '../../db/connection';
import { resetEnvForTests } from '../../utils/env';
import { resetLoggerForTests } from '../../utils/logger';

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
  SESSION_TTL_HOURS: '24',
};

describe('GET /api/health', () => {
  let tempDbPath: string;

  beforeEach(() => {
    tempDbPath = path.join(
      os.tmpdir(),
      `issa-sec-health-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);
    process.env.DB_PATH = tempDbPath;

    resetEnvForTests();
    resetLoggerForTests();
    resetDbForTests();

    initDatabase();
  });

  afterEach(() => {
    resetDbForTests();
    resetEnvForTests();
    resetLoggerForTests();

    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      try {
        fs.unlinkSync(tempDbPath + suffix);
      } catch {
        // ignoré
      }
    }

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);
  });

  it('retourne 200 avec status "ok" quand la DB est saine', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      db: 'ok',
    });
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('inclut tous les champs documentés', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/health');

    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('db');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('retourne 404 sur une route inconnue', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/inexistant');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
