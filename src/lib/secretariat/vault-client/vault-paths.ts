/**
 * Chemins logiques du vault Obsidian sur Google Drive.
 *
 * Chaque constante représente un chemin relatif depuis la racine du vault
 * (DRIVE_VAULT_ROOT_ID, qui pointe sur "00. Me/"). Le drive-resolver résout
 * ces chemins en fileIds.
 *
 * Source de vérité : docs/ia/Anya - Reponse questionnaire vault-paths.md
 * (vérifié par scan Drive direct 2026-05-17).
 *
 * Structure réelle du vault :
 *   07. Contacts/
 *     01. Famille/
 *     02. Amis/         (Carl, Maxime y sont — cofondateurs ranges en amis)
 *     03. Pro/          (22 fiches : avocats, comptables, notaires, partenaires)
 *     04. Autres/
 *     05. Locataires/
 *       01. Actuels/    (11 locataires actifs)
 *       02. Anciens/    (4 locataires sortis)
 *       _Candidats/     (postulants)
 *   02. Projets/
 *     01. Perso/Immobilier Direct/
 *       Biens/                (biens en gestion)
 *       Opportunités/         (apporteurs — à créer)
 *   03. Tâches/Todo.md
 *   _Inbox/
 *     A classifier/     (notes email no-match — scan Drive S23)
 *     AnyaLogs/         (audit trail JSONL)
 *     AnyaState/        (state JSON Anya)
 *     Notes/, Documents/, Photos/, Voice/, Plaud/
 *   Templates/
 *
 * Note S23 : `05. Notes/` et `06. Réunions/` n'existent PAS à la racine réelle
 * `00. Me` (vérifié scan Drive). `06. Réunions` abandonné (refonte calendar).
 */

// ============================================================
// Segments de chemin
// ============================================================

/** Dossier racine des contacts */
export const CONTACTS_ROOT = '07. Contacts';

/** Contacts famille */
export const CONTACTS_FAMILLE = '07. Contacts/01. Famille';

/** Contacts amis (Carl, Maxime y sont) */
export const CONTACTS_AMIS = '07. Contacts/02. Amis';

/** Contacts pro (avocats, comptables, notaires, partenaires) */
export const CONTACTS_PRO = '07. Contacts/03. Pro';

/** Contacts autres */
export const CONTACTS_AUTRES = '07. Contacts/04. Autres';

/** Locataires — racine */
export const LOCATAIRES_ROOT = '07. Contacts/05. Locataires';

/** Locataires actuels (bail actif) */
export const LOCATAIRES_ACTUELS = '07. Contacts/05. Locataires/01. Actuels';

/** Locataires anciens (bail terminé) */
export const LOCATAIRES_ANCIENS = '07. Contacts/05. Locataires/02. Anciens';

/** Candidats locataires (postulants) */
export const LOCATAIRES_CANDIDATS = '07. Contacts/05. Locataires/_Candidats';

/** Projets */
export const PROJETS_ROOT = '02. Projets';

/** Notes à classifier (email no-match) — dossier réel `_Inbox/A classifier`
 *  (scan Drive S23 : seul `A classifier` du vault, sous `_Inbox`). */
export const NOTES_A_CLASSIFIER = '_Inbox/A classifier';

/** Todo central */
export const TODO_PATH = '03. Tâches/Todo.md';

/** Inbox racine */
export const INBOX_ROOT = '_Inbox';

/** Logs Anya (audit trail JSONL) */
export const ANYA_LOGS = '_Inbox/AnyaLogs';

/** State Anya (JSON) */
export const ANYA_STATE = '_Inbox/AnyaState';

/** Templates Obsidian */
export const TEMPLATES_ROOT = 'Templates';

// ============================================================
// Chemins de recherche pour findContactByEmail
// ============================================================

/**
 * Dossiers à scanner lors de la recherche d'un contact par email.
 * Ordre = priorité de matching :
 *   1. Locataires actuels (cas le plus fréquent — emails locataires)
 *   2. Candidats locataires (postulants)
 *   3. Pro (contacts professionnels)
 *   4. Amis (Carl, Maxime — cofondateurs)
 *   5. Famille
 *   6. Anciens locataires (rare mais possible)
 *   7. Autres
 */
export const CONTACT_SEARCH_PATHS = [
  LOCATAIRES_ACTUELS,
  LOCATAIRES_CANDIDATS,
  CONTACTS_PRO,
  CONTACTS_AMIS,
  CONTACTS_FAMILLE,
  LOCATAIRES_ANCIENS,
  CONTACTS_AUTRES,
] as const;

/**
 * Extension des fichiers Markdown dans le vault.
 */
export const MD_EXTENSION = '.md';
