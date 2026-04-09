/**
 * Tests d'intégration — routes /api/telegram/webhook.
 *
 * Stratégie :
 *  - Mock des services externes : `services/anthropic`, `services/craft`,
 *    et `services/telegram` (pour ne jamais toucher Telegram API).
 *  - DB SQLite temporaire par test (même pattern que whatsapp.test.ts).
 *  - Secret token dans le header `X-Telegram-Bot-Api-Secret-Token`.
 *  - supertest sur buildApp().
 *
 * Couverture :
 *  - POST sans secret token → 401
 *  - POST avec secret token invalide → 401
 *  - POST avec chat_id non whitelisté → 200 (silent block, logged)
 *  - POST avec chat_id whitelisté + message texte → 200 + session créée
 *  - POST avec commande "terminer" → generateCR mocké appelé, preview envoyée
 *  - POST avec commande "valider" → publishToCraft mocké appelé
 *  - POST avec commande "annuler" → draft marqué abandoned
 *  - POST avec callback_query validate → publishToCraft appelé
 *  - POST avec callback_query cancel → draft marqué abandoned
 *  - POST message sans texte (photo) → message d'aide
 */

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
const mockSendTelegramMessage = vi.fn();
const mockSendTelegramConfirmation = vi.fn();
const mockAnswerCallbackQuery = vi.fn();

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

vi.mock('../../services/telegram', async () => {
  const actual = await vi.importActual<typeof import('../../services/telegram')>(
    '../../services/telegram',
  );
  return {
    ...actual,
    sendTelegramMessage: mockSendTelegramMessage,
    sendTelegramConfirmation: mockSendTelegramConfirmation,
    answerCallbackQuery: mockAnswerCallbackQuery,
  };
});

// Also mock WhatsApp service to avoid issues with its config check
vi.mock('../../services/whatsapp', async () => {
  const actual = await vi.importActual<typeof import('../../services/whatsapp')>(
    '../../services/whatsapp',
  );
  return {
    ...actual,
    sendMessage: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'wamid.mock',
      httpStatus: 200,
      durationMs: 1,
      attempts: 1,
    }),
    sendInteractiveConfirmation: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'wamid.mock.interactive',
      httpStatus: 200,
      durationMs: 1,
      attempts: 1,
    }),
  };
});

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const SNAPSHOT = { ...process.env };

const TELEGRAM_WEBHOOK_SECRET = 'telegram_test_secret_token_abc';
const TELEGRAM_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';

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
  // WhatsApp vars (needed to avoid crash on whatsapp router mount)
  WHATSAPP_CLOUD_API_TOKEN: 'EAAFake_test_token',
  WHATSAPP_PHONE_ID: '123456789012345',
  WHATSAPP_VERIFY_TOKEN: 'verify_token_for_tests',
  WHATSAPP_WEBHOOK_SECRET: 'webhook_secret_for_tests',
  // Telegram vars
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_SECRET,
};

const VALID_CR = {
  reference_placeholder: '[REF_TO_BE_GENERATED]',
  entite: 'IC',
  type_reunion: 'dejeuner',
  date_reunion: '2026-04-08',
  lieu: 'Restaurant Le Voltaire',
  participants: [
    {
      prenom: 'Karim',
      nom: 'Bensaid',
      titre: 'Directeur',
      societe: 'KB Conseil',
      qualite_relation: 'Conseiller',
    },
  ],
  objet: 'Déjeuner de travail stratégie Q3',
  montant_ttc_eur: 180,
  etablissement_nom: 'Le Voltaire',
  section_1_objet_art_39_1:
    'La présente réunion avait pour objet la revue stratégique.',
  section_2_points_abordes:
    'Les échanges ont porté sur les points suivants.',
  section_3_decisions:
    'Il a été convenu de lancer la phase pilote.',
  section_4_suites_a_donner: null,
};

const CHAT_ID = 12345;

