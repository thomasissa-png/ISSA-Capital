/**
 * Middleware accessLogger — log automatique des requêtes API dans `access_logs`.
 *
 * Responsabilités (Phase 6) :
 *   - À la fin de chaque requête API authentifiée (res.on('finish')), insérer
 *     une ligne dans `access_logs` avec : phone/admin, method+path, status,
 *     user-agent tronqué, ip.
 *   - Exclusions : /api/health, /admin/static/*, assets statiques GET.
 *   - Performance : insertion best-effort NON BLOQUANTE — si l'insert échoue,
 *     on log une erreur pino mais la réponse HTTP n'est pas affectée.
 *
 * Schéma cible (table `access_logs` définie en migration 001) :
 *   - actor_phone         ← phone whitelisté OU `admin:<sub>` OU `anonymous`
 *   - actor_display_name  ← contact.displayName si whitelist, sinon null
 *   - resource_type       ← toujours `api_request` pour le middleware global
 *   - resource_id         ← `${req.method} ${req.path}` (tronqué à 200 chars)
 *   - action              ← toujours `api_request` (pour filtrage admin)
 *   - entite              ← null (le middleware global ne connaît pas l'entité)
 *   - result              ← `${res.statusCode}` (ex: "200", "401", "500")
 *   - ip_address          ← req.ip
 *   - user_agent          ← req.get('user-agent') tronqué à 500 chars
 *
 * Ce middleware DOIT être monté APRÈS authJwt / whitelistGuard pour pouvoir
 * lire `req.admin` (set par authJwt) et éventuellement `req.whitelistedContact`
 * (la whitelist est appliquée inline dans whatsapp.ts — pas via middleware
 * global, donc on ne la voit pas ici : les webhooks WhatsApp loggent déjà
 * manuellement).
 *
 * Sources :
 *   - docs/ia/secretariat-implementation-plan.md Phase 6 (access_logs middleware)
 *   - docs/ia/secretariat-architecture.md Section 2.6 (access_logs schema)
 */

import type { NextFunction, Request, Response } from 'express';

import { getDb } from '../db/connection';
import { getLogger } from '../utils/logger';

// ============================================================
// Constantes
// ============================================================

const RESOURCE_ID_MAX = 200;
const USER_AGENT_MAX = 500;

/**
 * Préfixes de chemins exclus du logging.
 *
 * - /api/health : healthcheck Replit/load balancer — trop bruyant
 * - /admin/static : assets CSS/JS statiques — rien à auditer
 * - /admin/login.html + /admin/dashboard.html : pages HTML publiques
 */
const EXCLUDED_PREFIXES = ['/api/health', '/admin/static'];

/**
 * Chemins GET exclus (pages HTML publiques servies par admin router).
 */
const EXCLUDED_GET_PATHS = new Set([
  '/admin/login.html',
  '/admin/dashboard.html',
  '/admin',
  '/admin/',
]);

function shouldLog(req: Request): boolean {
  const p = req.path;
  for (const prefix of EXCLUDED_PREFIXES) {
    if (p.startsWith(prefix)) return false;
  }
  if (req.method === 'GET' && EXCLUDED_GET_PATHS.has(p)) return false;
  return true;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

/**
 * Résout le "qui" est en train de faire la requête :
 *   - Si authJwt a populé req.admin → "admin:<sub>"
 *   - Sinon → "anonymous" (route publique ou non encore authentifiée)
 *
 * Note : les webhooks WhatsApp loggent eux-mêmes l'actor_phone réel via
 * `logAccess()` dans whatsapp.ts — la ligne générée par ce middleware
 * aura actor_phone = "anonymous" pour les webhooks, ce qui permet de
 * distinguer "appel infra Meta" de "action utilisateur".
 */
function resolveActor(req: Request): string {
  if (req.admin !== undefined) {
    return `admin:${req.admin.sub}`;
  }
  return 'anonymous';
}

// ============================================================
// Middleware
// ============================================================

export function accessLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!shouldLog(req)) {
    next();
    return;
  }

  // Capture les infos requête AVANT de passer au next middleware :
  // après `next()`, des sub-routers Express peuvent modifier `req.url`
  // temporairement (strip du mount path), et même si Express restaure
  // l'URL, l'event `finish` peut lire un état intermédiaire.
  // On snapshot ici pour avoir la garantie du path original.
  const startedAt = Date.now();
  const originalPath = req.originalUrl.split('?')[0] ?? req.path;
  const method = req.method;
  const resourceId = truncate(`${method} ${originalPath}`, RESOURCE_ID_MAX);
  const userAgent = req.get('user-agent');
  const userAgentTruncated =
    typeof userAgent === 'string' ? truncate(userAgent, USER_AGENT_MAX) : null;
  const ipAddress = req.ip ?? null;

  res.on('finish', () => {
    // Insert synchrone dans le handler `finish` :
    //   - `finish` émit APRÈS que la réponse est envoyée au client, donc
    //     la requête HTTP n'est plus impactée par la latence du INSERT.
    //   - Un INSERT préparé better-sqlite3 est sub-ms en local et sur
    //     Replit autoscale (DB locale, pas de I/O réseau).
    //   - Évite d'utiliser setImmediate qui peut fire APRÈS un test teardown
    //     et tenter de réouvrir une DB déjà fermée.
    try {
      const db = getDb();
      // resolveActor() lit req.admin qui est populé par authJwt dans un
      // sub-router — donc on le relit ici (après next()) pour avoir la
      // valeur finale, pas un snapshot pré-auth.
      const actor = resolveActor(req);

      db.prepare(
        `INSERT INTO access_logs (
           actor_phone, actor_display_name, resource_type, resource_id,
           action, entite, result, timestamp, ip_address, user_agent
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        actor,
        req.admin?.sub ?? null,
        'api_request',
        resourceId,
        'api_request',
        null,
        String(res.statusCode),
        new Date().toISOString(),
        ipAddress,
        userAgentTruncated,
      );
    } catch (err) {
      // L'échec d'insertion d'un log NE DOIT PAS faire échouer la requête
      // (elle est déjà partie). On log via pino.
      getLogger().error(
        {
          err: err instanceof Error ? err.message : String(err),
          path: originalPath,
          method,
          durationMs: Date.now() - startedAt,
        },
        '[accessLogger] échec insert access_logs — requête non affectée',
      );
    }
  });

  next();
}
