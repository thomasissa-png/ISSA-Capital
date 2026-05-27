/**
 * Garde « destinataire direct » — Anya S24.
 *
 * Thomas (ou le propriétaire de la boîte) ne doit recevoir un BROUILLON de
 * réponse que si l'email lui est ADRESSÉ (présent dans le champ To). S'il est
 * seulement en copie (Cc) — l'email s'adresse à quelqu'un d'autre — pas de
 * brouillon : la documentation (historique, todo) reste faite en amont, donc
 * une éventuelle « action à faire » est conservée même sans brouillon.
 *
 * Règle de décision (pure, testable) :
 *   - self inconnu (résolution KO)            → adressé (fail-open : mieux un
 *                                                brouillon en trop qu'un email loupé)
 *   - self ∈ To                               → adressé (brouillon)
 *   - self ∈ Cc uniquement                    → PAS adressé (copie)
 *   - self ∉ To ∪ Cc, mais To/Cc non vides    → PAS adressé (liste, Bcc…)
 *   - To ET Cc vides (parsing KO)             → adressé (fail-open)
 */

import type { EmailAddress } from '../gmail-source/types';

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export interface AddresseeCheck {
  /** true si on doit préparer un brouillon de réponse. */
  addressed: boolean;
  /** Raison lisible (logs). */
  reason: string;
}

/**
 * Détermine si le propriétaire de la boîte est destinataire direct de l'email.
 *
 * @param selfAddresses Adresses du propriétaire (déjà résolues ; vide = inconnu)
 * @param to Destinataires directs
 * @param cc Destinataires en copie
 */
export function isDirectlyAddressed(
  selfAddresses: string[],
  to: EmailAddress[],
  cc: EmailAddress[],
): AddresseeCheck {
  const self = new Set(selfAddresses.map(normalize).filter((s) => s.length > 0));
  if (self.size === 0) {
    return { addressed: true, reason: 'propriétaire inconnu (fail-open)' };
  }

  const inTo = to.some((a) => self.has(normalize(a.email)));
  if (inTo) {
    return { addressed: true, reason: 'destinataire direct (To)' };
  }

  const inCc = cc.some((a) => self.has(normalize(a.email)));
  if (inCc) {
    return { addressed: false, reason: 'en copie uniquement (Cc)' };
  }

  if (to.length === 0 && cc.length === 0) {
    return { addressed: true, reason: 'destinataires non parsés (fail-open)' };
  }

  return { addressed: false, reason: 'non destinataire (ni To ni Cc)' };
}
