/**
 * CLI script : npm run triage:dry
 *
 * Liste les emails Gmail non traités + appelle Haiku 4.5 pour les trier.
 * AUCUNE modification : pas de label posé, pas de vault touché, pas de Telegram envoyé.
 *
 * Objectif : valider la qualité réelle du triage Jalon 3 sur des vrais emails
 * avant Jalon 4 (handlers + Telegram UI).
 *
 * Usage :
 *   npx tsx scripts/triage-dry.ts
 *
 * Dépendances : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, ANTHROPIC_API_KEY
 */

import { listUnprocessed, fetchDetail } from '../src/lib/secretariat/gmail-source/gmail-source';
import { triageEmail } from '../src/lib/secretariat/triage/triage';
import type { KnownContact } from '../src/lib/secretariat/triage/types';

// Contexte minimal — pas de vault-client appel pour ce dry test.
// Si triage merdique sans contexte, on enrichira avec listing locataires Drive.
const KNOWN_CONTACTS: KnownContact[] = [];

async function main(): Promise<void> {
  console.warn('=== triage:dry ===');
  console.warn('Mode : DRY (zéro modif Gmail, zéro vault, zéro Telegram)');
  console.warn('Modèle : claude-haiku-4-5-20251001');
  console.warn('Contacts injectés : 0 (test sans contexte)');
  console.warn('');

  // Étape 1 : lister les messages non traités
  console.warn('Lecture inbox Gmail (label != Anya/traité, < 7 jours)...');
  const messages = await listUnprocessed();

  if (messages.length === 0) {
    console.warn('Aucun email non traité trouvé.');
    return;
  }

  console.warn(`${messages.length} email(s) à trier.`);
  console.warn('');

  // Stats
  const stats: Record<string, number> = {};
  let totalConfidence = 0;
  let lowConfidence = 0;
  let triageFailures = 0;

  // Étape 2 : trier chaque email
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    console.warn(`\n========== Email ${i + 1}/${messages.length} ==========`);

    const detail = await fetchDetail(msg.id);
    if (!detail) {
      console.warn('  [ERREUR] Impossible de récupérer le détail.');
      triageFailures += 1;
      continue;
    }

    const fromDisplay = detail.from.name
      ? `${detail.from.name} <${detail.from.email}>`
      : detail.from.email;

    console.warn(`From    : ${fromDisplay}`);
    console.warn(`Subject : ${detail.subject}`);
    console.warn(`Date    : ${detail.receivedAt.toISOString()}`);
    console.warn(`Body    : ${detail.bodyPlain.slice(0, 200).replace(/\n/g, ' ')}${detail.bodyPlain.length > 200 ? '...' : ''}`);
    console.warn('');
    console.warn('--- Triage Haiku 4.5 ---');

    const result = await triageEmail(detail, KNOWN_CONTACTS);

    if (!result) {
      console.warn('[ÉCHEC] Haiku n\'a pas retourné de JSON valide après retry.');
      triageFailures += 1;
      continue;
    }

    stats[result.category] = (stats[result.category] || 0) + 1;
    totalConfidence += result.confidence;
    if (result.confidence < 0.7) lowConfidence += 1;

    console.warn(`Catégorie       : ${result.category}`);
    console.warn(`Intent          : ${result.intent}`);
    console.warn(`Confidence      : ${result.confidence.toFixed(2)}${result.confidence < 0.7 ? '  ⚠️  < 0.7 (forcé a-classifier en prod)' : ''}`);
    console.warn(`MatchedContact  : ${result.matchedContact || '(aucun)'}`);
    console.warn(`Summary         : ${result.summary}`);
    if (result.suggestedActions.length > 0) {
      console.warn('SuggestedActions:');
      for (const action of result.suggestedActions) {
        console.warn(`  - ${action.type}${action.target ? ` -> ${action.target}` : ''}`);
      }
    } else {
      console.warn('SuggestedActions: (aucune)');
    }
  }

  // Étape 3 : rapport global
  const successCount = messages.length - triageFailures;
  console.warn('');
  console.warn('========== Rapport global ==========');
  console.warn(`Emails traités       : ${successCount}/${messages.length}`);
  console.warn(`Échecs Haiku         : ${triageFailures}`);
  if (successCount > 0) {
    console.warn(`Confidence moyenne   : ${(totalConfidence / successCount).toFixed(2)}`);
    console.warn(`Emails low conf (< 0.7) : ${lowConfidence}/${successCount}`);
  }
  console.warn('');
  console.warn('Distribution par catégorie :');
  for (const cat of Object.keys(stats).sort()) {
    console.warn(`  ${cat.padEnd(15)} : ${stats[cat]}`);
  }
  console.warn('');
  console.warn('=== triage:dry terminé — aucune modification effectuée ===');
}

main().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