function buildTelegramUpdate(params: {
  text: string;
  chatId?: number;
  updateId?: number;
}): Record<string, unknown> {
  return {
    update_id: params.updateId ?? Math.floor(Math.random() * 1000000),
    message: {
      message_id: Math.floor(Math.random() * 1000),
      from: { id: params.chatId ?? CHAT_ID, first_name: 'Thomas', username: 'thomasissa' },
      chat: { id: params.chatId ?? CHAT_ID, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text: params.text,
    },
  };
}

function buildCallbackQueryUpdate(params: {
  callbackData: string;
  chatId?: number;
  callbackQueryId?: string;
}): Record<string, unknown> {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    callback_query: {
      id: params.callbackQueryId ?? `cbq-${Date.now()}`,
      from: { id: params.chatId ?? CHAT_ID, first_name: 'Thomas' },
      message: {
        message_id: 42,
        chat: { id: params.chatId ?? CHAT_ID, type: 'private' },
        date: Math.floor(Date.now() / 1000),
      },
      data: params.callbackData,
    },
  };
}

async function insertWhitelistedTelegramUser(chatId: number): Promise<void> {
  const { getDb } = await import('../../db/connection');
  getDb()
    .prepare(
      `INSERT INTO whitelist_whatsapp
         (id, phone_e164, display_name, entites_visibles, is_admin,
          rgpd_information_sent_at, mandat_signed_at, created_at, revoked_at,
          telegram_chat_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `wl-tg-${chatId}`,
      `+33600000001`,
      'Thomas Test',
      JSON.stringify(['IC', 'GO', 'VI', 'VV']),
      1,
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
      null,
      chatId,
    );
}

// ------------------------------------------------------------
// Tests
// ------------------------------------------------------------

describe('routes /api/telegram/webhook', () => {
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(
      os.tmpdir(),
      `issa-sec-tg-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);
    process.env.DB_PATH = tempDbPath;

    mockGenerateCR.mockReset();
    mockPublishToCraft.mockReset();
    mockSendTelegramMessage.mockReset();
    mockSendTelegramConfirmation.mockReset();
    mockAnswerCallbackQuery.mockReset();

    // Comportement par défaut des mocks : succès silencieux
    mockSendTelegramMessage.mockResolvedValue({
      success: true,
      messageId: 42,
      httpStatus: 200,
      durationMs: 1,
      attempts: 1,
    });
    mockSendTelegramConfirmation.mockResolvedValue({
      success: true,
      messageId: 43,
      httpStatus: 200,
      durationMs: 1,
      attempts: 1,
    });
    mockAnswerCallbackQuery.mockResolvedValue({
      success: true,
      httpStatus: 200,
      durationMs: 1,
      attempts: 1,
    });

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    const { resetDbForTests, initDatabase } = await import('../../db/connection');
    const { resetTelegramRateLimitForTests } = await import(
      '../../middleware/rateLimitTelegram'
    );

    resetEnvForTests();
    resetLoggerForTests();
    resetDbForTests();
    initDatabase();
    resetTelegramRateLimitForTests();
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
  // POST /webhook — secret token
  // ----------------------------------------------------------

  describe('POST /webhook — secret token', () => {
    it('retourne 401 sans header X-Telegram-Bot-Api-Secret-Token', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = buildTelegramUpdate({ text: 'Hello' });

      const res = await request(app)
        .post('/api/telegram/webhook')
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_SECRET');
    });

    it('retourne 401 avec secret token invalide', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = buildTelegramUpdate({ text: 'Hello' });

      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('X-Telegram-Bot-Api-Secret-Token', 'wrong_secret')
        .send(payload);

      expect(res.status).toBe(401);
    });

    it('retourne 200 avec secret token correct et payload valide', async () => {
      await insertWhitelistedTelegramUser(CHAT_ID);

      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = buildTelegramUpdate({ text: 'Hello' });

      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // POST /webhook — whitelist
  // ----------------------------------------------------------

  describe('POST /webhook — whitelist', () => {
    it('retourne 200 silencieux pour un chat_id non whitelisté', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = buildTelegramUpdate({ text: 'Hello', chatId: 99999 });

      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
        .send(payload);

      expect(res.status).toBe(200);
      // Aucun appel aux mocks de message
      expect(mockSendTelegramMessage).not.toHaveBeenCalled();

      // access_log contient le blocage
      const { getDb } = await import('../../db/connection');
      const row = getDb()
        .prepare(
          `SELECT action, result FROM access_logs
           WHERE actor_phone = ? ORDER BY id DESC LIMIT 1`,
        )
        .get('telegram:99999') as { action: string; result: string } | undefined;

      expect(row?.action).toBe('telegram_blocked');
      expect(row?.result).toBe('denied_not_whitelisted');
    });
  });

  // ----------------------------------------------------------
  // POST /webhook — dispatch commandes
  // ----------------------------------------------------------

  describe('POST /webhook — dispatch commandes', () => {
    beforeEach(async () => {
      await insertWhitelistedTelegramUser(CHAT_ID);
    });

    it('crée une session pour un message texte libre', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = buildTelegramUpdate({
        text: 'Déjeuner avec Karim au Voltaire, 180 euros',
      });

      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
        .send(payload);

      expect(res.status).toBe(200);

      // Vérifier qu'une session a été créée
      const { getDb } = await import('../../db/connection');
      const session = getDb()
        .prepare(
          'SELECT * FROM whatsapp_sessions WHERE user_phone = ?',
        )
        .get(`telegram:${CHAT_ID}`) as { state: string; active_draft_id: string | null };

      expect(session).toBeDefined();
      expect(session.state).toBe('drafting');
      expect(session.active_draft_id).not.toBeNull();

      // Un message de confirmation envoyé
      expect(mockSendTelegramMessage).toHaveBeenCalled();
    });

    it('commande "terminer" → appelle generateCR et envoie preview + inline keyboard', async () => {
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

      const send = async (text: string): Promise<void> => {
        const p = buildTelegramUpdate({ text });
        await request(app)
          .post('/api/telegram/webhook')
          .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
          .send(p);
      };

      // 1er message : contenu du CR
      await send('Déjeuner avec Karim Bensaid, stratégie Q3');
      // 2e message : "terminer"
      await send('terminer');

      expect(mockGenerateCR).toHaveBeenCalledTimes(1);
      expect(mockSendTelegramConfirmation).toHaveBeenCalled();

      // Session est en awaiting_publish_confirm
      const { getDb } = await import('../../db/connection');
      const session = getDb()
        .prepare('SELECT state, active_draft_id FROM whatsapp_sessions WHERE user_phone = ?')
        .get(`telegram:${CHAT_ID}`) as { state: string; active_draft_id: string };
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

      const send = async (text: string): Promise<void> => {
        const p = buildTelegramUpdate({ text });
        await request(app)
          .post('/api/telegram/webhook')
          .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
          .send(p);
      };

      // Pipeline complet : contenu → terminer → valider
      await send('Déjeuner avec Karim');
      await send('terminer');
      await send('valider');

      expect(mockPublishToCraft).toHaveBeenCalledTimes(1);

      const { getDb } = await import('../../db/connection');
      const draft = getDb()
        .prepare('SELECT status FROM cr_drafts WHERE user_phone = ? LIMIT 1')
        .get(`telegram:${CHAT_ID}`) as { status: string };
      expect(draft.status).toBe('published');
    });

    it('commande "annuler" → marque le draft abandoned', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const send = async (text: string): Promise<void> => {
        const p = buildTelegramUpdate({ text });
        await request(app)
          .post('/api/telegram/webhook')
          .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
          .send(p);
      };

      await send('Déjeuner avec Karim');
      await send('annuler');

      const { getDb } = await import('../../db/connection');
      const draft = getDb()
        .prepare('SELECT status FROM cr_drafts WHERE user_phone = ? LIMIT 1')
        .get(`telegram:${CHAT_ID}`) as { status: string };
      expect(draft.status).toBe('abandoned');

      const session = getDb()
        .prepare('SELECT state FROM whatsapp_sessions WHERE user_phone = ?')
        .get(`telegram:${CHAT_ID}`) as { state: string };
      expect(session.state).toBe('abandoned');
    });

    it('commande "terminer" sans brouillon → message d\'aide', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const p = buildTelegramUpdate({ text: 'terminer' });
      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
        .send(p);

      expect(res.status).toBe(200);
      expect(mockGenerateCR).not.toHaveBeenCalled();
      expect(mockSendTelegramMessage).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // POST /webhook — callback_query (boutons inline)
  // ----------------------------------------------------------

  describe('POST /webhook — callback_query', () => {
    beforeEach(async () => {
      await insertWhitelistedTelegramUser(CHAT_ID);
    });

    it('callback validate → publie sur Craft', async () => {
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
        craftDocId: 'craft-doc-xyz',
        craftUrl: 'https://craft.do/xyz',
        httpStatus: 200,
        durationMs: 100,
        attempts: 1,
      });

      const send = async (text: string): Promise<void> => {
        const p = buildTelegramUpdate({ text });
        await request(app)
          .post('/api/telegram/webhook')
          .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
          .send(p);
      };

      // Pipeline : contenu → terminer (CR prêt)
      await send('Déjeuner avec Karim');
      await send('terminer');

      // Récupérer le draftId actif
      const { getDb } = await import('../../db/connection');
      const session = getDb()
        .prepare('SELECT active_draft_id FROM whatsapp_sessions WHERE user_phone = ?')
        .get(`telegram:${CHAT_ID}`) as { active_draft_id: string };
      const draftId = session.active_draft_id;

      // Envoyer callback_query validate
      const cbPayload = buildCallbackQueryUpdate({
        callbackData: `validate:${draftId}`,
        callbackQueryId: 'cbq-validate-123',
      });

      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
        .send(cbPayload);

      expect(res.status).toBe(200);
      expect(mockPublishToCraft).toHaveBeenCalledTimes(1);
      expect(mockAnswerCallbackQuery).toHaveBeenCalled();

      const draft = getDb()
        .prepare('SELECT status FROM cr_drafts WHERE id = ?')
        .get(draftId) as { status: string };
      expect(draft.status).toBe('published');
    });

    it('callback cancel → draft abandoned', async () => {
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

      const send = async (text: string): Promise<void> => {
        const p = buildTelegramUpdate({ text });
        await request(app)
          .post('/api/telegram/webhook')
          .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
          .send(p);
      };

      await send('Déjeuner avec Karim');
      await send('terminer');

      const { getDb } = await import('../../db/connection');
      const session = getDb()
        .prepare('SELECT active_draft_id FROM whatsapp_sessions WHERE user_phone = ?')
        .get(`telegram:${CHAT_ID}`) as { active_draft_id: string };
      const draftId = session.active_draft_id;

      const cbPayload = buildCallbackQueryUpdate({
        callbackData: `cancel:${draftId}`,
        callbackQueryId: 'cbq-cancel-456',
      });

      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
        .send(cbPayload);

      expect(res.status).toBe(200);
      expect(mockAnswerCallbackQuery).toHaveBeenCalled();

      const draft = getDb()
        .prepare('SELECT status FROM cr_drafts WHERE id = ?')
        .get(draftId) as { status: string };
      expect(draft.status).toBe('abandoned');
    });

    it('callback non whitelisté → answerCallbackQuery "Accès non autorisé"', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const cbPayload = buildCallbackQueryUpdate({
        callbackData: 'validate:some-draft',
        chatId: 99999,
        callbackQueryId: 'cbq-unauth',
      });

      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
        .send(cbPayload);

      expect(res.status).toBe(200);
      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith(
        'cbq-unauth',
        'Accès non autorisé.',
      );
    });
  });

  // ----------------------------------------------------------
  // POST /webhook — messages non-texte
  // ----------------------------------------------------------

  describe('POST /webhook — messages non-texte', () => {
    beforeEach(async () => {
      await insertWhitelistedTelegramUser(CHAT_ID);
    });

    it('message sans texte (photo) → message d\'aide', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const payload = {
        update_id: 123456789,
        message: {
          message_id: 2,
          from: { id: CHAT_ID, first_name: 'Thomas' },
          chat: { id: CHAT_ID, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          photo: [{ file_id: 'photo123', width: 800, height: 600 }],
        },
      };

      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
        .send(payload);

      expect(res.status).toBe(200);
      expect(mockSendTelegramMessage).toHaveBeenCalledWith(
        CHAT_ID,
        expect.stringContaining('texte'),
      );
    });
  });

  // ----------------------------------------------------------
  // POST /webhook — payload invalide
  // ----------------------------------------------------------

  describe('POST /webhook — payload invalide', () => {
    it('retourne 200 OK pour un payload invalide (évite retries Telegram)', async () => {
      const { buildApp } = await import('../../index');
      const app = buildApp();

      const res = await request(app)
        .post('/api/telegram/webhook')
        .set('X-Telegram-Bot-Api-Secret-Token', TELEGRAM_WEBHOOK_SECRET)
        .send({ foo: 'bar' });

      expect(res.status).toBe(200);
      expect(res.body.ignored).toBe('invalid_payload');
    });
  });
});
