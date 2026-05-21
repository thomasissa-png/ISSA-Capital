/**
 * Wrapper Anthropic unifié — source unique pour tous les appels LLM secretariat.
 *
 * Pourquoi : audit @ia S16 (W1) — 3 appels dans `webhook/route.ts` sans
 * `cache_control` ni `recordAnthropicUsage()` faisaient sous-estimer la facture
 * Anthropic de 60-80%. Ce wrapper applique les deux par défaut.
 *
 * Garanties :
 *  1. `cache_control: ephemeral` AUTO sur le system prompt stable.
 *  2. `recordAnthropicUsage()` appelé systématiquement (input/output/cache).
 *  3. Modèles centralisés (`models.ts`) + override par env.
 *  4. Retry exponentiel 3x sur 429/500.
 *  5. Retry x1 sur JSON invalide si `responseFormat: 'json'`.
 *  6. Cas `dynamicSystem` : partie stable cache_control, partie dynamique
 *     concaténée comme dernier system block sans cache.
 *
 * Référence : `docs/ia/anya-audit-s16.md` R1 (4h budget).
 *
 * Anti-pattern interdit : appeler `client.messages.create()` directement
 * dans `secretariat/` ou `app/api/telegram/`. Toujours passer par `callAnthropic`.
 */

import Anthropic from '@anthropic-ai/sdk';
import { recordAnthropicUsage } from '../health-monitor/anthropic-usage';
import { resolveModelByFamily, type ModelFamily } from './models';

// ============================================================
// Client singleton lazy
// ============================================================

let cachedClient: Anthropic | null = null;

/**
 * Retourne le client Anthropic singleton.
 * Valide la clé API (rejette les placeholders __TO_FILL__).
 * Exposé pour les tests qui veulent réinitialiser le cache.
 */
export function getAnthropicClient(): Anthropic {
  if (cachedClient !== null) {
    return cachedClient;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === '__TO_FILL__' || apiKey.trim().length === 0) {
    throw new Error('ANTHROPIC_API_KEY manquante ou placeholder');
  }
  cachedClient = new Anthropic({ apiKey, maxRetries: 0 });
  return cachedClient;
}

/**
 * Réinitialise le client cache (tests uniquement).
 */
export function resetAnthropicClient(): void {
  cachedClient = null;
}

// ============================================================
// Types
// ============================================================

type AnthropicTool = Anthropic.Messages.Tool | Anthropic.Messages.WebSearchTool20250305;
type AnthropicMessageParam = Anthropic.Messages.MessageParam;
type AnthropicMessage = Anthropic.Messages.Message;

export interface CallAnthropicOptions {
  /** Famille de modèle (override env appliqué par `models.ts`). */
  family: ModelFamily;
  /** Override explicite du model ID (court-circuite la famille). */
  modelOverride?: string;
  /**
   * System prompt. Si string → tout en cache_control (sauf si `dynamicSystem`).
   * Si array → caller responsable de placer ses propres `cache_control`.
   */
  system: string | Anthropic.Messages.TextBlockParam[];
  /**
   * Partie dynamique du system (heure courante, instructions volatiles).
   * Concaténée APRES le system stable, sans cache_control.
   * Requiert `system` en string.
   */
  dynamicSystem?: string;
  /** Messages utilisateur/assistant. */
  messages: AnthropicMessageParam[];
  /** Tokens max output. */
  maxTokens: number;
  /** Outils Anthropic (web_search, etc.). */
  tools?: AnthropicTool[];
  /** Timeout par tentative (ms). Défaut 30_000. */
  timeoutMs?: number;
  /** AbortSignal externe (composable avec timeout interne). */
  signal?: AbortSignal;
  /**
   * Format attendu — si 'json' active le retry x1 sur JSON invalide.
   * Le wrapper ne parse pas le JSON lui-même (caller responsable).
   */
  responseFormat?: 'json' | 'text';
  /**
   * Validateur custom pour le retry JSON. Si fourni et retourne `false`,
   * un retry est déclenché avec un prompt de correction.
   * Si non fourni, validation par défaut = parsing JSON via `JSON.parse`.
   */
  jsonValidator?: (rawText: string) => boolean;
  /** Nombre max de tentatives sur 429/500. Défaut 3. */
  maxRetries?: number;
}

export interface CallAnthropicResult {
  /** Message brut Anthropic (content, usage, stop_reason...). */
  message: AnthropicMessage;
  /** Texte concaténé des blocs `text` (helper). */
  text: string;
  /** Nombre de retries réseau effectués (429/500). */
  networkRetries: number;
  /** Indique si le retry JSON a été déclenché. */
  jsonRetryUsed: boolean;
}

// ============================================================
// Helpers prompt split
// ============================================================

/**
 * Construit un system prompt en 2 blocs :
 *  - bloc stable avec `cache_control: ephemeral`
 *  - bloc dynamique sans cache (heure courante, contexte volatile)
 *
 * Pattern Anthropic standard pour préserver le cache hit malgré
 * une partie variable du prompt.
 *
 * @example
 *   const system = splitSystemPrompt(secretariatPrompt, `Heure : ${now}`);
 *   await callAnthropic({ system, ... });
 */
export function splitSystemPrompt(
  stable: string,
  dynamic: string,
): Anthropic.Messages.TextBlockParam[] {
  const blocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: 'text',
      text: stable,
      cache_control: { type: 'ephemeral' },
    },
  ];
  if (dynamic && dynamic.length > 0) {
    blocks.push({ type: 'text', text: dynamic });
  }
  return blocks;
}

