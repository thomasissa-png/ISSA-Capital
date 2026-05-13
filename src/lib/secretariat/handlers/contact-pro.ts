/**
 * Handler email-ingest : contact-pro.
 *
 * Gère les emails identifiés comme provenant d'un contact professionnel.
 * Cherche la fiche existante dans le vault — si trouvée, append à
 * l'historique + update frontmatter. Sinon, crée une nouvelle fiche.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4 §2.
 */

import type { TriageResult } from '../triage/types';
import type { EmailMessage } from '../gmail-source/types';
import type { ActionProposal } from './types';
import { findContactByEmail } from '../vault-client';

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
  const filename = `${contact.name}.md`;
  const target = `${contact.folderPath}/${filename}`;

  return [
    {
      type: 'append_historique',
      target,
      payload: {
        section: triage.intent,
        content: triage.summary,
        date: email.receivedAt.toISOString(),
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
  const filename = `${displayName}.md`;
  const target = `07. Contacts/01. Pro/${filename}`;

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
 */
function buildNewContactContent(
  email: EmailMessage,
  triage: TriageResult,
  displayName: string,
  date: string,
): string {
  return [
    '---',
    `nom: "${displayName}"`,
    `email: "${email.from.email}"`,
    `type: pro`,
    `date_creation: ${date}`,
    `date_derniere_interaction: ${date}`,
    `source: email-ingest`,
    '---',
    '',
    `# ${displayName}`,
    '',
    '## Historique',
    '',
    `### ${date} — ${triage.intent}`,
    '',
    triage.summary,
    '',
  ].join('\n');
}
