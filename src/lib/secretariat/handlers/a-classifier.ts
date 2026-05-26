/**
 * Handler email-ingest : a-classifier.
 *
 * Cas de fallback — l'email n'a pas été identifié comme locataire,
 * pro ou apporteur. On crée un fichier .md dans _Inbox/A classifier/
 * avec la date, le sujet et le résumé du triage.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4 §1.
 * Fix Jalon 4D-1 : path via VAULT_PATHS, slugify filename, em-dash, ref email.
 */

import type { TriageResult } from '../triage/types';
import type { EmailMessage } from '../gmail-source/types';
import type { ActionProposal } from './types';
import {
  VAULT_PATHS,
  slugifyVaultFilename,
  buildEmailRef,
  EM_DASH,
} from './vault-paths';

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
  const safeSubject = slugifyVaultFilename(email.subject || 'sans-objet');
  const filename = `${date} ${EM_DASH} ${safeSubject}.md`;
  const target = `${VAULT_PATHS.notesAClassifier}/${filename}`;

  // Contenu du fichier .md
  const fromDisplay = email.from.name
    ? `${email.from.name} <${email.from.email}>`
    : email.from.email;

  const emailRef = buildEmailRef(email.source, email.id);
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
 * Échappe les guillemets doubles pour les valeurs YAML.
 */
function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}
