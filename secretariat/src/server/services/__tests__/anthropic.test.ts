/**
 * Tests unitaires — services/anthropic.ts
 *
 * Stratégie : mock total de `@anthropic-ai/sdk`. Aucun appel réseau réel.
 * On vérifie :
 *  - parsing d'une réponse mock valide → CRDraft correctement typé
 *  - parsing d'une réponse malformée (JSON invalide) → AnthropicParseError
 *  - parsing d'un JSON ne respectant pas le schéma → AnthropicSchemaError
 *  - validation Zod du CRDraftSchema (accepte valide, rejette incomplet)
 *  - timeout : appel qui dépasse le timeout → AnthropicTimeoutError
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AnthropicParseError,
  AnthropicSchemaError,
  AnthropicTimeoutError,
  CRDraftSchema,
  ClaudeResponseSchema,
} from '../anthropic.types';

// ------------------------------------------------------------
// Mock du SDK Anthropic
// ------------------------------------------------------------
// On mock la classe default exportée. Chaque test configure le comportement
// de `messages.create` avant d'appeler `generateCR`.

const mockCreate = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      beta = {
        promptCaching: {
          messages: {
            create: mockCreate,
          },
        },
      };
      constructor(_opts: unknown) {
        // no-op
      }
    },
  };
});

// Mock du loader de system prompt — évite la lecture disque en test
vi.mock('../prompt-loader', () => {
  return {
    loadSystemPrompt: vi.fn(
      () =>
        'SYSTEM PROMPT MOCK — contenu fiscal de test de longueur suffisante pour passer les validations minimales du loader singleton.',
    ),
    resetPromptCacheForTests: vi.fn(),
    getSystemPromptPath: vi.fn(() => '/mock/path'),
  };
});

// ------------------------------------------------------------
// Env fake requis par getEnv() lors de l'appel generateCR
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
  DB_PATH: '/tmp/fake-not-used-in-this-test.db',
  SESSION_TTL_HOURS: '24',
};

// ------------------------------------------------------------
// Helpers : construction d'une réponse mock Anthropic
// ------------------------------------------------------------

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
      qualite_relation: 'Président opérationnel, partenaire récurrent',
    },
  ],
  objet: "Déjeuner de travail sur la stratégie Versimo Q3 2026",
  montant_ttc_eur: 180,
  etablissement_nom: 'Le Voltaire',
  section_1_objet_art_39_1:
    "La présente réunion, tenue le 8 avril 2026 au restaurant Le Voltaire, avait pour objet la revue des lancements Versimo Q3 2026. Elle s'inscrit dans le cadre des activités de Gradient One et répond à l'intérêt social de celle-ci au sens de l'Art. 39-1 du CGI. La charge y afférente, d'un montant de 180 € TTC, est exposée dans l'intérêt direct de l'exploitation.",
  section_2_points_abordes:
    "Les échanges ont porté sur les points suivants : (i) calendrier des lancements Q3 — Emmanuel Gomez a exposé les jalons clés ; (ii) allocation des ressources opérationnelles ; (iii) suivi commercial des prospects en cours.",
  section_3_decisions:
    "À l'issue de cet échange, il a été convenu que Gradient One lancerait la phase pilote Versimo le 15 juin 2026. Un point de suivi a été fixé au 30 avril.",
  section_4_suites_a_donner:
    "Préparer le dossier pilote Versimo — Responsable : Emmanuel Gomez, Président — Échéance : 30 avril 2026",
};

function buildMockAnthropicMessage(jsonText: string): unknown {
  return {
    id: 'msg_mock_01',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-5',
    stop_reason: 'end_turn',
    stop_sequence: null,
    content: [
      {
        type: 'text',
        text: jsonText,
      },
    ],
    usage: {
      input_tokens: 1200,
      output_tokens: 800,
      cache_creation_input_tokens: 1000,
      cache_read_input_tokens: 200,
    },
  };
}

// ------------------------------------------------------------
// Setup / teardown
// ------------------------------------------------------------

describe('services/anthropic', () => {
  beforeEach(async () => {
    // Reset env
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);

    // Reset mocks
    mockCreate.mockReset();

    // Reset singletons internes (env, client anthropic)
    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    const { resetAnthropicClientForTests } = await import('../anthropic');
    resetEnvForTests();
    resetLoggerForTests();
    resetAnthropicClientForTests();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);
  });

  // ----------------------------------------------------------
  // Schéma Zod (validation pure, sans appel API)
  // ----------------------------------------------------------

  describe('CRDraftSchema', () => {
    it('accepte un CR valide complet', () => {
      const result = CRDraftSchema.safeParse(VALID_CR);
      expect(result.success).toBe(true);
    });

    it('rejette un CR sans date_reunion', () => {
      const invalid = { ...VALID_CR, date_reunion: '' };
      const result = CRDraftSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejette un CR avec date au mauvais format', () => {
      const invalid = { ...VALID_CR, date_reunion: '08/04/2026' };
      const result = CRDraftSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejette un CR sans participants', () => {
      const invalid = { ...VALID_CR, participants: [] };
      const result = CRDraftSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejette un CR avec section_1 trop courte (< 50 chars)', () => {
      const invalid = { ...VALID_CR, section_1_objet_art_39_1: 'Trop court.' };
      const result = CRDraftSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('accepte un CR sans section_4 (null)', () => {
      const withoutSection4 = { ...VALID_CR, section_4_suites_a_donner: null };
      const result = CRDraftSchema.safeParse(withoutSection4);
      expect(result.success).toBe(true);
    });

    it('rejette un CR avec entite invalide', () => {
      const invalid = { ...VALID_CR, entite: 'XX' };
      const result = CRDraftSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // ClaudeResponseSchema (enveloppe clarification | ready)
  // ----------------------------------------------------------

  describe('ClaudeResponseSchema', () => {
    it('accepte une réponse "ready" avec cr non-null', () => {
      const response = {
        status: 'ready',
        clarification_question: null,
        detected_entite: 'GO',
        detected_type: 'dejeuner',
        cr: VALID_CR,
      };
      const result = ClaudeResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('accepte une réponse "needs_clarification" avec question non-null et cr=null', () => {
      const response = {
        status: 'needs_clarification',
        clarification_question: 'Qui est Bernard Marchand ? Titre et société ?',
        detected_entite: 'GO',
        detected_type: 'conseil',
        cr: null,
      };
      const result = ClaudeResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('rejette "ready" avec cr=null', () => {
      const response = {
        status: 'ready',
        clarification_question: null,
        detected_entite: 'GO',
        detected_type: 'dejeuner',
        cr: null,
      };
      const result = ClaudeResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('rejette "needs_clarification" sans question', () => {
      const response = {
        status: 'needs_clarification',
        clarification_question: null,
        detected_entite: null,
        detected_type: null,
        cr: null,
      };
      const result = ClaudeResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // generateCR — flow complet avec SDK mocké
  // ----------------------------------------------------------

  describe('generateCR', () => {
    it('parse une réponse mock valide et retourne un CRDraft + usage', async () => {
      const { generateCR } = await import('../anthropic');

      const validJson = JSON.stringify({
        status: 'ready',
        clarification_question: null,
        detected_entite: 'GO',
        detected_type: 'dejeuner',
        cr: VALID_CR,
      });
      mockCreate.mockResolvedValueOnce(buildMockAnthropicMessage(validJson));

      const result = await generateCR({
        rawInput: 'Déjeuner avec Emmanuel Gomez au Voltaire, 180€ TTC, Versimo Q3.',
        userPhone: 'thomas',
      });

      expect(result.response.status).toBe('ready');
      expect(result.response.cr).not.toBeNull();
      expect(result.response.cr?.entite).toBe('GO');
      expect(result.response.cr?.montant_ttc_eur).toBe(180);
      expect(result.usage.inputTokens).toBe(1200);
      expect(result.usage.outputTokens).toBe(800);
      expect(result.usage.cacheReadInputTokens).toBe(200);
      expect(result.usage.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('gère une réponse "needs_clarification" correctement', async () => {
      const { generateCR } = await import('../anthropic');

      const clarifyJson = JSON.stringify({
        status: 'needs_clarification',
        clarification_question: 'Quelle est la date de la réunion ?',
        detected_entite: null,
        detected_type: null,
        cr: null,
      });
      mockCreate.mockResolvedValueOnce(buildMockAnthropicMessage(clarifyJson));

      const result = await generateCR({
        rawInput: 'Déjeuner avec Emmanuel.',
        userPhone: 'thomas',
      });

      expect(result.response.status).toBe('needs_clarification');
      expect(result.response.clarification_question).toBe(
        'Quelle est la date de la réunion ?',
      );
      expect(result.response.cr).toBeNull();
    });

    it('throw AnthropicParseError sur JSON malformé', async () => {
      const { generateCR } = await import('../anthropic');

      mockCreate.mockResolvedValueOnce(
        buildMockAnthropicMessage('{ pas du json valide'),
      );

      await expect(
        generateCR({ rawInput: 'test', userPhone: 'thomas' }),
      ).rejects.toBeInstanceOf(AnthropicParseError);
    });

    it('throw AnthropicSchemaError sur JSON valide mais schéma incomplet', async () => {
      const { generateCR } = await import('../anthropic');

      const badJson = JSON.stringify({
        status: 'ready',
        // cr manquant → refinement échoue
        clarification_question: null,
        detected_entite: 'GO',
        detected_type: 'dejeuner',
        cr: null,
      });
      mockCreate.mockResolvedValueOnce(buildMockAnthropicMessage(badJson));

      await expect(
        generateCR({ rawInput: 'test', userPhone: 'thomas' }),
      ).rejects.toBeInstanceOf(AnthropicSchemaError);
    });

    it('throw AnthropicTimeoutError si l\'appel dépasse le timeout', async () => {
      // On mock un appel qui ne résout jamais. withTimeout() va appeler
      // abortController.abort() puis reject avec AnthropicTimeoutError via
      // Promise.race. Pour éviter une unhandled rejection tardive (la promesse
      // mock reste pendante à jamais), on attache un handler vide dessus
      // côté mock directement.
      vi.useFakeTimers();
      const { generateCR } = await import('../anthropic');

      const neverResolving = new Promise<never>(() => {
        /* never resolves, never rejects */
      });
      // Empêche node de signaler une unhandledRejection même si un jour
      // quelqu'un rejette cette promesse.
      neverResolving.catch(() => {
        /* swallow */
      });

      mockCreate.mockImplementationOnce(() => neverResolving);

      const promise = generateCR({ rawInput: 'test timeout', userPhone: 'thomas' });
      // Guard handler immédiat pour capturer le reject de manière déterministe
      const guarded = promise.then(
        (v: unknown) => ({ ok: true, value: v }),
        (err: unknown) => ({ ok: false, err }),
      );

      await vi.advanceTimersByTimeAsync(61_000);
      const outcome = await guarded;

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.err).toBeInstanceOf(AnthropicTimeoutError);
      }

      vi.useRealTimers();
    });

    it('envoie les contacts fournis dans le formatContactsBlock', async () => {
      const { generateCR } = await import('../anthropic');

      const validJson = JSON.stringify({
        status: 'ready',
        clarification_question: null,
        detected_entite: 'GO',
        detected_type: 'dejeuner',
        cr: VALID_CR,
      });
      mockCreate.mockResolvedValueOnce(buildMockAnthropicMessage(validJson));

      await generateCR({
        rawInput: 'Déjeuner avec Emmanuel.',
        userPhone: 'thomas',
        contacts: [
          {
            id: 'contact-1',
            prenom: 'Emmanuel',
            nom: 'Gomez',
            titre: 'Président',
            societe: 'Gradient One',
            entites_visibles: ['GO', 'VI', 'VV'],
          },
        ],
      });

      expect(mockCreate).toHaveBeenCalledOnce();
      const callArgs = mockCreate.mock.calls[0]?.[0] as {
        system: Array<{ type: string; text: string; cache_control?: unknown }>;
      };
      expect(callArgs.system).toHaveLength(2);
      expect(callArgs.system[1]?.text).toContain('Emmanuel Gomez');
      expect(callArgs.system[1]?.text).toContain('Président, Gradient One');
      expect(callArgs.system[0]?.cache_control).toEqual({ type: 'ephemeral' });
      expect(callArgs.system[1]?.cache_control).toEqual({ type: 'ephemeral' });
    });
  });
});
