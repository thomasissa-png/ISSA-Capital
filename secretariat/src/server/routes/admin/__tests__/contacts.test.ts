/**
 * Tests d'intégration — /admin/api/contacts (CRUD).
 *
 * Couverture :
 *  - Auth requise : toutes les routes retournent 401 sans cookie
 *  - GET    /admin/api/contacts : liste + pagination + filtre q + exclusion soft-deleted
 *  - GET    /admin/api/contacts/:id : 200 + 404
 *  - POST   /admin/api/contacts : 201 + validation Zod
 *  - PATCH  /admin/api/contacts/:id : update partiel
 *  - PATCH  /admin/api/contacts/:id/whatsapp-authorize : toggle
 *  - DELETE /admin/api/contacts/:id : soft delete + 409 si déjà delete
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import {
  TEST_PASSWORD,
  applyAdminEnv,
  cleanupTempDb,
  makeTempDbPath,
  restoreEnv,
  seedContact,
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
  return {
    app,
    cookie: cookie ?? '',
  };
}

describe('routes /admin/api/contacts', () => {
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

  // -----------------------------------------------------------
  // Auth
  // -----------------------------------------------------------

  it('GET /admin/api/contacts sans cookie → 401', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();
    const res = await request(app).get('/admin/api/contacts');
    expect(res.status).toBe(401);
  });

  it('POST /admin/api/contacts sans cookie → 401', async () => {
    const { buildApp } = await import('../../../index');
    const app = buildApp();
    const res = await request(app)
      .post('/admin/api/contacts')
      .send({ prenom: 'Alice', nom: 'Dupont' });
    expect(res.status).toBe(401);
  });

  // -----------------------------------------------------------
  // GET list
  // -----------------------------------------------------------

  it('GET /admin/api/contacts retourne une liste vide sur DB neuve', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/contacts')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('GET /admin/api/contacts retourne les contacts seedés, exclut soft-deleted', async () => {
    const { getDb } = await import('../../../db/connection');
    const db = getDb();
    seedContact(db, { prenom: 'Alice', nom: 'Dupont' });
    seedContact(db, { prenom: 'Bob', nom: 'Martin' });
    seedContact(db, {
      prenom: 'Charlie',
      nom: 'Delete',
      deletedAt: new Date().toISOString(),
    });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/contacts')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((c: { nom: string }) => c.nom).sort()).toEqual([
      'Dupont',
      'Martin',
    ]);
  });

  it('GET /admin/api/contacts?q=... filtre sur nom/prenom', async () => {
    const { getDb } = await import('../../../db/connection');
    const db = getDb();
    seedContact(db, { prenom: 'Alice', nom: 'Dupont' });
    seedContact(db, { prenom: 'Bob', nom: 'Martin' });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/contacts?q=Alice')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].prenom).toBe('Alice');
  });

  // -----------------------------------------------------------
  // GET :id
  // -----------------------------------------------------------

  it('GET /admin/api/contacts/:id → 200 si trouvé', async () => {
    const { getDb } = await import('../../../db/connection');
    const id = seedContact(getDb(), { prenom: 'Alice', nom: 'Dupont' });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get(`/admin/api/contacts/${id}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.prenom).toBe('Alice');
  });

  it('GET /admin/api/contacts/:id → 404 si introuvable', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .get('/admin/api/contacts/inexistant')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CONTACT_NOT_FOUND');
  });

  // -----------------------------------------------------------
  // POST create
  // -----------------------------------------------------------

  it('POST /admin/api/contacts crée un contact → 201', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .post('/admin/api/contacts')
      .set('Cookie', cookie)
      .send({
        prenom: 'Karim',
        nom: 'Benmoussa',
        titre: 'Président',
        societe: 'Versimo',
        email: 'karim@versimo.fr',
        entitesVisibles: ['IC', 'GO'],
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTypeOf('string');
    expect(res.body.entitesVisibles).toEqual(['IC', 'GO']);
    expect(res.body.source.startsWith('admin_')).toBe(true);
  });

  it('POST /admin/api/contacts rejette prenom vide → 400', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .post('/admin/api/contacts')
      .set('Cookie', cookie)
      .send({ prenom: '', nom: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /admin/api/contacts rejette email invalide → 400', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .post('/admin/api/contacts')
      .set('Cookie', cookie)
      .send({ prenom: 'Alice', nom: 'Dupont', email: 'pas-un-email' });
    expect(res.status).toBe(400);
  });

  // -----------------------------------------------------------
  // PATCH
  // -----------------------------------------------------------

  it('PATCH /admin/api/contacts/:id met à jour les champs fournis', async () => {
    const { getDb } = await import('../../../db/connection');
    const id = seedContact(getDb(), { prenom: 'Alice', nom: 'Dupont' });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .patch(`/admin/api/contacts/${id}`)
      .set('Cookie', cookie)
      .send({ titre: 'Directrice Générale' });
    expect(res.status).toBe(200);
    expect(res.body.titre).toBe('Directrice Générale');
    expect(res.body.prenom).toBe('Alice');
  });

  it('PATCH /admin/api/contacts/:id → 404 si introuvable', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .patch('/admin/api/contacts/zzz')
      .set('Cookie', cookie)
      .send({ titre: 'X' });
    expect(res.status).toBe(404);
  });

  it('PATCH .../whatsapp-authorize toggle la valeur', async () => {
    const { getDb } = await import('../../../db/connection');
    const id = seedContact(getDb(), {
      prenom: 'Alice',
      nom: 'Dupont',
      whatsappAuthorized: false,
    });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .patch(`/admin/api/contacts/${id}/whatsapp-authorize`)
      .set('Cookie', cookie)
      .send({ authorized: true });
    expect(res.status).toBe(200);
    expect(res.body.whatsappAuthorized).toBe(true);
  });

  // -----------------------------------------------------------
  // DELETE (soft)
  // -----------------------------------------------------------

  it('DELETE /admin/api/contacts/:id → soft delete (deleted_at set)', async () => {
    const { getDb } = await import('../../../db/connection');
    const id = seedContact(getDb(), { prenom: 'Alice', nom: 'Dupont' });

    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .delete(`/admin/api/contacts/${id}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.deletedAt).toBeTypeOf('string');

    // Vérifier que le contact n'apparaît plus dans la liste par défaut
    const listRes = await request(app)
      .get('/admin/api/contacts')
      .set('Cookie', cookie);
    expect(listRes.body.total).toBe(0);

    // Mais visible avec includeDeleted=true
    const listAllRes = await request(app)
      .get('/admin/api/contacts?includeDeleted=true')
      .set('Cookie', cookie);
    expect(listAllRes.body.total).toBe(1);
  });

  it('DELETE /admin/api/contacts/:id deux fois → 409', async () => {
    const { getDb } = await import('../../../db/connection');
    const id = seedContact(getDb(), { prenom: 'Alice', nom: 'Dupont' });

    const { app, cookie } = await authenticatedAgent();
    await request(app)
      .delete(`/admin/api/contacts/${id}`)
      .set('Cookie', cookie);
    const res2 = await request(app)
      .delete(`/admin/api/contacts/${id}`)
      .set('Cookie', cookie);
    expect(res2.status).toBe(409);
    expect(res2.body.code).toBe('CONTACT_ALREADY_DELETED');
  });

  it('DELETE /admin/api/contacts/:id → 404 si introuvable', async () => {
    const { app, cookie } = await authenticatedAgent();
    const res = await request(app)
      .delete('/admin/api/contacts/zzz')
      .set('Cookie', cookie);
    expect(res.status).toBe(404);
  });
});
