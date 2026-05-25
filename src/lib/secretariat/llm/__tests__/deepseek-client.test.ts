/**
 * Tests `deepseek-client.ts` — client fetch OpenAI-compatible.
 *
 * On mock `fetch` (aucun appel réseau réel) et `recordDeepSeekUsage` pour vérifier :
 *  - mapping system + dynamicSystem + messages vers le format OpenAI
 *  - response_format json_object si responseFormat: 'json'
 *  - parsing de la réponse (choices[0].message.content + usage)
 *  - retry 429/5xx (backoff) puis succès / échec
 *  - throw si clé absente ou placeholder
 *  - enregistrement de l'usage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockRecordUsage = vi.fn();
vi.mock('../../health-monitor/deepseek-usage', () => ({
  recordDeepSeekUsage: (...args: unknown[]) => mockRecordUsage(...args),
}));

import { callDeepSeek } from '../deepseek-client';

// Helper : réponse fetch OK avec contenu + usage.
function okResponse(content: string, usage = { prompt_tokens: 100, completion_tokens: 50 }) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
      usage,
    }),
    text: async () => '',
  };
}

function errResponse(status: number, body = 'err') {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body,
  };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  process.env.DEEPSEEK_API_KEY = 'sk-deepseek-test';
  delete process.env.DEEPSEEK_BASE_URL;
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
  delete process.env.DEEPSEEK_API_KEY;
});

describe('callDeepSeek — mapping & parsing', () => {
  it('construit le payload OpenAI (system + dynamicSystem fusionnés + messages)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('{"ok":true}'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await callDeepSeek({
      model: 'deepseek-v4-flash',
      system: 'Tu es Anya.',
      dynamicSystem: 'Heure : 10h.',
      messages: [{ role: 'user', content: 'Salut' }],
      maxTokens: 256,
      responseFormat: 'json',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-deepseek-test');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('deepseek-v4-flash');
    expect(body.max_tokens).toBe(256);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0]).toEqual({
      role: 'system',
      content: 'Tu es Anya.\n\nHeure : 10h.',
    });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Salut' });

    expect(result.text).toBe('{"ok":true}');
    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(50);
    expect(result.networkRetries).toBe(0);
  });

  it('omet response_format si responseFormat absent (texte)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('texte libre'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await callDeepSeek({
      model: 'deepseek-v4-flash',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 128,
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.response_format).toBeUndefined();
  });

  it('enregistre l usage via recordDeepSeekUsage', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(okResponse('x', { prompt_tokens: 7, completion_tokens: 3 })) as unknown as typeof fetch;

    await callDeepSeek({
      model: 'deepseek-v4-flash',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 64,
    });

    expect(mockRecordUsage).toHaveBeenCalledWith({
      model: 'deepseek-v4-flash',
      promptTokens: 7,
      completionTokens: 3,
    });
  });

  it('respecte DEEPSEEK_BASE_URL override', async () => {
    process.env.DEEPSEEK_BASE_URL = 'https://proxy.local/v1';
    const fetchMock = vi.fn().mockResolvedValue(okResponse('ok'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await callDeepSeek({
      model: 'deepseek-v4-flash',
      system: 'sys',
      messages: [],
      maxTokens: 16,
    });

    expect(fetchMock.mock.calls[0]![0]).toBe('https://proxy.local/v1/chat/completions');
  });
});

describe('callDeepSeek — clé API', () => {
  it('throw si DEEPSEEK_API_KEY absente', async () => {
    delete process.env.DEEPSEEK_API_KEY;
    await expect(
      callDeepSeek({ model: 'deepseek-v4-flash', system: 's', messages: [], maxTokens: 8 }),
    ).rejects.toThrow(/DEEPSEEK_API_KEY/);
  });

  it('throw si DEEPSEEK_API_KEY est un placeholder', async () => {
    process.env.DEEPSEEK_API_KEY = '__TO_FILL__';
    await expect(
      callDeepSeek({ model: 'deepseek-v4-flash', system: 's', messages: [], maxTokens: 8 }),
    ).rejects.toThrow(/DEEPSEEK_API_KEY/);
  });
});

describe('callDeepSeek — retry 429/5xx', () => {
  it('retry sur 429 puis succès, compte les retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errResponse(429))
      .mockResolvedValueOnce(errResponse(503))
      .mockResolvedValueOnce(okResponse('done'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = callDeepSeek({
      model: 'deepseek-v4-flash',
      system: 's',
      messages: [{ role: 'user', content: 'x' }],
      maxTokens: 32,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.text).toBe('done');
    expect(result.networkRetries).toBe(2);
  });

  it('throw après épuisement des retries (5xx persistant)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errResponse(500, 'down'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = callDeepSeek({
      model: 'deepseek-v4-flash',
      system: 's',
      messages: [{ role: 'user', content: 'x' }],
      maxTokens: 32,
    });
    const expectation = expect(promise).rejects.toThrow(/DeepSeek HTTP 500/);
    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('ne retry PAS sur 4xx non retryable (400)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(errResponse(400, 'bad'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = callDeepSeek({
      model: 'deepseek-v4-flash',
      system: 's',
      messages: [{ role: 'user', content: 'x' }],
      maxTokens: 32,
    });
    const expectation = expect(promise).rejects.toThrow(/DeepSeek HTTP 400/);
    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
