/**
 * Tests `llm/client.ts` — wrapper Anthropic unifié.
 *
 * On mock `@anthropic-ai/sdk` pour vérifier que :
 *  - cache_control est appliqué auto sur system string
 *  - dynamicSystem produit 2 blocs (stable cached + dynamique non cached)
 *  - recordAnthropicUsage est appelé avec les bons tokens
 *  - retry réseau 429/500 (3 tentatives, backoff)
 *  - retry JSON x1 si responseFormat: 'json' et validator KO
 *  - modèle résolu via models.ts + override env
 *  - splitSystemPrompt helper unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================
// Mocks (déclarés AVANT l'import du module testé)
// ============================================================

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
  // Attacher APIError comme propriété statique de la classe + default export
  (Anthropic as unknown as { APIError: typeof FakeAPIError }).APIError = FakeAPIError;
  return { default: Anthropic, APIError: FakeAPIError };
});

const mockRecordUsage = vi.fn();
vi.mock('../../health-monitor/anthropic-usage', () => ({
  recordAnthropicUsage: (...args: unknown[]) => mockRecordUsage(...args),
}));

// Import APRES les mocks
import {
  callAnthropic,
  splitSystemPrompt,
  resetAnthropicClient,
} from '../client';
import { SONNET_4, SONNET_4_6, HAIKU_4_5 } from '../models';
import Anthropic from '@anthropic-ai/sdk';

// ============================================================
// Setup
// ============================================================

const originalEnv = { ...process.env };

beforeEach(() => {
  mockCreate.mockReset();
  mockRecordUsage.mockReset();
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
  delete process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;
  delete process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU;
  resetAnthropicClient();
});

afterEach(() => {
  process.env = { ...originalEnv };
  resetAnthropicClient();
});

/**
 * Crée une instance APIError compatible avec le check isRetryableError du wrapper.
 * On utilise la classe mockée via le default export (Anthropic.APIError) en castant.
 */
function makeApiError(status: number, message: string): Error {
  const ApiError = (Anthropic as unknown as { APIError: new (status: number, message: string) => Error }).APIError;
  return new ApiError(status, message);
}

function makeResponse(text: string, usage?: Partial<{ input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }>) {
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: usage?.input_tokens ?? 100,
      output_tokens: usage?.output_tokens ?? 50,
      cache_read_input_tokens: usage?.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: usage?.cache_creation_input_tokens ?? 0,
    },
    stop_reason: 'end_turn',
    role: 'assistant',
    model: SONNET_4,
    id: 'msg_test',
    type: 'message',
  };
}

// ============================================================
// splitSystemPrompt
// ============================================================

describe('splitSystemPrompt', () => {
  it('retourne 2 blocs : stable avec cache_control, dynamique sans', () => {
    const blocks = splitSystemPrompt('STABLE_PROMPT', 'Heure : 14h32');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: 'text',
      text: 'STABLE_PROMPT',
      cache_control: { type: 'ephemeral' },
    });
    expect(blocks[1]).toEqual({
      type: 'text',
      text: 'Heure : 14h32',
    });
    expect(blocks[1]).not.toHaveProperty('cache_control');
  });

  it('retourne 1 bloc si dynamic vide', () => {
    const blocks = splitSystemPrompt('STABLE', '');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.cache_control).toEqual({ type: 'ephemeral' });
  });
});

// ============================================================
// callAnthropic — cache_control auto
// ============================================================

