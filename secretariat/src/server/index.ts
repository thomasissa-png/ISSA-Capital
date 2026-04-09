/**
 * Agent Secrétariat ISSA Capital — serveur Express.
 *
 * Responsabilités Phase 1 :
 *  - Chargement des variables d'environnement (dotenv depuis .env.local)
 *  - Validation fail-fast des env vars via Zod
 *  - Initialisation de la base SQLite + migrations
 *  - Configuration des middlewares de sécurité (helmet, cors, rate limit)
 *  - Exposition de l'endpoint /api/health
 *  - Graceful shutdown (SIGTERM, SIGINT) avec fermeture DB propre
 *
 * Phases ultérieures :
 *  - Phase 2 : /api/whatsapp/webhook (GET + POST)
 *  - Phase 3 : intégration Anthropic (pas de nouvelle route, via WhatsApp)
 *  - Phase 4 : /api/cr/draft, /api/cr/clarify, /api/cr/publish, /api/cr/list
 *  - Phase 5 : routes /api/contacts, /api/whitelist, /api/logs, /api/auth
 */

// dotenv DOIT être chargé AVANT tout import qui lit process.env
// (notamment ./utils/env qui valide les variables au premier getEnv()).
import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

import cors from 'cors';
import express, { type Application } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { closeDatabase, initDatabase } from './db/connection';
import { warnIfProductionDbNotEncrypted } from './db/encryption';
import { accessLogger } from './middleware/accessLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { draftRateLimit } from './middleware/rateLimitDraft';
import { publishRateLimit } from './middleware/rateLimitPublish';
import { adminRouter } from './routes/admin';
import { draftRouter } from './routes/draft';
import { draftsRouter } from './routes/drafts';
import { healthRouter } from './routes/health';
import { publishRouter } from './routes/publish';
import { publishedRouter } from './routes/published';
import { telegramRouter } from './routes/telegram';
import { whatsappRouter } from './routes/whatsapp';
import { getEnv } from './utils/env';
import { getLogger } from './utils/logger';

/**
 * Construit l'application Express sans la démarrer.
 * Exposée pour les tests d'intégration (supertest).
 */
