/**
 * Tests dispatcher `callLLM` — routage par tâche (S22).
 *
 * On mock le client DeepSeek (`deepseek-client`) et le SDK Anthropic pour
 * vérifier :
 *  - routage anthropic vs deepseek selon TASK_MODEL
 *  - override env par tâche
 *  - GARDE-FOU : aucun fallback cross-provider (erreur deepseek propagée,
 *    SDK Anthropic jamais appelé derrière)
 *  - tools + provider deepseek → throw
 *  - système non-string + deepseek → throw
 *  - résultat normalisé (message présent pour anthropic, absent pour deepseek)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock DeepSeek client.
const mockCallDeepSeek = vi.fn();
vi.mock('../deepseek-client', () => ({
  callDeepSeek: (...args: unknown[]) => mockCallDeepSeek(...args),
}));

// Mock SDK Anthropic (callAnthropic l'utilise sous le capot).
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class FakeAPIError extends Error {
    public status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  const Anthropic = vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })) as unknown as {
    new (opts: { apiKey: string; maxRetries: number }): { messages: { create: typeof mockCreate } };
    APIError: typeof FakeAPIError;
  };
  (Anthropic as unknown as { APIError: typeof FakeAPIError }).APIError = FakeAPIError;
  return { default: Anthropic, APIError: FakeAPIError };
});

vi.mock('../../health-monitor/anthropic-usage', () => ({
  recordAnthropicUsage: vi.fn(),
}));

import { callLLM, resetAnthropicClient } from '../client';

const envKeys = ['LLM_TASK_OVERRIDE_EMAIL_TRIAGE', 'LLM_TASK_OVERRIDE_CR'];

beforeEach(() => {
  vi.clearAllMocks();
  resetAnthropicClient();
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  process.env.DEEPSEEK_API_KEY = 'sk-deepseek';
  for (const k of envKeys) delete process.env[k];
});

afterEach(() => {
  for (const k of envKeys) delete process.env[k];
});

describe('callLLM — routage par défaut', () => {
  it('email-triage → DeepSeek (callDeepSeek appelé, SDK Anthropic ignoré)', async () => {
    mockCallDeepSeek.mockResolvedValue({
      text: '{"category":"spam"}',
      promptTokens: 10,
      completionTokens: 5,
      networkRetries: 0,
    });

    const result = await callLLM({
      task: 'email-triage',
      system: 'sys triage',
      messages: [{ role: 'user', content: 'email' }],
      maxTokens: 512,
      responseFormat: 'json',
    });

    expect(mockCallDeepSeek).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
    const arg = mockCallDeepSeek.mock.calls[0]![0];
    expect(arg.model).toBe('deepseek-v4-flash');
    expect(arg.system).toBe('sys triage');
    expect(result.text).toBe('{"category":"spam"}');
    expect(result.message).toBeUndefined();
    expect(result.networkRetries).toBe(0);
  });

  it('cr → Anthropic (SDK appelé, callDeepSeek ignoré, message présent)', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'CR généré' }],
      usage: { input_tokens: 100, output_tokens: 200 },
    });

    const result = await callLLM({
      task: 'cr',
      system: 'sys cr',
      messages: [{ role: 'user', content: 'réunion' }],
      maxTokens: 4096,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCallDeepSeek).not.toHaveBeenCalled();
    const arg = mockCreate.mock.calls[0]![0];
    expect(arg.model).toBe('claude-sonnet-4-6');
    expect(result.text).toBe('CR généré');
    expect(result.message).toBeDefined();
  });
});

describe('callLLM — override env', () => {
  it('LLM_TASK_OVERRIDE_EMAIL_TRIAGE=anthropic:... bascule sur Anthropic', async () => {
    process.env.LLM_TASK_OVERRIDE_EMAIL_TRIAGE = 'anthropic:claude-haiku-4-5-20251001';
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"category":"locataire"}' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const result = await callLLM({
      task: 'email-triage',
      system: 'sys',
      messages: [{ role: 'user', content: 'x' }],
      maxTokens: 256,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCallDeepSeek).not.toHaveBeenCalled();
    expect(mockCreate.mock.calls[0]![0].model).toBe('claude-haiku-4-5-20251001');
    expect(result.message).toBeDefined();
  });

  it('LLM_TASK_OVERRIDE_CR=deepseek:... bascule sur DeepSeek', async () => {
    process.env.LLM_TASK_OVERRIDE_CR = 'deepseek:deepseek-v4-flash';
    mockCallDeepSeek.mockResolvedValue({
      text: 'ok',
      promptTokens: 1,
      completionTokens: 1,
      networkRetries: 0,
    });

    await callLLM({
      task: 'cr',
      system: 'sys',
      messages: [{ role: 'user', content: 'x' }],
      maxTokens: 256,
    });

    expect(mockCallDeepSeek).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('callLLM — GARDE-FOU aucun fallback cross-provider', () => {
  it('erreur DeepSeek propagée, SDK Anthropic jamais appelé', async () => {
    mockCallDeepSeek.mockRejectedValue(new Error('DeepSeek HTTP 500 : down'));

    await expect(
      callLLM({
        task: 'email-triage',
        system: 'sys',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 256,
        responseFormat: 'json',
      }),
    ).rejects.toThrow(/DeepSeek HTTP 500/);

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('clé DeepSeek manquante propagée (pas de bascule Claude)', async () => {
    mockCallDeepSeek.mockRejectedValue(new Error('DEEPSEEK_API_KEY manquante ou placeholder'));

    await expect(
      callLLM({
        task: 'inbox-router',
        system: 'sys',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 256,
      }),
    ).rejects.toThrow(/DEEPSEEK_API_KEY/);

    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('callLLM — garde-fous DeepSeek', () => {
  it('tools fourni avec une tâche DeepSeek → throw', async () => {
    await expect(
      callLLM({
        task: 'email-triage',
        system: 'sys',
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 256,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      }),
    ).rejects.toThrow(/web_search non supporté/);

    expect(mockCallDeepSeek).not.toHaveBeenCalled();
  });

  it('system non-string avec une tâche DeepSeek → throw', async () => {
    await expect(
      callLLM({
        task: 'email-triage',
        system: [{ type: 'text', text: 'sys' }],
        messages: [{ role: 'user', content: 'x' }],
        maxTokens: 256,
      }),
    ).rejects.toThrow(/doit être une string/);

    expect(mockCallDeepSeek).not.toHaveBeenCalled();
  });
});
