/**
 * Storage des timestamps OAuth — health-monitor.
 *
 * Persiste dans /home/runner/issa-data/oauth-timestamps.json
 * avec fallback /tmp/issa-data/ (pattern aligné sur ticktick/poll.ts).
 *
 * Atomic write : .tmp + rename (pas de corruption sur crash).
 * Throttle recordOAuthUsage : 1x/jour max par provider.
 *
 * Jalon S15.5E — Task A.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================
// Constantes
// ============================================================

/** Répertoire de persistance — même pattern que ticktick/poll.ts */
const STORE_DIR = existsSync('/home/runner')
  ? '/home/runner/issa-data'
  : '/tmp/issa-data';

const TIMESTAMPS_PATH = resolve(STORE_DIR, 'oauth-timestamps.json');

/** 180 jours en millisecondes */
const OAUTH_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;

/** Throttle : 24h en millisecondes */
const THROTTLE_MS = 24 * 60 * 60 * 1000;

// ============================================================
// Types
// ============================================================

export type OAuthProvider = 'ticktick' | 'gmail' | 'drive';

export interface OAuthTimestamp {
  /** ISO string — quand le token a été obtenu via callback OAuth */
  obtainedAt: string | null;
  /** ISO string — dernier appel API réussi utilisant ce token */
  lastUsedAt: string | null;
}

type TimestampsStore = Partial<Record<OAuthProvider, OAuthTimestamp>>;

// ============================================================
// Storage helpers (internes, testables via exports nommés)
// ============================================================

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

function readStore(): TimestampsStore {
  try {
    if (!existsSync(TIMESTAMPS_PATH)) return {};
    const raw = readFileSync(TIMESTAMPS_PATH, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('[oauth-timestamps] fichier corrompu (pas un objet) — reset {}');
      return {};
    }
    return parsed as TimestampsStore;
  } catch (err) {
    console.warn('[oauth-timestamps] lecture/parse échouée — reset {}', err);
    return {};
  }
}

function writeStore(store: TimestampsStore): void {
  ensureDir();
  const tmpPath = `${TIMESTAMPS_PATH}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
  renameSync(tmpPath, TIMESTAMPS_PATH);
}

// ============================================================
// API publique
// ============================================================

/**
 * Enregistre un callback OAuth réussi.
 * Pose obtainedAt ET lastUsedAt au timestamp courant.
 */
export function recordOAuthCallback(provider: OAuthProvider): void {
  const store = readStore();
  const now = new Date().toISOString();
  store[provider] = {
    obtainedAt: now,
    lastUsedAt: now,
  };
  writeStore(store);
}

/**
 * Enregistre un usage API (appel réussi).
 * THROTTLE : skip si lastUsedAt < 24h (évite les écritures disque excessives).
 *
 * @returns true si l'écriture a eu lieu, false si throttlé
 */
export function recordOAuthUsage(provider: OAuthProvider): boolean {
  const store = readStore();
  const existing = store[provider];

  if (existing?.lastUsedAt) {
    const lastUsed = new Date(existing.lastUsedAt).getTime();
    if (Date.now() - lastUsed < THROTTLE_MS) {
      return false; // Throttlé — skip
    }
  }

  const now = new Date().toISOString();
  store[provider] = {
    obtainedAt: existing?.obtainedAt ?? null,
    lastUsedAt: now,
  };
  writeStore(store);
  return true;
}

/**
 * Lit les timestamps d'un provider.
 * Retourne null si aucun enregistrement.
 */
export function getOAuthTimestamps(provider: OAuthProvider): OAuthTimestamp | null {
  const store = readStore();
  return store[provider] ?? null;
}

/**
 * Calcule la date d'expiration estimée d'un provider OAuth.
 *
 * - ticktick : obtainedAt + 180j (access token avec durée fixe)
 * - gmail/drive : lastUsedAt + 180j (Google révoque après 180j sans usage)
 *
 * @returns Date d'expiration ou null si pas de données
 */
export function getExpiresAt(provider: OAuthProvider): Date | null {
  const ts = getOAuthTimestamps(provider);
  if (!ts) return null;

  if (provider === 'ticktick') {
    if (!ts.obtainedAt) return null;
    return new Date(new Date(ts.obtainedAt).getTime() + OAUTH_LIFETIME_MS);
  }

  // Gmail et Drive : basé sur lastUsedAt
  if (!ts.lastUsedAt) return null;
  return new Date(new Date(ts.lastUsedAt).getTime() + OAUTH_LIFETIME_MS);
}

// ============================================================
// Test helpers — permettent de configurer le store path pour les tests
// ============================================================

/** Expose le chemin du store (pour les tests) */
export function getStorePath(): string {
  return TIMESTAMPS_PATH;
}
