/**
 * Types pour le skill-loader Anya — fondation migration prompts vault-driven (S20).
 *
 * Voir `skill-loader.ts` pour l'implémentation.
 * Voir `docs/anya/skills-anya/` pour les skills en repo (fallback).
 * Voir vault `08. Outils/Anya/Skills/` pour les skills en source de vérité (R1).
 */

/**
 * Contexte d'un skill chargé depuis le vault (ou fallback repo).
 *
 * Les champs `redLines`, `decisionTree`, `example`, `recapTemplate` sont
 * prêts à être injectés dans le system prompt LLM (sections 5.1, 5.2, 5.4
 * et gabarit récap de la section 4).
 */
export interface SkillContext {
  /** Nom du skill (ex: "CR Reunion") — sert de clé de cache et de path */
  name: string;
  /** Chemin logique vault ou "FALLBACK_REPO" si lecture vault échouée */
  vaultPath: string;
  /** Timestamp de chargement (UTC) */
  loadedAt: Date;
  /** Frontmatter YAML parsé (informatif — PAS injecté dans le prompt LLM) */
  frontmatter: Record<string, unknown>;
  /** Section 5.1 Red lines — INJECTÉE dans system prompt */
  redLines: string;
  /** Section 5.2 Arbre de décision — INJECTÉE dans system prompt */
  decisionTree: string;
  /** Section 5.4 Exemple complet — INJECTÉE en few-shot */
  example: string;
  /** Gabarit récap Telegram extrait de la section 4 — INJECTÉE */
  recapTemplate: string;
}

/**
 * Issue détectée lors du check d'intégrité d'un skill.
 *
 * `error` → bloquant, throw SkillLoadError.
 * `warn`  → non bloquant, console.warn (+ alert Telegram à brancher en S21).
 */
export interface SkillIntegrityIssue {
  level: 'warn' | 'error';
  reason:
    | 'missing_frontmatter'
    | 'missing_section'
    | 'pending_confirmation'
    | 'parse_error';
  details: string;
}

/**
 * Erreur typée pour les échecs de chargement de skill.
 * Permet aux appelants de distinguer un échec skill d'une autre erreur runtime.
 */
export class SkillLoadError extends Error {
  public readonly skillName: string;
  public readonly issues: SkillIntegrityIssue[];

  constructor(skillName: string, message: string, issues: SkillIntegrityIssue[] = []) {
    super(`[skill-loader] ${skillName} — ${message}`);
    this.name = 'SkillLoadError';
    this.skillName = skillName;
    this.issues = issues;
  }
}
