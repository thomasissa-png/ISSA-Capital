/**
 * Chemins logiques du vault Obsidian sur Google Drive.
 *
 * Chaque constante représente un chemin relatif depuis la racine du vault
 * (DRIVE_VAULT_ROOT_ID). Le drive-resolver résout ces chemins en fileIds.
 *
 * Structure du vault (arbo Alt C validée Thomas S10) :
 *   07. Contacts/
 *     01. Pro/
 *     02. Famille/
 *     05. Locataires/
 *       01. Actuels/
 *       _Candidats/
 *   02. Projets/
 *   05. Notes/
 *     A classifier/
 *   _Inbox/
 *     AnyaLogs/
 *     Photos/
 *     Notes/
 *     Voice/
 *     Documents/
 *   Templates/
 */

// ============================================================
// Segments de chemin
// ============================================================

/** Dossier racine des contacts */
export const CONTACTS_ROOT = '07. Contacts';

/** Contacts pro */
export const CONTACTS_PRO = '07. Contacts/01. Pro';

/** Contacts famille */
export const CONTACTS_FAMILLE = '07. Contacts/02. Famille';

/** Locataires — racine */
export const LOCATAIRES_ROOT = '07. Contacts/05. Locataires';

/** Locataires actuels */
export const LOCATAIRES_ACTUELS = '07. Contacts/05. Locataires/01. Actuels';

/** Candidats locataires */
export const LOCATAIRES_CANDIDATS = '07. Contacts/05. Locataires/_Candidats';

/** Projets */
export const PROJETS_ROOT = '02. Projets';

/** Notes */
export const NOTES_ROOT = '05. Notes';

/** Notes à classifier (no-match email) */
export const NOTES_A_CLASSIFIER = '05. Notes/A classifier';

/** Inbox racine */
export const INBOX_ROOT = '_Inbox';

/** Logs Anya (audit trail JSONL) */
export const ANYA_LOGS = '_Inbox/AnyaLogs';

/** Templates Obsidian */
export const TEMPLATES_ROOT = 'Templates';

// ============================================================
// Chemins de recherche pour findContactByEmail
// ============================================================

/**
 * Dossiers à scanner lors de la recherche d'un contact par email.
 * Ordre = priorité de matching (locataires actuels en premier).
 */
export const CONTACT_SEARCH_PATHS = [
  LOCATAIRES_ACTUELS,
  LOCATAIRES_CANDIDATS,
  CONTACTS_PRO,
  CONTACTS_FAMILLE,
] as const;

/**
 * Extension des fichiers Markdown dans le vault.
 */
export const MD_EXTENSION = '.md';
