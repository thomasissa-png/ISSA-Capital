/**
 * Middleware Express — lit le cookie `admin_session`, vérifie le JWT,
 * et attache `req.admin` (= { sub, role }) si valide.
 *
 * Comportement :
 *  - Pas de cookie        → 401 AUTH_REQUIRED
 *  - Cookie invalide/exp  → 401 AUTH_INVALID
 *  - Cookie valide        → next() avec req.admin populated
 *
 * Le JSON renvoyé au client ne contient JAMAIS le token ni d'indice sur la
 * cause exacte (évite le fingerprinting). Le logger interne distingue les
 * cas pour le debug ops.
 *
 * Usage :
 *   router.use(authJwt);             // protège toutes les sous-routes
 *   router.get('/foo', authJwt, h);  // protège une route ciblée
 */

import type { NextFunction, Request, Response } from 'express';

import { verifyJwt } from '../services/auth';
import { getLogger } from '../utils/logger';

export const ADMIN_COOKIE_NAME = 'admin_session';

export function authJwt(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // cookie-parser populate req.cookies. Si pas monté → req.cookies est undefined.
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;

  const token = cookies?.[ADMIN_COOKIE_NAME];

  if (typeof token !== 'string' || token.length === 0) {
    getLogger().debug(
      { path: req.path },
      '[authJwt] cookie admin_session absent',
    );
    res.status(401).json({
      error: 'Authentification requise',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  const payload = verifyJwt(token);
  if (payload === null) {
    getLogger().debug(
      { path: req.path },
      '[authJwt] JWT invalide ou expiré',
    );
    res.status(401).json({
      error: 'Session invalide ou expirée, reconnexion requise',
      code: 'AUTH_INVALID',
    });
    return;
  }

  req.admin = {
    sub: payload.sub,
    role: payload.role,
  };

  next();
}
