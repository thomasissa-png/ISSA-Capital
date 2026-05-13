/**
 * Résolution nom de label Gmail → labelId.
 *
 * Cache TTL 1h (même pattern que drive-resolver.ts du vault-client).
 * Règle CLAUDE.md n23 : listing complet + filtre local.
 *
 * Labels cibles :
 *   - "Anya/traité" → utilisé pour marquer un email comme traité
 *   - "Anya/à-revoir" → utilisé pour marquer un email en erreur
 */

import { listLabels } from './gmail-client';

// ============================================================
// Constantes
// ============================================================

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

// ============================================================
// Types
// ============================================================

interface LabelCacheEntry {
  labels: Map<string, string>; // name → id
  cachedAt: number;
}

// ============================================================
// Cache
// ============================================================

let labelCache: LabelCacheEntry | null = null;

/**
 * Invalide le cache des labels (pour les tests ou après modification).
 */
export function invalidateLabelCache(): void {
  labelCache = null;
}

/**
 * Retourne le nombre de labels en cache (pour les tests).
 */
export function getLabelCacheSize(): number {
  return labelCache?.labels.size ?? 0;
}

// ============================================================
// Résolution
// ============================================================

/**
 * Charge tous les labels Gmail et les met en cache.
 * Listing complet + filtre local (règle 23 CLAUDE.md).
 */
async function loadLabels(): Promise<Map<string, string>> {
  // Vérifier le cache
  if (labelCache && Date.now() - labelCache.cachedAt < CACHE_TTL_MS) {
    return labelCache.labels;
  }

  const rawLabels = await listLabels();
  const map = new Map<string, string>();

  for (const label of rawLabels) {
    map.set(label.name, label.id);
  }

  // Logger pour diagnostic (règle 23 : liste visible en WARN)
  console.warn(
    `[label-resolver] ${rawLabels.length} labels chargés. Noms : ${rawLabels.map((l) => l.name).join(', ').slice(0, 500)}`,
  );

  labelCache = { labels: map, cachedAt: Date.now() };
  return map;
}

/**
 * Résout un nom de label en labelId.
 *
 * @param labelName Nom complet du label (ex: "Anya/traité")
 * @returns labelId ou null si non trouvé
 */
export async function resolveLabelId(labelName: string): Promise<string | null> {
  const labels = await loadLabels();

  // 1. Match exact
  const exact = labels.get(labelName);
  if (exact) return exact;

  // 2. Match case-insensitive
  const normalizedTarget = labelName.toLowerCase();
  for (const [name, id] of labels) {
    if (name.toLowerCase() === normalizedTarget) {
      console.warn(
        `[label-resolver] match case-insensitive "${labelName}" → "${name}" (id=${id})`,
      );
      return id;
    }
  }

  console.warn(`[label-resolver] label "${labelName}" non trouvé parmi ${labels.size} labels`);
  return null;
}

/**
 * Résout le label "Anya/traité" configuré via env var.
 * Env var : GMAIL_LABEL_TRAITE (défaut: "Anya/traité")
 */
export async function resolveTraiteLabel(): Promise<string | null> {
  const labelName = process.env.GMAIL_LABEL_TRAITE ?? 'Anya/traité';
  return resolveLabelId(labelName);
}

/**
 * Résout le label "Anya/à-revoir" configuré via env var.
 * Env var : GMAIL_LABEL_A_REVOIR (défaut: "Anya/à-revoir")
 */
export async function resolveARevoir(): Promise<string | null> {
  const labelName = process.env.GMAIL_LABEL_A_REVOIR ?? 'Anya/à-revoir';
  return resolveLabelId(labelName);
}