export function buildApp(): Application {
  const env = getEnv();
  const log = getLogger();

  const app = express();

  // --- Sécurité headers (Phase 6 — CSP strict) ---
  // CSP durcie en Phase 6 pour :
  //  - defaultSrc 'self' : rien n'est chargé hors origin
  //  - scriptSrc 'self' : pas de scripts inline (login.html externalisé en
  //    /admin/static/js/login.js Phase 6)
  //  - styleSrc 'self' + 'unsafe-inline' : gardé car le dashboard vanilla
  //    utilise quelques styles inline légers ; admissible, pas de JS via style.
  //  - imgSrc 'self' + data: : data: indispensable pour le QR code 2FA
  //    (qrcode lib retourne une data URL base64 PNG)
  //  - objectSrc 'none' + frameAncestors 'none' : clickjacking impossible
  //  - upgradeInsecureRequests : force HTTPS en prod
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      // Admin UI vanilla : pas d'embed cross-origin nécessaire
      crossOriginEmbedderPolicy: false,
    }),
  );

  // --- CORS ---
  // En Phase 1 l'API n'a pas encore de front (admin web = Phase 5).
  // On whiteliste uniquement issa-capital.com (prod) et localhost (dev).
  const corsOrigins =
    env.NODE_ENV === 'production'
      ? ['https://issa-capital.com', 'https://www.issa-capital.com']
      : ['http://localhost:3000', 'http://localhost:3001'];

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  );

  // --- Body parsing ---
  // Limite 1 MB (aucun upload binaire en Phase 1 ; les messages WhatsApp
  // entrants sont du JSON léger).
  //
  // `verify` capture le raw body UTF-8 sur `req.rawBody` — indispensable au
  // middleware verifyMetaSignature (HMAC-SHA256 sur bytes exacts reçus).
  // Cf docs/ia/secretariat-architecture.md §7.2 et middleware/verifyMetaSignature.ts.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    }),
  );

  // --- Rate limiting global ---
  // 100 req / 15 min par IP en dev. En prod le rate limiting fin par numéro
  // WhatsApp sera ajouté en Phase 6 (5 req/min par numéro).
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Trop de requêtes, réessaye plus tard', code: 'RATE_LIMITED' },
  });
  app.use(globalLimiter);

  // --- Logging requêtes (basique Phase 1) ---
  app.use((req, _res, next) => {
    log.debug({ method: req.method, path: req.path }, 'requête reçue');
    next();
  });

  // --- Access logger (Phase 6) ---
  // Insère une ligne dans access_logs pour chaque requête API non exclue
  // (cf middleware/accessLogger.ts pour la liste des exclusions). Monté
  // AVANT les routes pour pouvoir attacher l'event `finish` à la réponse,
  // mais APRÈS les middlewares d'auth admin ? Non : l'auth admin est
  // appliquée sous /admin par le sous-router, donc req.admin est populé
  // à ce moment-là. Le middleware accessLogger lit req.admin dans son
  // listener `finish` qui s'exécute APRÈS le sous-router → tout est OK.
  app.use(accessLogger);

  // --- Routes ---
  app.use('/api/health', healthRouter);
  // Phase 3 — génération CR via Anthropic. Rate limit dédié (20 req / 15 min / IP)
  // appliqué AVANT le router pour éviter de consommer des tokens sur un abus.
  app.use('/api/draft', draftRateLimit, draftRouter);
  app.use('/api/drafts', draftsRouter);
  // Phase 4 — publication d'un CR validé sur Craft. Rate limit dédié
  // (10 req / 15 min / IP) car chaque publication crée un document externe
  // facturable et immuable côté Craft.
  app.use('/api/publish', publishRateLimit, publishRouter);
  // Phase 4 — lecture des CR publiés (liste + détail). Pas de rate limit
  // dédié : lecture en local SQLite, pas d'appel externe.
  app.use('/api/published', publishedRouter);
  // Phase 2 — webhooks WhatsApp Cloud API (GET handshake + POST messages).
  // Signature HMAC vérifiée via middleware dédié (verifyMetaSignature) dans
  // le router — le rawBody est capturé en amont par `express.json({ verify })`.
  app.use('/api/whatsapp', whatsappRouter);
  // Telegram Bot API webhook — connecteur d'entrée alternatif à WhatsApp.
  // Secret token vérifié via header X-Telegram-Bot-Api-Secret-Token dans le router.
  app.use('/api/telegram', telegramRouter);
  // Phase 5 — admin web `/admin`. Cookie-parser + auth JWT + CRUD 4 modules +
  // UI vanilla statique. Monté en dernier avant 404 handler pour que le
  // cookie-parser du sous-router ne pollue pas les autres routes.
  app.use('/admin', adminRouter);

  // --- 404 + error handler (DOIVENT être montés en dernier) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/**
 * Démarre le serveur HTTP.
 * NE PAS appeler en test (utiliser buildApp() + supertest à la place).
 */
function startServer(): void {
  const env = getEnv();
  const log = getLogger();

  // Init DB (ouverture + migrations) AVANT binding du port.
  // Si la DB est KO, on crash immédiatement plutôt que de servir des 500.
  try {
    initDatabase();
  } catch (err) {
    log.fatal({ err }, 'échec initialisation DB — arrêt');
    process.exit(1);
  }

  // Warn loud si la DB n'est pas chiffrée en production (Phase 6 prep).
  // Non-fatal : permet un premier déploiement avant la migration SQLCipher.
  warnIfProductionDbNotEncrypted();

  const app = buildApp();
  const server = app.listen(env.PORT, () => {
    log.info(
      {
        port: env.PORT,
        nodeEnv: env.NODE_ENV,
        pid: process.pid,
      },
      'serveur démarré',
    );
  });

  // --- Graceful shutdown ---
  const shutdown = (signal: string): void => {
    log.info({ signal }, 'signal reçu, arrêt en cours');

    server.close((err) => {
      if (err) {
        log.error({ err }, 'erreur fermeture serveur HTTP');
      } else {
        log.info('serveur HTTP fermé');
      }

      closeDatabase();
      process.exit(err ? 1 : 0);
    });

    // Force kill si le close dépasse 10s (Replit autoscale tue après 30s)
    setTimeout(() => {
      log.error('shutdown timeout — force kill');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // --- Crashs non gérés ---
  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'uncaughtException');
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    log.fatal({ reason }, 'unhandledRejection');
    shutdown('unhandledRejection');
  });
}

// ------------------------------------------------------------
// Entrypoint
// ------------------------------------------------------------
if (require.main === module) {
  startServer();
}
