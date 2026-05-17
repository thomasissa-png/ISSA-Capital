/**
 * Handler email-ingest : locataire.
 *
 * Gère les emails identifiés comme provenant d'un locataire actuel.
 * Cherche la fiche dans 07. Contacts/05. Locataires/01. Actuels/.
 * Si trouvée → append historique + update frontmatter + détection quittance.
 * Si non trouvée (cas anormal) → dépôt A classifier + prompt 5 boutons.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4 §3.
 * Fix Jalon 4D-1 : paths via VAULT_PATHS, slugify, em-dash, ref Gmail.
 * Fix Jalon 4D-2 : no-match → A classifier + prompt 5 boutons (plus de add_todo seul).
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
 * Génère les actions pour un email classé "locataire".
 *
 * Si la fiche locataire existe → append historique + update date.
 * Si intent quittance détecté → add_todo supplémentaire.
 * Si fiche non trouvée (anormal) → A classifier + prompt 5 boutons.
 */
export async function handleLocataire(
  triage: TriageResult,
  email: EmailMessage,
): Promise<ActionProposal[]> {
  const contact = await findContactByEmail(email.from.email);
  const date = email.receivedAt.toISOString().slice(0, 10);

  if (contact) {
    return buildLocataireActions(triage, email, contact, date);
  }

  return buildUnknownLocataireActions(triage, email);
}

// ============================================================
// Locataire connu
// ============================================================

function buildLocataireActions(
  triage: TriageResult,
  email: EmailMessage,
  contact: { name: string; folderPath: string },
  date: string,
): ActionProposal[] {
  const filename = `${slugifyVaultFilename(contact.name)}.md`;
  const target = `${contact.folderPath}/${filename}`;
  const emailRef = buildEmailRef(email.source, email.id);

  const actions: ActionProposal[] = [
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
  ];

  // Détection intent quittance → action add_todo vers 03. Tâches/Todo.md
  if (isQuittanceIntent(triage.intent)) {
    actions.push({
      type: 'add_todo',
      target: VAULT_PATHS.todoMd,
      payload: {
        task: `Générer quittance ${triage.intent} pour ${contact.name}`,
        priority: 'P1',
      },
      description: `Tâche P1 : générer quittance pour ${contact.name}`,
    });
  }

  actions.push({
    type: 'mark_processed',
    target: null,
    payload: { messageId: email.id },
    description: 'Marquer l\'email comme traité dans Gmail',
  });

  return actions;
}

// ============================================================
// Locataire inconnu — no-match (Jalon 4D-2)
// ============================================================

/**
 * Construit les actions pour un email "locataire" dont l'expéditeur n'a pas de fiche.
 *
 * Cas rare mais robustesse : si le triage classe en locataire un email d'inconnu,
 * on dépose dans A classifier + prompt 5 boutons avec defaultType "autres"
 * (un locataire inconnu n'est probablement pas un vrai locataire).
 */
function buildUnknownLocataireActions(
  triage: TriageResult,
  email: EmailMessage,
): ActionProposal[] {
  const date = email.receivedAt.toISOString().slice(0, 10);
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
    `triage_category: locataire`,
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
      description: `Déposer dans A classifier (locataire inconnu)`,
    },
    {
      type: 'prompt_create_contact_choice',
      target: null,
      payload: {
        emailFrom: email.from.email,
        nameFrom: email.from.name ?? null,
        defaultType: 'autres',
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
 * Détecte si l'intent du triage correspond à une demande de quittance.
 * Matche les intents commençant par "demande_quittance_" (case-insensitive).
 */
function isQuittanceIntent(intent: string): boolean {
  return /^demande_quittance_/i.test(intent);
}

/**
 * Échappe les guillemets doubles pour les valeurs YAML.
 */
function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}
