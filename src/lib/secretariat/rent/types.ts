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
});

export type Locataire = z.infer<typeof LocataireSchema>;

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
  /** Nom du locataire sélectionné (nom fichier) */
  locataireNom?: string;
  /** Données locataire parsées depuis Drive */
  locataire?: Locataire;
  /** Année de la quittance */
  annee?: number;
  /** Mois de la quittance (1-12) */
  mois?: number;
  /** Override loyer (si Thomas veut un montant différent) */
  loyerOverride?: number;
  /** Override charges */
  chargesOverride?: number;
  /** Override moyen de paiement */
  moyenPaiementOverride?: string;
  /** Liste des locataires trouvés (pour sélection) */
  locatairesDisponibles?: Array<{ nom: string; adresse: string }>;
  /** PDF généré en base64 (pour envoi via Telegram par le router) */
  pdfBase64?: string;
  /** Nom du fichier PDF généré */
  pdfFilename?: string;
}