describe('callAnthropic — cache_control', () => {
  it('applique cache_control auto sur system string', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('hello'));
    await callAnthropic({
      family: 'sonnet',
      system: 'SYSTEM_STABLE',
      messages: [{ role: 'user', content: 'salut' }],
      maxTokens: 100,
    });
    expect(mockCreate).toHaveBeenCalledOnce();
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call.system).toEqual([
      { type: 'text', text: 'SYSTEM_STABLE', cache_control: { type: 'ephemeral' } },
    ]);
  });

  it('split system stable + dynamique si dynamicSystem fourni', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('ok'));
    await callAnthropic({
      family: 'sonnet',
      system: 'STABLE',
      dynamicSystem: 'now=2026-05-19',
      messages: [{ role: 'user', content: 'x' }],
      maxTokens: 100,
    });
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call.system).toHaveLength(2);
    expect(call.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(call.system[1]).not.toHaveProperty('cache_control');
    expect(call.system[1].text).toBe('now=2026-05-19');
  });

  it('respecte un system array fourni par le caller (pas de modif)', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('ok'));
    const customSystem = [
      { type: 'text' as const, text: 'A', cache_control: { type: 'ephemeral' as const } },
      { type: 'text' as const, text: 'B' },
      { type: 'text' as const, text: 'C' },
    ];
    await callAnthropic({
      family: 'sonnet',
      system: customSystem,
      messages: [{ role: 'user', content: 'x' }],
      maxTokens: 100,
    });
    const call = mockCreate.mock.calls[0]?.[0];
    expect(call.system).toEqual(customSystem);
  });
});

// ============================================================
// callAnthropic — recordAnthropicUsage
// ============================================================

describe('callAnthropic — usage tracking', () => {
  it('appelle recordAnthropicUsage avec les bons tokens', async () => {
    mockCreate.mockResolvedValueOnce(
      makeResponse('hello', {
        input_tokens: 1234,
        output_tokens: 567,
        cache_read_input_tokens: 890,
      }),
    );
    await callAnthropic({
      family: 'haiku',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
    });
    expect(mockRecordUsage).toHaveBeenCalledOnce();
    expect(mockRecordUsage).toHaveBeenCalledWith({
      model: HAIKU_4_5,
      inputTokens: 1234,
      outputTokens: 567,
      cacheReadTokens: 890,
    });
  });

  it('utilise 0 si cache_read_input_tokens absent', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('ok'));
    await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
    });
    expect(mockRecordUsage).toHaveBeenCalledWith(
      expect.objectContaining({ cacheReadTokens: 0 }),
    );
  });
});

// ============================================================
// callAnthropic — retry réseau (429/500)
// ============================================================

describe('callAnthropic — retry réseau', () => {
  it('retry 3 fois sur 429 puis succès', async () => {
    mockCreate
      .mockRejectedValueOnce(makeApiError(429, 'rate limited'))
      .mockRejectedValueOnce(makeApiError(429, 'rate limited'))
      .mockResolvedValueOnce(makeResponse('ok'));

    const result = await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
      maxRetries: 3,
    });
    expect(result.networkRetries).toBe(2);
    expect(result.text).toBe('ok');
    expect(mockCreate).toHaveBeenCalledTimes(3);
  }, 20_000);

  it('retry sur 500 puis succès', async () => {
    mockCreate
      .mockRejectedValueOnce(makeApiError(500, 'server error'))
      .mockResolvedValueOnce(makeResponse('ok'));

    const result = await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
      maxRetries: 3,
    });
    expect(result.networkRetries).toBe(1);
  }, 20_000);

  it('throw après épuisement des retries', async () => {
    mockCreate
      .mockRejectedValueOnce(makeApiError(429, 'rate limited'))
      .mockRejectedValueOnce(makeApiError(429, 'rate limited'))
      .mockRejectedValueOnce(makeApiError(429, 'rate limited'));

    await expect(
      callAnthropic({
        family: 'sonnet',
        system: 'X',
        messages: [{ role: 'user', content: 'y' }],
        maxTokens: 100,
        maxRetries: 3,
      }),
    ).rejects.toThrow('rate limited');
    expect(mockCreate).toHaveBeenCalledTimes(3);
  }, 20_000);

  it('ne retry PAS sur 400 (non retryable)', async () => {
    mockCreate.mockRejectedValueOnce(makeApiError(400, 'bad request'));
    await expect(
      callAnthropic({
        family: 'sonnet',
        system: 'X',
        messages: [{ role: 'user', content: 'y' }],
        maxTokens: 100,
        maxRetries: 3,
      }),
    ).rejects.toThrow('bad request');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// callAnthropic — retry JSON
// ============================================================

describe('callAnthropic — retry JSON', () => {
  it('retry x1 si responseFormat=json et validator KO', async () => {
    mockCreate
      .mockResolvedValueOnce(makeResponse('pas du json'))
      .mockResolvedValueOnce(makeResponse('{"ok":true}'));

    const result = await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
      responseFormat: 'json',
    });
    expect(result.jsonRetryUsed).toBe(true);
    expect(result.text).toBe('{"ok":true}');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('pas de retry si JSON valide au premier coup', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('{"ok":true}'));
    const result = await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
      responseFormat: 'json',
    });
    expect(result.jsonRetryUsed).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('utilise jsonValidator custom si fourni', async () => {
    mockCreate
      .mockResolvedValueOnce(makeResponse('{"ok":true}')) // JSON valide mais validator custom refuse
      .mockResolvedValueOnce(makeResponse('{"status":"ready"}'));

    const customValidator = vi.fn((text: string) => text.includes('"status"'));

    const result = await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
      responseFormat: 'json',
      jsonValidator: customValidator,
    });
    expect(result.jsonRetryUsed).toBe(true);
    expect(customValidator).toHaveBeenCalledTimes(2);
  });

  it('record usage 2x si retry JSON déclenché', async () => {
    mockCreate
      .mockResolvedValueOnce(makeResponse('invalide'))
      .mockResolvedValueOnce(makeResponse('{"ok":true}'));
    await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
      responseFormat: 'json',
    });
    expect(mockRecordUsage).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// callAnthropic — modèles
