/**
 * Service Universign — horodatage RFC 3161 TSA (Phase 6).
 *
 * Rôle :
 *   Demander un timestamp token RFC 3161 pour une empreinte SHA-256.
 *   Ce token est une preuve cryptographique qu'un document existait à une
 *   date donnée, émise par une TSA (Time-Stamping Authority) qualifiée eIDAS.
 *
 *   On l'utilise pour sceller chaque CR publié (endpoint /publish) afin
 *   d'avoir une preuve opposable dans le cadre DGFiP / audit.
 *
 * API Universign (RFC 3161) :
 *   POST https://ws.universign.eu/tsa/post/
 *   Headers :
 *     Authorization: Basic <base64(apiKey:)>
 *     Content-Type: application/timestamp-query
 *   Body : requête RFC 3161 binaire (TimeStampReq ASN.1 DER)
 *   Réponse : RFC 3161 binaire (TimeStampResp ASN.1 DER)
 *
 * Fallback safe :
 *   Si `UNIVERSIGN_API_KEY` est absent OU vaut le placeholder `__TO_FILL__`,
 *   `requestTimestamp` jette `UniversignNotConfiguredError`. Les appelants
 *   (publish.ts, backfill job) catchent cette erreur spécifique et continuent
 *   sans timestamp — le CR est publié mais `rfc3161_token` reste NULL,
 *   et un job backfill pourra re-tenter plus tard.
 *
 * Retry :
 *   Retry exponentiel 2s / 4s sur erreurs réseau ou 5xx.
 *   Timeout global 30s par tentative.
 *
 * Sources :
 *   - docs/ia/secretariat-implementation-plan.md Phase 6 (Universign RFC 3161)
 *   - https://help.universign.com/hc/fr/articles/360011965819
 *   - https://datatracker.ietf.org/doc/html/rfc3161
 */

import { createHash } from 'node:crypto';

import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';

// ============================================================
// Erreurs typées
// ============================================================

/**
 * Jetée quand la TSA Universign n'est pas configurée (clé absente ou
 * placeholder). Les appelants doivent catcher cette erreur spécifique pour
 * implémenter un fallback safe (publish sans timestamp).
 */
export class UniversignNotConfiguredError extends Error {
  constructor(message = 'UNIVERSIGN_API_KEY absent ou placeholder') {
    super(message);
    this.name = 'UniversignNotConfiguredError';
  }
}

/** Jetée quand Universign retourne une erreur HTTP définitive (4xx). */
export class UniversignClientError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'UniversignClientError';
  }
}

/** Jetée quand Universign est injoignable après les retries. */
export class UniversignTimeoutError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
  ) {
    super(message);
    this.name = 'UniversignTimeoutError';
  }
}

// ============================================================
// Constantes
// ============================================================

const MAX_ATTEMPTS = 3;
const TIMEOUT_MS = 30_000;
const BACKOFF_SCHEDULE_MS = [0, 2_000, 4_000];
const PROVIDER_NAME = 'universign';
const PLACEHOLDER_VALUES = new Set(['', '__to_fill__', 'changeme', 'fake']);

// ============================================================
// Types retour
// ============================================================

export interface TimestampResult {
  /** Base64 du token RFC 3161 (TimeStampResp ASN.1 DER). */
  token: string;
  /** Nom de la TSA ('universign'). */
  provider: string;
  /** SHA-256 hex de l'input (pour traçabilité / audit). */
  sha256: string;
  /** Timestamp de la requête côté serveur (ISO 8601). */
  requestedAt: string;
  /** Nombre de tentatives effectuées. */
  attempts: number;
  /** Durée totale (ms). */
  durationMs: number;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Vérifie que la clé Universign est effectivement configurée (pas un
 * placeholder évident). Permet aux appelants de check sans catch.
 */
export function isConfigured(): boolean {
  const env = getEnv();
  const key = env.UNIVERSIGN_API_KEY;
  if (key === undefined || key === null) return false;
  if (PLACEHOLDER_VALUES.has(key.trim().toLowerCase())) return false;
  if (key.trim().length < 8) return false;
  return true;
}

/**
 * Encode une requête TimeStampReq RFC 3161 minimale en ASN.1 DER.
 *
 * Structure :
 *   TimeStampReq ::= SEQUENCE {
 *     version         INTEGER (1),
 *     messageImprint  MessageImprint,
 *     certReq         BOOLEAN DEFAULT FALSE
 *   }
 *
 *   MessageImprint ::= SEQUENCE {
 *     hashAlgorithm   AlgorithmIdentifier,
 *     hashedMessage   OCTET STRING
 *   }
 *
 *   AlgorithmIdentifier ::= SEQUENCE {
 *     algorithm  OBJECT IDENTIFIER (sha256 = 2.16.840.1.101.3.4.2.1),
 *     parameters NULL
 *   }
 *
 * On construit le DER à la main pour éviter une dépendance à node-forge.
 */
function buildTimestampRequest(sha256Hex: string): Buffer {
  const hashBytes = Buffer.from(sha256Hex, 'hex');
  if (hashBytes.length !== 32) {
    throw new Error('[universign] sha256 doit faire 32 bytes (64 hex)');
  }

  // OID SHA-256 : 2.16.840.1.101.3.4.2.1
  // Encoded DER: 06 09 60 86 48 01 65 03 04 02 01
  const sha256Oid = Buffer.from([
    0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
  ]);
  // NULL parameters: 05 00
  const nullParams = Buffer.from([0x05, 0x00]);
  // AlgorithmIdentifier SEQUENCE
  const algIdContent = Buffer.concat([sha256Oid, nullParams]);
  const algId = derSequence(algIdContent);

  // OCTET STRING (hashed message)
  const hashOctetString = derOctetString(hashBytes);

  // MessageImprint SEQUENCE
  const messageImprint = derSequence(Buffer.concat([algId, hashOctetString]));

  // INTEGER version = 1
  const version = Buffer.from([0x02, 0x01, 0x01]);

  // certReq BOOLEAN DEFAULT FALSE → on ne l'encode pas (default)
  // Mais certaines TSAs préfèrent explicitement TRUE pour recevoir le certif.
  // On envoie TRUE = 01 01 FF.
  const certReq = Buffer.from([0x01, 0x01, 0xff]);

  // TimeStampReq SEQUENCE
  return derSequence(Buffer.concat([version, messageImprint, certReq]));
}

/** Encode une SEQUENCE DER autour d'un contenu. */
function derSequence(content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0x30]), derLength(content.length), content]);
}

