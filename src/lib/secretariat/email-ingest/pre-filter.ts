/**
 * Pré-filtre heuristique — email-ingest Anya.
 *
 * Filtre les emails probablement spam/newsletter AVANT l'appel LLM Haiku.
 * Économie estimée : ~70% des emails (inbox Thomas bruitée).
 *
 * Si au moins 1 pattern matche → return true (skip Haiku, auto-label).
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4C §B.
 */

import type { EmailMessage } from '../gmail-source/types';

// ============================================================
// Patterns de détection
// ============================================================

/**
 * Préfixes d'adresses email typiques des systèmes automatisés.
 * Matche le local-part avant le @.
 */
const AUTOMATED_FROM_RE =
  /^(noreply|no-reply|notifications?|mailer-daemon|postmaster|unsubscribe|info|alerts?|news|newsletter|hello|support|contact)@/i;

/**
 * Domaines d'envoi mass-mailing ou services d'envoi automatisé.
 * Matche le domaine après le @.
 */
const BULK_DOMAIN_RE =
  /@(.*newsletter.*|.*mailing.*|.*marketing.*|.*notification.*|sendgrid\..*|mailgun\..*|amazonses\..*)$/i;

/**
 * Sujets typiques de newsletters ou digests automatisés.
 * Supporte le préfixe optionnel "Re:" et les tags "[...]".
 */
const NEWSLETTER_SUBJECT_RE =
  /^(re:\s)?(\[.*?\]\s)?(your weekly|newsletter|digest|update from|new in|reminder:|unsubscribe)/i;

// ============================================================
// API publique
// ============================================================

/**
 * Détermine si un email est probablement du spam/newsletter
 * en se basant uniquement sur des heuristiques (pas d'appel LLM).
 *
 * @param email Email normalisé à vérifier
 * @returns true si au moins un pattern de spam détecté
 */
export function isLikelySpamByHeuristic(email: EmailMessage): boolean {
  const fromEmail = email.from.email.toLowerCase();

  // Check 1 : préfixe d'adresse automatisé
  if (AUTOMATED_FROM_RE.test(fromEmail)) {
    return true;
  }

  // Check 2 : domaine bulk-sending
  if (BULK_DOMAIN_RE.test(fromEmail)) {
    return true;
  }

  // Check 3 : sujet newsletter/digest
  if (NEWSLETTER_SUBJECT_RE.test(email.subject)) {
    return true;
  }

  return false;
}
