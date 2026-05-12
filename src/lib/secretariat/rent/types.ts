/**
 * Types et schémas Zod pour le workflow quittance de loyer.
 *
 * Modèles : Locataire (fiche Drive), Bien (biens.yml), BailleurConfig,
 * Quittance (variables pour le rendu PDF).
 */

import { z } from 'zod';

// ============================================================
// Locataire — parsé depuis le frontmatter YAML d'une fiche Drive
// ============================================================

export const LocataireSchema = z.object({
  /** Nom du fichier sans extension (ex: "Kenan Beguigneau") */
  nomFichier: z.string().min(1),
  /** Nom complet officiel (frontmatter `nom_officiel`, fallback sur nomFichier) */
  nomAffiche: z.string().min(1),
  /** Civilité : "Monsieur", "Madame", "Mademoiselle" (optionnel) */
  civilite: z.string().nullable(),
  /** Email du locataire (optionnel — utile en V2 pour envoi direct) */
  email: z.string().email().nullable(),
  /** Adresse du bien loué (frontmatter `adresse_bien`) */
  adresseBien: z.string().min(1),
  /** Loyer hors charges en euros */
  montantLoyer: z.number().positive(),
  /** Charges mensuelles en euros */
  montantCharges: z.number().nonnegative(),
  /** Date d'entrée du bail (optionnelle) */
  dateEntreeBail: z.date().nullable(),
  /** Date de fin du bail (optionnelle) */
  dateFinBail: z.date().nullable(),
  /** Moyen de paiement (défaut : "Virement bancaire") */
  moyenPaiement: z.string().default('Virement bancaire'),
  // --- Champs spécifiques au bail (optionnels pour les quittances) ---
  /** Date de naissance du locataire (YYYY-MM-DD) */
  dateNaissance: z.date().nullable().optional(),
  /** Lieu de naissance (ex: "Paris 13") */
  lieuNaissance: z.string().nullable().optional(),
  /** Nationalité (ex: "Française") */
  nationalite: z.string().nullable().optional(),
  /** Surface réelle du logement en m² (prioritaire sur bail-config) */
  surfaceM2: z.number().nullable().optional(),
  /** Dépôt de garantie en euros (override par locataire) */
  depotGarantie: z.number().nullable().optional(),
  /** Jour de paiement du loyer (1-28) */
  jourPaiement: z.number().nullable().optional(),
});

export type Locataire = z.infer<typeof LocataireSchema>;

// ============================================================
// LocataireMatch — résultat de recherche fuzzy
// ============================================================

/** Type de match trouvé lors de la recherche */
export type MatchType = 'exact' | 'normalized' | 'startsWith' | 'contains' | 'levenshtein' | 'nomOfficiel';

/** Un candidat retourné par la recherche fuzzy */
export interface LocataireMatch {
  /** Nom du fichier sans extension (ex: "Hella Taoutaou") */
  nomFichier: string;
  /** nom_officiel si présent, sinon nomFichier */
  nomAffiche: string;
  /** Source du fichier dans l'arborescence Drive */
  source: 'actuels' | 'candidats';
  /** Score de match : 0 (parfait) à N (faible). Plus bas = meilleur */
  score: number;
  /** Stratégie de matching qui a produit ce résultat */
  matchType: MatchType;
}

/** Résultat de la recherche de locataire */
export interface RechercheLocataireResult {
  /** Locataire résolu si match unique et évident (score ≤ 1) */
  locataire: Locataire | null;
  /** Liste de candidats si ambigu ou multiples matches (triée par score croissant, max 5) */
  candidats: LocataireMatch[];
  /** Totaux pour permettre au caller de proposer la liste complète si zéro résultat */
  totaux: { actuels: number; candidats: number };
}

// ============================================================
// Helpers dérivés sur Locataire
// ============================================================

/** Total loyer + charges */
export function locataireTotal(loc: Locataire): number {
  return loc.montantLoyer + loc.montantCharges;
}

/** Nom avec civilité ("Monsieur Kenan Beguigneau") */
export function locataireNomAvecCivilite(loc: Locataire): string {
  if (loc.civilite) {
    return `${loc.civilite} ${loc.nomAffiche}`;
  }
  return loc.nomAffiche;
}

/**
 * Initiales pour le numéro de quittance : "Kenan Beguigneau" → "KBE"
 * Port fidèle du Python : première lettre du prénom + 2 premières du nom.
 */
export function locataireInitiales(loc: Locataire): string {
  const parts = loc.nomFichier.trim().split(/\s+/);
  if (parts.length >= 2) {
    const prenom = parts[0]!;
    const nom = parts[parts.length - 1]!;
    return (prenom[0]! + nom.slice(0, 2)).toUpperCase();
  }
  return loc.nomFichier.slice(0, 3).toUpperCase();
}

// ============================================================
// Bien — chargé depuis biens.yml
// ============================================================

export const BienSchema = z.object({
  id: z.string(),
  matchAdresse: z.array(z.string()),
  ligne1: z.string(),
  /** ligne2 peut être statique, template ou par côté */
  ligne2: z.string().optional(),
  ligne2Template: z.string().optional(),
  ligne2ParCote: z.record(z.string()).optional(),
  ligne2Defaut: z.string().optional(),
  cpVille: z.string(),
});

export type Bien = z.infer<typeof BienSchema>;

/** Résultat de la résolution d'un bien pour un locataire */
export interface BienResolu {
  ligne1: string;
  ligne2: string;
  cpVille: string;
}

// ============================================================
// Bailleur — chargé depuis biens.yml section bailleur
// ============================================================

