/**
 * Service Craft API (Phase 4).
 *
 * Responsabilités :
 *  - Appel `POST {CRAFT_IC_BASE_URL}/blocks` avec auth Bearer.
 *  - Timeout explicite 30s via AbortController.
 *  - Retry exponentiel (2 tentatives supplémentaires, backoff 2s/4s) sur
 *    erreurs réseau et 5xx. PAS de retry sur 4xx (erreur de payload ou auth).
 *  - Logging Pino avec redaction automatique de la clé API.
 *  - Validation Zod permissive de la réponse + normalisation des identifiants.
 *
 * Sécurité :
 *  - La clé `env.CRAFT_IC_KEY` n'est JAMAIS logguée (redaction + précaution
 *    côté code : on ne passe jamais le header Authorization à log.*).
 *  - Le body de réponse Craft est tronqué à 500 chars en cas d'erreur pour
 *    éviter de polluer les logs avec des dumps HTML.
 *
 * Spec API :
 *  Base URL  : https://connect.craft.do/links/EgdwyOCC09S/api/v1
 *  Endpoint  : POST /blocks
 *  Auth      : Authorization: Bearer {CRAFT_IC_KEY}
 *  Body      : { "markdown": "...", "position": { "position": "end" } }
 *  (cf docs/BRIEF_CLAUDE_CODE_SECRETARIAT_ISSA.md)
 */

import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';
import {
  CraftApiResponseSchema,
  CraftHttpError,
  CraftResponseError,
  CraftTimeoutError,
  type CraftApiResponse,
  type CraftDocumentPayload,
  type CraftPublishResult,
} from './craft.types';

// ============================================================
// Constantes
// ============================================================

const TIMEOUT_MS = 30_000;
/** Nombre max de tentatives totales (1 initiale + 2 retries). */
const MAX_ATTEMPTS = 3;
/** Délais de backoff en millisecondes, indexés par tentative (2e et 3e). */
const BACKOFF_MS = [2_000, 4_000] as const;
/** Taille max du preview body loggé en cas d'erreur. */
const BODY_PREVIEW_MAX = 500;

// ============================================================
// Helpers
// ============================================================

/**
 * Délai async non-bloquant. Utilisé pour le backoff.
 * Exposé en paramètre pour être mockable en test (injection `sleep`).
 */
