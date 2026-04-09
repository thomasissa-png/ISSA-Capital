/**
 * Connexion SQLite (singleton better-sqlite3).
 *
 * Responsabilités Phase 1 :
 *  - Ouvrir ou créer le fichier DB à partir de `env.DB_PATH`
 *  - Activer les pragmas de robustesse (WAL, foreign_keys, synchronous NORMAL)
 *  - Créer la table `schema_version` si absente
 *  - Appliquer les migrations non-jouées via le runner
 *
 * Phase 6 — chiffrement at-rest :
 *   SQLCipher sera activé via `DB_ENCRYPTION_KEY`. En Phase 1 on utilise
 *   `better-sqlite3` natif. La bascule vers `@journeyapps/sqlcipher` ou
 *   équivalent se fera sans changer la surface d'API de ce module.
 *
 * Règle d'usage :
 *   - Toujours passer par `getDb()` — pas de `new Database()` ailleurs.
 *   - Appeler `initDatabase()` UNE fois au démarrage serveur.
 *   - Appeler `closeDatabase()` lors du graceful shutdown.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database, { type Database as BetterSqlite3Database } from 'better-sqlite3';

import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';
import { runMigrations } from './migrations/runner';

let cachedDb: BetterSqlite3Database | null = null;

/**
 * Retourne l'instance SQLite singleton.
 * Crée la connexion au premier appel.
 */
export function getDb(): BetterSqlite3Database {
  if (cachedDb === null) {
    cachedDb = openDatabase();
  }
  return cachedDb;
}

/**
 * Ouvre (ou crée) le fichier DB et applique les pragmas.
 * Usage interne — utiliser `getDb()` côté application.
 */
function openDatabase(): BetterSqlite3Database {
  const env = getEnv();
  const log = getLogger();

  if (!env.DB_PATH || env.DB_PATH.trim() === '') {
    throw new Error('[db] DB_PATH est vide — vérifier .env.local / Replit Secrets.');
  }

  const dbPath = path.resolve(env.DB_PATH);
  const dbDir = path.dirname(dbPath);

  // Crée le dossier parent si nécessaire (utile sur Replit au premier démarrage)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log.info({ dbDir }, '[db] dossier créé');
  }

  const db = new Database(dbPath);

  // Pragmas de robustesse — cf docs/ia/secretariat-architecture.md Section 2
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  log.info({ dbPath, journalMode: db.pragma('journal_mode', { simple: true }) }, '[db] ouverte');

  return db;
}

/**
 * Initialise la base : ouverture + migrations.
 * À appeler UNE fois au démarrage du serveur (avant `app.listen`).
 *
 * Idempotent : si les migrations sont déjà jouées, aucune écriture n'est faite.
 */
export function initDatabase(): void {
  const log = getLogger();
  const db = getDb();

  // Créer la table schema_version si absente (avant de lire son contenu)
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = runMigrations(db);

  if (applied.length === 0) {
    log.info('[db] aucune nouvelle migration');
  } else {
    log.info({ migrations: applied }, '[db] migrations appliquées');
  }
}

/**
 * Ferme proprement la connexion DB.
 * À appeler dans le handler SIGTERM / SIGINT.
 */
export function closeDatabase(): void {
  if (cachedDb !== null) {
    const log = getLogger();
    try {
      cachedDb.close();
      log.info('[db] connexion fermée');
    } catch (err) {
      log.error({ err }, '[db] erreur fermeture');
    }
    cachedDb = null;
  }
}

/**
 * Reset le cache. Utile uniquement en test (ex : bascule DB mémoire).
 */
export function resetDbForTests(): void {
  if (cachedDb !== null) {
    try {
      cachedDb.close();
    } catch {
      // ignoré — best effort en test
    }
    cachedDb = null;
  }
}
