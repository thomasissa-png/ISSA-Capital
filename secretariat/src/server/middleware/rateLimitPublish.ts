/**
 * Rate limiter Express dédié à POST /api/publish/:draftId (Phase 4).
 *
 * Raison : l'endpoint de publication pousse un document externe sur Craft et
 * consomme un appel API facturé. Un limiter strict empêche un bug côté
 * client (loop de retry sur erreur 500 par exemple) de créer en masse des
 * documents Craft qu'il faudrait ensuite nettoyer manuellement.
 *
 * Calibration : 10 req / 15 min / IP — largement suffisant pour l'usage
 * réel (quelques CR par jour dictés par Thomas), bloque tout bot trivial.
 *
 * Ce limiter est mounté EN AMONT du router publish dans `src/server/index.ts` :
 *   app.use('/api/publish', publishRateLimit, publishRouter);
 *
 * Il est séparé du rate limit global et du draftRateLimit pour permettre
 * des réglages indépendants et un message d'erreur spécifique en français.
 */

import rateLimit from 'express-rate-limit';

/** Fenêtre de 15 minutes. */
const WINDOW_MS = 15 * 60 * 1000;

/**
 * Limite dure par IP pendant la fenêtre.
 *
 * En test on monte à 10_000 pour permettre aux tests d'intégration
 * d'enchaîner plusieurs POST /api/publish sans déclencher le limiter
 * (le store est partagé entre `buildApp()` car le middleware est instancié
 * au chargement du module). En production, la valeur effective est 10.
 */
const MAX_REQUESTS = process.env.NODE_ENV === 'test' ? 10_000 : 10;

export const publishRateLimit = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error:
      'Trop de publications demandées. Réessaye dans quelques minutes (limite 10 / 15 min par IP).',
    code: 'PUBLISH_RATE_LIMITED',
  },
});
