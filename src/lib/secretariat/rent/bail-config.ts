/**
 * Configuration bail meublé — chargée depuis bail-config.json.
 *
 * Port fidèle du Python generer_bail.py : résolution du bien,
 * complément d'adresse (statique, template ou par côté),
 * inventaire-type, valeurs par défaut.
 *
 * Source de vérité : second-cerveau/bail-config.yml, copié en
 * JSON statique dans src/lib/secretariat/rent/data/bail-config.json.
 */

import bailConfigData from './data/bail-config.json';
import { chargerBiens, resoudreBien } from './biens';
import type { Locataire, BailVariables } from './types';
import { nombreEnLettres } from './num-en-lettres';
import { dateEnLettres, formatDateFr } from './dates-fr';
import { chargerSignatureBase64 } from './signature';

// ============================================================
// Types internes pour le JSON importé
// ============================================================

interface BailBailleurConfig {
  nom_complet: string;
  nom_avec_capitales: string;
  date_naissance: string;
  lieu_naissance: string;
  nationalite: string;
  adresse: string;
  cp_ville: string;
  signature_image: string;
  signature_largeur_mm: number;
}

interface BailDefaults {
  depot_garantie: number;
  delai_restitution_depot: string;
  jour_paiement_loyer: number;
  duree_bail: string;
  preavis_locataire: string;
  preavis_bailleur: string;
  lieu_signature: string;
  type_bail: string;
}

interface BailBienConfig {
  surface_m2: number;
  description_complement?: string;
  description_complement_template?: string;
  description_complement_par_cote?: Record<string, string>;
  description_complement_defaut?: string;
  pieces: string;
  charges_incluses: string;
  inventaire_type?: string;
}

interface BailConfigJson {
  bailleur: BailBailleurConfig;
  defaults: BailDefaults;
  biens: Record<string, BailBienConfig>;
  inventaires: Record<string, Record<string, string[]>>;
}

const config = bailConfigData as BailConfigJson;

// ============================================================
// API publique
// ============================================================

/** Retourne la configuration bailleur étendue (état civil complet pour le bail) */
export function chargerBailleurBail(): BailBailleurConfig {
  return config.bailleur;
}

/** Retourne les valeurs par défaut du bail */
export function chargerDefaultsBail(): BailDefaults {
  return config.defaults;
}

/**
 * Résout le complément d'adresse et les caractéristiques du bien
 * pour la génération d'un bail.
 *
 * Croise l'adresse_bien du locataire avec biens.json (pour l'adresse)
 * et bail-config.json (pour surface, pièces, charges, inventaire).
 *
 * Port fidèle de resoudre_bien() du Python generer_bail.py.
 */
export function resoudreBienBail(loc: Locataire): {
  id: string;
  adresseLigne1: string;
  complement: string;
  cpVille: string;
  surfaceM2: number;
  pieces: string;
  chargesIncluses: string;
  inventaireType: string | null;
} | null {
  const adresseLc = loc.adresseBien.toLowerCase();

  // Utiliser biens.json pour résoudre l'adresse de base
  const bienResolu = resoudreBien(loc.adresseBien);
  if (!bienResolu) return null;

  // Trouver l'ID du bien dans biens.json pour croiser avec bail-config.json
  const biens = chargerBiens();
  const bienMatch = biens.find((b) =>
    b.matchAdresse.some((frag) => adresseLc.includes(frag.toLowerCase())),
  );
  if (!bienMatch) return null;

  const bailBien = config.biens[bienMatch.id];
  if (!bailBien) {
    console.warn(`[bail-config] bien "${bienMatch.id}" absent de bail-config.json — fallback`);
    return {
      id: bienMatch.id,
      adresseLigne1: bienResolu.ligne1,
      complement: bienResolu.ligne2,
      cpVille: bienResolu.cpVille,
      surfaceM2: 0,
      pieces: '[à compléter]',
      chargesIncluses: '[à compléter]',
      inventaireType: null,
    };
  }

  // Résoudre le complément d'adresse depuis bail-config
  let complement = '';
  if (bailBien.description_complement) {
    complement = bailBien.description_complement;
  } else if (bailBien.description_complement_template) {
    const m = loc.adresseBien.match(/(?:studio|appartement|apt)\s+(\d+)/i);
    const num = m?.[1] ?? '?';
    complement = bailBien.description_complement_template.replace('{studio_num}', num);
  } else if (bailBien.description_complement_par_cote) {
    complement = bailBien.description_complement_defaut ?? 'RDC';
    for (const [cle, val] of Object.entries(bailBien.description_complement_par_cote)) {
      if (adresseLc.includes(cle.toLowerCase())) {
        complement = val;
        break;
      }
    }
  }

  return {
    id: bienMatch.id,
    adresseLigne1: bienResolu.ligne1,
    complement,
    cpVille: bienResolu.cpVille,
    surfaceM2: bailBien.surface_m2,
    pieces: bailBien.pieces,
    chargesIncluses: bailBien.charges_incluses,
    inventaireType: bailBien.inventaire_type ?? null,
  };
}

