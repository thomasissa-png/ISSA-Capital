/**
 * Service WhatsApp Cloud API (Phase 2).
 *
 * Responsabilités :
 *  - Appel sortant `POST graph.facebook.com/v21.0/{PHONE_ID}/messages`
 *    pour envoyer des messages texte et interactifs (boutons).
 *  - Parsing strict du payload webhook entrant via Zod.
 *  - Timeout explicite 10s via AbortController (règle fullstack agent).
 *  - Retry exponentiel (2 tentatives supplémentaires, backoff 1s/2s) sur
 *    erreurs réseau et HTTP 5xx. PAS de retry sur 4xx (auth/payload).
 *  - Logging Pino — la clé Bearer est déjà en redaction globale (logger.ts).
 *
 * Sécurité :
 *  - `env.WHATSAPP_CLOUD_API_TOKEN` n'est JAMAIS passé à un log.*.
 *  - Les payloads Meta entrants sont absorbés par un schéma `.passthrough()`
 *    pour tolérer les évolutions mineures de la Cloud API.
 *
 * Sources :
 *  - docs/ia/secretariat-architecture.md Section 7 (webhook, envoi, limites).
 *  - Meta Cloud API v21.0 : https://developers.facebook.com/docs/whatsapp/cloud-api/
 */

import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';
import {
  WhatsAppConfigError,
  WhatsAppHttpError,
  WhatsAppIncomingMessageSchema,
  WhatsAppParseError,
  WhatsAppTimeoutError,
  WhatsAppWebhookPayloadSchema,
  type WhatsAppIncomingMessage,
  type WhatsAppSendInteractiveButtonsPayload,
  type WhatsAppSendResult,
  type WhatsAppSendTextPayload,
} from './whatsapp.types';

// ============================================================
// Constantes
// ============================================================

/** API Meta Cloud version. */
const META_API_VERSION = 'v21.0';
/** Timeout par tentative (10s — règle agent @fullstack pour APIs tierces). */
const TIMEOUT_MS = 10_000;
/** Nombre max de tentatives (1 initiale + 2 retries). */
const MAX_ATTEMPTS = 3;
/** Backoff indexé par tentative pour les retries (2e puis 3e). */
const BACKOFF_MS = [1_000, 2_000] as const;
/** Taille max du preview de body loggé en cas d'erreur. */
const BODY_PREVIEW_MAX = 500;
/** Limite Meta sur un message texte. */
const WHATSAPP_TEXT_MAX = 4096;

// ============================================================
// Helpers internes
// ============================================================

async function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function previewBody(body: string): string {
  if (body.length <= BODY_PREVIEW_MAX) {
    return body;
  }
  return `${body.slice(0, BODY_PREVIEW_MAX)}… [truncated, ${body.length} chars total]`;
}

/**
 * Retry policy identique à craft.ts : 5xx + 408 + 429 sont retriables.
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

/**
 * Valide la configuration WhatsApp — throw `WhatsAppConfigError` si absente.
 * En Phase 2 les credentials restent OPTIONNELS dans env.ts pour laisser
 * Thomas les remplir plus tard sans casser le pipeline CI. Cette fonction
 * enforce leur présence AU MOMENT de l'appel (pas au démarrage).
 */
function requireWhatsAppConfig(): {
  token: string;
  phoneId: string;
} {
  const env = getEnv();
  if (
    env.WHATSAPP_CLOUD_API_TOKEN === undefined ||
    env.WHATSAPP_CLOUD_API_TOKEN.trim() === '' ||
    env.WHATSAPP_CLOUD_API_TOKEN === '__TO_FILL__'
  ) {
    throw new WhatsAppConfigError(
      'WHATSAPP_CLOUD_API_TOKEN manquant ou placeholder — impossible d\'appeler Meta',
    );
  }
  if (
    env.WHATSAPP_PHONE_ID === undefined ||
    env.WHATSAPP_PHONE_ID.trim() === '' ||
    env.WHATSAPP_PHONE_ID === '__TO_FILL__'
  ) {
    throw new WhatsAppConfigError(
      'WHATSAPP_PHONE_ID manquant ou placeholder — impossible d\'appeler Meta',
    );
  }
  return {
    token: env.WHATSAPP_CLOUD_API_TOKEN,
    phoneId: env.WHATSAPP_PHONE_ID,
  };
}

