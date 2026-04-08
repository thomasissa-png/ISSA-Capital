/**
 * Service Anthropic — wrapper SDK officiel @anthropic-ai/sdk (Phase 3).
 *
 * Responsabilités :
 *  - Construire la requête Messages API avec le system prompt fiscal + cache control
 *  - Exécuter l'appel avec timeout explicite (60s — Claude peut être lent sur un CR long)
 *  - Parser la réponse JSON et la valider via Zod (ClaudeResponseSchema)
 *  - Mesurer la latence et les tokens consommés (cache included)
 *  - Logger via Pino SANS jamais exposer la clé API (redaction déjà en place)
 *
 * Ce module n'est JAMAIS appelé directement par les tests unitaires Vitest :
 * les tests mockent `@anthropic-ai/sdk` pour éviter tout appel réseau réel.
 *
 * Sources :
 *  - docs/ia/secretariat-system-prompt.md Section 2 (system prompt complet)
 *  - docs/ia/secretariat-system-prompt.md Section 6.2 (prompt caching)
 *  - docs/ia/secretariat-architecture.md Section 0 (modèle claude-sonnet-4-5)
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  PromptCachingBetaMessage,
  PromptCachingBetaMessageParam,
} from '@anthropic-ai/sdk/resources/beta/prompt-caching/messages';
import { ZodError } from 'zod';

import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';
import { loadSystemPrompt } from './prompt-loader';
import {
  AnthropicParseError,
  AnthropicSchemaError,
  AnthropicTimeoutError,
  ClaudeResponseSchema,
  type ClaudeResponse,
  type GenerateCRInput,
  type GenerateCRResult,
} from './anthropic.types';

// ============================================================
// Constantes
// ============================================================

/**
 * Timeout par appel Anthropic. 60s car un CR long peut prendre 20-30s de
 * génération, et on veut une marge pour le parsing + network.
 */
const ANTHROPIC_TIMEOUT_MS = 60_000;

/**
 * Instance client Anthropic — singleton lazy.
 * Permet aux tests de mocker `@anthropic-ai/sdk` sans instancier le vrai SDK.
 */
let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (cachedClient !== null) {
    return cachedClient;
  }
  const env = getEnv();
  cachedClient = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    // Le SDK gère son propre timeout + retries ; on ajoute un AbortController
    // par appel pour un timeout strict côté service.
    maxRetries: 2,
  });
  return cachedClient;
}

/**
 * Reset le client — utile en test pour forcer la recréation après mock.
 */
export function resetAnthropicClientForTests(): void {
  cachedClient = null;
}

// ============================================================
// Helpers privés
// ============================================================

/**
 * Formate la liste des contacts injectables en texte structuré pour Claude.
 * Ce bloc est ajouté comme second segment `system` avec cache_control ephemeral
 * pour bénéficier du prompt caching (cf Section 6.2 du livrable @ia).
 */
function formatContactsBlock(input: GenerateCRInput): string {
  if (!input.contacts || input.contacts.length === 0) {
    return '# DATABASE CONTACTS\n\n(aucun contact récurrent fourni pour cet appel)';
  }

  const lines = input.contacts.map((c) => {
    const titre = c.titre ?? '';
    const societe = c.societe ?? '';
    const entites =
      c.entites_visibles && c.entites_visibles.length > 0
        ? `(entités : ${c.entites_visibles.join(', ')})`
        : '';
    const notes = c.notes ? ` Notes : ${c.notes}` : '';
    const titreSociete = [titre, societe].filter((s) => s.length > 0).join(', ');
    const prefix = titreSociete.length > 0 ? ` — ${titreSociete}` : '';
    return `- ${c.prenom} ${c.nom}${prefix} ${entites}${notes}`.trim();
  });

  return `# DATABASE CONTACTS\n\n${lines.join('\n')}`;
}

/**
 * Extrait le texte JSON brut depuis une réponse Messages API Anthropic.
 * L'API retourne un tableau `content` dont chaque bloc peut être de type
 * `text`, `tool_use`, etc. On ne garde que les blocs de type `text`.
 */
function extractTextFromResponse(message: PromptCachingBetaMessage): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === 'text') {
      parts.push(block.text);
    }
  }
  const combined = parts.join('\n').trim();
  if (combined.length === 0) {
    throw new AnthropicParseError(
      'Réponse Anthropic vide : aucun bloc de type "text" retourné',
      JSON.stringify(message.content),
    );
  }
  return combined;
}

/**
 * Parse le texte brut en JSON et valide contre ClaudeResponseSchema.
 * Throw AnthropicParseError si le JSON est malformé,
 * AnthropicSchemaError si la structure ne matche pas le schéma.
 */
function parseAndValidateResponse(rawText: string): ClaudeResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new AnthropicParseError(
      `Réponse Claude non parseable en JSON : ${reason}`,
      rawText,
    );
  }

  try {
    return ClaudeResponseSchema.parse(parsed);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new AnthropicSchemaError(
        `Réponse Claude invalide vs schéma attendu : ${err.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(' ; ')}`,
        err.issues,
      );
    }
    throw err;
  }
}

