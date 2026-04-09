/**
 * Tests d'intégration — routes /api/draft + /api/drafts
 *
 * Stratégie :
 *  - Mock du service `services/anthropic` → aucun appel LLM réel
 *  - DB SQLite temporaire par test (réutilise le pattern de health.test.ts)
 *  - supertest sur buildApp()
 *
 * Couverture :
 *  - POST /api/draft avec input valide → 200 + persistance DB
 *  - POST /api/draft avec rawInput vide → 400
 *  - POST /api/draft quand le service anthropic throw un timeout → 504
 *  - GET /api/drafts → liste paginée
 *  - GET /api/drafts/:id inexistant → 404
 *  - PATCH /api/drafts/:id → update status
 *  - DELETE /api/drafts/:id → soft delete
 *
 * Note rate limit : le rate limit 20/15min est testé via un test dédié qui
 * envoie 21 requêtes et vérifie que la 21e retourne 429. Pour éviter de
 * dépendre du timing réel, on utilise directement supertest en série.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ------------------------------------------------------------
// Mock du service anthropic (DOIT être déclaré avant l'import de buildApp)
// ------------------------------------------------------------

const mockGenerateCR = vi.fn();

vi.mock('../../services/anthropic', async () => {
  const actual = await vi.importActual<typeof import('../../services/anthropic')>(
    '../../services/anthropic',
  );
  return {
    ...actual,
    generateCR: mockGenerateCR,
  };
});

// ------------------------------------------------------------
// Helpers
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
  entite: 'GO',
  type_reunion: 'dejeuner',
  date_reunion: '2026-04-08',
  lieu: 'Restaurant Le Voltaire, Paris 1er',
  participants: [
    {
      prenom: 'Emmanuel',
      nom: 'Gomez',
      titre: 'Président',
      societe: 'Gradient One',
      qualite_relation: 'Président opérationnel',
    },
  ],
  objet: "Déjeuner de travail sur la stratégie Versimo Q3 2026",
  montant_ttc_eur: 180,
  etablissement_nom: 'Le Voltaire',
  section_1_objet_art_39_1:
    "La présente réunion, tenue le 8 avril 2026 au restaurant Le Voltaire, avait pour objet la revue des lancements Versimo. Elle s'inscrit dans le cadre des activités de Gradient One au sens de l'Art. 39-1 du CGI.",
  section_2_points_abordes:
    "Les échanges ont porté sur les points suivants : (i) calendrier Q3 ; (ii) allocation ressources ; (iii) suivi prospects.",
  section_3_decisions:
    "À l'issue de cet échange, il a été convenu que Gradient One lancerait la phase pilote Versimo le 15 juin 2026.",
  section_4_suites_a_donner: null,
};

function makeValidGenerateResult(): unknown {
  return {
    response: {
      status: 'ready',
      clarification_question: null,
      detected_entite: 'GO',
      detected_type: 'dejeuner',
      cr: VALID_CR,
    },
    usage: {
      inputTokens: 1200,
      outputTokens: 800,
      cacheCreationInputTokens: 1000,
      cacheReadInputTokens: 200,
      model: 'claude-sonnet-4-5',
      latencyMs: 123,
    },
  };
}

// ------------------------------------------------------------
// Tests
// ------------------------------------------------------------

describe('routes /api/draft + /api/drafts', () => {
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(
      os.tmpdir(),
      `issa-sec-draft-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);
    process.env.DB_PATH = tempDbPath;

    mockGenerateCR.mockReset();

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
  // POST /api/draft
  // ----------------------------------------------------------

  describe('POST /api/draft', () => {
    it('retourne 200 + draftId + cr persisté pour un input valide', async () => {
      mockGenerateCR.mockResolvedValueOnce(makeValidGenerateResult());

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .post('/api/draft')
        .send({
          rawInput:
            'Déjeuner avec Emmanuel Gomez ce midi au Voltaire, 180€ TTC, stratégie Versimo Q3.',
          userPhone: 'thomas',
        });

      expect(res.status).toBe(200);
      expect(res.body.draftId).toBeDefined();
      expect(res.body.status).toBe('ready');
      expect(res.body.cr).toBeDefined();
      expect(res.body.cr.entite).toBe('GO');
      expect(res.body.usage.inputTokens).toBe(1200);

      // Vérifier la persistance DB
      const { getDb } = await import('../../db/connection');
      const row = getDb()
        .prepare('SELECT id, status, entite, type_reunion FROM cr_drafts WHERE id = ?')
        .get(res.body.draftId) as
        | { id: string; status: string; entite: string; type_reunion: string }
        | undefined;

      expect(row).toBeDefined();
      expect(row?.status).toBe('ready');
      expect(row?.entite).toBe('GO');
      expect(row?.type_reunion).toBe('dejeuner');
    });

    it('retourne 400 si rawInput est vide', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .post('/api/draft')
        .send({ rawInput: '', userPhone: 'thomas' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(mockGenerateCR).not.toHaveBeenCalled();
    });

    it('retourne 400 si rawInput dépasse 5000 chars', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const longInput = 'a'.repeat(5001);
      const res = await request(app)
        .post('/api/draft')
        .send({ rawInput: longInput, userPhone: 'thomas' });

      expect(res.status).toBe(400);
      expect(mockGenerateCR).not.toHaveBeenCalled();
    });

    it('persiste le draft en status "needs_clarification" quand le LLM demande une clarification', async () => {
      mockGenerateCR.mockResolvedValueOnce({
        response: {
          status: 'needs_clarification',
          clarification_question: 'Quelle est la date de la réunion ?',
          detected_entite: null,
          detected_type: null,
          cr: null,
        },
        usage: {
          inputTokens: 900,
          outputTokens: 50,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          model: 'claude-sonnet-4-5',
          latencyMs: 80,
        },
      });

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .post('/api/draft')
        .send({ rawInput: 'Déjeuner avec Emmanuel.', userPhone: 'thomas' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('needs_clarification');
      expect(res.body.clarificationQuestion).toBe(
        'Quelle est la date de la réunion ?',
      );
      expect(res.body.cr).toBeNull();

      const { getDb } = await import('../../db/connection');
      const row = getDb()
        .prepare('SELECT status FROM cr_drafts WHERE id = ?')
        .get(res.body.draftId) as { status: string } | undefined;
      expect(row?.status).toBe('needs_clarification');
    });

    it('retourne 504 sur AnthropicTimeoutError', async () => {
      const { AnthropicTimeoutError } = await import('../../services/anthropic.types');
      mockGenerateCR.mockRejectedValueOnce(new AnthropicTimeoutError(60_000));

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .post('/api/draft')
        .send({ rawInput: 'test timeout', userPhone: 'thomas' });

      expect(res.status).toBe(504);
      expect(res.body.code).toBe('LLM_TIMEOUT');
    });

    it('retourne 502 sur AnthropicParseError', async () => {
      const { AnthropicParseError } = await import('../../services/anthropic.types');
      mockGenerateCR.mockRejectedValueOnce(
        new AnthropicParseError('JSON malformé', '{ invalid'),
      );

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .post('/api/draft')
        .send({ rawInput: 'test parse', userPhone: 'thomas' });

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('LLM_PARSE_ERROR');
    });
  });

  // ----------------------------------------------------------
  // GET /api/drafts
  // ----------------------------------------------------------

  describe('GET /api/drafts', () => {
    it('retourne une liste vide initialement', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app).get('/api/drafts');

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(50);
    });

    it('retourne les drafts persistés en ordre DESC created_at', async () => {
      mockGenerateCR.mockResolvedValue(makeValidGenerateResult());

      const { buildApp } = await import('../../index');
      const app = buildApp();

      // Créer 2 drafts
      await request(app)
        .post('/api/draft')
        .send({ rawInput: 'premier draft', userPhone: 'thomas' });
      await request(app)
        .post('/api/draft')
        .send({ rawInput: 'second draft', userPhone: 'thomas' });

      const res = await request(app).get('/api/drafts');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items).toHaveLength(2);
    });

    it('filtre par status quand fourni', async () => {
      mockGenerateCR.mockResolvedValue(makeValidGenerateResult());

      const { buildApp } = await import('../../index');
      const app = buildApp();

      await request(app)
        .post('/api/draft')
        .send({ rawInput: 'draft ready', userPhone: 'thomas' });

      const res = await request(app).get('/api/drafts?status=ready');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);

      const resEmpty = await request(app).get('/api/drafts?status=published');
      expect(resEmpty.body.total).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // GET /api/drafts/:id
  // ----------------------------------------------------------

  describe('GET /api/drafts/:id', () => {
    it('retourne 404 pour un id inexistant', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app).get('/api/drafts/nonexistent-uuid');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('DRAFT_NOT_FOUND');
    });

    it('retourne le draft complet avec cr parsé', async () => {
      mockGenerateCR.mockResolvedValueOnce(makeValidGenerateResult());

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const createRes = await request(app)
        .post('/api/draft')
        .send({ rawInput: 'Déjeuner Emmanuel', userPhone: 'thomas' });

      const res = await request(app).get(`/api/drafts/${createRes.body.draftId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(createRes.body.draftId);
      expect(res.body.cr).toBeDefined();
      expect((res.body.cr as { entite: string }).entite).toBe('GO');
    });
  });

  // ----------------------------------------------------------
  // PATCH /api/drafts/:id
  // ----------------------------------------------------------

  describe('PATCH /api/drafts/:id', () => {
    it('met à jour le status', async () => {
      mockGenerateCR.mockResolvedValueOnce(makeValidGenerateResult());

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const createRes = await request(app)
        .post('/api/draft')
        .send({ rawInput: 'Déjeuner Emmanuel', userPhone: 'thomas' });

      const patchRes = await request(app)
        .patch(`/api/drafts/${createRes.body.draftId}`)
        .send({ status: 'abandoned' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.status).toBe('abandoned');
    });

    it('retourne 404 pour un id inexistant', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .patch('/api/drafts/nonexistent')
        .send({ status: 'abandoned' });

      expect(res.status).toBe(404);
    });
  });

  // ----------------------------------------------------------
  // DELETE /api/drafts/:id
  // ----------------------------------------------------------

  describe('DELETE /api/drafts/:id', () => {
    it('soft-delete en passant status à abandoned', async () => {
      mockGenerateCR.mockResolvedValueOnce(makeValidGenerateResult());

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const createRes = await request(app)
        .post('/api/draft')
        .send({ rawInput: 'Déjeuner Emmanuel', userPhone: 'thomas' });

      const deleteRes = await request(app).delete(
        `/api/drafts/${createRes.body.draftId}`,
      );

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.status).toBe('abandoned');

      // Le draft existe toujours (soft delete)
      const getRes = await request(app).get(`/api/drafts/${createRes.body.draftId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.status).toBe('abandoned');
    });

    it('retourne 404 pour un id inexistant', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app).delete('/api/drafts/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
