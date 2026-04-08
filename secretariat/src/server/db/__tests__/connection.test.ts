/**
 * Tests unitaires — connexion SQLite + migrations.
 *
 * Stratégie :
 *  - Créer un fichier DB temporaire par test (os.tmpdir())
 *  - Set DB_PATH dans process.env avant de charger env
 *  - Vérifier que initDatabase() applique les migrations
 *  - Vérifier que les 7 tables + schema_version existent
 *  - Vérifier l'idempotence (2e appel = no-op)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getDb, initDatabase, resetDbForTests } from '../connection';
import { resetEnvForTests } from '../../utils/env';
import { resetLoggerForTests } from '../../utils/logger';

const SNAPSHOT = { ...process.env };

const VALID_ENV = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake-key-for-tests-only',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake_test_key',
  SESSION_TTL_HOURS: '24',
};

const EXPECTED_TABLES = [
  'contacts',
  'cr_drafts',
  'cr_published',
  'whitelist_whatsapp',
  'whatsapp_sessions',
  'access_logs',
  'generation_logs',
  'schema_version',
];

describe('db connection + migrations', () => {
  let tempDbPath: string;

  beforeEach(() => {
    // Fichier DB unique par test (évite les collisions WAL)
    tempDbPath = path.join(
      os.tmpdir(),
      `issa-sec-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);
    process.env.DB_PATH = tempDbPath;

    resetEnvForTests();
    resetLoggerForTests();
    resetDbForTests();
  });

  afterEach(() => {
    resetDbForTests();
    resetEnvForTests();
    resetLoggerForTests();

    // Cleanup fichiers DB (+ WAL/SHM)
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      try {
        fs.unlinkSync(tempDbPath + suffix);
      } catch {
        // ignoré
      }
    }

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);
  });

  it('initDatabase() crée le fichier DB et applique la migration initiale', () => {
    initDatabase();
    expect(fs.existsSync(tempDbPath)).toBe(true);

    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);

    for (const expected of EXPECTED_TABLES) {
      expect(names).toContain(expected);
    }
  });

  it('enregistre la version 1 dans schema_version après migration initiale', () => {
    initDatabase();
    const db = getDb();

    const row = db
      .prepare('SELECT version, applied_at FROM schema_version ORDER BY version DESC LIMIT 1')
      .get() as { version: number; applied_at: string } | undefined;

    expect(row).toBeDefined();
    expect(row?.version).toBe(1);
    expect(row?.applied_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('initDatabase() est idempotent (2e appel = no-op)', () => {
    initDatabase();
    initDatabase(); // ne doit pas throw

    const db = getDb();
    const count = db
      .prepare('SELECT COUNT(*) as c FROM schema_version WHERE version = 1')
      .get() as { c: number };

    // La migration 1 ne doit être présente qu'une seule fois
    expect(count.c).toBe(1);
  });

  it('active les pragmas WAL et foreign_keys', () => {
    initDatabase();
    const db = getDb();

    const journalMode = db.pragma('journal_mode', { simple: true });
    const foreignKeys = db.pragma('foreign_keys', { simple: true });

    expect(String(journalMode).toLowerCase()).toBe('wal');
    expect(Number(foreignKeys)).toBe(1);
  });

  it('permet un INSERT/SELECT trivial sur contacts', () => {
    initDatabase();
    const db = getDb();

    db.prepare(
      `INSERT INTO contacts (id, prenom, nom, source, created_at, updated_at)
       VALUES (?, ?, ?, 'import_initial', datetime('now'), datetime('now'))`,
    ).run('test-uuid-1', 'Jean', 'Test');

    const row = db
      .prepare('SELECT prenom, nom FROM contacts WHERE id = ?')
      .get('test-uuid-1') as { prenom: string; nom: string } | undefined;

    expect(row).toBeDefined();
    expect(row?.prenom).toBe('Jean');
    expect(row?.nom).toBe('Test');
  });
});
