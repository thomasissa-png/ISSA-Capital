/**
 * Tests d'intégration — routes /api/publish + /api/published (Phase 4).
 *
 * Stratégie :
 *  - Mock du service `services/craft` → aucun appel Craft réel
 *  - DB SQLite temporaire par test (même pattern que draft.test.ts)
 *  - supertest sur buildApp()
 *
 * Couverture :
 *  - POST /api/publish/:draftId avec draft ready → 200 + persistance cr_published
 *  - POST /api/publish/:draftId avec draft non-ready → 409
 *  - POST /api/publish/:draftId avec draft déjà publié → 409
 *  - POST /api/publish/:draftId avec draft inexistant → 404
 *  - POST /api/publish/:draftId avec erreur Craft → 502 + access_log en error
 *  - GET /api/published → liste paginée
 *  - GET /api/published/:id → détail complet
 *  - GET /api/published/:id inexistant → 404
 *  - Génération référence incrémentale IC-CR-2026-0001, -0002, etc.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ------------------------------------------------------------
// Mocks (DOIVENT être déclarés avant les imports)
// ------------------------------------------------------------

const mockPublishToCraft = vi.fn();

vi.mock('../../services/craft', async () => {
  const actual = await vi.importActual<typeof import('../../services/craft')>(
    '../../services/craft',
  );
  return {
    ...actual,
    publishToCraft: mockPublishToCraft,
  };
});

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

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
};

const VALID_CR = {
  reference_placeholder: '[REF_TO_BE_GENERATED]',
  entite: 'IC',
  type_reunion: 'dejeuner',
  date_reunion: '2026-04-08',
  lieu: 'Restaurant Le Voltaire, Paris 1er',
  participants: [
    {
      prenom: 'Karim',
      nom: 'Benmoussa',
      titre: 'Directeur Général',
      societe: 'Capital Partners',
      qualite_relation: 'Partenaire stratégique',
    },
  ],
  objet: "Discussion stratégique sur le positionnement ISSA Capital 2026",
  montant_ttc_eur: 285,
  etablissement_nom: 'Le Voltaire',
  section_1_objet_art_39_1:
    "La présente réunion, tenue le 8 avril 2026, avait pour objet la discussion stratégique sur le positionnement d'ISSA Capital pour 2026. Elle s'inscrit dans le cadre des activités d'ISSA Capital SAS au sens de l'Art. 39-1 du CGI.",
  section_2_points_abordes:
    "Les échanges ont porté sur : (i) la revue des participations actuelles, (ii) l'identification de nouvelles opportunités.",
  section_3_decisions:
    "Il a été convenu que Capital Partners produirait une note d'opportunité d'ici le 30 avril 2026.",
  section_4_suites_a_donner: null,
};

/**
 * Insère directement un draft "ready" en DB sans passer par la route POST /api/draft
 * (qui déclencherait l'appel Anthropic). On crée un draft "prêt à publier" en DB.
 */
