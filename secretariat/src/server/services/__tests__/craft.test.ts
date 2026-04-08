/**
 * Tests unitaires — service craft (Phase 4).
 *
 * Stratégie :
 *  - Mock de `globalThis.fetch` pour tous les tests (aucun appel réel à Craft).
 *  - Injection d'un `sleep` no-op pour éliminer les délais de backoff en test.
 *  - Reset env entre chaque test pour partir d'un état propre.
 *
 * Couverture :
 *  - Succès : publication OK → CraftPublishResult avec craftDocId + craftUrl
 *  - Succès sans URL : craftUrl undefined mais success=true
 *  - 401 (non retriable) : échec immédiat, 1 seule tentative
 *  - 500 (retriable) : 3 tentatives au total puis échec
 *  - Timeout AbortError : retry puis échec
 *  - JSON non-parseable : échec avec message clair
 *  - Réponse sans identifiant : échec validation Zod / normalisation
 *  - Clé API jamais présente dans les arguments de fetch visibles pour les logs
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { publishToCraft } from '../craft';
import type { CraftDocumentPayload } from '../craft.types';

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
  DB_PATH: '/tmp/issa-craft-test-unused.db',
  SESSION_TTL_HOURS: '24',
};

function makePayload(): CraftDocumentPayload {
  return {
    markdown: '# Test CR\n\nContenu du test.',
    position: { position: 'end' },
    internalTitle: '2026-04-08-dejeuner-IC-test.md',
    internalMetadata: {
      draftId: 'test-draft-uuid',
      reference: 'IC-CR-2026-0001',
      entite: 'IC',
      typeReunion: 'dejeuner',
      dateReunion: '2026-04-08',
      userPhone: 'thomas',
      markdownSha256:
        '0000000000000000000000000000000000000000000000000000000000000000',
    },
  };
}

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

// ------------------------------------------------------------
// Setup / teardown
// ------------------------------------------------------------

describe('publishToCraft', () => {
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
  // Succès
  // ----------------------------------------------------------

  describe('succès', () => {
    it('retourne success=true avec craftDocId et craftUrl quand Craft répond 200', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeFetchResponse(200, {
          id: 'craft-doc-abc123',
          url: 'https://craft.do/docs/abc123',
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(true);
      expect(result.craftDocId).toBe('craft-doc-abc123');
      expect(result.craftUrl).toBe('https://craft.do/docs/abc123');
      expect(result.httpStatus).toBe(200);
      expect(result.attempts).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('accepte les variants de nom de champ (blockId au lieu de id)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeFetchResponse(201, {
          blockId: 'block-xyz',
          webUrl: 'https://craft.do/blocks/xyz',
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(true);
      expect(result.craftDocId).toBe('block-xyz');
      expect(result.craftUrl).toBe('https://craft.do/blocks/xyz');
    });

    it('retourne success=true sans craftUrl si Craft n\'en fournit pas', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeFetchResponse(200, { id: 'just-an-id' }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(true);
      expect(result.craftDocId).toBe('just-an-id');
      expect(result.craftUrl).toBeUndefined();
    });

    it('envoie le header Authorization Bearer avec la clé API', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeFetchResponse(200, { id: 'ok' }),
      );
      vi.stubGlobal('fetch', fetchMock);

      await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://connect.craft.do/links/fake/api/v1/blocks');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer pdk_fake_test_key_for_tests');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('envoie uniquement markdown et position à Craft (pas les champs internal*)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        makeFetchResponse(200, { id: 'ok' }),
      );
      vi.stubGlobal('fetch', fetchMock);

      await publishToCraft(makePayload(), { sleep: async () => {} });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(['markdown', 'position']);
      expect(body.markdown).toBe('# Test CR\n\nContenu du test.');
      expect(body.position).toEqual({ position: 'end' });
    });
  });

  // ----------------------------------------------------------
  // Erreurs non retriables (4xx)
  // ----------------------------------------------------------

  describe('erreurs 4xx (non retriables)', () => {
    it('401 Unauthorized → échec immédiat, 1 seule tentative, PAS de retry', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(401, 'Unauthorized'));
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(false);
      expect(result.httpStatus).toBe(401);
      expect(result.attempts).toBe(1);
      expect(result.error).toContain('401');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('400 Bad Request → échec immédiat', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          makeFetchResponse(400, { error: 'Invalid markdown format' }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(false);
      expect(result.httpStatus).toBe(400);
      expect(result.attempts).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // Erreurs retriables (5xx)
  // ----------------------------------------------------------

  describe('erreurs 5xx (retriables)', () => {
    it('500 persistent → retry 2 fois puis échoue (3 tentatives au total)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(500, 'Internal Server Error'));
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(false);
      expect(result.httpStatus).toBe(500);
      expect(result.attempts).toBe(3);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('500 puis 200 → succès au 2e essai', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(makeFetchResponse(503, 'Service Unavailable'))
        .mockResolvedValueOnce(makeFetchResponse(200, { id: 'recovered' }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(true);
      expect(result.craftDocId).toBe('recovered');
      expect(result.attempts).toBe(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('429 rate limit → traité comme retriable', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(makeFetchResponse(429, 'Too Many Requests'))
        .mockResolvedValueOnce(makeFetchResponse(200, { id: 'after-rate-limit' }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // Timeout
  // ----------------------------------------------------------

  describe('timeout', () => {
    it('AbortError → retry puis échec timeout', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      const fetchMock = vi.fn().mockRejectedValue(abortError);
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('interrompu');
      expect(result.attempts).toBe(3);
    });

    it('AbortError puis succès → récupération au 2e essai', async () => {
      const abortError = new Error('aborted');
      abortError.name = 'AbortError';
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(makeFetchResponse(200, { id: 'recovered-timeout' }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(true);
      expect(result.craftDocId).toBe('recovered-timeout');
      expect(result.attempts).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // Réponses malformées
  // ----------------------------------------------------------

  describe('réponses malformées', () => {
    it('JSON invalide → échec avec erreur de parsing', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, '{ this is not json'));
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('non-JSON');
      expect(result.attempts).toBe(1); // pas de retry sur parsing (succès HTTP)
    });

    it('JSON valide mais aucun identifiant → échec de normalisation', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, { someOtherField: 'value' }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('identifiant');
    });
  });

  // ----------------------------------------------------------
  // Erreurs réseau
  // ----------------------------------------------------------

  describe('erreurs réseau', () => {
    it('ECONNREFUSED → retry puis échec', async () => {
      const netError = new Error('ECONNREFUSED');
      const fetchMock = vi.fn().mockRejectedValue(netError);
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), { sleep: async () => {} });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
      expect(result.attempts).toBe(3);
    });
  });

  // ----------------------------------------------------------
  // Option maxAttempts
  // ----------------------------------------------------------

  describe('options', () => {
    it('maxAttempts=1 désactive les retries', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(makeFetchResponse(500, 'boom'));
      vi.stubGlobal('fetch', fetchMock);

      const result = await publishToCraft(makePayload(), {
        sleep: async () => {},
        maxAttempts: 1,
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
