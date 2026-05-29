/**
 * Logique PURE de migration des fiches Contact vers le schéma S25.
 *
 * Aucun effet de bord, aucune dépendance réseau/Drive : uniquement la
 * transformation de contenu Markdown → Markdown. Importable par :
 *   - `migrate-contact-fiches.ts` (runner Drive, prod)
 *   - le harness local de migration (lecture/écriture via MCP côté agent)
 *   - les tests unitaires
 *
 * Règles (cf. en-tête de migrate-contact-fiches.ts) :
 *   - Ajoute les champs frontmatter manquants (valeur vide acceptée).
 *   - Insère les sections H2 manquantes JUSTE AVANT `## Historique`.
 *   - Préserve TOUT le contenu existant. IDEMPOTENT.
 */

import { parseObsidianFile } from '../src/lib/secretariat/vault-client/frontmatter';

// ============================================================
// Schéma cible
// ============================================================

export const PRO_FRONTMATTER_KEYS = [
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
] as const;

export const RELATIONAL_FRONTMATTER_KEYS = [
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
] as const;

export const PRO_SECTIONS_ORDER = [
  "## Qui c'est",
  '## Statut courant',
  '## Projets liés',
  '## Notes',
  '## Tonalité de communication',
  '## Historique',
];

export const RELATIONAL_SECTIONS_ORDER = [
  "## Qui c'est",
  '## Famille / Liens',
  '## Notes',
  '## Tonalité de communication',
  '## Historique',
];

/** Bloc canonique de la section `## Tonalité de communication` (vide). */
export const TONALITE_BLOCK = `## Tonalité de communication

- Canal préféré :
- Tu/Vous :
- Langue : Français
- Ton :
- À éviter :

`;

// ============================================================
// Détection du type
// ============================================================

/**
 * Détecte le type de fiche à partir du frontmatter et du dossier vault.
 * Retourne `null` si la fiche n'est pas un contact migrable (skippée).
 *
 * Priorité au champ `categorie` du frontmatter (signal principal). Le dossier
 * n'est qu'un fallback quand `categorie` est absent/inconnu.
 *
 * Dossiers réels (07. Contacts/) : `01. Famille`, `02. Amis`, `03. Pro`,
 * `04. Autres`, `05. Locataires` (hors scope — template distinct).
 */
export function detectFicheType(
  folderPath: string,
  categorie: string | undefined,
): 'pro' | 'relational' | null {
  if (categorie === 'pro') return 'pro';
  if (categorie === 'famille') return 'relational';
  if (categorie === 'ami' || categorie === 'amis') return 'relational';
  if (categorie === 'autre' || categorie === 'autres') return 'relational';
  if (categorie === 'locataire') return null;

  // Fallback : dossier (chemins réels du vault).
  if (folderPath.includes('05. Locataires')) return null;
  if (folderPath.includes('03. Pro')) return 'pro';
  if (folderPath.includes('01. Famille')) return 'relational';
  if (folderPath.includes('02. Amis')) return 'relational';
  // 04. Autres : hybride → relationnel par défaut (champs communs uniquement).
  if (folderPath.includes('04. Autres')) return 'relational';

  return null;
}

// ============================================================
// Helpers de détection des manques
// ============================================================

export function missingFrontmatterKeys(
  current: Record<string, unknown>,
  target: readonly string[],
): string[] {
  return target.filter((k) => !(k in current));
}

/**
 * Renvoie les sections H2 ABSENTES. Match sur une ligne d'en-tête H2 exacte
 * (début de ligne `## Titre`) pour éviter les faux positifs avec des H3
 * (`### Notes`) ou des sous-chaînes.
 */
export function missingSections(content: string, expected: string[]): string[] {
  return expected.filter((s) => !hasH2Heading(content, s));
}

/** Vrai si `content` contient l'en-tête H2 `heading` sur sa propre ligne. */
function hasH2Heading(content: string, heading: string): boolean {
  // heading commence par "## " ; on exige un début de ligne et une fin de
  // ligne (ou fin de fichier) pour ne pas matcher "### ..." ou une sous-chaîne.
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|\\n)${escaped}(\\r?\\n|$)`);
  return re.test(content);
}

// ============================================================
// Transformation d'une fiche
// ============================================================

export interface MigrateResult {
  migrated: string;
  added: string[];
}

export function migrateFicheContent(
  content: string,
  ficheType: 'pro' | 'relational',
): MigrateResult {
  const added: string[] = [];
  const parsed = parseObsidianFile(content);
  const fmFields = parsed.frontmatter?.fields ?? {};

  const targetKeys =
    ficheType === 'pro' ? PRO_FRONTMATTER_KEYS : RELATIONAL_FRONTMATTER_KEYS;
  const sectionsOrder =
    ficheType === 'pro' ? PRO_SECTIONS_ORDER : RELATIONAL_SECTIONS_ORDER;

  // 1. Frontmatter — ajouter les clés manquantes en fin de bloc (avant `---`).
  const missingKeys = missingFrontmatterKeys(fmFields, targetKeys);
  let migrated = content;
  if (missingKeys.length > 0) {
    const fmEndMatch = migrated.match(/^---\r?\n[\s\S]*?\r?\n---/);
    if (fmEndMatch) {
      const fmText = fmEndMatch[0];
      // Conserver le corps du frontmatter sans les délimiteurs ---.
      const fmCore = fmText.replace(/^---\r?\n/, '').replace(/\r?\n---$/, '');
      const additions = missingKeys
        .map((k) => {
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

  // 2. Sections manquantes — insérer JUSTE AVANT `## Historique` (ordre
  //    canonique). Si `## Historique` absent, append en fin.
  const missing = missingSections(migrated, sectionsOrder);
  if (missing.length > 0) {
    const histMatch = migrated.match(/(^|\n)## Historique(\r?\n|$)/);
    const histIdx = histMatch ? migrated.indexOf('## Historique', histMatch.index) : -1;
    const sectionsToInsert = missing
      .filter((s) => s !== '## Historique')
      .map((s) => {
        if (s === '## Tonalité de communication') return TONALITE_BLOCK.trim() + '\n';
        return `${s}\n\n`;
      })
      .join('\n');

    if (histIdx >= 0) {
      migrated =
        migrated.slice(0, histIdx) + sectionsToInsert + '\n' + migrated.slice(histIdx);
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