/**
 * Normalise un numéro destinataire :
 *  - accepte "+33612345678" ou "33612345678"
 *  - retourne toujours SANS le "+" (format attendu par Meta)
 */
function normalizeRecipient(to: string): string {
  return to.startsWith('+') ? to.slice(1) : to;
}

// ============================================================
// Options d'appel (pour injection tests)
// ============================================================

export interface SendOptions {
  /** Timeout custom (tests). */
  timeoutMs?: number;
  /** Nombre max de tentatives (tests). */
  maxAttempts?: number;
  /** Sleep no-op pour accélérer les tests. */
  sleep?: (ms: number) => Promise<void>;
}

// ============================================================
// Appel Meta générique (factorisation send text + send interactive)
// ============================================================

async function postToMeta(
  body: WhatsAppSendTextPayload | WhatsAppSendInteractiveButtonsPayload,
  options: SendOptions,
): Promise<WhatsAppSendResult> {
  const log = getLogger();
  const { token, phoneId } = requireWhatsAppConfig();

  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const sleep = options.sleep ?? defaultSleep;

  const url = `https://graph.facebook.com/${META_API_VERSION}/${phoneId}/messages`;
  const bodyJson = JSON.stringify(body);
  const startedAt = Date.now();

  let lastError: WhatsAppSendResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: bodyJson,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const rawBody = await response.text();

      if (!response.ok) {
        const shouldRetry =
          isRetriableHttpStatus(response.status) && attempt < maxAttempts;

        if (shouldRetry) {
          const backoff =
            BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0;
          log.warn(
            {
              httpStatus: response.status,
              attempt,
              nextRetryInMs: backoff,
              bodyPreview: previewBody(rawBody),
            },
            '[whatsapp] échec HTTP retriable — retry prévu',
          );
          await sleep(backoff);
          continue;
        }

        const err = new WhatsAppHttpError(
          response.status,
          `Meta API a répondu ${response.status}`,
          previewBody(rawBody),
        );
        log.error(
          {
            httpStatus: response.status,
            attempt,
            bodyPreview: previewBody(rawBody),
            durationMs: Date.now() - startedAt,
          },
          '[whatsapp] échec définitif envoi',
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

      // ---- Succès 2xx : extraire l'id Meta (optionnel) ----
      let messageId: string | undefined;
      try {
        const parsed = JSON.parse(rawBody) as {
          messages?: Array<{ id?: string }>;
        };
        messageId = parsed.messages?.[0]?.id;
      } catch {
        // Body non-JSON : toléré — Meta retourne toujours JSON en 2xx mais on
        // ne fait pas échouer pour autant si le send a bien passé HTTP 200.
      }

      const durationMs = Date.now() - startedAt;
      log.info(
        {
          attempt,
          httpStatus: response.status,
          durationMs,
          hasMessageId: messageId !== undefined,
        },
        '[whatsapp] message envoyé',
      );

      const result: WhatsAppSendResult = {
        success: true,
        httpStatus: response.status,
        durationMs,
        attempts: attempt,
      };
      if (messageId !== undefined) {
        result.messageId = messageId;
      }
      return result;
    } catch (err) {
      clearTimeout(timer);

      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('aborted'));

      if (isAbort) {
        const timeoutErr = new WhatsAppTimeoutError(timeoutMs);
        const shouldRetry = attempt < maxAttempts;
        if (shouldRetry) {
          const backoff =
            BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0;
          log.warn(
            { attempt, timeoutMs, nextRetryInMs: backoff },
            '[whatsapp] timeout — retry prévu',
          );
          await sleep(backoff);
          continue;
        }
        log.error(
          { attempt, timeoutMs, durationMs: Date.now() - startedAt },
          '[whatsapp] timeout définitif',
        );
        return {
          success: false,
          error: timeoutErr.message,
          durationMs: Date.now() - startedAt,
          attempts: attempt,
        };
      }

      // Erreur réseau (DNS, ECONNREFUSED, etc.)
      const errorMessage = err instanceof Error ? err.message : String(err);
      const shouldRetry = attempt < maxAttempts;

      if (shouldRetry) {
        const backoff =
          BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 0;
        log.warn(
          { attempt, errorMessage, nextRetryInMs: backoff },
          '[whatsapp] erreur réseau — retry prévu',
        );
        await sleep(backoff);
        continue;
      }

      log.error(
        { attempt, errorMessage, durationMs: Date.now() - startedAt },
        '[whatsapp] erreur réseau définitive',
      );
      return {
        success: false,
        error: `Erreur réseau WhatsApp : ${errorMessage}`,
        durationMs: Date.now() - startedAt,
        attempts: attempt,
      };
    }
  }

  return (
    lastError ?? {
      success: false,
      error: 'Échec inconnu (aucune tentative effectuée)',
      durationMs: Date.now() - startedAt,
      attempts: 0,
    }
  );
}

