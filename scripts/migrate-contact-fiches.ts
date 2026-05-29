/**
 * Script de migration des fiches Contact existantes vers le schéma S25.
 *
 * Aligne les fiches déjà présentes dans `07. Contacts/` sur les templates
 * `Templates/Contact pro.md` v3 et `Templates/Contact relationnel.md` :
 *   - Ajoute les champs frontmatter manquants (sous_categorie, langue,
 *     canal_préféré, fréquence_échanges, entites_visibles selon le type).
 *   - Insère les sections H2 manquantes (## Statut courant, ## Projets liés,
 *     ## Notes, ## Tonalité de communication) JUSTE AVANT `## Historique`.
 *   - Préserve TOUT le contenu existant. IDEMPOTENT.
 *
 * La logique de transformation vit dans `migrate-contact-fiches-core.ts`
 * (pure, testée — voir `__tests__/migrate-contact-fiches-core.test.ts`).
 * Ce fichier n'est que le RUNNER Drive (lecture/écriture via l'API Drive).
 *
 * NE PAS EXÉCUTER AUTOMATIQUEMENT. Lancement manuel par Thomas, avec préalable :
 *   1. Backup du dossier `07. Contacts/` (snapshot Drive).
 *   2. Dry-run (env `MIGRATE_DRY_RUN=1`) pour voir le rapport sans écrire.
 *   3. Si OK → relancer sans `MIGRATE_DRY_RUN` pour appliquer.
 *
 * Usage :
 *   MIGRATE_DRY_RUN=1 npx tsx scripts/migrate-contact-fiches.ts
 *   npx tsx scripts/migrate-contact-fiches.ts
 *
 * S25 (2026-05-29) — créé suite à l'audit Thomas « si on fait des fiches,
 * des templates et des workflows, c'est pour qu'Anya les suive ».
 */

import { getVaultContacts } from '../src/lib/secretariat/vault-contacts';
import { readFile, writeFile } from '../src/lib/secretariat/vault-client/obsidian-file';
import { parseObsidianFile } from '../src/lib/secretariat/vault-client/frontmatter';
import { detectFicheType, migrateFicheContent } from './migrate-contact-fiches-core';

const DRY_RUN = process.env['MIGRATE_DRY_RUN'] === '1';

interface MigrationStats {
  scanned: number;
  alreadyMigrated: number;
  migrated: number;
  errors: number;
  changes: Array<{ path: string; added: string[] }>;
}

async function main(): Promise<void> {
  console.log(`[migrate-contact-fiches] mode = ${DRY_RUN ? 'DRY-RUN (read-only)' : 'APPLY'}`);
  const stats: MigrationStats = {
    scanned: 0,
    alreadyMigrated: 0,
    migrated: 0,
    errors: 0,
    changes: [],
  };

  const contacts = await getVaultContacts();
  for (const c of contacts) {
    if (!c.folderPath || !c.filename) continue;
    stats.scanned++;
    try {
      const result = await readFile(c.folderPath, c.filename);
      if (!result.success || !result.content) {
        stats.errors++;
        continue;
      }
      const parsed = parseObsidianFile(result.content);
      const ficheType = detectFicheType(
        c.folderPath,
        parsed.frontmatter?.fields['categorie'] as string,
      );
      if (!ficheType) continue;

      const { migrated, added } = migrateFicheContent(result.content, ficheType);
      if (added.length === 0) {
        stats.alreadyMigrated++;
        continue;
      }

      const path = `${c.folderPath}/${c.filename}`;
      stats.changes.push({ path, added });

      if (!DRY_RUN) {
        const writeRes = await writeFile(c.folderPath, c.filename, migrated);
        if (writeRes.success) {
          stats.migrated++;
        } else {
          stats.errors++;
          console.warn(`[migrate] échec écriture ${path}`);
        }
      } else {
        stats.migrated++;
      }
    } catch (err) {
      stats.errors++;
      console.warn(
        `[migrate] exception sur ${c.folderPath}/${c.filename} : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log('\n=== Rapport migration ===');
  console.log(`Mode             : ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
  console.log(`Fiches scannées  : ${stats.scanned}`);
  console.log(`Déjà migrées     : ${stats.alreadyMigrated}`);
  console.log(`${DRY_RUN ? 'À migrer' : 'Migrées'}        : ${stats.migrated}`);
  console.log(`Erreurs          : ${stats.errors}`);

  if (stats.changes.length > 0) {
    console.log('\n=== Détail des changements ===');
    for (const c of stats.changes.slice(0, 50)) {
      console.log(`- ${c.path}`);
      console.log(`    + ${c.added.join(', ')}`);
    }
    if (stats.changes.length > 50) {
      console.log(`... et ${stats.changes.length - 50} autres.`);
    }
  }
}

main().catch((err) => {
  console.error('[migrate-contact-fiches] fatal :', err);
  process.exit(1);
});