// ============================================================

describe('callAnthropic — modèles', () => {
  it('résout sonnet → SONNET_4_6 par défaut', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('ok'));
    await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
    });
    expect(mockCreate.mock.calls[0]?.[0]?.model).toBe(SONNET_4_6);
  });

  it('résout haiku → HAIKU_4_5 par défaut', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('ok'));
    await callAnthropic({
      family: 'haiku',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
    });
    expect(mockCreate.mock.calls[0]?.[0]?.model).toBe(HAIKU_4_5);
  });

  it('respecte modelOverride explicite', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('ok'));
    await callAnthropic({
      family: 'sonnet',
      modelOverride: 'claude-test-model',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
    });
    expect(mockCreate.mock.calls[0]?.[0]?.model).toBe('claude-test-model');
  });

  it('respecte ANTHROPIC_MODEL_OVERRIDE_SONNET env', async () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = 'claude-sonnet-4-6';
    mockCreate.mockResolvedValueOnce(makeResponse('ok'));
    await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
    });
    expect(mockCreate.mock.calls[0]?.[0]?.model).toBe('claude-sonnet-4-6');
  });
});

// ============================================================
// callAnthropic — clé API + tools
// ============================================================

describe('callAnthropic — clé API + tools', () => {
  it('throw si ANTHROPIC_API_KEY manquante', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    resetAnthropicClient();
    await expect(
      callAnthropic({
        family: 'sonnet',
        system: 'X',
        messages: [{ role: 'user', content: 'y' }],
        maxTokens: 100,
      }),
    ).rejects.toThrow('ANTHROPIC_API_KEY');
  });

  it('throw si placeholder __TO_FILL__', async () => {
    process.env.ANTHROPIC_API_KEY = '__TO_FILL__';
    resetAnthropicClient();
    await expect(
      callAnthropic({
        family: 'sonnet',
        system: 'X',
        messages: [{ role: 'user', content: 'y' }],
        maxTokens: 100,
      }),
    ).rejects.toThrow('placeholder');
  });

  it('passe les tools si fournis', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('ok'));
    const tools = [
      { type: 'web_search_20250305' as const, name: 'web_search' as const, max_uses: 3 },
    ];
    await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
      tools,
    });
    expect(mockCreate.mock.calls[0]?.[0]?.tools).toEqual(tools);
  });

  it('n inclut PAS tools si non fourni', async () => {
    mockCreate.mockResolvedValueOnce(makeResponse('ok'));
    await callAnthropic({
      family: 'sonnet',
      system: 'X',
      messages: [{ role: 'user', content: 'y' }],
      maxTokens: 100,
    });
    expect(mockCreate.mock.calls[0]?.[0]?.tools).toBeUndefined();
  });
});
