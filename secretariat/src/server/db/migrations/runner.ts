/**
 * Runner de migrations SQL simple.
 *
 * Conventions :
 *  - Chaque migration est un fichier `NNN_nom.sql` dans ce dossier
 *  - Le numéro NNN (3 chiffres) détermine l'ordre d'application
 *  - Chaque migration DOIT se terminer par `INSERT INTO schema_version ...`
 *  - Les migrations sont exécutées dans une transaction (rollback sur erreur)
 *  - Le runner est idempotent : toute migration dont le numéro est déjà
 *    présent dans `schema_version` est ignorée
 *
 * Usage CLI :
 *   npm run migrate         → applique les migrations en attente
 *
 * Usage programmatique (au démarrage serveur) :
 *   import { runMigrations } from './migrations/runner';
 *   runMigrations(db);
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';

const MIGRATIONS_DIR = __dirname;
const MIGRATION_FILE_REGEX = /^(\d{3})_[a-z0-9_]+\.sql$/i;

interface MigrationFile {
  version: number;
  filename: string;
  fullPath: string;
}

/**
 * Liste les fichiers de migration présents dans le dossier, triés par version.
 */
function listMigrationFiles(): MigrationFile[] {
  const entries = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });

  const files: MigrationFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(MIGRATION_FILE_REGEX);
    if (!match || !match[1]) continue;

    files.push({
      version: Number.parseInt(match[1], 10),
      filename: entry.name,
      fullPath: path.join(MIGRATIONS_DIR, entry.name),
    });
  }

  files.sort((a, b) => a.version - b.version);
  return files;
}

/**
 * Retourne la version max déjà appliquée (0 si table vide).
 */
function getAppliedVersions(db: BetterSqlite3Database): Set<number> {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const rows = db.prepare('SELECT version FROM schema_version').all() as Array<{
    version: number;
  }>;
  return new Set(rows.map((r) => r.version));
}

/**
 * Applique les migrations en attente.
 * Retourne la liste des migrations effectivement appliquées.
 *
 * Chaque migration est exécutée dans une transaction : si une instruction
 * échoue, la transaction est annulée et l'erreur est re-lancée.
 */
export function runMigrations(db: BetterSqlite3Database): MigrationFile[] {
  const files = listMigrationFiles();
  const applied = getAppliedVersions(db);

  const toApply = files.filter((f) => !applied.has(f.version));
  const executed: MigrationFile[] = [];

  for (const migration of toApply) {
    const sql = fs.readFileSync(migration.fullPath, 'utf8');

    // better-sqlite3 exécute le script complet via exec() ; la transaction
    // est démarrée manuellement pour englober tout le fichier.
    const run = db.transaction(() => {
      db.exec(sql);
    });

    try {
      run();
      executed.push(migration);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[migrations] échec migration ${migration.filename} : ${reason}`,
      );
    }
  }

  return executed;
}

// ------------------------------------------------------------
// CLI entry point — `npm run migrate`
// ------------------------------------------------------------
// Exécuté uniquement si ce fichier est lancé directement (pas importé).
// En import programmatique, ce bloc est ignoré.
if (require.main === module) {
  // Charge .env.local avant l'import de connection (qui instancie env.ts)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: '.env.local' });

  // Import dynamique pour éviter la dépendance circulaire avec connection.ts
  // (connection.ts importe runMigrations depuis ce fichier).
  // En CLI on ouvre une connexion dédiée.
  (async () => {
    const { getDb } = await import('../connection');
    const { getLogger } = await import('../../utils/logger');
    const log = getLogger();

    try {
      const db = getDb();
      const executed = runMigrations(db);

      if (executed.length === 0) {
        log.info('[migrate] aucune migration en attente');
      } else {
        log.info(
          { migrations: executed.map((m) => m.filename) },
          '[migrate] migrations appliquées',
        );
      }
      process.exit(0);
    } catch (err) {
      log.error({ err }, '[migrate] échec');
      process.exit(1);
    }
  })();
}
