/**
 * GET /api/health — endpoint de santé pour UptimeRobot et monitoring interne.
 *
 * Retourne :
 *  - 200 si tout est OK
 *  - 503 si la DB est inaccessible (status "degraded")
 *
 * Le payload inclut :
 *  - status : "ok" | "degraded"
 *  - version : version du package
 *  - uptime : secondes depuis le démarrage du process
 *  - db : "ok" | "error"
 *  - timestamp : ISO
 *
 * Principe : un endpoint /health NE DOIT JAMAIS crasher.
 * Toutes les vérifications sont wrappées en try/catch et dégradent le statut
 * au lieu de lancer une 500.
 */

import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';

import { getDb } from '../db/connection';
import { getLogger } from '../utils/logger';

export const healthRouter = Router();

interface HealthPayload {
  status: 'ok' | 'degraded';
  version: string;
  uptime: number;
  db: 'ok' | 'error';
  timestamp: string;
}

/**
 * Lit la version depuis package.json au démarrage (1 fois, cache en mémoire).
 */
let cachedVersion: string | null = null;
function readVersion(): string {
  if (cachedVersion !== null) return cachedVersion;

  try {
    const pkgPath = path.resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      version?: string;
    };
    cachedVersion = pkg.version ?? '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }

  return cachedVersion;
}

/**
 * Vérifie que la DB répond à une requête triviale.
 * Retourne 'ok' | 'error' — ne throw jamais.
 */
function checkDatabase(): 'ok' | 'error' {
  try {
    const db = getDb();
    const result = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined;
    return result && result.ok === 1 ? 'ok' : 'error';
  } catch (err) {
    getLogger().error({ err }, '[health] DB check failed');
    return 'error';
  }
}

healthRouter.get('/', (_req: Request, res: Response) => {
  const dbStatus = checkDatabase();
  const payload: HealthPayload = {
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    version: readVersion(),
    uptime: Math.round(process.uptime()),
    db: dbStatus,
    timestamp: new Date().toISOString(),
  };

  res.status(dbStatus === 'ok' ? 200 : 503).json(payload);
});
