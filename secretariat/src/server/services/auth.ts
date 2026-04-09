/**
 * Service d'authentification admin (Phase 5).
 *
 * Responsabilités :
 *  - Hasher un mot de passe (bcryptjs, 10 rounds)
 *  - Comparer un mot de passe en clair au hash stocké (timing-safe via bcryptjs)
 *  - Générer un JWT signé avec `env.JWT_SECRET`
 *  - Vérifier un JWT et retourner le payload typé
 *
 * Librairies :
 *  - `bcryptjs` plutôt que `bcrypt` : pas de compilation C++ native, plus
 *    portable sur Replit autoscale (cold start plus rapide, pas de binaire
 *    à builder au déploiement).
 *  - `jsonwebtoken` : standard de facto, supporte expiration + signature HS256.
 *
 * Sécurité :
 *  - `JWT_SECRET` doit faire >= 32 caractères (contrôle côté env.ts)
 *  - Le hash bcrypt ne doit JAMAIS apparaître en logs
 *  - En cas d'erreur de comparaison (ex : hash corrompu), on retourne false
 *    plutôt que de throw — pas de fuite d'info via un message d'erreur
 *  - Les JWT expirent après `env.ADMIN_SESSION_TTL_HOURS` heures
 */

import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';
import type { AdminJwtPayload, AdminRole, LoginResult } from './auth.types';

const BCRYPT_ROUNDS = 10;

/**
 * Hash d'un mot de passe en clair.
 * Utilisé UNIQUEMENT par le script de génération du hash admin (CLI).
 * En runtime serveur, on ne hash jamais — on compare contre le hash stocké
 * dans `env.ADMIN_PASSWORD_HASH`.
 */
export async function hashPassword(plain: string): Promise<string> {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('hashPassword: plain must be a non-empty string');
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Vérifie qu'un mot de passe en clair correspond à un hash bcrypt.
 * Retourne `false` silencieusement si le hash est malformé plutôt que de
 * throw — évite de fuiter un indice sur la validité du hash stocké.
 */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  if (typeof plain !== 'string' || plain.length === 0) return false;
  if (typeof hash !== 'string' || !hash.startsWith('$2')) return false;

  try {
    return await bcrypt.compare(plain, hash);
  } catch (err) {
    getLogger().warn({ err }, '[auth] verifyPassword: comparaison échouée');
    return false;
  }
}

/**
 * Génère un JWT signé pour un admin authentifié.
 * La durée de vie est définie par `env.ADMIN_SESSION_TTL_HOURS`.
 *
 * Retourne le token + la durée en ms (pour synchro du cookie Max-Age).
 */
export function generateJwt(sub: string, role: AdminRole): LoginResult {
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new Error('generateJwt: sub must be a non-empty string');
  }

  const env = getEnv();
  const ttlHours = env.ADMIN_SESSION_TTL_HOURS;
  const ttlSeconds = ttlHours * 3600;

  const payload: AdminJwtPayload = { sub, role };
  const token = jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: ttlSeconds,
  });

  return {
    token,
    maxAgeMs: ttlSeconds * 1000,
  };
}

/**
 * Vérifie un JWT et retourne le payload admin typé.
 * Retourne `null` si la signature est invalide, si le token est expiré,
 * ou si le payload est malformé.
 */
export function verifyJwt(token: string): AdminJwtPayload | null {
  if (typeof token !== 'string' || token.length === 0) return null;

  const env = getEnv();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
    }) as JwtPayload | string;

    if (typeof decoded === 'string' || decoded === null) return null;

    const sub = decoded.sub;
    const role = (decoded as { role?: unknown }).role;

    if (typeof sub !== 'string' || sub.length === 0) return null;
    if (role !== 'admin' && role !== 'superadmin') return null;

    const payload: AdminJwtPayload = { sub, role };
    if (typeof decoded.iat === 'number') payload.iat = decoded.iat;
    if (typeof decoded.exp === 'number') payload.exp = decoded.exp;
    return payload;
  } catch (err) {
    // Erreurs attendues : TokenExpiredError, JsonWebTokenError
    // On ne log qu'en debug (évite de polluer les logs d'un 401 attendu)
    getLogger().debug(
      { err: err instanceof Error ? err.message : String(err) },
      '[auth] verifyJwt: token invalide',
    );
    return null;
  }
}
