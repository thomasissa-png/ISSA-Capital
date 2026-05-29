/**
 * Script de migration des fiches Contact existantes vers le schéma S25.
 *
 * Aligne les fiches déjà présentes dans `07. Contacts/` sur les templates
 * `Templates/Contact pro.md` v3 et `Templates/Contact relationnel.md` :
 *   - Ajoute les champs frontmatter manquants (sous_categorie, langue,
 *     canal_préféré, fréquence_échanges, entites_visibles selon le type).
 *   - Insère les sections H2 manquantes (## Statut courant, ## Projets liés,
 *     ## Notes, ## Tonalité de communication) JUSTE APRÈS `## Qui c'est` et
 *     AVANT `## Historique` (ordre canonique du template).
 *   - Préserve TOUT le contenu existant : aucun champ rempli n'est écrasé,
 *     aucune section existante n'est modifiée.
 *
 * IDEMPOTENT : re-exécuter le script ne modifie pas une fiche déjà migrée.
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

// ============================================================
// Helpers
// ============================================================

const DRY_RUN = process.env['MIGRATE_DRY_RUN'] === '1';

interface MigrationStats {
  scanned: number;
  alreadyMigrated: number;
  migrated: number;
  errors: number;
  changes: Array<{ path: string; added: string[] }>;
}

/**
 * Champs frontmatter qui DOIVENT exister sur une fiche pro (avec valeur
 * vide acceptée). Si absent → on l'ajoute en conservant la valeur existante
 * des champs déjà présents.
 */
const PRO_FRONTMATTER_KEYS = [
  'type',
  'categorie',
  'sous_categorie',
  'societe',
  'role',
  'email',
  'telephone',
  'langue',
  'rencontre_via',
  'date_premier_contact',
  'date_derniere_interaction',
  'canal_préféré',
  'fréquence_échanges',
  'entites_visibles',
  'classification',
  'tags',
];

const RELATIONAL_FRONTMATTER_KEYS = [
  'type',
  'categorie',
  'sous_categorie',
  'date_naissance',
  'date_anniversaire',
  'lieu_residence',
  'adresse',
  'telephone',
  'email',
  'langue',
  'rencontre_via',
  'date_derniere_interaction',
  'canal_préféré',
  'fréquence_échanges',
  'tags',
];

/** Sections H2 qui doivent exister (dans cet ordre) sur une fiche pro. */
const PRO_SECTIONS_ORDER = [
  "## Qui c'est",
  '## Statut courant',
  '## Projets liés',
  '## Notes',
  '## Tonalité de communication',
  '## Historique',
];

const RELATIONAL_SECTIONS_ORDER = [
  "## Qui c'est",
  '## Famille / Liens',
  '## Notes',
  '## Tonalité de communication',
  '## Historique',
];

/** Bloc canonique de la section `## Tonalité de communication` (vide). */
const TONALITE_BLOCK = `## Tonalité de communication

- Canal préféré :
- Tu/Vous :
- Langue : Français
- Ton :
- À éviter :

`;

/**
 * Détecte le type de fiche à partir du frontmatter et du dossier vault.
 * Retourne `null` si la fiche n'est pas un contact reconnu (skippée).
 */
function detectFicheType(
  folderPath: string,
  categorie: string | undefined,
): 'pro' | 'relational' | null {
  // Priorité au champ categorie du frontmatter.
  if (categorie === 'pro') return 'pro';
  if (categorie === 'famille' || categorie === 'ami' || categorie === 'amis') return 'relational';
  if (categorie === 'autre' || categorie === 'autres') return 'relational';

  // Fallback : dossier.
  if (folderPath.includes('/03. Pro') || folderPath.endsWith('/Pro')) return 'pro';
  if (folderPath.includes('/02. Famille') || folderPath.includes('/04. Amis')) return 'relational';
  if (folderPath.includes('/05. Locataires')) return null; // hors scope migration (template Locataire.md distinct)

  return null;
}

/**
 * Renvoie la liste des champs frontmatter à AJOUTER (et leur valeur initiale
 * vide) pour atteindre le schéma cible. Les champs déjà présents ne sont pas
 * touchés.
 */
