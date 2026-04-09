/**
 * Logger Pino configuré pour l'agent secrétariat.
 *
 * Règles de sécurité :
 * - Les secrets (clés API, tokens, mots de passe) sont automatiquement
 *   masqués via la configuration `redact`. Ne JAMAIS désactiver.
 * - Format pretty en développement, JSON structuré en production.
 * - Niveau configurable via env LOG_LEVEL.
 *
 * Usage :
 *   import { getLogger } from '@/server/utils/logger';
 *   const log = getLogger();
 *   log.info({ draftId }, 'CR draft créé');
 */

import pino, { type Logger, type LoggerOptions } from 'pino';
import { getEnv } from './env';

/**
 * Paths à masquer dans les logs. Tout champ matchant est remplacé par [REDACTED].
 * Couvre les headers HTTP courants et les champs sensibles des payloads métier.
 */
const REDACT_PATHS = [
  // Headers HTTP
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-hub-signature-256"]',
  'res.headers["set-cookie"]',

  // Champs génériques
  '*.password',
  '*.apiKey',
  '*.api_key',
  '*.token',
  '*.accessToken',
  '*.access_token',
  '*.secret',
  '*.encryptionKey',
  '*.encryption_key',

  // Champs spécifiques projet
  '*.ANTHROPIC_API_KEY',
  '*.CRAFT_IC_KEY',
  '*.WHATSAPP_CLOUD_API_TOKEN',
  '*.WHATSAPP_WEBHOOK_SECRET',
  '*.TELEGRAM_BOT_TOKEN',
  '*.TELEGRAM_WEBHOOK_SECRET',
  '*.DB_ENCRYPTION_KEY',
] as const;

let cachedLogger: Logger | null = null;

function buildLoggerOptions(level: string, isDev: boolean): LoggerOptions {
  const base: LoggerOptions = {
    level,
    redact: {
      paths: [...REDACT_PATHS],
      censor: '[REDACTED]',
    },
    base: {
      service: 'issa-secretariat',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (isDev) {
    return {
      ...base,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,service',
          singleLine: false,
        },
      },
    };
  }

  return base;
}

export function getLogger(): Logger {
  if (cachedLogger === null) {
    const env = getEnv();
    const isDev = env.NODE_ENV !== 'production';
    cachedLogger = pino(buildLoggerOptions(env.LOG_LEVEL, isDev));
  }
  return cachedLogger;
}

/**
 * Reset le cache logger. Utile uniquement en test.
 */
export function resetLoggerForTests(): void {
  cachedLogger = null;
}
