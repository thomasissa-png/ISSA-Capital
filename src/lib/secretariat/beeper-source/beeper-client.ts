/**
 * Client Beeper — lecture de la DB SQLite du bridge WhatsApp (Phase 2).
 *
 * L'API HTTP du Beeper Server est cassée (bug nightly `CloudBackup nil` →
 * stuck `initializing` → endpoints vides). Décision actée S24 : lire la DB
 * SQLite locale du bridge en READ-ONLY.
 *
 * On n'ajoute AUCUNE dépendance npm (un module SQLite natif casserait le build
 * Replit qui partage ce package.json). On shelle vers la CLI `sqlite3`
 * (installée sur le VPS) en `-readonly -json`. Ce code ne tourne que sur le VPS.
 *
 * 🔒 LECTURE SEULE STRICTE : jamais d'INSERT/UPDATE/DELETE (c'est le bridge qui
 * écrit). Ouverture `-readonly`. Aucune capacité d'envoi WhatsApp (règle 11).
 */

import { execFile } from 'node:child_process';
import { loadEnvConfig } from '@next/env';

let envLoaded = false;
function ensureEnv(): void {
  if (envLoaded) return;
  try {
    loadEnvConfig(process.cwd());
  } catch {
    /* best-effort */
  }
  envLoaded = true;
}

const DEFAULT_DB = '/root/.beeper/profiles/server/server/local-whatsapp/megabridge.db';
const SQLITE_TIMEOUT_MS = 15_000;

export function beeperDbPath(): string {
  ensureEnv();
  return process.env.BEEPER_DB_PATH ?? DEFAULT_DB;
}

/** Liste blanche pro (chat_id ou numéro), CSV dans BEEPER_WHITELIST. */
export function beeperWhitelist(): string[] {
  ensureEnv();
  return (process.env.BEEPER_WHITELIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export interface SqliteResult {
  ok: boolean;
  rows?: Array<Record<string, unknown>>;
  error?: string;
}

/**
 * Exécute une requête SQLite en READ-ONLY via la CLI `sqlite3`, sortie JSON.
 * Ne JAMAIS passer une requête d'écriture : `-readonly` la rejetterait, mais
 * l'invariant est qu'on ne lit que des SELECT.
 */
export function runSqliteJson(query: string): Promise<SqliteResult> {
  return new Promise((resolve) => {
    execFile(
      'sqlite3',
      ['-readonly', '-json', beeperDbPath(), query],
      { timeout: SQLITE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          resolve({ ok: false, error: (stderr || err.message).slice(0, 400).trim() });
          return;
        }
        const out = stdout.trim();
        if (!out) {
          resolve({ ok: true, rows: [] });
          return;
        }
        try {
          resolve({ ok: true, rows: JSON.parse(out) as Array<Record<string, unknown>> });
        } catch {
          resolve({ ok: false, error: `JSON parse impossible : ${out.slice(0, 200)}` });
        }
      },
    );
  });
}

export interface BeeperDbCheck {
  ok: boolean;
  portals?: number;
  ghosts?: number;
  error?: string;
}

/**
 * Vérifie l'accès à la DB du bridge (lecture seule) : compte portals + ghosts.
 * Révèle d'un coup : accès fichier (permissions cross-user), DB lisible (WAL),
 * et volumétrie. Lecture seule.
 */
export async function checkBeeperDb(): Promise<BeeperDbCheck> {
  const r = await runSqliteJson(
    "SELECT (SELECT COUNT(*) FROM portal) AS portals, (SELECT COUNT(*) FROM ghost) AS ghosts;",
  );
  if (!r.ok) return { ok: false, error: r.error };
  const row = r.rows?.[0] ?? {};
  return {
    ok: true,
    portals: Number(row.portals ?? 0),
    ghosts: Number(row.ghosts ?? 0),
  };
}