/**
 * Exécute une promesse avec un timeout strict. Si la promesse ne résout
 * pas avant timeoutMs, throw AnthropicTimeoutError et abort le signal.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  abortController: AbortController,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      abortController.abort();
      reject(new AnthropicTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
}

// ============================================================
// API publique
// ============================================================

/**
 * Génère un CR (ou une question de clarification) à partir d'un input libre.
 *
 * Flow :
 *  1. Charge le system prompt fiscal (cache singleton après 1er appel)
 *  2. Formate le bloc contacts pour injection (avec cache_control ephemeral)
 *  3. Construit le message utilisateur (rawInput + historique éventuel)
 *  4. Appelle Anthropic.messages.create avec timeout 60s
 *  5. Extrait le texte, parse JSON, valide Zod
 *  6. Retourne { response, usage } — latence et tokens mesurés
 *
 * Erreurs remontées :
 *  - AnthropicTimeoutError : timeout 60s dépassé
 *  - AnthropicParseError : réponse non JSON
 *  - AnthropicSchemaError : JSON ne matche pas ClaudeResponseSchema
 *  - Toute autre erreur du SDK (401, 429, 500) est propagée telle quelle
 *    pour que l'appelant (routes/draft.ts) décide du retry ou de l'erreur 502.
 */
export async function generateCR(input: GenerateCRInput): Promise<GenerateCRResult> {
  const env = getEnv();
  const log = getLogger();
  const startTs = Date.now();

  // 1. Chargement system prompt (cache singleton)
  const systemPromptBase = loadSystemPrompt();

  // 2. Formatage contacts
  const contactsBlock = formatContactsBlock(input);

  // 3. Construction messages utilisateur
  const userMessages: PromptCachingBetaMessageParam[] = [];

  // Historique conversationnel (tours de clarification antérieurs)
  if (input.conversationHistory && input.conversationHistory.length > 0) {
    for (const turn of input.conversationHistory) {
      userMessages.push({
        role: turn.role,
        content: turn.content,
      });
    }
  }

  // Dernier message utilisateur : l'input courant
  userMessages.push({
    role: 'user',
    content: input.rawInput,
  });

  // 4. Appel API avec timeout
  const abortController = new AbortController();
  const client = getClient();

  log.info(
    {
      model: env.ANTHROPIC_MODEL,
      rawInputLen: input.rawInput.length,
      contactsCount: input.contacts?.length ?? 0,
      historyLen: input.conversationHistory?.length ?? 0,
      userPhone: input.userPhone,
    },
    '[anthropic] appel generateCR',
  );

  let message: PromptCachingBetaMessage;
  try {
    // On passe par l'endpoint beta.promptCaching.messages qui expose
    // cache_control ephemeral sur les blocs system et retourne les métriques
    // cache_creation_input_tokens / cache_read_input_tokens.
    message = await withTimeout(
      client.beta.promptCaching.messages.create(
        {
          model: env.ANTHROPIC_MODEL,
          max_tokens: env.ANTHROPIC_MAX_TOKENS,
          // Le system prompt est scindé en 2 segments avec cache_control ephemeral
          // (cf Section 6.2 du livrable @ia). Cache TTL Anthropic : 5 min.
          system: [
            {
              type: 'text',
              text: systemPromptBase,
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text: contactsBlock,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: userMessages,
        },
        {
          signal: abortController.signal,
        },
      ),
      ANTHROPIC_TIMEOUT_MS,
      abortController,
    );
  } catch (err) {
    const latencyMs = Date.now() - startTs;
    // Ne JAMAIS logger la clé API. Pino redact s'en charge, mais on prend
    // explicitement soin d'extraire uniquement les infos non sensibles.
    if (err instanceof AnthropicTimeoutError) {
      log.error({ latencyMs, timeoutMs: ANTHROPIC_TIMEOUT_MS }, '[anthropic] timeout');
    } else {
      log.error(
        {
          latencyMs,
          errName: err instanceof Error ? err.name : 'Unknown',
          errMessage: err instanceof Error ? err.message : String(err),
        },
        '[anthropic] appel échoué',
      );
    }
    throw err;
  }

  const latencyMs = Date.now() - startTs;

  // 5. Extraction + parsing + validation
  const rawText = extractTextFromResponse(message);
  const response = parseAndValidateResponse(rawText);

  // 6. Construction du résultat
  // cache_creation_input_tokens et cache_read_input_tokens peuvent être null
  // selon la réponse API → on normalise à 0.
  const usage: GenerateCRResult['usage'] = {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
    model: message.model,
    latencyMs,
  };

  log.info(
    {
      status: response.status,
      latencyMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheRead: usage.cacheReadInputTokens,
      cacheCreation: usage.cacheCreationInputTokens,
    },
    '[anthropic] generateCR ok',
  );

  return { response, usage };
}
