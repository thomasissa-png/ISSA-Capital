/**
 * Handler email-ingest : a-classifier.
 *
 * Cas de fallback — l'email n'a pas été identifié comme locataire,
 * pro ou apporteur. On crée un fichier .md dans 05. Notes/A classifier/
 * avec la date, le sujet et le résumé du triage.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4 §1.
 */

import type { TriageResult } from '../triage/types';
import type { EmailMessage } from '../gmail-source/types';
import type { ActionProposal } from './types';

/**
 * Génère les actions pour un email classé "a-classifier" ou "autre".
 *
 * Action unique : créer un fichier dans A classifier/ avec le contenu
 * minimum pour que Thomas puisse retrouver l'email plus tard.
 */
export async function handleAClassifier(
  triage: TriageResult,
  email: EmailMessage,
): Promise<ActionProposal[]> {
  const date = email.receivedAt.toISOString().slice(0, 10);
  const safeSubject = sanitizeFilename(email.subject || 'sans-objet');
  const filename = `${date} - ${safeSubject}.md`;
  const target = `05. Notes/A classifier/${filename}`;

  // Contenu du fichier .md
  const fromDisplay = email.from.name
    ? `${email.from.name} <${email.from.email}>`
    : email.from.email;

  const bodyPreview = email.bodyPlain.slice(0, 1000).trim();

  const content = [
    '---',
    `source: ${email.source}`,
    `from: "${fromDisplay}"`,
    `date: ${date}`,
    `subject: "${escapeYaml(email.subject)}"`,
    `triage_intent: ${triage.intent}`,
    `triage_confidence: ${triage.confidence}`,
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
    triage.summary,
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
      description: `Créer une note dans A classifier : ${filename}`,
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
 * Nettoie un sujet email pour en faire un nom de fichier valide.
 * Retire les caractères interdits et tronque à 60 caractères.
 */
function sanitizeFilename(subject: string): string {
  return subject
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    || 'sans-objet';
}

/**
 * Échappe les guillemets doubles pour les valeurs YAML.
 */
function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}