// ============================================================
// API publique
// ============================================================

/**
 * Envoie un message texte simple à un destinataire WhatsApp.
 *
 * Ne throw pas : retourne un `WhatsAppSendResult` dont le caller doit
 * tester `success`. Cohérent avec `publishToCraft` (service Phase 4).
 *
 * Si le texte dépasse 4096 caractères (limite Meta), il est tronqué et
 * suffixé `… [tronqué]` — le caller est responsable du split si nécessaire.
 */
export async function sendMessage(
  to: string,
  text: string,
  options: SendOptions = {},
): Promise<WhatsAppSendResult> {
  const safeText =
    text.length > WHATSAPP_TEXT_MAX
      ? `${text.slice(0, WHATSAPP_TEXT_MAX - 12)}… [tronqué]`
      : text;

  const payload: WhatsAppSendTextPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizeRecipient(to),
    type: 'text',
    text: {
      body: safeText,
      preview_url: false,
    },
  };

  return postToMeta(payload, options);
}

/**
 * Envoie un message interactif à 3 boutons pour la confirmation d'un brouillon.
 * Les ids de bouton encodent le draftId pour que le dispatcher webhook
 * puisse retrouver la session et router l'action (valider / modifier / annuler).
 */
export async function sendInteractiveConfirmation(
  to: string,
  draftId: string,
  previewText: string,
  options: SendOptions = {},
): Promise<WhatsAppSendResult> {
  // Meta limite le body interactif à ~1024 chars — on tronque sans suffixe
  // visible si dépassement (le preview complet est déjà envoyé en texte avant).
  const safeBody =
    previewText.length > 1024 ? `${previewText.slice(0, 1020)}…` : previewText;

  const payload: WhatsAppSendInteractiveButtonsPayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizeRecipient(to),
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: safeBody },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: { id: `validate:${draftId}`, title: 'Valider' },
          },
          {
            type: 'reply',
            reply: { id: `modify:${draftId}`, title: 'Modifier' },
          },
          {
            type: 'reply',
            reply: { id: `cancel:${draftId}`, title: 'Annuler' },
          },
        ],
      },
    },
  };

  return postToMeta(payload, options);
}

/**
 * Parse et valide un payload webhook entrant de Meta.
 *
 * Retourne la liste plate des messages entrants (aplatit entry[] → changes[] →
 * value.messages[]). Les changes hors `field === "messages"` (ex: "statuses")
 * sont ignorés silencieusement — ils ne sont pas des messages texte.
 *
 * @throws `WhatsAppParseError` si le payload ne matche pas le schéma Zod.
 */
export function parseWebhookPayload(body: unknown): WhatsAppIncomingMessage[] {
  const parsed = WhatsAppWebhookPayloadSchema.safeParse(body);
  if (!parsed.success) {
    const bodyPreview = previewBody(
      typeof body === 'string' ? body : JSON.stringify(body ?? {}),
    );
    throw new WhatsAppParseError(
      `Payload webhook WhatsApp invalide : ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ')}`,
      bodyPreview,
    );
  }

  const messages: WhatsAppIncomingMessage[] = [];
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') {
        continue;
      }
      const value = change.value;
      if (!value.messages || value.messages.length === 0) {
        continue;
      }
      for (const rawMessage of value.messages) {
        // Revalide strictement chaque message (le schéma entry est permissif).
        const msg = WhatsAppIncomingMessageSchema.safeParse(rawMessage);
        if (msg.success) {
          messages.push(msg.data);
        }
      }
    }
  }

  return messages;
}
