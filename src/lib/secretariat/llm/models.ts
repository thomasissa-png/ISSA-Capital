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

/** Haiku 4.5 — modèle Anthropic léger (famille haiku). */
export const HAIKU_4_5 = 'claude-haiku-4-5-20251001';

/** Sonnet 4 (legacy) — ancienne version. Conservée pour rollback via override env. */
export const SONNET_4 = 'claude-sonnet-4-20250514';

/**
 * Sonnet 4.6 — version Sonnet COURANTE (S23). Défaut de la famille `sonnet`,
 * utilisée par le CR (web_search). Rollback possible via
 * ANTHROPIC_MODEL_OVERRIDE_SONNET=claude-sonnet-4-20250514.
 */
export const SONNET_4_6 = 'claude-sonnet-4-6';

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
  return SONNET_4_6;
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

// ============================================================
// DeepSeek — modèle externe compatible OpenAI
// ============================================================

/**
 * DeepSeek V4 Flash — tier économique (legacy S22). Conservé pour rollback
 * par tâche via env `LLM_TASK_OVERRIDE_<TASK>=deepseek-v4-flash`.
 * String exacte attendue par l'endpoint `/chat/completions`.
 */
export const DEEPSEEK_V4_FLASH = 'deepseek-v4-flash';

/**
 * DeepSeek V4 Pro — tier supérieur (raisonnement complexe, génération, code).
 * Choisi par Thomas (S23) pour router inbox / triage email / brouillon email /
 * hot-context : qualité privilégiée sur le coût. String exacte API DeepSeek.
 */
export const DEEPSEEK_V4_PRO = 'deepseek-v4-pro';

// ============================================================
// Registre tâche → modèle (sélection PAR TÂCHE — S22)
// ============================================================

/**
 * Liste exhaustive des tâches LLM d'Anya routables.
 * Toute nouvelle tâche DOIT être ajoutée ici ET dans `TASK_MODEL`.
 */
export type LLMTask =
  | 'inbox-router'
  | 'email-triage'
  | 'hot-context-detect'
  | 'hot-context-modify'
  | 'email-draft'
  | 'morning-citation'
  | 'cr';

/**
 * Configuration d'une tâche : provider + modèle effectif.
 * - `anthropic` : `family` (résolu via override env) ou `model` explicite.
 * - `deepseek`  : `model` (string DeepSeek, ex `deepseek-v4-flash`).
 */
export interface TaskModelConfig {
  provider: 'anthropic' | 'deepseek';
  family?: ModelFamily;
  model?: string;
}

/**
 * Mapping par défaut tâche → modèle.
 *
 * Stratégie S23 (décision Thomas, affinée après observation prod) :
 *  - DeepSeek V4 **Flash** : tâches de CLASSEMENT/EXTRACTION JSON lean (routage
 *    inbox, triage email, détection/modif hot-context). Flash est lean, rapide,
 *    ~4x moins cher et ne tronque pas — V4 Pro était trop verbeux (JSON triage
 *    tronqué en prod run 19:00).
 *  - DeepSeek V4 **Pro** : RÉDACTION (brouillon email) — qualité de prose.
 *  - Anthropic Sonnet 4.6 : CR (utilise web_search — exclusivité Anthropic).
 *
 * Override par tâche via env `LLM_TASK_OVERRIDE_<TASK_UPPER_SNAKE>`
 * (voir `resolveTaskModel`). Ex bascule draft sur Flash : `=deepseek-v4-flash`.
 */
export const TASK_MODEL: Record<LLMTask, TaskModelConfig> = {
  'inbox-router': { provider: 'deepseek', model: DEEPSEEK_V4_FLASH },
  'email-triage': { provider: 'deepseek', model: DEEPSEEK_V4_FLASH },
  'hot-context-detect': { provider: 'deepseek', model: DEEPSEEK_V4_FLASH },
  'hot-context-modify': { provider: 'deepseek', model: DEEPSEEK_V4_FLASH },
  'email-draft': { provider: 'deepseek', model: DEEPSEEK_V4_PRO },
  // Brief du matin (S23) : distillation lean d'une citation depuis une fiche de
  // lecture → Flash (extraction courte, ~0 €, ne tronque pas).
  'morning-citation': { provider: 'deepseek', model: DEEPSEEK_V4_FLASH },
  cr: { provider: 'anthropic', family: 'sonnet' },
};

/** Résultat normalisé de la résolution d'une tâche. */
export interface ResolvedTaskModel {
  provider: 'anthropic' | 'deepseek';
  model: string;
}

/**
 * Convertit un nom de tâche en suffixe d'env (UPPER_SNAKE).
 * Ex : `email-triage` → `EMAIL_TRIAGE`.
 */
function taskEnvSuffix(task: LLMTask): string {
  return task.replace(/-/g, '_').toUpperCase();
}

/**
 * Résout le provider + modèle effectif d'une tâche.
 *
 * Override env (prioritaire) : `LLM_TASK_OVERRIDE_<TASK_UPPER_SNAKE>`.
 * Formats acceptés :
 *   - `deepseek:deepseek-v4-flash`     → provider explicite + modèle
 *   - `anthropic:claude-sonnet-4-...`  → provider explicite + modèle
 *   - `claude-sonnet-4-...`            → modèle seul, provider déduit
 *     (préfixe `claude` ou `anthropic` → anthropic, sinon deepseek)
 *
 * Sans override : lit `TASK_MODEL`. Pour anthropic+family, résout le model
 * via `resolveModelByFamily` (applique les overrides ANTHROPIC_MODEL_OVERRIDE_*).
 */
export function resolveTaskModel(task: LLMTask): ResolvedTaskModel {
  const override = process.env[`LLM_TASK_OVERRIDE_${taskEnvSuffix(task)}`];
  if (override && override.trim().length > 0) {
    const raw = override.trim();
    const sep = raw.indexOf(':');
    if (sep > 0) {
      const provider = raw.slice(0, sep).trim().toLowerCase();
      const model = raw.slice(sep + 1).trim();
      if ((provider === 'anthropic' || provider === 'deepseek') && model.length > 0) {
        return { provider, model };
      }
    }
    // Modèle seul → provider déduit du préfixe.
    const provider: 'anthropic' | 'deepseek' =
      raw.startsWith('claude') || raw.startsWith('anthropic') ? 'anthropic' : 'deepseek';
    return { provider, model: raw };
  }

  const config = TASK_MODEL[task];
  if (config.provider === 'anthropic') {
    const model = config.model ?? resolveModelByFamily(config.family ?? 'sonnet');
    return { provider: 'anthropic', model };
  }
  // DeepSeek
  return { provider: 'deepseek', model: config.model ?? DEEPSEEK_V4_FLASH };
}