/**
 * Charge un inventaire-type par sa clé.
 *
 * @returns Dictionnaire catégorie → items, ou null si non trouvé
 */
export function chargerInventaire(inventaireType: string): Record<string, string[]> | null {
  return config.inventaires[inventaireType] ?? null;
}

// ============================================================
// Vérification fiche locataire pour bail
// ============================================================

/**
 * Vérifie que la fiche locataire contient tous les champs nécessaires au bail.
 *
 * @returns Liste des champs manquants (vide = OK)
 */
export function verifierFicheBail(loc: Locataire): string[] {
  const issues: string[] = [];
  if (!loc.civilite) issues.push('civilite (Monsieur/Madame/Mademoiselle)');
  if (!loc.dateNaissance) issues.push('date_naissance (YYYY-MM-DD)');
  if (!loc.lieuNaissance) issues.push('lieu_naissance');
  if (!loc.nationalite) issues.push('nationalite');
  if (loc.montantLoyer <= 0) issues.push('montant_loyer');
  if (!loc.adresseBien) issues.push('adresse_bien');
  return issues;
}

// ============================================================
// Construction des variables de bail
// ============================================================

/**
 * Construit toutes les variables nécessaires au rendu du bail.
 *
 * @param loc Locataire avec tous les champs
 * @param dateDebut Date de début du bail
 * @param dateSignature Date de signature (défaut : veille du début)
 * @param overrides Override loyer/charges/dépôt depuis le workflow
 */
export function construireVariablesBail(
  loc: Locataire,
  dateDebut: Date,
  dateSignature?: Date,
  overrides?: {
    loyer?: number;
    charges?: number;
    depot?: number;
  },
): BailVariables | { error: string } {
  const bien = resoudreBienBail(loc);
  if (!bien) {
    return {
      error: `Bien introuvable pour l'adresse "${loc.adresseBien}". Vérifier biens.json et bail-config.json.`,
    };
  }

  const bailleur = config.bailleur;
  const defaults = config.defaults;

  const loyer = overrides?.loyer ?? loc.montantLoyer;
  const charges = overrides?.charges ?? loc.montantCharges;
  const depot = overrides?.depot ?? loc.depotGarantie ?? defaults.depot_garantie;
  const jourPaiement = loc.jourPaiement ?? defaults.jour_paiement_loyer;

  const sigDate = dateSignature ?? new Date(dateDebut.getTime() - 24 * 60 * 60 * 1000);

  // Surface : priorité fiche locataire, puis bail-config
  const surface = loc.surfaceM2 ?? bien.surfaceM2;

  // Inventaire
  const inventaire = bien.inventaireType ? chargerInventaire(bien.inventaireType) : null;

  const signaturePngBase64 = chargerSignatureBase64();

  return {
    bailleurNom: bailleur.nom_complet,
    bailleurNomCapitales: bailleur.nom_avec_capitales,
    bailleurDateNaissance: bailleur.date_naissance,
    bailleurLieuNaissance: bailleur.lieu_naissance,
    bailleurNationalite: bailleur.nationalite,
    bailleurAdresse: bailleur.adresse,
    bailleurCpVille: bailleur.cp_ville,
    signaturePngBase64,
    signatureLargeurMm: bailleur.signature_largeur_mm,

    locataireNom: loc.nomAffiche,
    locataireCiviliteAbregee: civiliteAbregee(loc.civilite),
    locataireDateNaissance: loc.dateNaissance ? formatDateFr(loc.dateNaissance) : '[date manquante]',
    locataireLieuNaissance: loc.lieuNaissance ?? '[lieu manquant]',
    locataireNationalite: loc.nationalite ?? '[nationalité manquante]',
    locataireEstFeminin: estFeminin(loc.civilite),

    bienAdresseLigne1: bien.adresseLigne1,
    bienComplement: bien.complement,
    bienCpVille: bien.cpVille,
    bienSurfaceM2: surface,
    bienPieces: bien.pieces,
    bienChargesIncluses: bien.chargesIncluses,

    dateDebut,
    dateSignature: sigDate,
    dureeBail: defaults.duree_bail,
    preavisLocataire: defaults.preavis_locataire,
    preavisBailleur: defaults.preavis_bailleur,
    loyer,
    charges,
    depotGarantie: depot,
    jourPaiement,
    delaiRestitutionDepot: defaults.delai_restitution_depot,
    lieuSignature: defaults.lieu_signature,
    typeBail: defaults.type_bail,

    inventaire,
  };
}

// ============================================================
// Helpers internes
// ============================================================

/** "Monsieur" → "M.", "Madame" → "Mme", "Mademoiselle" → "Mlle" */
function civiliteAbregee(civilite: string | null): string {
  const c = (civilite ?? '').toLowerCase();
  if (c.startsWith('mons')) return 'M.';
  if (c.startsWith('mada')) return 'Mme';
  if (c.startsWith('made') || c === 'melle') return 'Mlle';
  return 'M./Mme';
}

/** Détermine si la civilité est féminine */
function estFeminin(civilite: string | null): boolean {
  const c = (civilite ?? '').toLowerCase();
  return c.startsWith('mada') || c.startsWith('made') || c === 'melle';
}
