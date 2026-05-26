/**
 * Paths vault Drive Anya — source de vérité unique pour les handlers email-ingest.
 *
 * Vérifiés par scan Drive direct le 2026-05-17
 * (cf. docs/ia/Anya - Reponse questionnaire vault-paths.md).
 *
 * Racine implicite : 00. Me/ (configurée via DRIVE_VAULT_ROOT_ID).
 */

// ============================================================
// Paths statiques
// ============================================================

export const VAULT_PATHS = {
  /**
   * Notes à classifier (email no-match) — dossier réel `_Inbox/A classifier`
   * (vérifié scan Drive S23 : seul `A classifier` du vault, sous `_Inbox`).
   * L'ancien `05. Notes/A classifier` n'existait pas → createVaultFile échouait
   * à chaque email no-match (locataire/contact-pro/a-classifier).
   */
  notesAClassifier: '_Inbox/A classifier',

  /** Contacts pro — 22 fiches existantes. Convention : Prenom Nom.md (ASCII). */
  contactsPro: '07. Contacts/03. Pro',

  /** Contacts famille — read-only pour création, append Historique OK. */
  contactsFamille: '07. Contacts/01. Famille',

  /** Contacts amis — Carl et Maxime y sont (cofondateurs rangés en Amis). */
  contactsAmis: '07. Contacts/02. Amis',

  /** Contacts autres. */
  contactsAutres: '07. Contacts/04. Autres',

  /** Locataires actuels — 11 fiches. */
  locatairesActuels: '07. Contacts/05. Locataires/01. Actuels',

  /** Locataires anciens — 4 fiches. */
  locatairesAnciens: '07. Contacts/05. Locataires/02. Anciens',

  /** Candidats locataires — existe avec _README.md. */
  candidatsLocataires: '07. Contacts/05. Locataires/_Candidats',

  /** Biens existants — 4 biens. */
  biensExistants: '02. Projets/01. Perso/Immobilier Direct/Biens',

  /** Opportunités apporteurs — à créer. */
  opportunitesApporteurs: '02. Projets/01. Perso/Immobilier Direct/Opportunités',

  /** Todo.md — section ## Inbox pour les add_todo Anya. */
  todoMd: '03. Tâches/Todo.md',

  /** Logs audit Anya (JSONL). */
  inboxAnyaLogs: '_Inbox/AnyaLogs',

  /** État persistent Anya (pending-validations, etc.). */
  inboxAnyaState: '_Inbox/AnyaState',
} as const;

// ============================================================
// Paths dynamiques
// ============================================================

/**
 * Path des réunions, organisé par année et mois (zéro-paddé).
 * Ex: reunions(2026, 5) → "06. Réunions/2026/05"
 */
export function reunionsPath(year: number, month: number): string {
  return `06. Réunions/${year}/${String(month).padStart(2, '0')}`;
}

// ============================================================
// Slugify pour noms de fichiers vault
// ============================================================

/**
 * Slugify ASCII pour noms de fichiers vault (règle CLAUDE.md n20 + Cowork C1-C2).
 *
 * - Retire accents (NFD + remove diacritics)
 * - Retire caractères interdits : / \ : * ? " < > | '
 * - Compresse espaces multiples
 * - Tronque à 80 caractères
 *
 * @example slugifyVaultFilename("François D'Aremberg") → "Francois DAremberg"
 * @example slugifyVaultFilename("Hélla Taoutaou") → "Hella Taoutaou"
 */
export function slugifyVaultFilename(name: string): string {
  const result = name
    // NFD decomposition → remove diacritics (accents)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Remove forbidden chars: / \ : * ? " < > | '
    .replace(/[/\\:*?"<>|']/g, '')
    // Compress multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();

  return result || 'sans-nom';
}

// ============================================================
// Format référence email pour section Historique
// ============================================================

/**
 * Format référence email pour section Historique.
 *
 * @example buildEmailRef('gmail', '19abc123') → "(cf. thread Gmail 19abc123)"
 * @example buildEmailRef('outlook', '<msg-id@outlook>') → "(cf. email Outlook <msg-id@outlook>)"
 */
export function buildEmailRef(
  source: 'gmail' | 'outlook',
  refId: string,
): string {
  if (source === 'gmail') {
    return `(cf. thread Gmail ${refId})`;
  }
  return `(cf. email Outlook ${refId})`;
}

/**
 * Em-dash constant for historique titles (U+2014).
 * Convention: "### YYYY-MM-DD — Sujet"
 */
export const EM_DASH = '—';

/**
 * Build a historique H3 title with em-dash.
 *
 * @example buildHistoriqueTitle('2026-05-14', 'Demande validation clause bail')
 *   → "### 2026-05-14 — Demande validation clause bail"
 */
export function buildHistoriqueTitle(date: string, subject: string): string {
  return `### ${date} ${EM_DASH} ${subject}`;
}