async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Tronque un body pour les logs (évite de dumper 5MB de HTML d'erreur).
 */
function previewBody(body: string): string {
  if (body.length <= BODY_PREVIEW_MAX) {
    return body;
  }
  return `${body.slice(0, BODY_PREVIEW_MAX)}… [truncated, ${body.length} chars total]`;
}

/**
 * Extrait l'identifiant Craft depuis la réponse (plusieurs shapes supportées).
 */
function extractCraftDocId(parsed: CraftApiResponse): string | undefined {
  return (
    parsed.id ??
    parsed.blockId ??
    parsed.block_id ??
    parsed.documentId ??
    parsed.document_id
  );
}

/**
 * Extrait une URL Craft depuis la réponse.
 */
function extractCraftUrl(parsed: CraftApiResponse): string | undefined {
  return parsed.url ?? parsed.permalink ?? parsed.webUrl;
}

/**
 * Détermine si un status HTTP est éligible au retry.
 * Retry : toute 5xx + 408 (Request Timeout) + 429 (rate limit — best effort).
 * Pas de retry : 4xx (sauf 408/429) — c'est un problème de payload/auth.
 */
function isRetriableHttpStatus(status: number): boolean {
  if (status >= 500 && status < 600) {
    return true;
  }
  if (status === 408 || status === 429) {
    return true;
  }
  return false;
}

// ============================================================
// Service principal
// ============================================================

export interface PublishOptions {
  /** Injection pour les tests — timeout custom. */
  timeoutMs?: number;
  /** Injection pour les tests — désactive les retries. */
  maxAttempts?: number;
  /** Injection pour les tests — sleep custom (0 en test pour ne pas attendre). */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Publie un document sur Craft.
 *
 * @returns Toujours un `CraftPublishResult` (ne throw pas) — le caller lit
 *   `result.success` pour décider de la suite. Cette API évite au caller
 *   d'avoir à wrap chaque appel dans un try/catch.
 */
export async function publishToCraft(
  payload: CraftDocumentPayload,
  options: PublishOptions = {},
): Promise<CraftPublishResult> {
  const env = getEnv();
  const log = getLogger();

  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;

  const url = `${env.CRAFT_IC_BASE_URL.replace(/\/$/, '')}/blocks`;
  const startedAt = Date.now();

  // Body minimal effectivement envoyé à Craft (les champs internal* restent locaux).
  const bodyJson = JSON.stringify({
    markdown: payload.markdown,
    position: payload.position,
  });

  let lastError: CraftPublishResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStartedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          // Ne JAMAIS inclure ce header dans un log — la redaction Pino
          // couvre `req.headers.authorization` mais ici on est côté client,
          // donc on ne logge tout simplement jamais cet objet.
          Authorization: `Bearer ${env.CRAFT_IC_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: bodyJson,
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Lecture du body quel que soit le status — on en a besoin pour
      // (a) logger un preview en cas d'erreur, (b) parser la réponse en cas de succès.
      const rawBody = await response.text();

      if (!response.ok) {
        // HTTP non-2xx : on distingue retriable vs non-retriable.
        const shouldRetry =
          isRetriableHttpStatus(response.status) && attempt < maxAttempts;

        if (shouldRetry) {
          const backoff = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0;
          log.warn(
            {
              httpStatus: response.status,
              attempt,
              nextRetryInMs: backoff,
              bodyPreview: previewBody(rawBody),
            },
            '[craft] échec HTTP retriable — retry prévu',
          );
          await sleep(backoff);
          continue;
        }

        // Échec définitif (4xx ou retries épuisés)
        const err = new CraftHttpError(
          response.status,
          `Craft API a répondu ${response.status}`,
          previewBody(rawBody),
        );
        log.error(
          {
            httpStatus: response.status,
            attempt,
            bodyPreview: previewBody(rawBody),
            durationMs: Date.now() - startedAt,
          },
          '[craft] échec définitif publication',
        );
        lastError = {
          success: false,
          error: err.message,
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
          attempts: attempt,
        };
        return lastError;
      }

      // ---- Succès HTTP 2xx : parser + valider la réponse ----
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawBody);
      } catch (parseErr) {
        const err = new CraftResponseError(
          `Craft a retourné un body non-JSON (${(parseErr as Error).message})`,
          previewBody(rawBody),
        );
        log.error(
          {
            attempt,
            bodyPreview: previewBody(rawBody),
            durationMs: Date.now() - startedAt,
          },
          '[craft] réponse non-JSON',
        );
        return {
          success: false,
          error: err.message,
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
          attempts: attempt,
        };
      }

      const validation = CraftApiResponseSchema.safeParse(parsedJson);
      if (!validation.success) {
        log.error(
          {
            attempt,
            issues: validation.error.issues,
            durationMs: Date.now() - startedAt,
          },
          '[craft] réponse non conforme au schéma Zod',
        );
        return {
          success: false,
          error: 'Réponse Craft non conforme au schéma attendu',
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
          attempts: attempt,
        };
      }

      const craftDocId = extractCraftDocId(validation.data);
      if (craftDocId === undefined) {
        log.error(
          {
            attempt,
            responseKeys: Object.keys(validation.data),
            durationMs: Date.now() - startedAt,
          },
          '[craft] réponse sans identifiant de document',
        );
        return {
          success: false,
          error:
            "Craft n'a pas retourné d'identifiant de document (aucun champ id/blockId/documentId)",
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
          attempts: attempt,
        };
      }

      const craftUrl = extractCraftUrl(validation.data);
      const durationMs = Date.now() - startedAt;

      log.info(
        {
          craftDocId,
          attempt,
          durationMs,
          httpStatus: response.status,
          hasUrl: craftUrl !== undefined,
          attemptLatencyMs: Date.now() - attemptStartedAt,
        },
        '[craft] publication réussie',
      );

      // Construction progressive pour respecter exactOptionalPropertyTypes :
      // on n'assigne `craftUrl` que si elle est définie.
      const successResult: CraftPublishResult = {
        success: true,
        craftDocId,
        httpStatus: response.status,
        durationMs,
        attempts: attempt,
      };
      if (craftUrl !== undefined) {
        successResult.craftUrl = craftUrl;
      }
      return successResult;
    } catch (err) {
      clearTimeout(timer);

      // AbortError = timeout déclenché par notre controller
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('aborted'));

      if (isAbort) {
        const timeoutErr = new CraftTimeoutError(timeoutMs);
        const shouldRetry = attempt < maxAttempts;
        if (shouldRetry) {
          const backoff = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0;
          log.warn(
            { attempt, timeoutMs, nextRetryInMs: backoff },
            '[craft] timeout — retry prévu',
          );
          await sleep(backoff);
          continue;
        }
        log.error(
          { attempt, timeoutMs, durationMs: Date.now() - startedAt },
          '[craft] timeout définitif',
        );
        return {
          success: false,
          error: timeoutErr.message,
          durationMs: Date.now() - startedAt,
          attempts: attempt,
        };
      }

      // Erreur réseau (DNS, ECONNREFUSED, etc.) → retriable
      const errorMessage = err instanceof Error ? err.message : String(err);
      const shouldRetry = attempt < maxAttempts;

      if (shouldRetry) {
        const backoff = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0;
        log.warn(
          { attempt, errorMessage, nextRetryInMs: backoff },
          '[craft] erreur réseau — retry prévu',
        );
        await sleep(backoff);
        continue;
      }

      log.error(
        { attempt, errorMessage, durationMs: Date.now() - startedAt },
        '[craft] erreur réseau définitive',
      );
      return {
        success: false,
        error: `Erreur réseau Craft : ${errorMessage}`,
        durationMs: Date.now() - startedAt,
        attempts: attempt,
      };
    }
  }

  // Fallback théoriquement inatteignable (toutes les branches de la boucle
  // return ou continue), mais on sécurise pour le type-checker.
  return (
    lastError ?? {
      success: false,
      error: 'Échec inconnu (aucune tentative effectuée)',
      durationMs: Date.now() - startedAt,
      attempts: 0,
    }
  );
}
