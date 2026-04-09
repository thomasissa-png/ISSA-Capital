/**
 * Routes /admin/api/2fa — gestion de la 2FA TOTP (Phase 6).
 *
 * Endpoints (tous protégés par authJwt + requireAdmin sauf /verify-login) :
 *  - GET  /admin/api/2fa/status               → état 2FA du user courant
 *  - POST /admin/api/2fa/generate             → génère secret + QR code (pending)
 *  - POST /admin/api/2fa/enable               → body { code } → active + backup codes
 *  - POST /admin/api/2fa/disable              → body { code } → désactive
 *  - POST /admin/api/2fa/backup-codes/regenerate → body { code } → nouveaux codes
 *
 * Endpoint spécial (public — appelé pendant le flow login) :
 *  - POST /admin/api/2fa/verify-login         → body { temp_token, code }
 *    échange un temp_token contre un JWT admin final.
 *
 * Sources :
 *  - docs/ia/secretariat-implementation-plan.md Phase 6 (2FA routes)
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { ADMIN_COOKIE_NAME, authJwt } from '../../middleware/authJwt';
import { requireAdmin } from '../../middleware/requireAdmin';
import { AppError } from '../../middleware/errorHandler';
import { generateJwt } from '../../services/auth';
import {
  disable,
  enable,
  generateSecret,
  getStatus,
  regenerateBackupCodes,
  verify,
  verifyBackupCode,
} from '../../services/totp';
import { getEnv } from '../../utils/env';
import { getLogger } from '../../utils/logger';

export const twoFactorRouter = Router();

// ============================================================
// Schémas
// ============================================================

const CodeSchema = z.object({
  code: z
    .string()
    .min(6, 'code est requis (6 chiffres TOTP ou backup code hexa)')
    .max(32),
});

const VerifyLoginSchema = z.object({
  temp_token: z.string().min(10).max(1000),
  code: z
    .string()
    .min(6, 'code est requis (6 chiffres TOTP ou backup code hexa)')
    .max(32),
});

// ============================================================
// Helpers
// ============================================================

/**
 * Claim spécial du temp_token délivré au login quand 2FA est requise.
 * Durée courte (2 min) pour laisser le temps de saisir le code sans
 * exposer une fenêtre longue en cas de fuite du temp_token.
 */
interface TempTokenPayload {
  sub: string;
  stage: 'awaiting_2fa';
  iat?: number;
  exp?: number;
}

const TEMP_TOKEN_TTL_SECONDS = 120;

export function generateTempToken(sub: string): string {
  const env = getEnv();
  const payload: TempTokenPayload = { sub, stage: 'awaiting_2fa' };
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: TEMP_TOKEN_TTL_SECONDS,
  });
}

function verifyTempToken(token: string): TempTokenPayload | null {
  const env = getEnv();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload | string;

    if (typeof decoded === 'string' || decoded === null) return null;
    const sub = decoded.sub;
    const stage = (decoded as { stage?: unknown }).stage;
    if (typeof sub !== 'string' || sub.length === 0) return null;
    if (stage !== 'awaiting_2fa') return null;
    return { sub, stage };
  } catch {
    return null;
  }
}

// ============================================================
// GET /status
// ============================================================

twoFactorRouter.get(
  '/status',
  authJwt,
  requireAdmin,
  (req: Request, res: Response): void => {
    if (req.admin === undefined) {
      res.status(401).json({ error: 'Non authentifié', code: 'AUTH_REQUIRED' });
      return;
    }
    const status = getStatus(req.admin.sub);
    res.status(200).json(status);
  },
);

// ============================================================
// POST /generate
// ============================================================

twoFactorRouter.post(
  '/generate',
  authJwt,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.admin === undefined) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Non authentifié'));
      return;
    }

    void (async (): Promise<void> => {
      try {
        const generated = await generateSecret(req.admin!.sub);
        res.status(200).json({
          secret: generated.secret,
          otpauthUrl: generated.otpauthUrl,
          qrDataUrl: generated.qrDataUrl,
        });
      } catch (err) {
        getLogger().error({ err }, '[2fa] echec generate');
        next(new AppError(500, 'TOTP_GENERATE_FAILED', 'Génération du secret 2FA échouée'));
      }
    })();
  },
);

// ============================================================
// POST /enable
// ============================================================

