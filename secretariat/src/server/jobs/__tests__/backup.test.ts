/**
 * Tests d'intégration — job backup SQLite (Phase 6).
 *
 * Couverture (5 tests) :
 *  - runBackup() crée un fichier .db dans le dossier cible
 *  - Le fichier créé est une DB SQLite lisible (mêmes données que source)
 *  - rotateLocalBackups supprime les fichiers > rétention
 *  - rotateLocalBackups garde les fichiers récents
 *  - S3 et B2 stubs ne sont pas appelés si flags désactivés
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { rotateLocalBackups, runBackup } from '../backup';

const SNAPSHOT = { ...process.env };

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'issa-backup-test-'));
}

function makeTempDbPath(dir: string): string {
  return path.join(dir, 'source.db');
}

function writeBaseDb(dbPath: string): void {
  const db = new Database(dbPath);
  db.exec(`CREATE TABLE cr_published (
    reference TEXT PRIMARY KEY,
    markdown TEXT,
    markdown_sha256 TEXT,
    rfc3161_token TEXT,
    rfc3161_provider TEXT,
    rfc3161_requested_at TEXT
  );`);
  db.prepare(
    'INSERT INTO cr_published (reference, markdown, markdown_sha256) VALUES (?, ?, ?)',
  ).run(
    'IC-CR-2026-0001',
    '# Test',
    '0000000000000000000000000000000000000000000000000000000000000000',
  );
  db.close();
}

const VALID_BASE_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake',
  SESSION_TTL_HOURS: '24',
};

describe('jobs/backup', () => {
  let tempDir: string;
  let dbPath: string;
  let backupDir: string;

  beforeEach(async () => {
    tempDir = makeTempDir();
    dbPath = makeTempDbPath(tempDir);
    backupDir = path.join(tempDir, 'backups');

    // Create source DB with a minimal schema we control.
    writeBaseDb(dbPath);

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_BASE_ENV, {
      DB_PATH: dbPath,
      BACKUP_DIR: backupDir,
      BACKUP_LOCAL_RETENTION: '30',
    });

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    const { resetDbForTests } = await import('../../db/connection');
    resetEnvForTests();
    resetLoggerForTests();
    resetDbForTests();
  });

  afterEach(async () => {
    const { resetDbForTests } = await import('../../db/connection');
    resetDbForTests();

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    resetEnvForTests();
    resetLoggerForTests();

    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignoré
    }
  });

  it('runBackup() crée un fichier .db dans le dossier cible', async () => {
    const stats = await runBackup();

    expect(stats.created).toMatch(/issa-sec-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db$/);
    expect(stats.sizeBytes).toBeGreaterThan(0);
    expect(stats.s3Pushed).toBe(false);
    expect(stats.b2Pushed).toBe(false);
    expect(fs.existsSync(stats.created)).toBe(true);
  });

  it('le fichier de backup est une DB SQLite lisible avec les données source', async () => {
    const stats = await runBackup();

    const backup = new Database(stats.created, { readonly: true });
    const row = backup
      .prepare('SELECT reference FROM cr_published WHERE reference = ?')
      .get('IC-CR-2026-0001') as { reference: string } | undefined;
    backup.close();

    expect(row).toBeDefined();
    expect(row?.reference).toBe('IC-CR-2026-0001');
  });

  it('rotateLocalBackups supprime les fichiers > rétention', () => {
    // Crée 3 fichiers : 40j, 10j, 1j
    const now = Date.now();
    const files = [
      { name: `issa-sec-${isoPart(now - 40 * 86400_000)}.db`, age: 40 },
      { name: `issa-sec-${isoPart(now - 10 * 86400_000)}.db`, age: 10 },
      { name: `issa-sec-${isoPart(now - 1 * 86400_000)}.db`, age: 1 },
    ];
    fs.mkdirSync(backupDir, { recursive: true });
    for (const f of files) {
      fs.writeFileSync(path.join(backupDir, f.name), 'fake db content');
    }

    const removed = rotateLocalBackups(backupDir, 30);

    expect(removed).toBe(1); // seul le fichier de 40j doit être supprimé
    const remaining = fs.readdirSync(backupDir);
    expect(remaining).toHaveLength(2);
    expect(remaining.every((f) => !f.includes(isoPart(now - 40 * 86400_000)))).toBe(true);
  });

  it('rotateLocalBackups retourne 0 si aucun fichier > rétention', () => {
    const now = Date.now();
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(
      path.join(backupDir, `issa-sec-${isoPart(now - 5 * 86400_000)}.db`),
      'fake',
    );
    fs.writeFileSync(
      path.join(backupDir, `issa-sec-${isoPart(now - 1 * 86400_000)}.db`),
      'fake',
    );

    const removed = rotateLocalBackups(backupDir, 30);
    expect(removed).toBe(0);
  });

  it('runBackup n\'appelle pas les stubs S3/B2 par défaut', async () => {
    const stats = await runBackup();
    expect(stats.s3Pushed).toBe(false);
    expect(stats.b2Pushed).toBe(false);
  });
});

/** Format ISO compact utilisé dans les noms de backup : 2026-04-09T12-34-56 */
function isoPart(ms: number): string {
  return new Date(ms).toISOString().replace(/[:.]/g, '-').slice(0, 19);
}
