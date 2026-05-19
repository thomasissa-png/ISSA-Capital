/**
 * Estimateur de tokens pour `hot-context.md`.
 *
 * Cible : 500 tokens (arbitrage Thomas S19 — section 0.A de la spec).
 * Mode : warn-only (jamais bloquant). La carte Telegram affiche le delta,
 * Thomas valide quand même si pertinent.
 *
 * Approximation : 1 token ≈ 4 caractères en français (similaire OpenAI/Anthropic
 * tokenizer pour texte naturel). Marge confortable car le but est l'alerte
 * visuelle, pas la métrique facturation.
 */

// ============================================================
// Constantes
// ============================================================

/** Cible tokens (warn-only) — arbitrage Thomas S19. */
export const TOKEN_CAP_WARN = 500;

/** Ratio approximatif chars → tokens (FR). */
const CHARS_PER_TOKEN = 4;

// ============================================================
// API
// ============================================================

/**
 * Estime le nombre de tokens d'un contenu markdown.
 *
 * @param content Contenu brut.
 * @returns Estimation tokens (entier arrondi).
 */
export function estimateTokens(content: string): number {
  if (!content || content.length === 0) return 0;
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

/**
 * Détermine si l'estimation dépasse le cap warn (500 tokens).
 * Mode warn-only : retourne un flag, ne lève jamais d'exception.
 */
export function isCapExceeded(estimatedTokens: number): boolean {
  return estimatedTokens > TOKEN_CAP_WARN;
}

/**
 * Formate un message de delta pour la carte Telegram.
 *
 * Exemple : « 520 tokens (cap warn 500 dépassé : +20) ».
 */
export function formatTokenDelta(estimatedTokens: number): string {
  if (!isCapExceeded(estimatedTokens)) {
    return `${estimatedTokens} tokens`;
  }
  const delta = estimatedTokens - TOKEN_CAP_WARN;
  return `${estimatedTokens} tokens (cap warn ${TOKEN_CAP_WARN} dépassé : +${delta})`;
}
