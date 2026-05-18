/**
 * Anthropic API usage tracker — health-monitor.
 *
 * Persiste dans /home/runner/issa-data/anthropic-usage.json
 * avec fallback /tmp/issa-data/ (pattern aligné sur oauth-timestamps.ts).
 *
 * Atomic write : .tmp + rename (pas de corruption sur crash).
 * Pas de throttle : chaque appel est comptabilisé.
 *
 * Tarifs officiels (janvier 2026, USD per Mtok) :
 *   Haiku 3.5 : input $0.80  / output $4.00  / cache read $0.08
 *   Sonnet 4   : input $3.00  / output $15.00 / cache read $0.30
 *
 * Conversion USD → EUR : taux fixe 0.92.
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

const USAGE_PATH = resolve(STORE_DIR, 'anthropic-usage.json');

const USD_TO_EUR = 0.92;

/**
 * Tarifs Anthropic — USD par million de tokens.
 * Clé = préfixe du model ID (match par startsWith).
 */
const PRICING: Record<string, { inputPerMtok: number; outputPerMtok: number; cacheReadPerMtok: number }> = {
  'claude-haiku-4-5': { inputPerMtok: 0.80, outputPerMtok: 4.00, cacheReadPerMtok: 0.08 },
  'claude-sonnet-4': { inputPerMtok: 3.00, outputPerMtok: 15.00, cacheReadPerMtok: 0.30 },
};

// ============================================================
// Types
// ============================================================

interface UsageStore {
  month: string;
  totalEur: number;
  calls: number;
  byModel: Record<string, number>;
}

export interface RecordUsageParams {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
}

// ============================================================
// Storage helpers
// ============================================================

function ensureDir(): void {
  if (!existsSync(STORE_DIR)) {
    mkdirSync(STORE_DIR, { recursive: true });
  }
}

function loadStore(): UsageStore {
  try {
    if (!existsSync(USAGE_PATH)) {
      return makeEmptyStore();
    }
    const raw = readFileSync(USAGE_PATH, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('[anthropic-usage] fichier corrompu — reset');
      return makeEmptyStore();
    }
    const store = parsed as UsageStore;
    // Validation minimale
    if (typeof store.month !== 'string' || typeof store.totalEur !== 'number') {
      console.warn('[anthropic-usage] structure invalide — reset');
      return makeEmptyStore();
    }
    return store;
  } catch {
    console.warn('[anthropic-usage] lecture échouée — reset');
    return makeEmptyStore();
  }
}

function saveStore(store: UsageStore): void {
  ensureDir();
  const tmpPath = `${USAGE_PATH}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
  renameSync(tmpPath, USAGE_PATH);
}

function makeEmptyStore(): UsageStore {
  return {
    month: getCurrentMonth(),
    totalEur: 0,
    calls: 0,
    byModel: {},
  };
}

/** Retourne le mois courant au format "YYYY-MM" */
function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ============================================================
// Calcul de coût
// ============================================================

/**
 * Résout le pricing pour un model ID.
 * Match par préfixe (ex: 'claude-haiku-4-5-20251001' → 'claude-haiku-4-5').
 * Retourne null si modèle inconnu.
 */
function resolvePricing(model: string): (typeof PRICING)[string] | null {
  for (const prefix of Object.keys(PRICING)) {
    if (model.startsWith(prefix)) {
      return PRICING[prefix] ?? null;
    }
  }
  return null;
}

/**
 * Calcule le coût en EUR d'un appel API.
 */
function computeCostEur(params: RecordUsageParams): number {
  const pricing = resolvePricing(params.model);
  if (!pricing) {
    console.warn(`[anthropic-usage] modèle inconnu "${params.model}" — coût ignoré`);
    return 0;
  }

  const inputCost = (params.inputTokens / 1_000_000) * pricing.inputPerMtok;
  const outputCost = (params.outputTokens / 1_000_000) * pricing.outputPerMtok;
  const cacheCost = ((params.cacheReadTokens ?? 0) / 1_000_000) * pricing.cacheReadPerMtok;

  return (inputCost + outputCost + cacheCost) * USD_TO_EUR;
}

// ============================================================
// API publique
// ============================================================

/**
 * Enregistre un appel API Anthropic.
 * Si le mois stocké est différent du mois courant → reset (nouveau mois).
 * Fire-and-forget, pas de throttle.
 */
export function recordAnthropicUsage(params: RecordUsageParams): void {
  const currentMonth = getCurrentMonth();
  let store = loadStore();

  // Reset si mois différent
  if (store.month !== currentMonth) {
    store = makeEmptyStore();
  }

  const costEur = computeCostEur(params);

  // Normaliser le nom du modèle pour byModel (retirer la date)
  const modelKey = normalizeModelKey(params.model);

  store.totalEur += costEur;
  store.calls += 1;
  store.byModel[modelKey] = (store.byModel[modelKey] ?? 0) + costEur;

  saveStore(store);
}

/**
 * Retourne le total EUR dépensé ce mois-ci.
 */
export async function getMonthlyUsageEur(): Promise<number> {
  const store = loadStore();
  const currentMonth = getCurrentMonth();
  if (store.month !== currentMonth) return 0;
  return store.totalEur;
}

/**
 * Retourne le budget mensuel EUR (depuis env, défaut 50€).
 */
export function getMonthlyBudgetEur(): number {
  return parseInt(process.env.ANTHROPIC_MONTHLY_BUDGET_EUR ?? '50', 10);
}

// ============================================================
// Helpers internes
// ============================================================

/**
 * Normalise le model ID pour le regroupement byModel.
 * Ex: 'claude-haiku-4-5-20251001' → 'haiku-4-5'
 *     'claude-sonnet-4-20250514' → 'sonnet-4'
 */
function normalizeModelKey(model: string): string {
  // Retirer le préfixe 'claude-' et la date suffixe
  let key = model.replace(/^claude-/, '');
  key = key.replace(/-\d{8}$/, '');
  return key;
}

/** Expose le chemin du store (pour les tests) */
export function getStorePath(): string {
  return USAGE_PATH;
}