// ============================================================
// Helpers internes
// ============================================================

function buildSystemBlocks(
  opts: CallAnthropicOptions,
): Anthropic.Messages.TextBlockParam[] | string {
  // Caller a passé un array → respecter tel quel (responsabilité caller).
  if (Array.isArray(opts.system)) {
    return opts.system;
  }
  // dynamicSystem défini → split stable/dynamic.
  if (opts.dynamicSystem !== undefined) {
    return splitSystemPrompt(opts.system, opts.dynamicSystem);
  }
  // System string seul → 1 bloc avec cache_control auto.
  return [
    {
      type: 'text',
      text: opts.system,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

function extractText(message: AnthropicMessage): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === 'text') {
      parts.push(block.text);
    }
  }
  return parts.join('\n').trim();
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    return status === 429 || status >= 500;
  }
  // Erreurs réseau bas niveau
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('econnreset') || msg.includes('etimedout') || msg.includes('socket hang up');
  }
  return false;
}

function backoffDelayMs(attempt: number): number {
  // 1s, 2s, 4s
  return 1000 * Math.pow(2, attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultJsonValidator(rawText: string): boolean {
  if (!rawText) return false;
  // Extraction permissive : bloc ```json ... ``` ou objet brut.
  const blockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidate = blockMatch?.[1]?.trim() ?? rawText.match(/\{[\s\S]*\}/)?.[0]?.trim() ?? null;
  if (!candidate) return false;
  try {
    JSON.parse(candidate);
    return true;
  } catch {
    return false;
  }
}

function recordUsage(message: AnthropicMessage, model: string): void {
  // Mock-friendly : si `usage` absent (test mock partiel), skip silencieusement.
  // En prod l'API Anthropic renvoie toujours `usage`.
  if (!message.usage) return;

  try {
    const usage = message.usage as unknown as {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    void recordAnthropicUsage({
      model,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    });
  } catch (err) {
    console.warn('[llm/client] recordAnthropicUsage failed', err);
  }
}

// ============================================================
// Appel principal
// ============================================================

/**
 * Appel Anthropic unifié.
 *
 * @throws {Error} `ANTHROPIC_API_KEY manquante` si pas de clé valide
 * @throws {Anthropic.APIError} si retries 429/500 épuisés ou 4xx non retryable
 */
export async function callAnthropic(
  opts: CallAnthropicOptions,
): Promise<CallAnthropicResult> {
  const client = getAnthropicClient();
  const model = opts.modelOverride ?? resolveModelByFamily(opts.family);
  const system = buildSystemBlocks(opts);
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxRetries = opts.maxRetries ?? 3;

  let networkRetries = 0;
  let jsonRetryUsed = false;

  // Boucle retry réseau
  let lastErr: unknown = null;
  let message: AnthropicMessage | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Compose avec signal externe si fourni.
    const onExternalAbort = (): void => controller.abort();
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const params: Anthropic.Messages.MessageCreateParamsNonStreaming = {
        model,
        max_tokens: opts.maxTokens,
        system,
        messages: opts.messages,
      };
      if (opts.tools && opts.tools.length > 0) {
        params.tools = opts.tools as Anthropic.Messages.ToolUnion[];
      }
      message = await client.messages.create(params, { signal: controller.signal });
      break;
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || attempt === maxRetries - 1) {
        throw err;
      }
      networkRetries += 1;
      await sleep(backoffDelayMs(attempt));
    } finally {
      clearTimeout(timer);
      if (opts.signal) {
        opts.signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  if (!message) {
    // Sécurité défensive — la boucle aurait dû throw.
    throw lastErr instanceof Error ? lastErr : new Error('Anthropic call failed without error');
  }

  // Tracking usage (toujours, même si retry JSON suit).
  recordUsage(message, model);

  let text = extractText(message);

  // Retry x1 sur JSON invalide si demandé.
  if (opts.responseFormat === 'json') {
    const validator = opts.jsonValidator ?? defaultJsonValidator;
    if (!validator(text)) {
      jsonRetryUsed = true;
      const correctionPrompt = `Le JSON que tu as renvoyé est invalide ou mal formé. Renvoie UNIQUEMENT un objet JSON valide, sans texte avant ni après, sans bloc markdown.`;
      const retryMessages: AnthropicMessageParam[] = [
        ...opts.messages,
        { role: 'assistant', content: text || '(vide)' },
        { role: 'user', content: correctionPrompt },
      ];
      const retryController = new AbortController();
      const retryTimer = setTimeout(() => retryController.abort(), timeoutMs);
      try {
        const retryParams: Anthropic.Messages.MessageCreateParamsNonStreaming = {
          model,
          max_tokens: opts.maxTokens,
          system,
          messages: retryMessages,
        };
        if (opts.tools && opts.tools.length > 0) {
          retryParams.tools = opts.tools as Anthropic.Messages.ToolUnion[];
        }
        const retryMessage = await client.messages.create(retryParams, {
          signal: retryController.signal,
        });
        recordUsage(retryMessage, model);
        const retryText = extractText(retryMessage);
        if (validator(retryText)) {
          message = retryMessage;
          text = retryText;
        }
      } catch (err) {
        console.warn('[llm/client] retry JSON échoué', err instanceof Error ? err.message : err);
      } finally {
        clearTimeout(retryTimer);
      }
    }
  }

  return { message, text, networkRetries, jsonRetryUsed };
}
