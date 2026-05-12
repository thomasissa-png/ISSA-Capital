/**
 * Chargement et résolution des biens immobiliers.
 *
 * Source : second-cerveau/biens.yml, copié en JSON statique
 * dans src/lib/secretariat/rent/data/biens.json au build.
 *
 * Port fidèle de resoudre_bien() du Python generer_quittance.py.
 */

import biensData from './data/biens.json';
import type { Bien, BienResolu, BailleurConfig } from './types';

// ============================================================
// Types internes pour le JSON importé
// ============================================================

interface BienJson {
  id: string;
  matchAdresse: string[];
  ligne1: string;
  ligne2?: string;
  ligne2Template?: string;
  ligne2ParCote?: Record<string, string>;
  ligne2Defaut?: string;
  cpVille: string;
}

interface BiensConfig {
  bailleur: {
    nom: string;
    telephone: string;
    adresse: string;
    cpVille: string;
    signatureImage?: string;
    signatureLargeurMm?: number;
  };
  biens: BienJson[];
}

const config = biensData as BiensConfig;

// ============================================================
// API publique
// ============================================================

/** Retourne la liste de tous les biens configurés */
export function chargerBiens(): Bien[] {
  return config.biens.map((b) => ({
    id: b.id,
    matchAdresse: b.matchAdresse,
    ligne1: b.ligne1,
    ligne2: b.ligne2,
    ligne2Template: b.ligne2Template,
    ligne2ParCote: b.ligne2ParCote,
    ligne2Defaut: b.ligne2Defaut,
    cpVille: b.cpVille,
  }));
}

/** Retourne la config bailleur depuis biens.json */
export function chargerBailleurDepuisBiens(): BailleurConfig {
  return {
    nom: config.bailleur.nom,
    telephone: config.bailleur.telephone,
    adresse: config.bailleur.adresse,
    cpVille: config.bailleur.cpVille,
    signatureImage: config.bailleur.signatureImage,
    signatureLargeurMm: config.bailleur.signatureLargeurMm ?? 40,
  };
}

/**
 * Résout l'adresse complète d'un bien à partir de l'adresse_bien du locataire.
 *
 * Port fidèle du Python :
 * - Match par fragment insensible à la casse
 * - ligne2 statique, ou template avec {studio}, ou par côté (rue/cour)
 *
 * @returns BienResolu ou null si aucun bien ne correspond
 */
export function resoudreBien(adresseLocataire: string): BienResolu | null {
  const adresseLc = adresseLocataire.toLowerCase();

  for (const bien of config.biens) {
    const matched = bien.matchAdresse.some(
      (frag) => adresseLc.includes(frag.toLowerCase()),
    );
    if (!matched) continue;

    let ligne2 = '';

    if (bien.ligne2) {
      // Cas 1 : ligne2 statique
      ligne2 = bien.ligne2;
    } else if (bien.ligne2Template) {
      // Cas 2 : template avec {studio} — extrait "Studio X" de l'adresse
      const studioMatch = adresseLocataire.match(/studio\s+\d+/i);
      const studio = studioMatch
        ? studioMatch[0].charAt(0).toUpperCase() + studioMatch[0].slice(1)
        : 'Studio';
      ligne2 = bien.ligne2Template.replace('{studio}', studio);
    } else if (bien.ligne2ParCote) {
      // Cas 3 : par côté (rue/cour) — cherche dans l'adresse
      ligne2 = bien.ligne2Defaut ?? 'Studio';
      for (const [cle, val] of Object.entries(bien.ligne2ParCote)) {
        if (adresseLc.includes(cle.toLowerCase())) {
          ligne2 = val;
          break;
        }
      }
    }

    return {
      ligne1: bien.ligne1,
      ligne2,
      cpVille: bien.cpVille,
    };
  }

  return null;
}
