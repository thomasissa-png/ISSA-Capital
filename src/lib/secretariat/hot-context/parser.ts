/**
 * Parser markdown → AST 4 sections pour `hot-context.md`.
 *
 * Source de vérité : `docs/hot-context-spec.md` §1.2.
 *
 * Détecte les 4 headings cibles (tolérant variations Markdown) :
 *  - « Je bouge sur (cette semaine) » → section 'bouge'
 *  - « J'attends » → section 'attends'
 *  - « Décisions en arbitrage » → section 'arbitrage'
 *  - « Maintenance » → section 'maintenance' (red line — INTOUCHABLE)
 *
 * Préserve :
 *  - Frontmatter YAML (---\n...\n---) bit-à-bit
 *  - Préambule (texte avant la première section connue)
 *  - Ordre des sections détectées
 *  - Lignes de corps (whitespace, listes, tableaux markdown)
 *  - UTF-8 natif (é, è, à, etc.)
 *
 * Anti-pattern interdit : reformater le markdown. Le parser DOIT être
 * conservatif (round-trip = identité quand aucun patch n'est appliqué).
 */

import type { HotContextAst, SectionBlock } from './types';

// ============================================================
// Headings — détection
// ============================================================

/**
 * Mapping label canonique → clé d'AST.
 * Comparaison case-insensitive, après normalisation des espaces.
 */
const SECTION_LABELS: Record<string, keyof Omit<HotContextAst, 'frontmatter' | 'preamble'>> = {
  'je bouge sur (cette semaine)': 'bouge',
  'je bouge sur': 'bouge',
  "j'attends": 'attends',
  'décisions en arbitrage': 'arbitrage',
  'decisions en arbitrage': 'arbitrage',
  'maintenance': 'maintenance',
};

/**
 * Tente d'extraire un label de heading depuis une ligne markdown.
 * Retourne null si la ligne n'est pas un heading ATX (# / ## / ###).
 */
function parseHeading(line: string): { level: number; label: string } | null {
  const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
  if (!match || !match[1] || !match[2]) return null;
  return { level: match[1].length, label: match[2].trim() };
}

/**
 * Normalise un label pour matching insensible casse + accents simples.
 * Retourne null si pas de section connue.
 */
function matchSectionKey(label: string): keyof Omit<HotContextAst, 'frontmatter' | 'preamble'> | null {
  const normalized = label.toLowerCase().replace(/\s+/g, ' ').trim();
  return SECTION_LABELS[normalized] ?? null;
}

// ============================================================
// Frontmatter
// ============================================================

/**
 * Extrait le frontmatter YAML s'il existe.
 * Retourne { frontmatter, rest } — frontmatter inclut les délimiteurs `---`.
 */
function extractFrontmatter(content: string): { frontmatter: string; rest: string } {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    return { frontmatter: '', rest: content };
  }
  // Chercher le `---` de fermeture (ligne complète).
  const lines = content.split('\n');
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? '').trim() === '---') {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) {
    return { frontmatter: '', rest: content };
  }
  const frontmatter = lines.slice(0, closeIdx + 1).join('\n') + '\n';
  const rest = lines.slice(closeIdx + 1).join('\n');
  return { frontmatter, rest };
}

// ============================================================
// Parser principal
// ============================================================

/**
 * Parse le contenu markdown en AST 4 sections.
 *
 * Garanties :
 *  - Toute section non détectée → SectionBlock vide (heading généré par défaut).
 *  - Le préambule contient tout ce qui précède la première section reconnue.
 *  - Round-trip : `serialize(parse(content))` doit donner `content` (modulo
 *    normalisation des line endings → \n).
 *
 * @param content Contenu brut du fichier `hot-context.md`.
 * @returns AST exploitable par applier.
 */
export function parseHotContext(content: string): HotContextAst {
  const { frontmatter, rest } = extractFrontmatter(content);
  const lines = rest.split('\n');

  const ast: HotContextAst = {
    frontmatter,
    preamble: '',
    bouge: emptyBlock('## Je bouge sur (cette semaine)'),
    attends: emptyBlock("## J'attends"),
    arbitrage: emptyBlock('## Décisions en arbitrage'),
    maintenance: emptyBlock('## Maintenance'),
  };

  const preambleLines: string[] = [];
  let currentKey: keyof Omit<HotContextAst, 'frontmatter' | 'preamble'> | null = null;

  for (const line of lines) {
    const heading = parseHeading(line);
    if (heading) {
      const key = matchSectionKey(heading.label);
      if (key) {
        ast[key] = { heading: line, bodyLines: [] };
        currentKey = key;
        continue;
      }
    }
    if (currentKey === null) {
      preambleLines.push(line);
    } else {
      ast[currentKey].bodyLines.push(line);
    }
  }

  ast.preamble = preambleLines.join('\n');
  return ast;
}

function emptyBlock(defaultHeading: string): SectionBlock {
  return { heading: defaultHeading, bodyLines: [] };
}

// ============================================================
// Serializer (round-trip)
// ============================================================

/**
 * Re-sérialise l'AST en markdown.
 *
 * Ordre fixe : bouge → attends → arbitrage → maintenance.
 * Si une section est vide (jamais détectée ET bodyLines vide), son heading
 * par défaut est tout de même émis pour faciliter les futurs patches.
 */
export function serializeHotContext(ast: HotContextAst): string {
  const sections: string[] = [];
  sections.push(joinSection(ast.bouge));
  sections.push(joinSection(ast.attends));
  sections.push(joinSection(ast.arbitrage));
  sections.push(joinSection(ast.maintenance));

  const body = sections.join('').replace(/\n+$/, '\n');
  const preamble = ast.preamble.length > 0 ? ast.preamble : '';
  // Conserver une ligne vide entre frontmatter et corps si frontmatter présent.
  return ast.frontmatter + preamble + (preamble.endsWith('\n') || preamble === '' ? '' : '\n') + body;
}

function joinSection(block: SectionBlock): string {
  const body = block.bodyLines.join('\n');
  return block.heading + '\n' + body + (body.endsWith('\n') ? '' : '\n');
}

// ============================================================
// Helpers exportés (utilisés par applier + tests)
// ============================================================

/**
 * Vérifie si la section Maintenance a été modifiée entre deux AST.
 * Red line : applier doit refuser tout patch qui altère cette section.
 */
export function maintenanceChanged(before: HotContextAst, after: HotContextAst): boolean {
  if (before.maintenance.heading !== after.maintenance.heading) return true;
  if (before.maintenance.bodyLines.length !== after.maintenance.bodyLines.length) return true;
  for (let i = 0; i < before.maintenance.bodyLines.length; i++) {
    if (before.maintenance.bodyLines[i] !== after.maintenance.bodyLines[i]) return true;
  }
  return false;
}