export const BailleurConfigSchema = z.object({
  nom: z.string(),
  telephone: z.string(),
  adresse: z.string(),
  cpVille: z.string(),
  signatureImage: z.string().optional(),
  signatureLargeurMm: z.number().default(40),
});

export type BailleurConfig = z.infer<typeof BailleurConfigSchema>;

// ============================================================
// Variables de quittance — input pour le rendu PDF
// ============================================================

export interface QuittanceVariables {
  bailleurNom: string;
  bailleurTelephone: string;
  bailleurAdresse: string;
  bailleurCpVille: string;
  signaturePngBase64: string | null;
  signatureLargeurMm: number;
  locataireNom: string;
  bienAdresseLigne1: string;
  bienAdresseLigne2: string;
  bienCpVille: string;
  periodeMoisAnnee: string;
  periodeDebut: string;
  periodeFin: string;
  loyer: number;
  charges: number;
  total: number;
  totalLettres: string;
  datePaiement: string;
  moyenPaiement: string;
  lieuEmission: string;
  dateEmission: string;
  numeroQuittance: string;
}

// ============================================================
// État du workflow quittance (data persistée dans WorkflowState.data)
// ============================================================

export interface QuittanceWorkflowData {
  /** Locataires sélectionnés pour le batch (N locataires) */
  selectedLocataires?: Locataire[];
  /** Mois sélectionnés pour le batch (M mois) */
  selectedMois?: Array<{ year: number; month: number }>;
  /** Liste des locataires actuels affichée à l'utilisateur (pour sélection par numéro) */
  locatairesDisponibles?: Array<{ nom: string; adresse: string }>;
  /** Total PDFs à générer (N × M) */
  totalPdfs?: number;

  // --- Champs legacy pour compatibilité (single mode = N=1, M=1) ---
  /** Nom du locataire sélectionné (nom fichier) — single mode */
  locataireNom?: string;
  /** Données locataire parsées depuis Drive — single mode */
  locataire?: Locataire;
  /** Année de la quittance — single mode */
  annee?: number;
  /** Mois de la quittance (1-12) — single mode */
  mois?: number;
  /** Override loyer (si Thomas veut un montant différent) */
  loyerOverride?: number;
  /** Override charges */
  chargesOverride?: number;
  /** Override moyen de paiement */
  moyenPaiementOverride?: string;
  /** PDF généré en base64 (pour envoi via Telegram par le router) — single mode */
  pdfBase64?: string;
  /** Nom du fichier PDF généré — single mode */
  pdfFilename?: string;

  // --- Batch result (stocké dans state pour le router) ---
  /** Résultat du batch : PDFs générés en base64 avec métadonnées */
  batchResults?: Array<{
    locataireNom: string;
    moisLabel: string;
    pdfBase64: string;
    pdfFilename: string;
  }>;
  /** Erreurs survenues pendant le batch */
  batchErrors?: Array<{
    locataireNom: string;
    moisLabel: string;
    reason: string;
  }>;
}

// ============================================================
// État du workflow bail (data persistée dans WorkflowState.data)
// ============================================================

/** Étapes du workflow bail */
export type BailWorkflowStep =
  | 'selecting_locataire'
  | 'collecting_date_debut'
  | 'collecting_date_signature'
  | 'confirming_recap'
  | 'generating'
  | 'done'
  | 'error';

export interface BailWorkflowData {
  /** Locataire sélectionné */
  selectedLocataire?: Locataire;
  /** Liste des locataires affichée (pour sélection par numéro) */
  locatairesDisponibles?: Array<{ nom: string; adresse: string }>;
  /** Date de début du bail (YYYY-MM-DD) */
  dateDebut?: string;
  /** Date de signature (YYYY-MM-DD, défaut : veille du début) */
  dateSignature?: string;
  /** Override loyer (optionnel) */
  loyerOverride?: number;
  /** Override charges (optionnel) */
  chargesOverride?: number;
  /** Override dépôt de garantie (optionnel) */
  depotOverride?: number;
  /** DOCX généré en base64 */
  docxBase64?: string;
  /** PDF généré en base64 */
  pdfBase64?: string;
  /** Nom des fichiers générés (sans extension) */
  filenameBase?: string;
}

// ============================================================
// Variables de bail — input pour le rendu DOCX/PDF
// ============================================================

export interface BailVariables {
  // Bailleur
  bailleurNom: string;
  bailleurNomCapitales: string;
  bailleurDateNaissance: string;
  bailleurLieuNaissance: string;
  bailleurNationalite: string;
  bailleurAdresse: string;
  bailleurCpVille: string;
  signaturePngBase64: string | null;
  signatureLargeurMm: number;

  // Locataire
  locataireNom: string;
  locataireCiviliteAbregee: string;
  locataireDateNaissance: string;
  locataireLieuNaissance: string;
  locataireNationalite: string;
  locataireEstFeminin: boolean;

  // Bien
  bienAdresseLigne1: string;
  bienComplement: string;
  bienCpVille: string;
  bienSurfaceM2: number;
  bienPieces: string;
  bienChargesIncluses: string;

  // Bail
  dateDebut: Date;
  dateSignature: Date;
  dureeBail: string;
  preavisLocataire: string;
  preavisBailleur: string;
  loyer: number;
  charges: number;
  depotGarantie: number;
  jourPaiement: number;
  delaiRestitutionDepot: string;
  lieuSignature: string;
  typeBail: string;

  // Inventaire
  inventaire: Record<string, string[]> | null;
}
