/**
 * Handler email-ingest : contact-pro.
 *
 * Gère les emails identifiés comme provenant d'un contact professionnel.
 * Cherche la fiche existante dans le vault — si trouvée, append à
 * l'historique + update frontmatter. Sinon, dépose dans A classifier/
 * et retourne une action prompt_create_contact_choice (carte Telegram
 * 5 boutons pour que Thomas choisisse le type de fiche à créer).
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4 §2.
 * Fix Jalon 4D-1 : paths vault corrigés (07. Contacts/03. Pro, pas 01. Pro).
 * Fix Jalon 4D-2 : no-match → A classifier + prompt 5 boutons (plus de fiche stub auto).
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
  EM_DASH,
} from './vault-paths';

// ============================================================
// Handler principal
// ============================================================

/**
 * Génère les actions pour un email classé "contact-pro".
 *
 * Si la fiche contact existe → append historique + update date.
 * Sinon → dépôt dans A classifier + prompt 5 boutons Telegram.
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

  return buildNoMatchActions(triage, email, date);
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
// No-match contact (Jalon 4D-2)
// ============================================================

/**
 * Construit les actions pour un email dont l'expéditeur n'a pas de fiche.
 *
 * - Dépôt dans A classifier/ avec résumé triage
 * - Action prompt_create_contact_choice pour carte Telegram 5 boutons
 * - mark_processed
 */
function buildNoMatchActions(
  triage: TriageResult,
  email: EmailMessage,
  date: string,
): ActionProposal[] {
  const safeSubject = slugifyVaultFilename(email.subject || 'sans-objet');
  const filename = `${date} ${EM_DASH} ${safeSubject}.md`;
  const target = `${VAULT_PATHS.notesAClassifier}/${filename}`;

  const fromDisplay = email.from.name
    ? `${email.from.name} <${email.from.email}>`
    : email.from.email;
  const emailRef = buildEmailRef(email.source, email.id);
  const bodyPreview = email.bodyPlain.slice(0, 1000).trim();

  const content = [
    '---',
    `source: ${email.source}`,
    `from: "${escapeYaml(fromDisplay)}"`,
    `date: ${date}`,
    `subject: "${escapeYaml(email.subject)}"`,
    `triage_intent: ${triage.intent}`,
    `triage_confidence: ${triage.confidence}`,
    `triage_category: contact-pro`,
    '---',
    '',
    `## ${email.subject}`,
    '',
    `**De** : ${fromDisplay}`,
    `**Date** : ${email.receivedAt.toLocaleDateString('fr-FR')}`,
    `**Lien** : ${email.rawRef}`,
    '',
    `### Résumé triage`,
    '',
    `${triage.summary} ${emailRef}`,
    '',
    `### Contenu`,
    '',
    bodyPreview,
    bodyPreview.length < email.bodyPlain.length ? '\n\n[... tronqué]' : '',
    '',
  ].join('\n');

  return [
    {
      type: 'create_file',
      target,
      payload: { content, filename },
      description: `Déposer dans A classifier (contact inconnu)`,
    },
    {
      type: 'prompt_create_contact_choice',
      target: null,
      payload: {
        emailFrom: email.from.email,
        nameFrom: email.from.name ?? null,
        defaultType: 'pro',
        emailMessageId: email.id,
        emailThreadRef: buildEmailRef(email.source, email.id),
      },
      description: 'Proposer création fiche contact (5 boutons : Pro/Famille/Amis/Autres/Skip)',
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
 * Échappe les guillemets doubles pour les valeurs YAML.
 */
function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}
