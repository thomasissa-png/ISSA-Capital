/**
 * Helpers partagés pour les tests d'intégration du router admin.
 *
 * - Setup d'une DB SQLite temporaire par test
 * - Chargement d'un env valide incluant ADMIN_PASSWORD_HASH + JWT_SECRET
 * - Helper pour forger un JWT admin et construire un cookie
 * - Helper pour authentifier une requête supertest
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

// Mot de passe en clair utilisé dans les tests de login.
export const TEST_PASSWORD = 'testpass123';
// Hash bcrypt (cost 10) du mot de passe ci-dessus — fixe pour les tests.
// Généré via `hashPassword(TEST_PASSWORD)`.
export const TEST_PASSWORD_HASH =
  '$2a$10$t4CmclbHQg8Vq8bApZdhc.yvtvQrsuJkNWujFKJDJDUUuFePjnDTa';

export const TEST_JWT_SECRET =
  'test-jwt-secret-at-least-32-characters-long-for-tests';

export const VALID_ADMIN_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake-key-for-tests-only',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake_test_key',
  SESSION_TTL_HOURS: '24',
  JWT_SECRET: TEST_JWT_SECRET,
  ADMIN_SESSION_TTL_HOURS: '24',
};

export function makeTempDbPath(): string {
  return path.join(
    os.tmpdir(),
    `issa-sec-admin-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
  );
}

export function cleanupTempDb(tempDbPath: string): void {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    try {
      fs.unlinkSync(tempDbPath + suffix);
    } catch {
      // ignoré
    }
  }
  // Clean signature.png éventuel dans le même dossier
  try {
    const sigPath = path.join(path.dirname(tempDbPath), 'signature.png');
    fs.unlinkSync(sigPath);
  } catch {
    // ignoré
  }
}

export function restoreEnv(snapshot: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, snapshot);
}

export function applyAdminEnv(dbPath: string, overrides?: Record<string, string>): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, VALID_ADMIN_ENV);
  process.env.DB_PATH = dbPath;
  process.env.ADMIN_PASSWORD_HASH = TEST_PASSWORD_HASH;
  if (overrides) {
    Object.assign(process.env, overrides);
  }
}

/**
 * Précalcule un hash bcrypt (à usage de maintenance — n'est pas appelé par
 * les tests eux-mêmes). Utilisé pour régénérer TEST_PASSWORD_HASH si on
 * change TEST_PASSWORD.
 */
export async function recomputeHash(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** Génère un id contact de test (uuid v4). */
export function newId(): string {
  return randomUUID();
}

/**
 * Insère un contact minimal dans la table contacts (pour les tests PATCH/DELETE).
 */
export function seedContact(
  db: import('better-sqlite3').Database,
  overrides?: Partial<{
    id: string;
    prenom: string;
    nom: string;
    email: string | null;
    whatsappAuthorized: boolean;
    deletedAt: string | null;
  }>,
): string {
  const id = overrides?.id ?? newId();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO contacts
      (id, prenom, nom, titre, societe, email, telephone,
       whatsapp_authorized, entites_visibles, notes, source,
       created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, NULL, NULL, ?, NULL, ?, '[]', NULL, 'test', ?, ?, ?)`,
  ).run(
    id,
    overrides?.prenom ?? 'Alice',
    overrides?.nom ?? 'Dupont',
    overrides?.email ?? null,
    overrides?.whatsappAuthorized ? 1 : 0,
    now,
    now,
    overrides?.deletedAt ?? null,
  );
  return id;
}
