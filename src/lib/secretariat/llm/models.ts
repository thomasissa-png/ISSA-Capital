/**
 * Centralisation des constantes modèles Anthropic.
 *
 * Source unique pour tout `secretariat/`. Ne JAMAIS hardcoder un model ID
 * ailleurs dans le code — toujours importer depuis ce fichier.
 *
 * Override possible via env :
 *   - ANTHROPIC_MODEL_OVERRIDE_SONNET → remplace SONNET_4
 *   - ANTHROPIC_MODEL_OVERRIDE_HAIKU  → remplace HAIKU_4_5
 *
 * Référence audit @ia S16 (W1) + reco S1 (A/B Sonnet 4.6) :
 * `docs/ia/anya-audit-s16.md`.
 */

// ============================================================
// Constantes par défaut (model IDs Anthropic officiels)
// ============================================================

/** Haiku 4.5 — triage email, router inbox. ~5x moins cher que Sonnet. */
export const HAIKU_4_5 = 'claude-haiku-4-5-20251001';

/** Sonnet 4 — CR (web_search), draft email. Production stable S4→S16. */
export const SONNET_4 = 'claude-sonnet-4-20250514';

/**
 * Sonnet 4.6 — préparé pour A/B test futur (reco audit S16 — S1).
 * Activer via env ANTHROPIC_MODEL_OVERRIDE_SONNET=claude-sonnet-4-6
 * pour basculer sans toucher au code.
 */
// export const SONNET_4_6 = 'claude-sonnet-4-6';

// ============================================================
// Résolution dynamique (avec override env)
// ============================================================

/**
 * Retourne le modèle Sonnet effectif (avec override env si défini).
 */
export function resolveSonnetModel(): string {
  const override = process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;
  if (override && override.trim().length > 0) {
    return override.trim();
  }
  return SONNET_4;
}

/**
 * Retourne le modèle Haiku effectif (avec override env si défini).
 */
export function resolveHaikuModel(): string {
  const override = process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU;
  if (override && override.trim().length > 0) {
    return override.trim();
  }
  return HAIKU_4_5;
}

/**
 * Type union des familles de modèles supportées.
 */
export type ModelFamily = 'sonnet' | 'haiku';

/**
 * Résout un modèle par famille (sucre syntaxique pour le wrapper).
 */
export function resolveModelByFamily(family: ModelFamily): string {
  return family === 'sonnet' ? resolveSonnetModel() : resolveHaikuModel();
}
