/**
 * CLI script : npm run ingest:gmail -- --dry-run
 *
 * Liste les emails Gmail non traités sans rien modifier.
 * Critère de succès Jalon 2 : ce script fonctionne.
 *
 * Usage :
 *   npx tsx scripts/ingest-gmail.ts --dry-run     # liste sans modifier
 *   npx tsx scripts/ingest-gmail.ts               # (futur) triage + actions
 *
 * Dépendances : GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *               + GMAIL_USER_EMAIL (optionnel, défaut "me")
 */

import { listUnprocessed, fetchDetail } from '../src/lib/secretariat/gmail-source/gmail-source';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.warn('=== ingest:gmail ===');
  console.warn(`Mode : ${isDryRun ? 'DRY-RUN (lecture seule)' : 'LIVE'}`);
  console.warn('');

  // Étape 1 : lister les messages non traités
  console.warn('Recherche des emails non traités...');
  const messages = await listUnprocessed();

  if (messages.length === 0) {
    console.warn('Aucun email non traité trouvé.');
    console.warn('Vérifiez que :');
    console.warn('  1. Thomas a re-OAuth avec les scopes Gmail (visiter /api/drive-auth)');
    console.warn('  2. Le label "Anya/traité" existe dans Gmail');
    console.warn('  3. Il y a des emails récents (< 7 jours) dans l\'inbox');
    return;
  }

  console.warn(`${messages.length} email(s) non traité(s) trouvé(s).`);
  console.warn('');

  // Étape 2 : fetch détail de chaque message
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    console.warn(`--- Email ${i + 1}/${messages.length} (id: ${msg.id}) ---`);

    const detail = await fetchDetail(msg.id);
    if (!detail) {
      console.warn('  [ERREUR] Impossible de récupérer le détail.');
      continue;
    }

    console.warn(`  From    : ${detail.from.name ? `${detail.from.name} <${detail.from.email}>` : detail.from.email}`);
    console.warn(`  Subject : ${detail.subject}`);
    console.warn(`  Date    : ${detail.receivedAt.toISOString()}`);
    console.warn(`  Body    : ${detail.bodyPlain.slice(0, 150).replace(/\n/g, ' ')}${detail.bodyPlain.length > 150 ? '...' : ''}`);
    if (detail.attachments.length > 0) {
      console.warn(`  Attach  : ${detail.attachments.map((a) => a.name).join(', ')}`);
    }
    console.warn(`  Ref     : ${detail.rawRef}`);
    console.warn('');
  }

  if (isDryRun) {
    console.warn('=== DRY-RUN terminé — aucune modification effectuée ===');
  }
}

main().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
