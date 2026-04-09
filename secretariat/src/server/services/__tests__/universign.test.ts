/**
 * Tests unitaires — service universign (Phase 6).
 *
 * Stratégie :
 *  - Mock de `globalThis.fetch` (aucun appel réel à ws.universign.eu).
 *  - Reset env entre chaque test.
 *
 * Couverture (11 tests) :
 *  - isConfigured : clé absente, placeholder, clé valide
 *  - sha256Hex : empreinte reproductible
 *  - requestTimestamp sans config → UniversignNotConfiguredError
 *  - requestTimestamp sha256 invalide → throw
 *  - requestTimestamp succès → token base64 + provider + requestedAt
 *  - requestTimestamp 4xx → UniversignClientError (pas de retry)
 *  - requestTimestamp 500 puis 200 → retry OK, attempts=2
 *  - requestTimestamp 3x 500 → UniversignTimeoutError
 *  - requestTimestamp abort/timeout → retry puis throw
 *  - requête DER contient bien l'OID SHA-256 et le hash
 *  - header Authorization Basic bien construit
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isConfigured,
  requestTimestamp,
  sha256Hex,
  UniversignClientError,
  UniversignNotConfiguredError,
  UniversignTimeoutError,
} from '../universign';

const SNAPSHOT = { ...process.env };

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake-for-tests',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake_test_key',
  DB_PATH: '/tmp/issa-universign-test-unused.db',
  SESSION_TTL_HOURS: '24',
};

/** Fake response RFC 3161 — un buffer binaire arbitraire de 512 bytes. */
function fakeTimestampResponse(): Uint8Array {
  const buf = new Uint8Array(512);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = (i * 7) % 256;
  }
  return buf;
}

function makeOkResponse(bytes: Uint8Array): Response {
  return {
    ok: true,
    status: 200,
    // Buffer.from(Uint8Array) partage le même underlying ArrayBuffer view,
    // donc on doit exposer un vrai ArrayBuffer copié pour que le wrapper
    // Buffer.from(arrayBuffer) dans le service le consomme sans mutation.
    arrayBuffer: async (): Promise<ArrayBuffer> => {
      const ab = new ArrayBuffer(bytes.length);
      new Uint8Array(ab).set(bytes);
      return ab;
    },
    text: async () => '',
  } as unknown as Response;
}

function makeErrorResponse(status: number, body = ''): Response {
  return {
    ok: false,
    status,
    arrayBuffer: async () => new ArrayBuffer(0),
    text: async () => body,
  } as unknown as Response;
}

describe('universign — isConfigured', () => {
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

  it('retourne false si UNIVERSIGN_API_KEY est absent', async () => {
    delete process.env.UNIVERSIGN_API_KEY;
    const { resetEnvForTests } = await import('../../utils/env');
    resetEnvForTests();
    expect(isConfigured()).toBe(false);
  });

  it('retourne false si la clé est un placeholder __TO_FILL__', async () => {
    process.env.UNIVERSIGN_API_KEY = '__TO_FILL__';
    const { resetEnvForTests } = await import('../../utils/env');
    resetEnvForTests();
    expect(isConfigured()).toBe(false);
  });

  it('retourne true si la clé semble valide', async () => {
    process.env.UNIVERSIGN_API_KEY = 'universign_live_key_abcdef123456';
    const { resetEnvForTests } = await import('../../utils/env');
    resetEnvForTests();
    expect(isConfigured()).toBe(true);
  });
});

describe('universign — sha256Hex', () => {
  it('produit une empreinte SHA-256 reproductible', () => {
    const h1 = sha256Hex('hello world');
    const h2 = sha256Hex('hello world');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    // Valeur connue de SHA-256('hello world')
    expect(h1).toBe(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    );
  });
});

describe('universign — requestTimestamp', () => {
  beforeEach(async () => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);
    // Active Universign avec une clé valide pour tous les tests de ce bloc
    process.env.UNIVERSIGN_API_KEY = 'universign_live_key_abcdef123456';
    process.env.UNIVERSIGN_API_URL = 'https://ws.universign.eu/tsa/post/';
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

  it('throw UniversignNotConfiguredError si clé absente', async () => {
    delete process.env.UNIVERSIGN_API_KEY;
    const { resetEnvForTests } = await import('../../utils/env');
    resetEnvForTests();

    await expect(
      requestTimestamp(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      ),
    ).rejects.toBeInstanceOf(UniversignNotConfiguredError);
  });

  it('throw si sha256 invalide (pas 64 hex)', async () => {
    await expect(requestTimestamp('not-a-hash')).rejects.toThrow(/64 caractères/);
  });

  it('succès : retourne token base64 + provider universign', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeOkResponse(fakeTimestampResponse()));
    vi.stubGlobal('fetch', fetchMock);

    const hash =
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
    const result = await requestTimestamp(hash);

    expect(result.provider).toBe('universign');
    expect(result.sha256).toBe(hash);
    expect(result.attempts).toBe(1);
    expect(result.token).toMatch(/^[A-Za-z0-9+/]+=*$/); // base64
    expect(result.token.length).toBeGreaterThan(100);
    expect(result.requestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Vérifier les headers
    const [url, opts] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: Buffer },
    ];
    expect(url).toBe('https://ws.universign.eu/tsa/post/');
    expect(opts.headers.Authorization).toMatch(/^Basic /);
    expect(opts.headers['Content-Type']).toBe('application/timestamp-query');
    // Le body doit être un buffer DER contenant l'OID SHA-256
    // 2.16.840.1.101.3.4.2.1 = 06 09 60 86 48 01 65 03 04 02 01
    const bodyHex = Buffer.from(opts.body).toString('hex');
    expect(bodyHex).toContain('608648016503040201');
    // Et le hash lui-même (32 bytes = 64 hex)
    expect(bodyHex).toContain(hash);
  });

  it('401 → UniversignClientError (pas de retry)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeErrorResponse(401, 'Unauthorized'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestTimestamp(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      ),
    ).rejects.toBeInstanceOf(UniversignClientError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('500 puis 200 → retry et succès, attempts=2', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeErrorResponse(500, 'Server error'))
      .mockResolvedValueOnce(makeOkResponse(fakeTimestampResponse()));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestTimestamp(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    );

    expect(result.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 20_000);

  it('3 x 500 → UniversignTimeoutError après 3 tentatives', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeErrorResponse(500, 'Server error'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestTimestamp(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      ),
    ).rejects.toBeInstanceOf(UniversignTimeoutError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 20_000);

  it('network error → retry et UniversignTimeoutError si persistant', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestTimestamp(
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      ),
    ).rejects.toBeInstanceOf(UniversignTimeoutError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 20_000);
});
