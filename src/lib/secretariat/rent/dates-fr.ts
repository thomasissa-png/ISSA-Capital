/**
 * Formatage de dates en français pour les quittances.
 *
 * Deux fonctions :
 * - dateEnLettres : "vingt-cinq janvier deux mille vingt-six"
 * - moisEnLettres : numéro de mois → nom en français (capitalisé)
 * - formatDateFr : Date → "DD/MM/YYYY"
 */

import { nombreEnLettres } from './num-en-lettres';

const MOIS_FR = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const MOIS_FR_LOWER = [
  '', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Retourne le nom du mois en français (capitalisé).
 *
 * @param month Numéro du mois (1-12)
 * @returns Ex: "Janvier", "Février"
 * @throws Si mois invalide
 */
export function moisEnLettres(month: number): string {
  if (month < 1 || month > 12) {
    throw new Error(`Mois invalide : ${month} (attendu 1-12)`);
  }
  return MOIS_FR[month]!;
}

/**
 * Formate une date en toutes lettres françaises.
 *
 * @param date Date à formater
 * @returns Ex: "vingt-cinq janvier deux mille vingt-six"
 */
export function dateEnLettres(date: Date): string {
  const jour = date.getDate();
  const mois = date.getMonth() + 1; // getMonth() retourne 0-11
  const annee = date.getFullYear();

  // Le jour en lettres (sans devise)
  const jourLettres = nombreEnLettres(jour, '').trim();

  // Le mois en minuscule
  const moisLettres = MOIS_FR_LOWER[mois]!;

  // L'année en lettres (sans devise)
  const anneeLettres = nombreEnLettres(annee, '').trim();

  // "premier" pour le 1er du mois
  const jourFinal = jour === 1 ? 'premier' : jourLettres;

  return `${jourFinal} ${moisLettres} ${anneeLettres}`;
}

/**
 * Formate une Date en DD/MM/YYYY (format français).
 */
export function formatDateFr(date: Date): string {
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const annee = date.getFullYear();
  return `${jour}/${mois}/${annee}`;
}

/**
 * Retourne le dernier jour du mois pour une année/mois donnés.
 */
export function dernierJourDuMois(annee: number, mois: number): number {
  // new Date(annee, mois, 0) donne le dernier jour du mois précédent
  // donc new Date(2026, 5, 0) donne le 31 mai 2026
  return new Date(annee, mois, 0).getDate();
}