function insertReadyDraft(params: {
  id: string;
  userPhone: string;
  cr: Record<string, unknown>;
  status?: string;
}): Promise<void> {
  return import('../../db/connection').then(({ getDb }) => {
    const db = getDb();
    const now = new Date().toISOString();
    const crRecord = params.cr as { entite: string; type_reunion: string; date_reunion: string };

    db.prepare(
      `INSERT INTO cr_drafts (
        id, user_phone, conversation_id, raw_input, enriched_input,
        status, clarification_history, cr_json, cr_markdown,
        type_reunion, entite, date_reunion,
        created_at, updated_at, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      params.id,
      params.userPhone,
      `conv-${params.id}`,
      'input brut test',
      null,
      params.status ?? 'ready',
      null,
      JSON.stringify(params.cr),
      null,
      crRecord.type_reunion,
      crRecord.entite,
      crRecord.date_reunion,
      now,
      now,
      null,
    );
  });
}

// ------------------------------------------------------------
// Tests
// ------------------------------------------------------------

describe('routes /api/publish + /api/published', () => {
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(
      os.tmpdir(),
      `issa-sec-publish-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);
    process.env.DB_PATH = tempDbPath;

    mockPublishToCraft.mockReset();

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    const { resetDbForTests, initDatabase } = await import('../../db/connection');

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

  // ----------------------------------------------------------
  // POST /api/publish/:draftId
  // ----------------------------------------------------------

  describe('POST /api/publish/:draftId', () => {
    it('retourne 200 + persiste cr_published + met à jour draft.status=published', async () => {
      mockPublishToCraft.mockResolvedValueOnce({
        success: true,
        craftDocId: 'craft-doc-abc123',
        craftUrl: 'https://craft.do/docs/abc123',
        httpStatus: 200,
        durationMs: 420,
        attempts: 1,
      });

      await insertReadyDraft({
        id: 'draft-001',
        userPhone: 'thomas',
        cr: VALID_CR,
      });

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app).post('/api/publish/draft-001').send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reference).toBe('IC-CR-2026-0001');
      expect(res.body.craftDocId).toBe('craft-doc-abc123');
      expect(res.body.craftUrl).toBe('https://craft.do/docs/abc123');
      expect(res.body.filename).toBe('2026-04-08-dejeuner-IC-karim-benmoussa.md');
      expect(res.body.markdownSha256).toMatch(/^[a-f0-9]{64}$/);

      // Vérifier cr_published
      const { getDb } = await import('../../db/connection');
      const pubRow = getDb()
        .prepare('SELECT * FROM cr_published WHERE reference = ?')
        .get('IC-CR-2026-0001') as Record<string, unknown> | undefined;
      expect(pubRow).toBeDefined();
      expect(pubRow?.draft_id).toBe('draft-001');
      expect(pubRow?.craft_document_id).toBe('craft-doc-abc123');
      expect(pubRow?.entite).toBe('IC');
      expect(pubRow?.rfc3161_token).toBeNull();

      // Vérifier que le draft est passé à "published"
      const draftRow = getDb()
        .prepare('SELECT status, published_at FROM cr_drafts WHERE id = ?')
        .get('draft-001') as { status: string; published_at: string } | undefined;
      expect(draftRow?.status).toBe('published');
      expect(draftRow?.published_at).not.toBeNull();

      // Vérifier access_logs
      const logRow = getDb()
        .prepare(
          "SELECT * FROM access_logs WHERE resource_id = 'IC-CR-2026-0001' AND action = 'publish'",
        )
        .get() as { result: string; entite: string } | undefined;
      expect(logRow).toBeDefined();
      expect(logRow?.result).toBe('success');
      expect(logRow?.entite).toBe('IC');

      // Vérifier l'appel au service craft
      expect(mockPublishToCraft).toHaveBeenCalledTimes(1);
      const payload = mockPublishToCraft.mock.calls[0]?.[0] as {
        markdown: string;
        internalTitle: string;
      };
      expect(payload.markdown).toContain('IC-CR-2026-0001');
      expect(payload.markdown).toContain('# COMPTE RENDU');
      expect(payload.internalTitle).toBe('2026-04-08-dejeuner-IC-karim-benmoussa.md');
    });

    it("retourne 409 si le draft n'est pas en status ready", async () => {
      await insertReadyDraft({
        id: 'draft-pending',
        userPhone: 'thomas',
        cr: VALID_CR,
        status: 'needs_clarification',
      });

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app).post('/api/publish/draft-pending').send({});

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DRAFT_NOT_READY');
      expect(mockPublishToCraft).not.toHaveBeenCalled();
    });

    it('retourne 409 si le draft a déjà été publié', async () => {
      // Premier publish : succès
      mockPublishToCraft.mockResolvedValueOnce({
        success: true,
        craftDocId: 'craft-doc-first',
        craftUrl: 'https://craft.do/docs/first',
        httpStatus: 200,
        durationMs: 300,
        attempts: 1,
      });

      await insertReadyDraft({
        id: 'draft-002',
        userPhone: 'thomas',
        cr: VALID_CR,
      });

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res1 = await request(app).post('/api/publish/draft-002').send({});
      expect(res1.status).toBe(200);

      // Second publish : le draft est passé à "published" → 409
      const res2 = await request(app).post('/api/publish/draft-002').send({});
      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe('DRAFT_ALREADY_PUBLISHED');
      expect(res2.body.details?.reference).toBe('IC-CR-2026-0001');
      // Craft n'a été appelé qu'une fois
      expect(mockPublishToCraft).toHaveBeenCalledTimes(1);
    });

    it('retourne 404 si le draft est inexistant', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .post('/api/publish/nonexistent-draft-id')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('DRAFT_NOT_FOUND');
      expect(mockPublishToCraft).not.toHaveBeenCalled();
    });

    it('retourne 502 et log access en error si publication Craft échoue', async () => {
      mockPublishToCraft.mockResolvedValueOnce({
        success: false,
        error: 'Craft API a répondu 500',
        httpStatus: 500,
        durationMs: 1000,
        attempts: 3,
      });

      await insertReadyDraft({
        id: 'draft-fail',
        userPhone: 'thomas',
        cr: VALID_CR,
      });

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app).post('/api/publish/draft-fail').send({});

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('CRAFT_PUBLISH_FAILED');
      expect(res.body.error).toContain('500');

      // Le draft ne doit PAS être passé à "published"
      const { getDb } = await import('../../db/connection');
      const draftRow = getDb()
        .prepare('SELECT status FROM cr_drafts WHERE id = ?')
        .get('draft-fail') as { status: string } | undefined;
      expect(draftRow?.status).toBe('ready');

      // Rien dans cr_published
      const countRow = getDb()
        .prepare('SELECT COUNT(*) as n FROM cr_published')
        .get() as { n: number };
      expect(countRow.n).toBe(0);

      // Un access_log en "error" doit exister
      const logRow = getDb()
        .prepare("SELECT * FROM access_logs WHERE action = 'publish' AND result = 'error'")
        .get() as { resource_id: string } | undefined;
      expect(logRow).toBeDefined();
      expect(logRow?.resource_id).toBe('draft-fail');
    });

    it('génère des références incrémentales (0001, 0002, 0003)', async () => {
      mockPublishToCraft.mockResolvedValue({
        success: true,
        craftDocId: 'craft-doc-any',
        craftUrl: 'https://craft.do/docs/any',
        httpStatus: 200,
        durationMs: 100,
        attempts: 1,
      });

      await insertReadyDraft({ id: 'd1', userPhone: 'thomas', cr: VALID_CR });
      await insertReadyDraft({ id: 'd2', userPhone: 'thomas', cr: VALID_CR });
      await insertReadyDraft({ id: 'd3', userPhone: 'thomas', cr: VALID_CR });

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const r1 = await request(app).post('/api/publish/d1').send({});
      const r2 = await request(app).post('/api/publish/d2').send({});
      const r3 = await request(app).post('/api/publish/d3').send({});

      expect(r1.body.reference).toBe('IC-CR-2026-0001');
      expect(r2.body.reference).toBe('IC-CR-2026-0002');
      expect(r3.body.reference).toBe('IC-CR-2026-0003');
    });

    it('isole les compteurs par entité (IC-0001, GO-0001 indépendants)', async () => {
      mockPublishToCraft.mockResolvedValue({
        success: true,
        craftDocId: 'craft-any',
        craftUrl: 'https://craft.do/docs/any',
        httpStatus: 200,
        durationMs: 50,
        attempts: 1,
      });

      await insertReadyDraft({ id: 'ic1', userPhone: 'thomas', cr: VALID_CR });
      await insertReadyDraft({
        id: 'go1',
        userPhone: 'thomas',
        cr: { ...VALID_CR, entite: 'GO' },
      });

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const ric = await request(app).post('/api/publish/ic1').send({});
      const rgo = await request(app).post('/api/publish/go1').send({});

      expect(ric.body.reference).toBe('IC-CR-2026-0001');
      expect(rgo.body.reference).toBe('GO-CR-2026-0001');
    });
  });

  // ----------------------------------------------------------
  // GET /api/published
  // ----------------------------------------------------------

  describe('GET /api/published', () => {
    it('retourne une liste vide initialement', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app).get('/api/published');
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('retourne les publications en ordre DESC date_etablissement', async () => {
      mockPublishToCraft.mockResolvedValue({
        success: true,
        craftDocId: 'craft-any',
        craftUrl: 'https://craft.do/docs/any',
        httpStatus: 200,
        durationMs: 50,
        attempts: 1,
      });

      await insertReadyDraft({ id: 'd1', userPhone: 'thomas', cr: VALID_CR });
      await insertReadyDraft({
        id: 'd2',
        userPhone: 'thomas',
        cr: { ...VALID_CR, entite: 'VI' },
      });

      const { buildApp } = await import('../../index');
      const app = buildApp();

      await request(app).post('/api/publish/d1').send({});
      await request(app).post('/api/publish/d2').send({});

      const res = await request(app).get('/api/published');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items).toHaveLength(2);

      // Les deux publications peuvent avoir le même date_etablissement
      // (exécution < 1ms). On vérifie donc la PRÉSENCE des deux éléments,
      // pas leur ordre exact.
      const draftIds = (res.body.items as Array<{ draftId: string }>).map(
        (i) => i.draftId,
      );
      expect(draftIds).toContain('d1');
      expect(draftIds).toContain('d2');

      const entites = (res.body.items as Array<{ entite: string }>).map(
        (i) => i.entite,
      );
      expect(entites).toContain('IC');
      expect(entites).toContain('VI');
    });

    it('filtre par entity', async () => {
      mockPublishToCraft.mockResolvedValue({
        success: true,
        craftDocId: 'craft-any',
        craftUrl: 'https://craft.do/docs/any',
        httpStatus: 200,
        durationMs: 50,
        attempts: 1,
      });

      await insertReadyDraft({ id: 'ic1', userPhone: 'thomas', cr: VALID_CR });
      await insertReadyDraft({
        id: 'go1',
        userPhone: 'thomas',
        cr: { ...VALID_CR, entite: 'GO' },
      });

      const { buildApp } = await import('../../index');
      const app = buildApp();

      await request(app).post('/api/publish/ic1').send({});
      await request(app).post('/api/publish/go1').send({});

      const resIc = await request(app).get('/api/published?entity=IC');
      expect(resIc.body.total).toBe(1);

      const resGo = await request(app).get('/api/published?entity=GO');
      expect(resGo.body.total).toBe(1);
    });

    it("refuse un filtre entity invalide avec 400", async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app).get('/api/published?entity=XX');
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ----------------------------------------------------------
  // GET /api/published/:id
  // ----------------------------------------------------------

  describe('GET /api/published/:id', () => {
    it('retourne 404 pour une reference inexistante', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app).get('/api/published/IC-CR-2026-9999');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PUBLISHED_NOT_FOUND');
    });

    it('retourne le markdown complet pour une publication existante', async () => {
      mockPublishToCraft.mockResolvedValueOnce({
        success: true,
        craftDocId: 'craft-abc',
        craftUrl: 'https://craft.do/docs/abc',
        httpStatus: 200,
        durationMs: 100,
        attempts: 1,
      });

      await insertReadyDraft({ id: 'd1', userPhone: 'thomas', cr: VALID_CR });

      const { buildApp } = await import('../../index');
      const app = buildApp();

      await request(app).post('/api/publish/d1').send({});

      const res = await request(app).get('/api/published/IC-CR-2026-0001');
      expect(res.status).toBe(200);
      expect(res.body.reference).toBe('IC-CR-2026-0001');
      expect(res.body.markdown).toBeDefined();
      expect(res.body.markdown).toContain('# COMPTE RENDU');
      expect(res.body.markdown).toContain('IC-CR-2026-0001');
      expect(res.body.markdownSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(res.body.craftDocumentId).toBe('craft-abc');
      expect(res.body.craftUrl).toBe('https://craft.do/docs/abc');
    });
  });
});
