/**
 * Tests unitaires — service telegram (envoi + parsing).
 *
 * Stratégie :
 *  - Mock de `globalThis.fetch` pour tous les tests (aucun appel réel Telegram).
 *  - `sleep` no-op injecté pour éliminer les délais de backoff.
 *  - Reset env entre chaque test.
 *
 * Couverture :
 *  - sendTelegramMessage : succès, 401 (non retriable), 500 (retry), timeout, troncature
 *  - sendTelegramConfirmation : inline keyboard avec 3 boutons + draftId encodé
 *  - answerCallbackQuery : appel correct
 *  - parseTelegramUpdate : payload valide, invalide, callback_query
 *  - Placeholder `__TO_FILL__` → TelegramConfigError
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  answerCallbackQuery,
  parseTelegramUpdate,
  sendTelegramConfirmation,
  sendTelegramMessage,
} from '../telegram';
import { TelegramConfigError, TelegramParseError } from '../telegram.types';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const SNAPSHOT = { ...process.env };

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake-for-tests',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake_test_key_for_tests',
  DB_PATH: '/tmp/issa-telegram-test-unused.db',
  SESSION_TTL_HOURS: '24',
  TELEGRAM_BOT_TOKEN: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
};

function makeFetchResponse(
  status: number,
  body: string | Record<string, unknown>,
): Response {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText,
  } as unknown as Response;
}

function makeTelegramSuccessBody(messageId = 42): Record<string, unknown> {
  return {
    ok: true,
    result: {
      message_id: messageId,
      chat: { id: 12345, type: 'private' },
      date: 1712577600,
      text: 'Hello',
    },
  };
}

// ------------------------------------------------------------
// Setup / teardown
// ------------------------------------------------------------

describe('telegram service', () => {
  beforeEach(async () => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    resetEnvForTests();
    resetLoggerForTests();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    resetEnvForTests();
    resetLoggerForTests();
  });

  // ----------------------------------------------------------
  // sendTelegramMessage — succès
  // ----------------------------------------------------------

  describe('sendTelegramMessage — succès', () => {
    it('retourne success=true + messageId quand Telegram répond 200', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, makeTelegramSuccessBody(99)));
      vi.stubGlobal('fetch', fetchMock);

      const result = await sendTelegramMessage(12345, 'Hello', {
        sleep: async () => {},
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(99);
      expect(result.httpStatus).toBe(200);
      expect(result.attempts).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('construit la bonne URL avec le token et la méthode sendMessage', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, makeTelegramSuccessBody()));
      vi.stubGlobal('fetch', fetchMock);

      await sendTelegramMessage(12345, 'Test', { sleep: async () => {} });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(
        'https://api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/sendMessage',
      );
      expect(init.method).toBe('POST');

      const headers = init.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('envoie un payload avec chat_id et text', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, makeTelegramSuccessBody()));
      vi.stubGlobal('fetch', fetchMock);

      await sendTelegramMessage(12345, 'Bonjour Thomas', {
        sleep: async () => {},
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.chat_id).toBe(12345);
      expect(body.text).toBe('Bonjour Thomas');
      expect(body.parse_mode).toBe('HTML');
    });

    it('tronque les messages > 4096 chars', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, makeTelegramSuccessBody()));
      vi.stubGlobal('fetch', fetchMock);

      const longText = 'a'.repeat(5000);
      await sendTelegramMessage(12345, longText, { sleep: async () => {} });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { text: string };
      expect(body.text.length).toBeLessThanOrEqual(4096);
      expect(body.text).toContain('[tronqué]');
    });
  });

  // ----------------------------------------------------------
  // sendTelegramMessage — erreurs
  // ----------------------------------------------------------

  describe('sendTelegramMessage — erreurs', () => {
    it('401 Unauthorized → échec immédiat, 1 seule tentative', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(401, 'Unauthorized'));
      vi.stubGlobal('fetch', fetchMock);

      const result = await sendTelegramMessage(12345, 'Test', {
        sleep: async () => {},
      });

      expect(result.success).toBe(false);
      expect(result.httpStatus).toBe(401);
      expect(result.attempts).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('500 → retry jusqu\'à 3 tentatives puis échoue', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(500, 'Server Error'));
      vi.stubGlobal('fetch', fetchMock);

      const result = await sendTelegramMessage(12345, 'Test', {
        sleep: async () => {},
      });

      expect(result.success).toBe(false);
      expect(result.httpStatus).toBe(500);
      expect(result.attempts).toBe(3);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('timeout AbortError → retry puis échoue', async () => {
      const fetchMock = vi.fn().mockImplementation(() => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await sendTelegramMessage(12345, 'Test', {
        sleep: async () => {},
        timeoutMs: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('interrompu');
      expect(result.attempts).toBe(3);
    });

    it('token __TO_FILL__ → TelegramConfigError', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '__TO_FILL__';
      const { resetEnvForTests } = await import('../../utils/env');
      resetEnvForTests();

      await expect(
        sendTelegramMessage(12345, 'Test', { sleep: async () => {} }),
      ).rejects.toBeInstanceOf(TelegramConfigError);
    });

    it('token manquant → TelegramConfigError', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      const { resetEnvForTests } = await import('../../utils/env');
      resetEnvForTests();

      await expect(
        sendTelegramMessage(12345, 'Test', { sleep: async () => {} }),
      ).rejects.toBeInstanceOf(TelegramConfigError);
    });
  });

  // ----------------------------------------------------------
  // sendTelegramConfirmation
  // ----------------------------------------------------------

  describe('sendTelegramConfirmation', () => {
    it('envoie un payload avec inline keyboard et 3 boutons + draftId encodé', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, makeTelegramSuccessBody()));
      vi.stubGlobal('fetch', fetchMock);

      const result = await sendTelegramConfirmation(
        12345,
        'draft-uuid-123',
        'Publier ?',
        { sleep: async () => {} },
      );

      expect(result.success).toBe(true);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as {
        chat_id: number;
        text: string;
        reply_markup: {
          inline_keyboard: Array<
            Array<{ text: string; callback_data: string }>
          >;
        };
      };
      expect(body.chat_id).toBe(12345);
      expect(body.text).toBe('Publier ?');
      expect(body.reply_markup.inline_keyboard).toHaveLength(1);
      expect(body.reply_markup.inline_keyboard[0]).toHaveLength(3);
      expect(body.reply_markup.inline_keyboard[0]?.[0]?.callback_data).toBe(
        'validate:draft-uuid-123',
      );
      expect(body.reply_markup.inline_keyboard[0]?.[1]?.callback_data).toBe(
        'modify:draft-uuid-123',
      );
      expect(body.reply_markup.inline_keyboard[0]?.[2]?.callback_data).toBe(
        'cancel:draft-uuid-123',
      );
    });
  });

  // ----------------------------------------------------------
  // answerCallbackQuery
  // ----------------------------------------------------------

  describe('answerCallbackQuery', () => {
    it('appelle la bonne méthode API avec callback_query_id', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, { ok: true }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await answerCallbackQuery('cbq-123', 'OK', {
        sleep: async () => {},
      });

      expect(result.success).toBe(true);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/answerCallbackQuery');
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.callback_query_id).toBe('cbq-123');
      expect(body.text).toBe('OK');
    });
  });

  // ----------------------------------------------------------
  // parseTelegramUpdate
  // ----------------------------------------------------------

  describe('parseTelegramUpdate', () => {
    it('parse un Update avec message texte valide', () => {
      const payload = {
        update_id: 123456789,
        message: {
          message_id: 1,
          from: { id: 12345, first_name: 'Thomas', username: 'thomasissa' },
          chat: { id: 12345, type: 'private' },
          date: 1712577600,
          text: 'Déjeuner hier avec Karim au Voltaire',
        },
      };

      const update = parseTelegramUpdate(payload);
      expect(update.update_id).toBe(123456789);
      expect(update.message?.text).toBe('Déjeuner hier avec Karim au Voltaire');
      expect(update.message?.chat.id).toBe(12345);
    });

    it('parse un Update avec callback_query valide', () => {
      const payload = {
        update_id: 123456790,
        callback_query: {
          id: 'abc123',
          from: { id: 12345, first_name: 'Thomas' },
          message: {
            message_id: 42,
            chat: { id: 12345, type: 'private' },
            date: 1712577600,
          },
          data: 'validate:draft-uuid',
        },
      };

      const update = parseTelegramUpdate(payload);
      expect(update.callback_query?.id).toBe('abc123');
      expect(update.callback_query?.data).toBe('validate:draft-uuid');
      expect(update.callback_query?.message?.chat.id).toBe(12345);
    });

    it('parse un Update sans message ni callback_query', () => {
      const payload = {
        update_id: 123456791,
      };

      const update = parseTelegramUpdate(payload);
      expect(update.update_id).toBe(123456791);
      expect(update.message).toBeUndefined();
      expect(update.callback_query).toBeUndefined();
    });

    it('throw TelegramParseError sur payload invalide', () => {
      const invalid = { foo: 'bar' };
      expect(() => parseTelegramUpdate(invalid)).toThrow(TelegramParseError);
    });

    it('parse un message sans texte (photo, sticker)', () => {
      const payload = {
        update_id: 123456792,
        message: {
          message_id: 2,
          from: { id: 12345, first_name: 'Thomas' },
          chat: { id: 12345, type: 'private' },
          date: 1712577600,
          photo: [{ file_id: 'photo123', width: 800, height: 600 }],
        },
      };

      const update = parseTelegramUpdate(payload);
      expect(update.message?.text).toBeUndefined();
      expect(update.message?.chat.id).toBe(12345);
    });
  });
});
