/**
 * Tests d'intégration — /admin/api/settings/*
 *
 * Couverture :
 *  - Whitelist : CRUD + validation E.164 + doublon
 *  - Signature : upload PNG valide / invalide / trop grand / get / delete
 *  - Entities : get + patch
 *  - Cost alert : get + patch
 */

import fs from 'node:fs';
import path from 'node:path';
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

// PNG 1x1 pixel transparent valide
const VALID_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154785e6300010000000500010d0a2db400000000049454e44ae426082',
  'hex',
);

describe('routes /admin/api/settings', () => {
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
  // Whitelist
  // ============================================================

  it('GET /settings/whitelist sans cookie → 401', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();
    const res = await request(app).get('/admin/api/settings/whitelist');
    expect(res.status).toBe(401);
  });

  it('GET /settings/whitelist retourne liste vide sur DB neuve', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/settings/whitelist')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('POST /settings/whitelist ajoute un numéro', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .post('/admin/api/settings/whitelist')
      .set('Cookie', cookie)
      .send({
        phoneE164: '+33612345678',
        displayName: 'Thomas',
        entitesVisibles: ['IC', 'GO', 'VI', 'VV'],
      });
    expect(res.status).toBe(201);
    expect(res.body.phoneE164).toBe('+33612345678');
    expect(res.body.displayName).toBe('Thomas');
  });

  it('POST /settings/whitelist rejette phone invalide (pas E164) → 400', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .post('/admin/api/settings/whitelist')
      .set('Cookie', cookie)
      .send({
        phoneE164: '0612345678',
        displayName: 'Test',
        entitesVisibles: ['IC'],
      });
    expect(res.status).toBe(400);
  });

  it('POST /settings/whitelist rejette entités vides → 400', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .post('/admin/api/settings/whitelist')
      .set('Cookie', cookie)
      .send({
        phoneE164: '+33612345678',
        displayName: 'Test',
        entitesVisibles: [],
      });
    expect(res.status).toBe(400);
  });

  it('POST /settings/whitelist refuse doublon actif → 409', async () => {
    const { app, cookie } = await authenticatedAgent();
    await request(app)
      .post('/admin/api/settings/whitelist')
      .set('Cookie', cookie)
      .send({
        phoneE164: '+33612345678',
        displayName: 'Thomas',
        entitesVisibles: ['IC'],
      });
    const res = await request(app)
      .post('/admin/api/settings/whitelist')
      .set('Cookie', cookie)
      .send({
        phoneE164: '+33612345678',
        displayName: 'Thomas2',
        entitesVisibles: ['GO'],
      });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('WHITELIST_DUPLICATE');
  });

  it('DELETE /settings/whitelist/:phone révoque le numéro', async () => {
    const { app, cookie } = await authenticatedAgent();
    await request(app)
      .post('/admin/api/settings/whitelist')
      .set('Cookie', cookie)
      .send({
        phoneE164: '+33612345678',
        displayName: 'Thomas',
        entitesVisibles: ['IC'],
      });
    const res = await request(app)
      .delete('/admin/api/settings/whitelist/' + encodeURIComponent('+33612345678'))
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.revokedAt).toBeTypeOf('string');
  });

  // ============================================================
  // Signature PNG
  // ============================================================

  it('GET /settings/signature → 404 si aucun fichier', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/settings/signature')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
    expect(res.body.exists).toBe(false);
  });

  it('POST /settings/signature avec un PNG valide → 200', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .post('/admin/api/settings/signature')
      .set('Cookie', cookie)
      .set('Content-Type', 'image/png')
      .send(VALID_PNG);
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);

    // Fichier réellement créé
    const sigPath = path.join(path.dirname(tempDbPath), 'signature.png');
    expect(fs.existsSync(sigPath)).toBe(true);
  });

  it('POST /settings/signature avec un buffer non-PNG → 400', async () => {
    const { app, cookie } = await authenticatedAgent();
    const fakeBuf = Buffer.from('hello world');
    const res = await request(app)
      .post('/admin/api/settings/signature')
      .set('Cookie', cookie)
      .set('Content-Type', 'image/png')
      .send(fakeBuf);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_PNG');
  });

  it('DELETE /settings/signature → 200 après upload, puis 404 si redélete', async () => {
    const { app, cookie } = await authenticatedAgent();
    await request(app)
      .post('/admin/api/settings/signature')
      .set('Cookie', cookie)
      .set('Content-Type', 'image/png')
      .send(VALID_PNG);

    const del1 = await request(app)
      .delete('/admin/api/settings/signature')
      .set('Cookie', cookie);
    expect(del1.status).toBe(200);

    const del2 = await request(app)
      .delete('/admin/api/settings/signature')
      .set('Cookie', cookie);
    expect(del2.status).toBe(404);
  });

  // ============================================================
  // Entities
  // ============================================================

  it('GET /settings/entities retourne les 4 entités par défaut', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/settings/entities')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.entities.sort()).toEqual(['GO', 'IC', 'VI', 'VV']);
  });

  it('PATCH /settings/entities met à jour la liste', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .patch('/admin/api/settings/entities')
      .set('Cookie', cookie)
      .send({ entities: ['IC', 'GO'] });
    expect(res.status).toBe(200);
    expect(res.body.entities).toEqual(['IC', 'GO']);

    const get = await request(app)
      .get('/admin/api/settings/entities')
      .set('Cookie', cookie);
    expect(get.body.entities).toEqual(['IC', 'GO']);
  });

  it('PATCH /settings/entities rejette array vide → 400', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .patch('/admin/api/settings/entities')
      .set('Cookie', cookie)
      .send({ entities: [] });
    expect(res.status).toBe(400);
  });

  // ============================================================
  // Cost alert
  // ============================================================

  it('GET /settings/cost-alert retourne le seuil par défaut 10€', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/settings/cost-alert')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.thresholdMonthlyEur).toBe(10);
  });

  it('PATCH /settings/cost-alert met à jour le seuil', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .patch('/admin/api/settings/cost-alert')
      .set('Cookie', cookie)
      .send({ thresholdMonthlyEur: 25.5 });
    expect(res.status).toBe(200);
    expect(res.body.thresholdMonthlyEur).toBe(25.5);

    const get = await request(app)
      .get('/admin/api/settings/cost-alert')
      .set('Cookie', cookie);
    expect(get.body.thresholdMonthlyEur).toBe(25.5);
  });

  it('PATCH /settings/cost-alert rejette valeur négative → 400', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .patch('/admin/api/settings/cost-alert')
      .set('Cookie', cookie)
      .send({ thresholdMonthlyEur: -5 });
    expect(res.status).toBe(400);
  });
});
