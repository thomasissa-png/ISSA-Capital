/**
 * Handler email-ingest : contact-pro.
 *
 * Gère les emails identifiés comme provenant d'un contact professionnel.
 * Cherche la fiche existante dans le vault — si trouvée, append à
 * l'historique + update frontmatter. Sinon, crée une nouvelle fiche.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4 §2.
 * Fix Jalon 4D-1 : paths vault corrigés (07. Contacts/03. Pro, pas 01. Pro).
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
 * Génère les actions pour un email classé "contact-pro".
 *
 * Si la fiche contact existe → append historique + update date.
 * Sinon → créer la fiche avec frontmatter stub + historique initial.
 */
export async function handleContactPro(
  triage: TriageResult,
  email: EmailMessage,
): Promise<ActionProposal[]> {
  const contact = await findContactByEmail(email.from.email);
  const date = email.receivedAt.toISOString().slice(0, 10);

  if (contact) {
    return buildExistingContactActions(triage, email, contact, date);
  }

  return buildNewContactActions(triage, email, date);
}

// ============================================================
// Contact existant
// ============================================================

function buildExistingContactActions(
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
// Nouveau contact
// ============================================================

function buildNewContactActions(
  triage: TriageResult,
  email: EmailMessage,
  date: string,
): ActionProposal[] {
  const displayName = extractDisplayName(email.from);
  const slugName = slugifyVaultFilename(displayName);
  const filename = `${slugName}.md`;
  const target = `${VAULT_PATHS.contactsPro}/${filename}`;

  const content = buildNewContactContent(email, triage, displayName, date);

  return [
    {
      type: 'create_file',
      target,
      payload: { content, filename },
      description: `Créer la fiche contact pro : ${displayName}`,
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
 * Construit le contenu Markdown d'une nouvelle fiche contact pro.
 * Frontmatter aligné sur le format réel du vault (cf. Cowork D1).
 */
function buildNewContactContent(
  email: EmailMessage,
  triage: TriageResult,
  displayName: string,
  date: string,
): string {
  const emailRef = buildEmailRef(email.source, email.id);

  return [
    '---',
    'type: contact',
    'categorie: pro',
    'societe: ',
    'role: ',
    `email: ${email.from.email}`,
    'telephone: ',
    'rencontre_via: ',
    `date_premier_contact: ${date}`,
    `date_derniere_interaction: ${date}`,
    'classification: ',
    'tags:',
    '  - pro',
    '---',
    '',
    `# ${displayName}`,
    '',
    '## Historique',
    '',
    buildHistoriqueTitle(date, triage.intent),
    '',
    `${triage.summary} ${emailRef}`,
    '',
  ].join('\n');
}