/** Encode une OCTET STRING DER autour d'un buffer. */
function derOctetString(content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0x04]), derLength(content.length), content]);
}

/** Encode une longueur DER (short ou long form). */
function derLength(len: number): Buffer {
  if (len < 0x80) {
    return Buffer.from([len]);
  }
  if (len < 0x100) {
    return Buffer.from([0x81, len]);
  }
  if (len < 0x10000) {
    return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
  }
  throw new Error('[universign] longueur DER > 65535 non supportée');
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// ============================================================
// API publique
// ============================================================

/**
 * Calcule le SHA-256 d'une chaîne UTF-8 et retourne l'hex.
 */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Demande un timestamp RFC 3161 à Universign pour l'empreinte SHA-256 fournie.
 *
 * @param sha256 SHA-256 hex (64 caractères).
 * @throws UniversignNotConfiguredError si la clé API est absente/placeholder
 * @throws UniversignClientError si Universign retourne 4xx définitif
 * @throws UniversignTimeoutError si toutes les tentatives échouent
 */
export async function requestTimestamp(
  sha256: string,
): Promise<TimestampResult> {
  if (!isConfigured()) {
    throw new UniversignNotConfiguredError();
  }

  const env = getEnv();
  const apiKey = env.UNIVERSIGN_API_KEY as string;
  const apiUrl = env.UNIVERSIGN_API_URL;
  const log = getLogger();
  const startTime = Date.now();
  const requestedAt = new Date().toISOString();

  if (!/^[0-9a-f]{64}$/i.test(sha256)) {
    throw new Error('[universign] sha256 doit être un hex de 64 caractères');
  }

  const requestBody = buildTimestampRequest(sha256.toLowerCase());
  const authHeader = `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const backoff = BACKOFF_SCHEDULE_MS[attempt - 1] ?? 0;
    if (backoff > 0) {
      log.warn(
        { attempt, backoff },
        '[universign] retry avec backoff',
      );
      await sleep(backoff);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, TIMEOUT_MS);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/timestamp-query',
          Accept: 'application/timestamp-reply',
        },
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status >= 400 && response.status < 500) {
        // Erreur client — pas de retry, on throw direct
        const text = await response.text().catch(() => '');
        throw new UniversignClientError(
          `Universign HTTP ${response.status}: ${text.slice(0, 200)}`,
          response.status,
        );
      }

      if (!response.ok) {
        // 5xx → on laisse le retry faire son job
        lastError = new Error(`Universign HTTP ${response.status}`);
        log.warn(
          { attempt, status: response.status },
          '[universign] réponse 5xx, retry',
        );
        continue;
      }

      const respBuffer = Buffer.from(await response.arrayBuffer());
      if (respBuffer.length === 0) {
        lastError = new Error('Universign response body empty');
        continue;
      }

      const token = respBuffer.toString('base64');
      const durationMs = Date.now() - startTime;

      log.info(
        { sha256: sha256.slice(0, 16), attempt, durationMs, bytes: respBuffer.length },
        '[universign] timestamp obtenu',
      );

      return {
        token,
        provider: PROVIDER_NAME,
        sha256,
        requestedAt,
        attempts: attempt,
        durationMs,
      };
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof UniversignClientError) {
        throw err; // pas de retry sur 4xx
      }

      lastError = err instanceof Error ? err : new Error(String(err));
      log.warn(
        { attempt, err: lastError.message },
        '[universign] tentative échouée',
      );
    }
  }

  throw new UniversignTimeoutError(
    `Universign injoignable après ${MAX_ATTEMPTS} tentatives: ${lastError?.message ?? 'unknown'}`,
    MAX_ATTEMPTS,
  );
}
