/**
 * Middleware Express — exige un role admin ou superadmin.
 *
 * À utiliser APRÈS `authJwt` qui populate `req.admin`. Cet enchaînement est
 * obligatoire (pas de vérif JWT ici — séparation des responsabilités).
 *
 * Comportement :
 *  - req.admin absent           → 401 AUTH_REQUIRED (ne devrait pas arriver
 *                                  si authJwt est monté en amont, garde-fou
 *                                  défensif)
 *  - req.admin.role inattendu   → 403 FORBIDDEN
 *  - role = admin | superadmin  → next()
 *
 * V1 : aucune différence fonctionnelle entre `admin` et `superadmin`. Phase 6
 * ajoutera les règles RBAC par entité (Carl = admin sur GO+VI, Maxime = admin
 * sur VV, Thomas = superadmin sur tout).
 *
 * Usage :
 *   router.use(authJwt, requireAdmin);
 */

import type { NextFunction, Request, Response } from 'express';

import { getLogger } from '../utils/logger';

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const admin = req.admin;

  if (admin === undefined) {
    getLogger().warn(
      { path: req.path },
      '[requireAdmin] req.admin absent — authJwt non monté en amont ?',
    );
    res.status(401).json({
      error: 'Authentification requise',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  if (admin.role !== 'admin' && admin.role !== 'superadmin') {
    getLogger().warn(
      { path: req.path, role: admin.role },
      '[requireAdmin] rôle non autorisé',
    );
    res.status(403).json({
      error: 'Accès réservé aux administrateurs',
      code: 'FORBIDDEN',
    });
    return;
  }

  next();
}
