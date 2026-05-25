/**
 * Client DeepSeek — endpoint OpenAI-compatible `/chat/completions`.
 *
 * Fetch pur (aucune dépendance npm ajoutée). Calque la résilience du wrapper
 * Anthropic : retry exponentiel 3x sur 429/5xx, timeout via AbortController,
 * tracking systématique de l'usage (`recordDeepSeekUsage`).
 *
 * GARDE-FOU : aucun fallback cross-provider ici. Une erreur DeepSeek
 * (clé absente, 4xx non retryable, retries épuisés, timeout) est PROPAGÉE.
 *
 * Base URL : https://api.deepseek.com (override possible via DEEPSEEK_BASE_URL).
 * Clé : env DEEPSEEK_API_KEY (rejette vide / placeholder).
 *
 * Jalon S22 — routage DeepSeek par tâche.
 */

import { recordDeepSeekUsage } from '../health-monitor/deepseek-usage';

// ============================================================
// Types
// ============================================================

/** Message OpenAI-compatible (rôles supportés par nos tâches). */
interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallDeepSeekOptions {
  /** Modèle DeepSeek (ex `deepseek-v4-flash`). */
  model: string;
  /** System prompt stable. */
  system: string;
  /** Partie dynamique du system (concaténée après `system`). */
  dynamicSystem?: string;
  /** Messages user/assistant (contenu texte uniquement). */
  messages: OpenAIChatMessage[];
  /** Tokens max output. */
  maxTokens: number;
  /** 'json' → response_format json_object. Défaut 'text'. */
  responseFormat?: 'json' | 'text';
  /** Timeout par tentative (ms). Défaut 30_000. */
  timeoutMs?: number;
  /** Nombre max de tentatives sur 429/5xx. Défaut 3. */
  maxRetries?: number;
}

export interface CallDeepSeekResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  networkRetries: number;
}

// ============================================================
// Helpers
// ============================================================

function getBaseUrl(): string {
  const override = process.env.DEEPSEEK_BASE_URL;
  if (override && override.trim().length > 0) {
    return override.trim().replace(/\/+$/, '');
  }
  return 'https://api.deepseek.com';
}

/** Lit la clé API lazy ; échec VISIBLE si absente/placeholder. */
function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key || key === '__TO_FILL__' || key.trim().length === 0) {
    throw new Error('DEEPSEEK_API_KEY manquante ou placeholder');
  }
  return key.trim();
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function backoffDelayMs(attempt: number): number {
  return 1000 * Math.pow(2, attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Construit le payload OpenAI : un message system (system + dynamicSystem
 * concaténés), suivi des messages user/assistant.
 */
function buildMessages(opts: CallDeepSeekOptions): OpenAIChatMessage[] {
  const systemContent =
    opts.dynamicSystem && opts.dynamicSystem.length > 0
      ? `${opts.system}\n\n${opts.dynamicSystem}`
      : opts.system;
  return [{ role: 'system', content: systemContent }, ...opts.messages];
}

// ============================================================
// Appel principal
// ============================================================

/**
 * Appel DeepSeek `/chat/completions`.
 *
 * @throws {Error} `DEEPSEEK_API_KEY manquante` si pas de clé valide
 * @throws {Error} sur 4xx non retryable, retries 429/5xx épuisés, ou timeout
 */
export async function callDeepSeek(
  opts: CallDeepSeekOptions,
): Promise<CallDeepSeekResult> {
  const apiKey = getApiKey();
  const url = `${getBaseUrl()}/chat/completions`;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const maxRetries = opts.maxRetries ?? 3;

  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens,
    messages: buildMessages(opts),
  };
  if (opts.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  let networkRetries = 0;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        if (isRetryableStatus(res.status) && attempt < maxRetries - 1) {
          networkRetries += 1;
          await sleep(backoffDelayMs(attempt));
          continue;
        }
        throw new Error(`DeepSeek HTTP ${res.status} : ${detail.slice(0, 300)}`);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const text = json.choices?.[0]?.message?.content ?? '';
      const promptTokens = json.usage?.prompt_tokens ?? 0;
      const completionTokens = json.usage?.completion_tokens ?? 0;

      // Tracking systématique (mock-friendly : ne throw jamais).
      try {
        recordDeepSeekUsage({ model: opts.model, promptTokens, completionTokens });
      } catch (err) {
        console.warn('[llm/deepseek] recordDeepSeekUsage failed', err);
      }

      return { text: text.trim(), promptTokens, completionTokens, networkRetries };
    } catch (err) {
      lastErr = err;
      // Abort (timeout) ou erreur réseau → retry si tentatives restantes.
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const isNetwork =
        err instanceof TypeError ||
        (err instanceof Error &&
          /econnreset|etimedout|socket hang up|fetch failed/i.test(err.message));
      if ((isAbort || isNetwork) && attempt < maxRetries - 1) {
        networkRetries += 1;
        await sleep(backoffDelayMs(attempt));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error('DeepSeek call failed without error');
}
