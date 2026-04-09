/**
 * Script CLI — génère un hash bcrypt d'un mot de passe admin.
 *
 * Usage :
 *   npx tsx scripts/generate-admin-hash.ts <motdepasse>
 *
 * Sortie :
 *   ADMIN_PASSWORD_HASH=$2a$10$...
 *
 * Copier la sortie dans `.env.local` (dev) ou Replit Secrets (prod).
 * Ne JAMAIS committer le mot de passe en clair.
 *
 * V1 par défaut : le mot de passe est `allezpsg`. À CHANGER en production.
 */

/* eslint-disable no-console */

import { hashPassword } from '../src/server/services/auth';

async function main(): Promise<void> {
  const plain = process.argv[2];

  if (typeof plain !== 'string' || plain.length === 0) {
    console.error(
      'Usage : npx tsx scripts/generate-admin-hash.ts <motdepasse>',
    );
    console.error('Exemple : npx tsx scripts/generate-admin-hash.ts allezpsg');
    process.exit(1);
  }

  if (plain.length < 8) {
    console.error(
      `ATTENTION : mot de passe de ${plain.length} caractères — minimum recommandé : 8`,
    );
  }

  const hash = await hashPassword(plain);

  console.log('');
  console.log('Hash bcrypt généré (copier la ligne ci-dessous dans .env.local) :');
  console.log('');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('');
  console.log('Vérification : longueur hash =', hash.length, 'caractères');
  console.log('(un hash bcrypt valide fait 60 caractères)');
}

main().catch((err: unknown) => {
  console.error('Erreur :', err);
  process.exit(1);
});
