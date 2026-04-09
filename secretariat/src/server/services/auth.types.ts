/**
 * Types du service d'authentification admin (Phase 5).
 *
 * Portée V1 : un seul rôle effectif (`admin`) protégé par un mot de passe
 * unique stocké en bcrypt hash + session JWT 24h en cookie httpOnly.
 *
 * Phase 6 ajoutera : 2FA TOTP, révocation de sessions via table dédiée,
 * multi-comptes (Carl / Maxime avec RBAC par entité).
 */

/**
 * Rôle de l'admin authentifié.
 * V1 : seul `admin` (= Thomas) existe. `superadmin` est réservé pour la
 * Phase 6 quand Carl/Maxime seront ajoutés (Thomas garde superadmin).
 */
export type AdminRole = 'admin' | 'superadmin';

/**
 * Payload stocké dans le JWT (claims signés).
 * On ne met PAS de PII — juste ce qui sert à l'autorisation serveur.
 */
export interface AdminJwtPayload {
  /** Identifiant logique — V1 : toujours "thomas" (mono-compte). */
  sub: string;
  /** Rôle — V1 : toujours "admin". */
  role: AdminRole;
  /** Issued-at (seconds epoch), géré par jsonwebtoken. */
  iat?: number;
  /** Expiration (seconds epoch), géré par jsonwebtoken. */
  exp?: number;
}

/**
 * Objet attaché à `req.admin` par le middleware `authJwt` après vérification.
 */
export interface AuthenticatedAdmin {
  sub: string;
  role: AdminRole;
}

/**
 * Résultat d'un login réussi — utilisé par la route `/admin/login`.
 */
export interface LoginResult {
  token: string;
  /** Durée de vie du cookie en millisecondes (synchro avec exp JWT). */
  maxAgeMs: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin;
    }
  }
}
