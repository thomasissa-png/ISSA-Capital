/**
 * Tests d'intégration — routes /api/whatsapp/webhook (Phase 2).
 *
 * Stratégie :
 *  - Mock des services externes : `services/anthropic`, `services/craft`,
 *    et `services/whatsapp` (pour ne jamais toucher Meta).
 *  - DB SQLite temporaire par test (même pattern que draft.test.ts).
 *  - HMAC calculé en JS avec le même secret que l'env.
 *  - supertest sur buildApp() avec `.set(header)` + `.send(rawJson)`.
 *
 * Couverture :
 *  - GET /api/whatsapp/webhook avec verify_token correct → 200 + challenge
 *  - GET /api/whatsapp/webhook avec verify_token incorrect → 403
 *  - POST sans signature → 401
 *  - POST avec signature invalide → 401
 *  - POST avec numéro non whitelisté → 200 (silent block, logged)
 *  - POST avec numéro whitelisté + message texte → 200 + session créée
 *  - POST avec commande "terminer" → generateCR mocké appelé, preview envoyée
 *  - POST avec commande "valider" → publishToCraft mocké appelé
 *  - POST avec commande "annuler" → draft marqué abandoned
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// ------------------------------------------------------------
// Mocks (DOIVENT être déclarés avant les imports)
// ------------------------------------------------------------

const mockGenerateCR = vi.fn();
const mockPublishToCraft = vi.fn();
const mockSendMessage = vi.fn();
const mockSendInteractive = vi.fn();

vi.mock('../../services/anthropic', async () => {
  const actual = await vi.importActual<typeof import('../../services/anthropic')>(
    '../../services/anthropic',
  );
  return {
    ...actual,
    generateCR: mockGenerateCR,
  };
});

vi.mock('../../services/craft', async () => {
  const actual = await vi.importActual<typeof import('../../services/craft')>(
    '../../services/craft',
  );
  return {
    ...actual,
    publishToCraft: mockPublishToCraft,
  };
});

vi.mock('../../services/whatsapp', async () => {
  const actual = await vi.importActual<typeof import('../../services/whatsapp')>(
    '../../services/whatsapp',
  );
  return {
    ...actual,
    sendMessage: mockSendMessage,
    sendInteractiveConfirmation: mockSendInteractive,
  };
});

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const SNAPSHOT = { ...process.env };

const WEBHOOK_SECRET = 'webhook_secret_for_tests';
const VERIFY_TOKEN = 'verify_token_for_tests';

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake',
  SESSION_TTL_HOURS: '24',
  WHATSAPP_CLOUD_API_TOKEN: 'EAAFake_test_token',
  WHATSAPP_PHONE_ID: '123456789012345',
  WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN,
  WHATSAPP_WEBHOOK_SECRET: WEBHOOK_SECRET,
};

const VALID_CR = {
  reference_placeholder: '[REF_TO_BE_GENERATED]',
  entite: 'IC',
  type_reunion: 'dejeuner',
  date_reunion: '2026-04-08',
  lieu: 'Restaurant Le Voltaire',
  participants: [
    {
      prenom: 'Emmanuel',
      nom: 'Gomez',
      titre: 'Président',
      societe: 'Gradient One',
      qualite_relation: 'Président opérationnel',
    },
  ],
  objet: 'Déjeuner de travail sur la stratégie Q3',
  montant_ttc_eur: 180,
  etablissement_nom: 'Le Voltaire',
  section_1_objet_art_39_1:
    "La présente réunion, tenue le 8 avril 2026 au restaurant Le Voltaire, avait pour objet la revue stratégique de la participation ISSA Capital dans le cadre de l'Art. 39-1 du CGI.",
  section_2_points_abordes:
    'Les échanges ont porté sur les points suivants : calendrier Q3, allocation ressources, suivi prospects.',
  section_3_decisions:
    "À l'issue de cet échange, il a été convenu de lancer la phase pilote le 15 juin.",
  section_4_suites_a_donner: null,
};

function signBody(rawBody: string): string {
  const hex = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  return `sha256=${hex}`;
}

function buildWebhookPayload(params: {
  from: string;
  text: string;
  timestamp?: string;
}): Record<string, unknown> {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_ID',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '33612345678',
                phone_number_id: '123456789',
              },
              contacts: [
                { profile: { name: 'Thomas' }, wa_id: params.from },
              ],
              messages: [
                {
                  from: params.from,
                  id: `wamid.${Date.now()}`,
                  timestamp: params.timestamp ?? '1712577600',
                  type: 'text',
                  text: { body: params.text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function insertWhitelistedNumber(phoneE164: string): Promise<void> {
  const { getDb } = await import('../../db/connection');
  getDb()
    .prepare(
      `INSERT INTO whitelist_whatsapp
         (id, phone_e164, display_name, entites_visibles, is_admin,
          rgpd_information_sent_at, mandat_signed_at, created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `wl-${phoneE164}`,
      phoneE164,
      'Thomas Test',
      JSON.stringify(['IC', 'GO', 'VI', 'VV']),
      1,
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
      null,
    );
}

// ------------------------------------------------------------
// Tests
// ------------------------------------------------------------

describe('routes /api/whatsapp/webhook', () => {
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(
      os.tmpdir(),
      `issa-sec-wa-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);
    process.env.DB_PATH = tempDbPath;

    mockGenerateCR.mockReset();
    mockPublishToCraft.mockReset();
    mockSendMessage.mockReset();
    mockSendInteractive.mockReset();

    // Comportement par défaut des mocks : succès silencieux
    mockSendMessage.mockResolvedValue({
      success: true,
      messageId: 'wamid.mock',
      httpStatus: 200,
      durationMs: 1,
      attempts: 1,
    });
    mockSendInteractive.mockResolvedValue({
      success: true,
      messageId: 'wamid.mock.interactive',
      httpStatus: 200,
      durationMs: 1,
      attempts: 1,
    });

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    const { resetDbForTests, initDatabase } = await import('../../db/connection');
    const { resetRateLimitForTests } = await import(
      '../../middleware/rateLimitWhatsApp'
    );

    resetEnvForTests();
    resetLoggerForTests();
    resetDbForTests();
    initDatabase();
    // Reset in-memory rate limit counters entre chaque test
    // (sinon les tests qui enchaînent >5 messages pour le même phone sont
    // bloqués par la limite 5/min héritée du test précédent).
    resetRateLimitForTests();
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
  // GET /webhook — handshake Meta
  // ----------------------------------------------------------

  describe('GET /webhook — handshake', () => {
    it('retourne 200 + challenge quand verify_token correct', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .get('/api/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': VERIFY_TOKEN,
          'hub.challenge': 'challenge-abc-123',
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe('challenge-abc-123');
    });

    it('retourne 403 quand verify_token incorrect', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .get('/api/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'challenge-abc-123',
        });

      expect(res.status).toBe(403);
    });

    it('retourne 400 quand hub.mode manquant', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .get('/api/whatsapp/webhook')
        .query({ 'hub.verify_token': VERIFY_TOKEN });

      expect(res.status).toBe(400);
    });
  });

  // ----------------------------------------------------------
  // POST /webhook — signature
  // ----------------------------------------------------------

  describe('POST /webhook — signature', () => {
    it('retourne 401 sans header X-Hub-Signature-256', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = buildWebhookPayload({
        from: '33612345678',
        text: 'Hello',
      });

      const res = await request(app).post('/api/whatsapp/webhook').send(payload);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('MISSING_SIGNATURE');
    });

    it('retourne 401 avec signature invalide', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = buildWebhookPayload({
        from: '33612345678',
        text: 'Hello',
      });

      const res = await request(app)
        .post('/api/whatsapp/webhook')
        .set('X-Hub-Signature-256', 'sha256=' + 'f'.repeat(64))
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_SIGNATURE');
    });

    it('retourne 401 avec format de signature invalide (non sha256=…)', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = buildWebhookPayload({
        from: '33612345678',
        text: 'Hello',
      });

      const res = await request(app)
        .post('/api/whatsapp/webhook')
        .set('X-Hub-Signature-256', 'md5=abc123')
        .send(payload);

      expect(res.status).toBe(401);
    });
  });

  // ----------------------------------------------------------
  // POST /webhook — whitelist
  // ----------------------------------------------------------

  describe('POST /webhook — whitelist', () => {
    it('retourne 200 silencieux pour un numéro non whitelisté (et logue)', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = buildWebhookPayload({
        from: '33699999999',
        text: 'Hello',
      });
      const rawBody = JSON.stringify(payload);
      const signature = signBody(rawBody);

      const res = await request(app)
        .post('/api/whatsapp/webhook')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);
      // Aucun appel aux mocks
      expect(mockGenerateCR).not.toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();

      // access_log contient le blocage
      const { getDb } = await import('../../db/connection');
      const row = getDb()
        .prepare(
          `SELECT action, result FROM access_logs
           WHERE actor_phone = ? ORDER BY id DESC LIMIT 1`,
        )
        .get('+33699999999') as { action: string; result: string } | undefined;

      expect(row?.action).toBe('whatsapp_blocked');
      expect(row?.result).toBe('denied_not_whitelisted');
    });
  });

  // ----------------------------------------------------------
  // POST /webhook — dispatch
  // ----------------------------------------------------------

  describe('POST /webhook — dispatch commandes', () => {
    beforeEach(async () => {
      await insertWhitelistedNumber('+33612345678');
    });

    it('retourne 200 + crée une session pour un message texte libre', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = buildWebhookPayload({
        from: '33612345678',
        text: 'Déjeuner avec Emmanuel ce midi au Voltaire, 180 euros',
      });
      const rawBody = JSON.stringify(payload);

      const res = await request(app)
        .post('/api/whatsapp/webhook')
        .set('X-Hub-Signature-256', signBody(rawBody))
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(res.status).toBe(200);

      // Vérifier qu'une session a été créée
      const { getDb } = await import('../../db/connection');
      const session = getDb()
        .prepare(
          'SELECT * FROM whatsapp_sessions WHERE user_phone = ?',
        )
        .get('+33612345678') as { state: string; active_draft_id: string | null };

      expect(session).toBeDefined();
      expect(session.state).toBe('drafting');
      expect(session.active_draft_id).not.toBeNull();

      // Un message de confirmation envoyé
      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('commande "terminer" → appelle generateCR et envoie une preview', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      mockGenerateCR.mockResolvedValue({
        response: {
          status: 'ready',
          clarification_question: null,
          detected_entite: 'IC',
          detected_type: 'dejeuner',
          cr: VALID_CR,
        },
        usage: {
          inputTokens: 1200,
          outputTokens: 800,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          model: 'claude-sonnet-4-5',
          latencyMs: 150,
        },
      });

      // 1er message : contenu du CR
      const payload1 = buildWebhookPayload({
        from: '33612345678',
        text: 'Déjeuner avec Emmanuel Gomez, stratégie Q3',
      });
      const raw1 = JSON.stringify(payload1);
      await request(app)
        .post('/api/whatsapp/webhook')
        .set('X-Hub-Signature-256', signBody(raw1))
        .set('Content-Type', 'application/json')
        .send(raw1);

      // 2e message : "terminer"
      const payload2 = buildWebhookPayload({
        from: '33612345678',
        text: 'terminer',
      });
      const raw2 = JSON.stringify(payload2);
      const res2 = await request(app)
        .post('/api/whatsapp/webhook')
        .set('X-Hub-Signature-256', signBody(raw2))
        .set('Content-Type', 'application/json')
        .send(raw2);

      expect(res2.status).toBe(200);
      expect(mockGenerateCR).toHaveBeenCalledTimes(1);
      expect(mockSendInteractive).toHaveBeenCalled();

      // Session est en awaiting_publish_confirm
      const { getDb } = await import('../../db/connection');
      const session = getDb()
        .prepare('SELECT state, active_draft_id FROM whatsapp_sessions WHERE user_phone = ?')
        .get('+33612345678') as { state: string; active_draft_id: string };
      expect(session.state).toBe('awaiting_publish_confirm');
      expect(session.active_draft_id).toBeDefined();
    });

    it('commande "valider" → appelle publishToCraft et marque published', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      mockGenerateCR.mockResolvedValue({
        response: {
          status: 'ready',
          clarification_question: null,
          detected_entite: 'IC',
          detected_type: 'dejeuner',
          cr: VALID_CR,
        },
        usage: {
          inputTokens: 1200,
          outputTokens: 800,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          model: 'claude-sonnet-4-5',
          latencyMs: 150,
        },
      });
      mockPublishToCraft.mockResolvedValue({
        success: true,
        craftDocId: 'craft-doc-abc',
        craftUrl: 'https://craft.do/abc',
        httpStatus: 200,
        durationMs: 100,
        attempts: 1,
      });

      // Pipeline complet : contenu → terminer → valider
      const send = async (text: string): Promise<void> => {
        const p = buildWebhookPayload({ from: '33612345678', text });
        const raw = JSON.stringify(p);
        await request(app)
          .post('/api/whatsapp/webhook')
          .set('X-Hub-Signature-256', signBody(raw))
          .set('Content-Type', 'application/json')
          .send(raw);
      };

      await send('Déjeuner avec Emmanuel');
      await send('terminer');
      await send('valider');

      expect(mockPublishToCraft).toHaveBeenCalledTimes(1);

      const { getDb } = await import('../../db/connection');
      const draft = getDb()
        .prepare('SELECT status FROM cr_drafts WHERE user_phone = ? LIMIT 1')
        .get('+33612345678') as { status: string };
      expect(draft.status).toBe('published');

      // Log d'accès pour la publication
      const logRow = getDb()
        .prepare(
          `SELECT action, result FROM access_logs
           WHERE actor_phone = ? AND action = 'publish' ORDER BY id DESC LIMIT 1`,
        )
        .get('+33612345678') as { action: string; result: string } | undefined;
      expect(logRow?.result).toBe('success');
    });

    it('commande "annuler" → marque le draft abandoned', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      // 1er message puis annuler
      const send = async (text: string): Promise<void> => {
        const p = buildWebhookPayload({ from: '33612345678', text });
        const raw = JSON.stringify(p);
        await request(app)
          .post('/api/whatsapp/webhook')
          .set('X-Hub-Signature-256', signBody(raw))
          .set('Content-Type', 'application/json')
          .send(raw);
      };

      await send('Déjeuner avec Emmanuel');
      await send('annuler');

      const { getDb } = await import('../../db/connection');
      const draft = getDb()
        .prepare('SELECT status FROM cr_drafts WHERE user_phone = ? LIMIT 1')
        .get('+33612345678') as { status: string };
      expect(draft.status).toBe('abandoned');

      const session = getDb()
        .prepare('SELECT state FROM whatsapp_sessions WHERE user_phone = ?')
        .get('+33612345678') as { state: string };
      expect(session.state).toBe('abandoned');
    });

    it('commande "terminer" sans brouillon → message d\'aide', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const p = buildWebhookPayload({ from: '33612345678', text: 'terminer' });
      const raw = JSON.stringify(p);
      const res = await request(app)
        .post('/api/whatsapp/webhook')
        .set('X-Hub-Signature-256', signBody(raw))
        .set('Content-Type', 'application/json')
        .send(raw);

      expect(res.status).toBe(200);
      expect(mockGenerateCR).not.toHaveBeenCalled();
      expect(mockSendMessage).toHaveBeenCalled();
    });
  });
});