twoFactorRouter.post(
  '/enable',
  authJwt,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.admin === undefined) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Non authentifié'));
      return;
    }

    const parsed = CodeSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    void (async (): Promise<void> => {
      try {
        const result = await enable(req.admin!.sub, parsed.data.code);
        res.status(200).json({
          success: true,
          backupCodes: result.backupCodes,
          message:
            'Notez ces codes de secours dans un endroit sûr — ils ne seront plus affichés.',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('code invalide')) {
          next(new AppError(401, 'TOTP_CODE_INVALID', 'Code TOTP invalide'));
          return;
        }
        if (msg.includes('aucun secret')) {
          next(new AppError(400, 'TOTP_NO_PENDING_SECRET', 'Aucun secret en attente — générer un QR code d\'abord'));
          return;
        }
        if (msg.includes('déjà activée')) {
          next(new AppError(409, 'TOTP_ALREADY_ENABLED', '2FA déjà activée'));
          return;
        }
        getLogger().error({ err }, '[2fa] enable inattendu');
        next(new AppError(500, 'TOTP_ENABLE_FAILED', 'Activation 2FA échouée'));
      }
    })();
  },
);

// ============================================================
// POST /disable
// ============================================================

twoFactorRouter.post(
  '/disable',
  authJwt,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.admin === undefined) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Non authentifié'));
      return;
    }

    const parsed = CodeSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    try {
      disable(req.admin.sub, parsed.data.code);
      res.status(200).json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('code invalide')) {
        next(new AppError(401, 'TOTP_CODE_INVALID', 'Code TOTP invalide'));
        return;
      }
      if (msg.includes('non activée')) {
        next(new AppError(409, 'TOTP_NOT_ENABLED', '2FA non activée'));
        return;
      }
      getLogger().error({ err }, '[2fa] disable inattendu');
      next(new AppError(500, 'TOTP_DISABLE_FAILED', 'Désactivation 2FA échouée'));
    }
  },
);

// ============================================================
// POST /backup-codes/regenerate
// ============================================================

twoFactorRouter.post(
  '/backup-codes/regenerate',
  authJwt,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction): void => {
    if (req.admin === undefined) {
      next(new AppError(401, 'AUTH_REQUIRED', 'Non authentifié'));
      return;
    }

    const parsed = CodeSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    void (async (): Promise<void> => {
      try {
        const result = await regenerateBackupCodes(
          req.admin!.sub,
          parsed.data.code,
        );
        res.status(200).json({
          success: true,
          backupCodes: result.backupCodes,
          message:
            'Notez ces nouveaux codes — les anciens sont invalidés.',
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('code invalide')) {
          next(new AppError(401, 'TOTP_CODE_INVALID', 'Code TOTP invalide'));
          return;
        }
        if (msg.includes('non activée')) {
          next(new AppError(409, 'TOTP_NOT_ENABLED', '2FA non activée'));
          return;
        }
        getLogger().error({ err }, '[2fa] regenerate inattendu');
        next(
          new AppError(500, 'TOTP_REGENERATE_FAILED', 'Régénération des backup codes échouée'),
        );
      }
    })();
  },
);

// ============================================================
// POST /verify-login — échange temp_token + code → JWT final
// ============================================================
//
// Cette route est PUBLIQUE (pas d'authJwt) parce qu'à ce stade l'admin n'a
// pas encore de session complète — il a juste un temp_token délivré par
// /admin/login après validation du mot de passe.

twoFactorRouter.post(
  '/verify-login',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = VerifyLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const payload = verifyTempToken(parsed.data.temp_token);
    if (payload === null) {
      next(
        new AppError(
          401,
          'TEMP_TOKEN_INVALID',
          'Session temporaire invalide ou expirée — recommence depuis le login',
        ),
      );
      return;
    }

    void (async (): Promise<void> => {
      const code = parsed.data.code;

      // On tente d'abord le code TOTP (6 chiffres). Si l'admin a perdu son
      // phone, il peut utiliser un backup code (8 chiffres hex).
      let ok = verify(payload.sub, code);
      if (!ok) {
        ok = await verifyBackupCode(payload.sub, code);
      }

      if (!ok) {
        getLogger().info({ sub: payload.sub }, '[2fa] verify-login échec');
        next(new AppError(401, 'TOTP_CODE_INVALID', 'Code invalide'));
        return;
      }

      // Succès : délivrer le vrai JWT admin
      const env = getEnv();
      const { token, maxAgeMs } = generateJwt(payload.sub, 'admin');

      res.cookie(ADMIN_COOKIE_NAME, token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: maxAgeMs,
        path: '/',
      });

      getLogger().info({ sub: payload.sub }, '[2fa] verify-login réussi');
      res.status(200).json({
        success: true,
        admin: { sub: payload.sub, role: 'admin' },
        expiresInMs: maxAgeMs,
      });
    })();
  },
);
