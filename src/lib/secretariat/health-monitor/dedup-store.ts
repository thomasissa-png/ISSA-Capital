/**
 * Dedup store — empêche les notifications health-monitor en double.
 *
 * Persiste dans /home/runner/issa-data/notifications-sent.json
 * avec fallback /tmp/issa-data/ (pattern aligné sur oauth-timestamps.ts).
 *
 * Clé composite : `${itemId}:${threshold}`.
 * TTL auto-purge : entries > 1 an supprimées à chaque saveStore().
 *
 * Jalon S15.5E — Task B.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================
// Constantes
// ============================================================

const STORE_DIR = existsSync('/home/runner')
  ? '/home/runner/issa-data'
  : '/tmp/issa-data';

const DEDUP_PATH = resolve(STORE_DIR, 'notifications-sent.json');

/** 1 an en millisecondes — TTL pour auto-purge */
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// ============================================================
// Types
// ============================================================

interface DedupEntry {
  sentAt: number;
  snoozedUntil: number | null;
}

type DedupStoreData = Record<string, DedupEntry>;

// ============================================================
// Storage helpers
// ============================================================

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

export function loadStore(): DedupStoreData {
  try {
    if (!existsSync(DEDUP_PATH)) return {};
    const raw = readFileSync(DEDUP_PATH, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('[dedup-store] fichier corrompu — reset {}');
      return {};
    }
    return parsed as DedupStoreData;
  } catch {
    console.warn('[dedup-store] lecture échouée — reset {}');
    return {};
  }
}

export function saveStore(store: DedupStoreData): void {
  ensureDir();

  // Auto-purge entries > 1 an
  const now = Date.now();
  const purged: DedupStoreData = {};
  for (const [key, entry] of Object.entries(store)) {
    if (now - entry.sentAt < ONE_YEAR_MS) {
      purged[key] = entry;
    }
  }

  const tmpPath = `${DEDUP_PATH}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(purged, null, 2), 'utf-8');
  renameSync(tmpPath, DEDUP_PATH);
}

// ============================================================
// API publique
// ============================================================

/**
 * Retourne true si l'item doit être notifié pour ce threshold.
 * True si : jamais notifié OU snooze expiré.
 * False si : déjà notifié ET pas de snooze OU snooze pas encore expiré.
 *
 * NE fait PAS d'écriture disque (lecture seule).
 */
export function shouldNotify(itemId: string, threshold: number): boolean {
  const store = loadStore();
  const key = `${itemId}:${threshold}`;
  const entry = store[key];

  if (!entry) return true; // Jamais notifié

  // Si snoozé et snooze expiré → notifier
  if (entry.snoozedUntil !== null && Date.now() >= entry.snoozedUntil) {
    return true;
  }

  // Déjà notifié, pas de snooze ou snooze pas encore expiré
  return false;
}

/**
 * Marque un item comme notifié pour un threshold donné.
 * Pose sentAt = Date.now(), snoozedUntil = null.
 */
export function markNotified(itemId: string, threshold: number): void {
  const store = loadStore();
  const key = `${itemId}:${threshold}`;
  store[key] = { sentAt: Date.now(), snoozedUntil: null };
  saveStore(store);
}

/**
 * Snooze un item pour N jours.
 * Pose snoozedUntil sur TOUTES les entries de cet itemId (tous thresholds).
 */
export function snooze(itemId: string, daysFromNow: number): void {
  const store = loadStore();
  const snoozedUntil = Date.now() + daysFromNow * 86_400_000;
  const prefix = `${itemId}:`;

  for (const key of Object.keys(store)) {
    if (key.startsWith(prefix)) {
      const entry = store[key];
      if (entry) {
        entry.snoozedUntil = snoozedUntil;
      }
    }
  }

  saveStore(store);
}

/**
 * Supprime toutes les entries d'un item (tous thresholds).
 * Utilisé quand Thomas clique "Marqué comme renouvelé".
 */
export function resetItem(itemId: string): void {
  const store = loadStore();
  const prefix = `${itemId}:`;

  for (const key of Object.keys(store)) {
    if (key.startsWith(prefix)) {
      delete store[key];
    }
  }

  saveStore(store);
}

/** Expose le chemin du store (pour les tests) */
export function getStorePath(): string {
  return DEDUP_PATH;
}