function missingFrontmatterKeys(
  current: Record<string, unknown>,
  target: typeof PRO_FRONTMATTER_KEYS,
): string[] {
  return target.filter((k) => !(k in current));
}

/**
 * Renvoie la liste des sections H2 ABSENTES (à ajouter dans l'ordre canonique).
 */
function missingSections(content: string, expected: string[]): string[] {
  return expected.filter((s) => !content.includes(s + '\n') && !content.endsWith(s));
}

// ============================================================
// Migration d'une fiche
// ============================================================

function migrateFicheContent(
  content: string,
  ficheType: 'pro' | 'relational',
): { migrated: string; added: string[] } {
  const added: string[] = [];
  const parsed = parseObsidianFile(content);
  const fmFields = parsed.frontmatter?.fields ?? {};

  const targetKeys = ficheType === 'pro' ? PRO_FRONTMATTER_KEYS : RELATIONAL_FRONTMATTER_KEYS;
  const sectionsOrder = ficheType === 'pro' ? PRO_SECTIONS_ORDER : RELATIONAL_SECTIONS_ORDER;

  // 1. Frontmatter — ajouter les clés manquantes en fin (avant `---`).
  const missingKeys = missingFrontmatterKeys(fmFields, targetKeys);
  let migrated = content;
  if (missingKeys.length > 0) {
    const fmEndMatch = migrated.match(/^---\n[\s\S]*?\n---/);
    if (fmEndMatch) {
      const fmText = fmEndMatch[0];
      const fmCore = fmText.slice(4, -4); // entre les --- balises
      const additions = missingKeys
        .map((k) => {
          // Defaults intelligents : langue=fr, entites_visibles=[], tags=[<categorie>]
          if (k === 'langue') return 'langue: fr';
          if (k === 'entites_visibles') return 'entites_visibles: []';
          if (k === 'tags' && fmFields['categorie']) {
            const cat = String(fmFields['categorie']);
            return `tags:\n  - ${cat}`;
          }
          return `${k}:`;
        })
        .join('\n');
      const newFmText = `---\n${fmCore}\n${additions}\n---`;
      migrated = migrated.replace(fmText, newFmText);
      added.push(...missingKeys.map((k) => `frontmatter:${k}`));
    }
  }

  // 2. Sections manquantes — insérer JUSTE AVANT `## Historique` (préserve
  //    l'ordre canonique). Si `## Historique` absent, append en fin.
  const missing = missingSections(migrated, sectionsOrder);
  if (missing.length > 0) {
    const histIdx = migrated.indexOf('## Historique');
    const sectionsToInsert = missing
      .filter((s) => s !== '## Historique') // historique géré séparément
      .map((s) => {
        if (s === '## Tonalité de communication') return TONALITE_BLOCK.trim() + '\n';
        return `${s}\n\n`;
      })
      .join('\n');

    if (histIdx >= 0) {
      migrated = migrated.slice(0, histIdx) + sectionsToInsert + '\n' + migrated.slice(histIdx);
    } else if (sectionsToInsert.length > 0) {
      migrated = migrated.trimEnd() + '\n\n' + sectionsToInsert;
    }

    if (missing.includes('## Historique') && histIdx < 0) {
      migrated = migrated.trimEnd() + '\n\n## Historique\n\n';
    }
    added.push(...missing.map((s) => `section:${s.replace('## ', '')}`));
  }

  return { migrated, added };
}

// ============================================================
// Runner
// ============================================================

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
      const ficheType = detectFicheType(c.folderPath, parsed.frontmatter?.fields['categorie'] as string);
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
      console.warn(`[migrate] exception sur ${c.folderPath}/${c.filename} : ${err instanceof Error ? err.message : String(err)}`);
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
    for (const c of stats.changes.slice(0, 20)) {
      console.log(`- ${c.path}`);
      console.log(`    + ${c.added.join(', ')}`);
    }
    if (stats.changes.length > 20) {
      console.log(`... et ${stats.changes.length - 20} autres.`);
    }
  }
}

main().catch((err) => {
  console.error('[migrate-contact-fiches] fatal :', err);
  process.exit(1);
});
