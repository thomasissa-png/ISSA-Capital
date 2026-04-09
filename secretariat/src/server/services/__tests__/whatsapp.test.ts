/**
 * Tests unitaires — service whatsapp (Phase 2).
 *
 * Stratégie :
 *  - Mock de `globalThis.fetch` pour tous les tests (aucun appel réel Meta).
 *  - `sleep` no-op injecté pour éliminer les délais de backoff.
 *  - Reset env entre chaque test.
 *
 * Couverture :
 *  - sendMessage : succès, 401 (non retriable), 500 (retry), timeout, body JSON valide
 *  - sendInteractiveConfirmation : structure boutons correcte
 *  - parseWebhookPayload : payload valide, invalide, message audio
 *  - Headers Authorization + URL v21.0 + phoneId dans l'URL
 *  - Placeholder `__TO_FILL__` → WhatsAppConfigError
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  parseWebhookPayload,
  sendInteractiveConfirmation,
  sendMessage,
} from '../whatsapp';
import { WhatsAppConfigError, WhatsAppParseError } from '../whatsapp.types';

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
  DB_PATH: '/tmp/issa-whatsapp-test-unused.db',
  SESSION_TTL_HOURS: '24',
  WHATSAPP_CLOUD_API_TOKEN: 'EAAFake_test_token_for_tests',
  WHATSAPP_PHONE_ID: '123456789012345',
  WHATSAPP_VERIFY_TOKEN: 'verify_token_test',
  WHATSAPP_WEBHOOK_SECRET: 'webhook_secret_test',
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

function makeMetaSuccessBody(messageId = 'wamid.test123'): Record<string, unknown> {
  return {
    messaging_product: 'whatsapp',
    contacts: [{ input: '33612345678', wa_id: '33612345678' }],
    messages: [{ id: messageId }],
  };
}

// ------------------------------------------------------------
// Setup / teardown
// ------------------------------------------------------------

describe('whatsapp service', () => {
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
  // sendMessage — succès
  // ----------------------------------------------------------

  describe('sendMessage — succès', () => {
    it('retourne success=true + messageId quand Meta répond 200', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, makeMetaSuccessBody('wamid.abc')));
      vi.stubGlobal('fetch', fetchMock);

      const result = await sendMessage('+33612345678', 'Hello', {
        sleep: async () => {},
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid.abc');
      expect(result.httpStatus).toBe(200);
      expect(result.attempts).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('construit la bonne URL avec v21.0 et phoneId', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, makeMetaSuccessBody()));
      vi.stubGlobal('fetch', fetchMock);

      await sendMessage('+33612345678', 'Test', { sleep: async () => {} });

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://graph.facebook.com/v21.0/123456789012345/messages');
      expect(init.method).toBe('POST');

      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer EAAFake_test_token_for_tests');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('envoie un payload type text valide', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, makeMetaSuccessBody()));
      vi.stubGlobal('fetch', fetchMock);

      await sendMessage('+33612345678', 'Bonjour Thomas', {
        sleep: async () => {},
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.messaging_product).toBe('whatsapp');
      expect(body.recipient_type).toBe('individual');
      expect(body.to).toBe('33612345678'); // sans "+"
      expect(body.type).toBe('text');
      expect((body.text as { body: string }).body).toBe('Bonjour Thomas');
    });

    it('tronque les messages > 4096 chars', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, makeMetaSuccessBody()));
      vi.stubGlobal('fetch', fetchMock);

      const longText = 'a'.repeat(5000);
      await sendMessage('+33612345678', longText, { sleep: async () => {} });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as {
        text: { body: string };
      };
      expect(body.text.body.length).toBeLessThanOrEqual(4096);
      expect(body.text.body).toContain('[tronqué]');
    });
  });

  // ----------------------------------------------------------
  // sendMessage — erreurs
  // ----------------------------------------------------------

  describe('sendMessage — erreurs', () => {
    it('401 Unauthorized → échec immédiat, 1 seule tentative', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(401, 'Unauthorized'));
      vi.stubGlobal('fetch', fetchMock);

      const result = await sendMessage('+33612345678', 'Test', {
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

      const result = await sendMessage('+33612345678', 'Test', {
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

      const result = await sendMessage('+33612345678', 'Test', {
        sleep: async () => {},
        timeoutMs: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('interrompu');
      expect(result.attempts).toBe(3);
    });

    it('token __TO_FILL__ → WhatsAppConfigError', async () => {
      process.env.WHATSAPP_CLOUD_API_TOKEN = '__TO_FILL__';
      const { resetEnvForTests } = await import('../../utils/env');
      resetEnvForTests();

      await expect(
        sendMessage('+33612345678', 'Test', { sleep: async () => {} }),
      ).rejects.toBeInstanceOf(WhatsAppConfigError);
    });
  });

  // ----------------------------------------------------------
  // sendInteractiveConfirmation
  // ----------------------------------------------------------

  describe('sendInteractiveConfirmation', () => {
    it('envoie un payload interactif avec 3 boutons et draftId encodé', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, makeMetaSuccessBody()));
      vi.stubGlobal('fetch', fetchMock);

      const result = await sendInteractiveConfirmation(
        '+33612345678',
        'draft-uuid-123',
        'Publier ?',
        { sleep: async () => {} },
      );

      expect(result.success).toBe(true);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as {
        type: string;
        interactive: {
          type: string;
          body: { text: string };
          action: {
            buttons: Array<{ reply: { id: string; title: string } }>;
          };
        };
      };
      expect(body.type).toBe('interactive');
      expect(body.interactive.type).toBe('button');
      expect(body.interactive.body.text).toBe('Publier ?');
      expect(body.interactive.action.buttons).toHaveLength(3);
      expect(body.interactive.action.buttons[0]?.reply.id).toBe('validate:draft-uuid-123');
      expect(body.interactive.action.buttons[1]?.reply.id).toBe('modify:draft-uuid-123');
      expect(body.interactive.action.buttons[2]?.reply.id).toBe('cancel:draft-uuid-123');
    });
  });

  // ----------------------------------------------------------
  // parseWebhookPayload
  // ----------------------------------------------------------

  describe('parseWebhookPayload', () => {
    it('extrait les messages depuis un payload Meta valide', () => {
      const payload = {
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
                    { profile: { name: 'Thomas' }, wa_id: '33612345678' },
                  ],
                  messages: [
                    {
                      from: '33612345678',
                      id: 'wamid.abc',
                      timestamp: '1712577600',
                      type: 'text',
                      text: { body: 'Déjeuner avec Emmanuel ce midi' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const messages = parseWebhookPayload(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.from).toBe('33612345678');
      expect(messages[0]?.type).toBe('text');
      expect(messages[0]?.text?.body).toBe('Déjeuner avec Emmanuel ce midi');
    });

    it('retourne un tableau vide si le payload ne contient pas de messages', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WABA_ID',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  statuses: [{ status: 'delivered' }],
                },
              },
            ],
          },
        ],
      };

      const messages = parseWebhookPayload(payload);
      expect(messages).toHaveLength(0);
    });

    it('ignore les changes hors field="messages"', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WABA_ID',
            changes: [
              {
                field: 'account_update',
                value: {},
              },
            ],
          },
        ],
      };

      const messages = parseWebhookPayload(payload);
      expect(messages).toHaveLength(0);
    });

    it('throw WhatsAppParseError sur payload non conforme', () => {
      const invalid = { foo: 'bar' };
      expect(() => parseWebhookPayload(invalid)).toThrow(WhatsAppParseError);
    });

    it('parse les messages audio/image sans crash (type parsé)', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      from: '33612345678',
                      id: 'wamid.audio',
                      timestamp: '1712577600',
                      type: 'audio',
                      audio: { id: 'media-id', mime_type: 'audio/ogg' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const messages = parseWebhookPayload(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.type).toBe('audio');
      expect(messages[0]?.audio?.id).toBe('media-id');
    });
  });
});
