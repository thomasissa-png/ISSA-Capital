/**
 * Handler email-ingest : candidat.
 *
 * Gère les emails identifiés comme provenant d'un candidat locataire.
 * Cherche la fiche dans 07. Contacts/05. Locataires/_Candidats/.
 * Si trouvée → append historique + update date_derniere_interaction.
 * Si non trouvée → crée fiche stub dans _Candidats/ avec frontmatter candidat.
 *
 * Créé Jalon 4D-1 (2026-05-17).
 * Paths vérifiés par scan Drive direct (cf. docs/ia/Anya - Reponse questionnaire vault-paths.md B4).
 */

import type { TriageResult } from '../triage/types';
import type { EmailMessage } from '../gmail-source/types';
import type { ActionProposal } from './types';
import { findContactByEmail } from '../vault-client';
import {
  VAULT_PATHS,
  slugifyVaultFilename,
  buildEmailRef,
  buildHistoriqueTitle,
} from './vault-paths';

// ============================================================
// Handler principal
// ============================================================

/**
 * Génère les actions pour un email classé "candidat".
 *
 * Si la fiche candidat existe → append historique + update date.
 * Si non trouvée → créer la fiche stub dans _Candidats/ + mark_processed.
 */
export async function handleCandidat(
  triage: TriageResult,
  email: EmailMessage,
): Promise<ActionProposal[]> {
  const contact = await findContactByEmail(email.from.email);
  const date = email.receivedAt.toISOString().slice(0, 10);

  if (contact) {
    return buildExistingCandidatActions(triage, email, contact, date);
  }

  return buildNewCandidatActions(triage, email, date);
}

// ============================================================
// Candidat existant
// ============================================================

function buildExistingCandidatActions(
  triage: TriageResult,
  email: EmailMessage,
  contact: { name: string; folderPath: string },
  date: string,
): ActionProposal[] {
  const filename = `${slugifyVaultFilename(contact.name)}.md`;
  const target = `${contact.folderPath}/${filename}`;
  const emailRef = buildEmailRef(email.source, email.id);

  return [
    {
      type: 'append_historique',
      target,
      payload: {
        section: triage.intent,
        content: `${triage.summary} ${emailRef}`,
        date: email.receivedAt.toISOString(),
        title: buildHistoriqueTitle(date, triage.intent),
      },
      description: `Ajouter à l'historique de ${contact.name} : ${triage.intent}`,
    },
    {
      type: 'update_frontmatter',
      target,
      payload: { date_derniere_interaction: date },
      description: `Mettre à jour la date de dernière interaction de ${contact.name}`,
    },
    {
      type: 'mark_processed',
      target: null,
      payload: { messageId: email.id },
      description: 'Marquer l\'email comme traité dans Gmail',
    },
  ];
}

// ============================================================
// Nouveau candidat
// ============================================================

function buildNewCandidatActions(
  triage: TriageResult,
  email: EmailMessage,
  date: string,
): ActionProposal[] {
  const displayName = extractDisplayName(email.from);
  const slugName = slugifyVaultFilename(displayName);
  const filename = `${slugName}.md`;
  const target = `${VAULT_PATHS.candidatsLocataires}/${filename}`;

  const content = buildNewCandidatContent(email, triage, displayName, date);

  return [
    {
      type: 'create_file',
      target,
      payload: { content, filename },
      description: `Créer la fiche candidat locataire : ${displayName}`,
    },
    {
      type: 'mark_processed',
      target: null,
      payload: { messageId: email.id },
      description: 'Marquer l\'email comme traité dans Gmail',
    },
  ];
}

// ============================================================
// Utilitaires
// ============================================================

/**
 * Extrait un nom d'affichage depuis l'adresse email.
 *
 * Priorité : champ `name` du From. Sinon, local-part de l'email
 * transformé en Title Case (martin.dupont@x.com → Martin Dupont).
 */
function extractDisplayName(from: { email: string; name?: string }): string {
  if (from.name && from.name.trim().length > 0) {
    return from.name.trim();
  }

  const localPart = from.email.split('@')[0] ?? 'inconnu';
  return localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || 'Inconnu';
}

/**
 * Construit le contenu Markdown d'une nouvelle fiche candidat.
 * Frontmatter aligné sur les conventions vault (cf. Cowork B4 + D1).
 */
function buildNewCandidatContent(
  email: EmailMessage,
  triage: TriageResult,
  displayName: string,
  date: string,
): string {
  const emailRef = buildEmailRef(email.source, email.id);

  return [
    '---',
    'type: contact',
    'categorie: locataire',
    'statut: candidat',
    `email: ${email.from.email}`,
    `date_premier_contact: ${date}`,
    `date_derniere_interaction: ${date}`,
    'tags:',
    '  - locataire',
    '  - candidat',
    '---',
    '',
    `# ${displayName}`,
    '',
    '## Contact',
    '',
    '## Bien souhaité',
    '',
    '## Dossier locatif',
    '',
    '## Historique',
    '',
    buildHistoriqueTitle(date, triage.intent),
    '',
    `${triage.summary} ${emailRef}`,
    '',
  ].join('\n');
}
