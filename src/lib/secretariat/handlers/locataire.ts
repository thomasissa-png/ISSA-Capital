/**
 * Handler email-ingest : locataire.
 *
 * Gère les emails identifiés comme provenant d'un locataire actuel.
 * Cherche la fiche dans 07. Contacts/05. Locataires/01. Actuels/.
 * Si trouvée → append historique + update frontmatter + détection quittance.
 * Si non trouvée (cas anormal) → warning + add_todo.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4 §3.
 */

import type { TriageResult } from '../triage/types';
import type { EmailMessage } from '../gmail-source/types';
import type { ActionProposal } from './types';
import { findContactByEmail } from '../vault-client';

// ============================================================
// Handler principal
// ============================================================

/**
 * Génère les actions pour un email classé "locataire".
 *
 * Si la fiche locataire existe → append historique + update date.
 * Si intent quittance détecté → add_todo supplémentaire.
 * Si fiche non trouvée (anormal) → warning add_todo.
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

  return buildUnknownLocataireActions(email);
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
  const filename = `${contact.name}.md`;
  const target = `${contact.folderPath}/${filename}`;

  const actions: ActionProposal[] = [
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
  ];

  // Détection intent quittance → action add_todo
  if (isQuittanceIntent(triage.intent)) {
    actions.push({
      type: 'add_todo',
      target: null,
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
// Locataire inconnu (cas anormal)
// ============================================================

function buildUnknownLocataireActions(
  email: EmailMessage,
): ActionProposal[] {
  return [
    {
      type: 'add_todo',
      target: null,
      payload: {
        task: `Vérifier locataire inconnu : ${email.from.email}`,
        priority: 'P2',
      },
      description: `Warning : locataire non trouvé dans le vault (${email.from.email})`,
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
