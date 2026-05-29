/**
 * Générateur et validateur de références CR.
 *
 * Wrapper centralisé autour de reference-counter.ts pour :
 *  - exposer une API stable (`generateReference`) consommée par le webhook
 *    et tout futur appelant (cron, batch, replay)
 *  - valider/parser une référence au format canonique
 *      {ENTITE}-CR-{YYYY}-{XXXX}
 *    (ENTITE ∈ {IC, GO, VI, VV}, YYYY = 4 chiffres, XXXX = séquence zero-padded 4 chiffres)
 *
 * DRIFT SOT CONNU (suivi orchestrateur — hors scope ici) :
 *  Le compteur séquentiel sous-jacent est persisté sur DISQUE LOCAL
 *  (`/home/runner/issa-data/cr-counter.json`, fallback `/tmp/...`).
 *  Il n'est PAS dérivé du vault Drive (SOT R1).
 *  Conséquences possibles : reset compteur à 0 si Replit recrée l'env, ou
 *  désynchro entre runtime et vault après import/replay de CR archivés.
 *  Toute reconstruction d'historique (replay batch) doit, à terme, scanner
 *  le vault et alimenter le compteur depuis le max(reference) par
 *  (entité, année) — TODO orchestrateur.
 */

import { getNextReference } from '../reference-counter';
import type { Entite } from '../types';

/**
 * Regex canonique d'une référence CR.
 * Capture stricte : pas de tolérance lowercase, pas de padding < 4.
 */
export const REFERENCE_REGEX = /^(IC|GO|VI|VV)-CR-(\d{4})-(\d{4})$/;

/**
 * Génère la prochaine référence pour une entité donnée.
 * Wrappe `getNextReference` pour offrir un point d'entrée unique au module.
 */
export function generateReference(entite: Entite): string {
  return getNextReference(entite);
}

/**
 * Valide qu'une chaîne respecte le format canonique d'une référence CR.
 */
export function isValidReference(ref: string): boolean {
  if (typeof ref !== 'string') return false;
  return REFERENCE_REGEX.test(ref);
}

/**
 * Parse une référence CR en ses composants.
 * Retourne `null` si la chaîne n'est pas valide.
 */
export function parseReference(
  ref: string,
): { entite: Entite; year: number; sequence: number } | null {
  if (typeof ref !== 'string') return null;
  const match = REFERENCE_REGEX.exec(ref);
  if (!match) return null;
  // match[0] = full, match[1] = entite, match[2] = year, match[3] = sequence.
  // La regex garantit la presence des 3 groupes ; on cast explicitement pour
  // satisfaire `noUncheckedIndexedAccess`.
  const entite = match[1] as Entite;
  const yearStr = match[2] as string;
  const seqStr = match[3] as string;
  return {
    entite,
    year: Number.parseInt(yearStr, 10),
    sequence: Number.parseInt(seqStr, 10),
  };
}
