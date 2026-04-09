/**
 * POST /admin/login + POST /admin/logout — authentification admin V1 (Phase 5).
 *
 * Flow :
 *  1. Le client POST { password } en JSON
 *  2. On vérifie le bcrypt contre `env.ADMIN_PASSWORD_HASH`
 *  3. Si match → génère un JWT HS256 et set le cookie `admin_session`
 *     httpOnly + SameSite=Lax + Secure (en prod) + Max-Age synchro JWT exp
 *  4. Si mismatch → 401 (délai fixe 200ms pour éviter le timing attack)
 *
 * Sécurité :
 *  - Pas de body autre que { password } — Zod strict
 *  - Pas de rate limit dédié ici (héritage du global 100 req/15min). En Phase 6,
 *    on durcira à 5 req/min par IP sur /admin/login pour limiter le brute-force.
 *  - Si ADMIN_PASSWORD_HASH est absent de l'env → 503 (serveur mal configuré).
 *    Ne JAMAIS fallback sur un password par défaut en clair.
 *  - Le message d'erreur ne distingue PAS « mot de passe incorrect » de
 *    « hash non configuré » (même payload retourné au client pour éviter le
 *    fingerprinting).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { ADMIN_COOKIE_NAME } from '../../middleware/authJwt';
import { AppError } from '../../middleware/errorHandler';
import { generateJwt, verifyPassword } from '../../services/auth';
import { getEnv } from '../../utils/env';
import { getLogger } from '../../utils/logger';

export const loginRouter = Router();

const LoginSchema = z.object({
  password: z.string().min(1, 'password est requis').max(200),
});

/** Délai constant minimum pour une réponse login (anti timing attack). */
const MIN_RESPONSE_MS = 200;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

loginRouter.post(
  '/login',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const started = Date.now();
    const env = getEnv();
    const log = getLogger();

    void (async (): Promise<void> => {
      try {
        const hash = env.ADMIN_PASSWORD_HASH;

        // Configuration manquante → 503 mais délai constant quand même
        if (hash === undefined || hash.length === 0) {
          log.error(
            '[admin/login] ADMIN_PASSWORD_HASH absent — serveur mal configuré',
          );
          await sleep(MIN_RESPONSE_MS);
          next(
            new AppError(
              503,
              'SERVICE_UNAVAILABLE',
              'Authentification admin non configurée — contacter le support',
            ),
          );
          return;
        }

        const ok = await verifyPassword(parsed.data.password, hash);

        // Délai constant pour masquer le temps de comparaison bcrypt
        const elapsed = Date.now() - started;
        if (elapsed < MIN_RESPONSE_MS) {
          await sleep(MIN_RESPONSE_MS - elapsed);
        }

        if (!ok) {
          log.info({ ip: req.ip }, '[admin/login] échec authentification');
          next(
            new AppError(
              401,
              'AUTH_FAILED',
              'Mot de passe incorrect',
            ),
          );
          return;
        }

        // V1 : un seul compte — sub="thomas", role="admin"
        const { token, maxAgeMs } = generateJwt('thomas', 'admin');

        res.cookie(ADMIN_COOKIE_NAME, token, {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: maxAgeMs,
          path: '/',
        });

        log.info({ ip: req.ip }, '[admin/login] authentification réussie');
        res.status(200).json({
          success: true,
          admin: { sub: 'thomas', role: 'admin' },
          expiresInMs: maxAgeMs,
        });
      } catch (err) {
        next(err);
      }
    })();
  },
);

loginRouter.post(
  '/logout',
  (_req: Request, res: Response): void => {
    const env = getEnv();
    res.clearCookie(ADMIN_COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    res.status(200).json({ success: true });
  },
);

/**
 * GET /admin/me — retourne les infos de l'admin authentifié (utilisé par le
 * front vanilla pour vérifier qu'une session existe au chargement de la page).
 * Cette route DOIT être protégée par authJwt dans le router parent.
 */
loginRouter.get(
  '/me',
  (req: Request, res: Response): void => {
    if (req.admin === undefined) {
      res.status(401).json({ error: 'Non authentifié', code: 'AUTH_REQUIRED' });
      return;
    }
    res.status(200).json({
      sub: req.admin.sub,
      role: req.admin.role,
    });
  },
);
