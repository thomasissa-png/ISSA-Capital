/**
 * Rate limiter Express dédié à POST /api/draft (Phase 3).
 *
 * Raison : l'endpoint de génération de CR consomme des tokens Anthropic
 * (~$0.01 par appel avec cache, ~$0.03 sans cache). Un rate limit strict
 * est obligatoire pour éviter un "coup de budget" en cas d'abus ou de bug
 * côté client (loop de retry par exemple).
 *
 * Calibration : 20 req / 15 min / IP — largement suffisant pour un usage
 * humain (Thomas dicte quelques CR par jour), bloque tout bot trivial.
 *
 * Ce limiter est mounté EN AMONT du router draft dans `src/server/index.ts` :
 *   app.use('/api/draft', draftRateLimit, draftRouter);
 *
 * Il est séparé du rate limit global pour permettre des réglages indépendants
 * et un message d'erreur spécifique en français.
 */

import rateLimit from 'express-rate-limit';

/**
 * Fenêtre de 15 minutes.
 */
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Limite dure par IP pendant la fenêtre.
 */
const MAX_REQUESTS = 20;

export const draftRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error:
      'Trop de générations de CR demandées. Réessaye dans quelques minutes (limite 20 / 15 min par IP).',
    code: 'DRAFT_RATE_LIMITED',
  },
});
