/**
 * Conversion d'un nombre entier en toutes lettres (français).
 *
 * Choix de lib : implémentation native (~80 lignes) plutôt qu'une dépendance npm.
 *
 * Justification :
 * - Le Python original utilise `num2words(n, lang="fr")` mais le scope est limité :
 *   montants de loyer entre 0 et ~10 000 euros, toujours entiers (arrondi).
 * - Les libs npm candidates (`to-words`, `written-number`, `nombre-en-toutes-lettres`)
 *   ajoutent 50-200KB de code pour 124 locales dont 123 inutiles.
 * - Les règles du français sont bien spécifiées (Réforme 1990 + usage courant) :
 *   - "et" uniquement pour 21, 31, 41, 51, 61, 71
 *   - "quatre-vingts" avec S sauf suivi (quatre-vingt-un)
 *   - "cent" avec S si multiple exact (deux cents, mais deux cent un)
 *   - "mille" invariable
 * - ~80 lignes testées = ownership total, zéro risque de breaking change npm.
 *
 * Couverture : 0 à 999 999 (suffisant pour tout loyer réaliste).
 * Au-delà, throw une erreur explicite.
 */

const UNITES = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

const DIZAINES = [
  '', 'dix', 'vingt', 'trente', 'quarante', 'cinquante',
  'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt',
];

/**
 * Convertit un nombre 0-99 en lettres.
 */
function dizaineEnLettres(n: number): string {
  if (n < 20) return UNITES[n]!;

  const dizaine = Math.floor(n / 10);
  const unite = n % 10;

  // 70-79 : soixante-dix, soixante-et-onze, soixante-douze...
  if (dizaine === 7) {
    if (unite === 1) return 'soixante-et-onze';
    return `soixante-${UNITES[10 + unite]}`;
  }

  // 90-99 : quatre-vingt-dix, quatre-vingt-onze...
  if (dizaine === 9) {
    return `quatre-vingt-${UNITES[10 + unite]}`;
  }

  // 80 : quatre-vingts (avec S), 81-89 : quatre-vingt-un (sans S)
  if (dizaine === 8) {
    if (unite === 0) return 'quatre-vingts';
    return `quatre-vingt-${UNITES[unite]}`;
  }

  // 20-69 (sauf 70+) : vingt, vingt-et-un, vingt-deux...
  if (unite === 0) return DIZAINES[dizaine]!;
  if (unite === 1) return `${DIZAINES[dizaine]}-et-un`;
  return `${DIZAINES[dizaine]}-${UNITES[unite]}`;
}

/**
 * Convertit un nombre 0-999 en lettres.
 */
function centaineEnLettres(n: number): string {
  if (n < 100) return dizaineEnLettres(n);

  const centaines = Math.floor(n / 100);
  const reste = n % 100;

  let prefix: string;
  if (centaines === 1) {
    prefix = 'cent';
  } else if (reste === 0) {
    // Multiple exact → "deux cents" (avec S)
    return `${UNITES[centaines]} cents`;
  } else {
    prefix = `${UNITES[centaines]} cent`;
  }

  if (reste === 0) return prefix;
  return `${prefix} ${dizaineEnLettres(reste)}`;
}

/**
 * Convertit un entier positif (0 à 999 999) en toutes lettres.
 */
function entierEnLettres(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 1000) return centaineEnLettres(n);

  const milliers = Math.floor(n / 1000);
  const reste = n % 1000;

  // "mille" invariable — pas "un mille" mais juste "mille"
  let prefix: string;
  if (milliers === 1) {
    prefix = 'mille';
  } else {
    prefix = `${centaineEnLettres(milliers)} mille`;
  }

  if (reste === 0) return prefix;
  return `${prefix} ${centaineEnLettres(reste)}`;
}

/**
 * Convertit un montant en toutes lettres avec devise.
 *
 * Port fidèle du Python `montant_en_lettres` :
 *   n = int(round(montant))
 *   return num2words(n, lang="fr") + " euros"
 *
 * @param montant Montant en euros (sera arrondi à l'entier)
 * @param devise Devise à ajouter après le nombre (défaut : "euros")
 * @returns Ex: "six cent quatre-vingt-dix euros"
 * @throws Si montant > 999 999 ou < 0
 */
export function nombreEnLettres(montant: number, devise: string = 'euros'): string {
  const n = Math.round(montant);

  if (n < 0) {
    throw new Error(`Montant négatif non supporté : ${montant}`);
  }
  if (n > 999_999) {
    throw new Error(`Montant trop élevé (> 999 999) : ${montant}`);
  }

  const lettres = entierEnLettres(n);
  return `${lettres} ${devise}`;
}
