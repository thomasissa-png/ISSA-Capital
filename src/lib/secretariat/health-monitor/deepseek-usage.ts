/**
 * DeepSeek API usage tracker — health-monitor.
 *
 * Calqué sur `anthropic-usage.ts` (même mécanisme de persistance pour
 * cohérence du monitoring) : fichier JSON unique, atomic write (.tmp + rename),
 * reset mensuel, agrégation EUR + byModel. Pas de throttle.
 *
 * Persiste dans /home/runner/issa-data/deepseek-usage.json
 * avec fallback /tmp/issa-data/.
 *
 * Tarifs DeepSeek V4 Flash (USD per Mtok) — à ajuster si grille officielle change.
 * Conversion USD → EUR : taux fixe 0.92.
 *
 * Jalon S22 — routage DeepSeek par tâche.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================
// Constantes
// ============================================================

const STORE_DIR = existsSync('/home/runner')
  ? '/home/runner/issa-data'
  : '/tmp/issa-data';

const USAGE_PATH = resolve(STORE_DIR, 'deepseek-usage.json');

const USD_TO_EUR = 0.92;

/**
 * Tarifs DeepSeek — USD par million de tokens.
 * Clé = préfixe du model ID (match par startsWith).
 */
const PRICING: Record<string, { promptPerMtok: number; completionPerMtok: number }> = {
  // V4 Pro : tarif courant post-baisse 75% (mai 2026) — ~$0.435 in / $0.87 out.
  'deepseek-v4-pro': { promptPerMtok: 0.435, completionPerMtok: 0.87 },
  'deepseek-v4-flash': { promptPerMtok: 0.1, completionPerMtok: 0.3 },
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

export interface RecordDeepSeekUsageParams {
  model: string;
  promptTokens: number;
  completionTokens: number;
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
      console.warn('[deepseek-usage] fichier corrompu — reset');
      return makeEmptyStore();
    }
    const store = parsed as UsageStore;
    if (typeof store.month !== 'string' || typeof store.totalEur !== 'number') {
      console.warn('[deepseek-usage] structure invalide — reset');
      return makeEmptyStore();
    }
    return store;
  } catch {
    console.warn('[deepseek-usage] lecture échouée — reset');
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

function resolvePricing(model: string): (typeof PRICING)[string] | null {
  for (const prefix of Object.keys(PRICING)) {
    if (model.startsWith(prefix)) {
      return PRICING[prefix] ?? null;
    }
  }
  return null;
}

function computeCostEur(params: RecordDeepSeekUsageParams): number {
  const pricing = resolvePricing(params.model);
  if (!pricing) {
    console.warn(`[deepseek-usage] modèle inconnu "${params.model}" — coût ignoré`);
    return 0;
  }
  const promptCost = (params.promptTokens / 1_000_000) * pricing.promptPerMtok;
  const completionCost = (params.completionTokens / 1_000_000) * pricing.completionPerMtok;
  return (promptCost + completionCost) * USD_TO_EUR;
}

// ============================================================
// API publique
// ============================================================

/**
 * Enregistre un appel API DeepSeek.
 * Reset si le mois stocké diffère du mois courant. Pas de throttle.
 */
export function recordDeepSeekUsage(params: RecordDeepSeekUsageParams): void {
  const currentMonth = getCurrentMonth();
  let store = loadStore();

  if (store.month !== currentMonth) {
    store = makeEmptyStore();
  }

  const costEur = computeCostEur(params);

  store.totalEur += costEur;
  store.calls += 1;
  store.byModel[params.model] = (store.byModel[params.model] ?? 0) + costEur;

  saveStore(store);
}

/** Retourne le total EUR dépensé ce mois-ci sur DeepSeek. */
export async function getMonthlyDeepSeekUsageEur(): Promise<number> {
  const store = loadStore();
  const currentMonth = getCurrentMonth();
  if (store.month !== currentMonth) return 0;
  return store.totalEur;
}

/**
 * Retourne le budget mensuel DeepSeek en EUR (env `DEEPSEEK_MONTHLY_BUDGET_EUR`,
 * défaut 20 €). Le coût DeepSeek est ~10× inférieur à Anthropic ; budget plus bas
 * légitime — adapter via env si l'usage augmente.
 *
 * S25 (2026-05-29) : ajout pour brancher l'item `deepseek_monthly_quota` dans le
 * health-monitor (audit reviewer 29/05 — angle mort signalé : `deepseek-usage.ts`
 * existait mais n'alimentait aucun item du monitor).
 */
export function getMonthlyDeepSeekBudgetEur(): number {
  return parseInt(process.env.DEEPSEEK_MONTHLY_BUDGET_EUR ?? '20', 10);
}

/** Expose le chemin du store (pour les tests) */
export function getDeepSeekStorePath(): string {
  return USAGE_PATH;
}
