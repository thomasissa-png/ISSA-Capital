/**
 * Parse + patch YAML frontmatter Obsidian.
 *
 * Contrainte critique : préserver le frontmatter caractère pour caractère
 * sauf modifications explicites. Pas de re-sérialisation YAML (réordonne les clés).
 *
 * Approche : travailler sur le texte brut, ligne par ligne.
 * - Parse : extraction regex + split lignes
 * - Patch : remplacement chirurgical de la valeur d'une clé
 * - Le body Markdown après le frontmatter n'est JAMAIS touché ici
 *
 * Supporte :
 * - Valeurs simples (string, nombre, date YYYY-MM-DD)
 * - Listes YAML à tirets (tags, alias_email)
 * - Clés avec accents (date_dernière_interaction)
 * - Valeurs entre guillemets ou non
 * - Champs vides (clé:) ou null (clé: null)
 */

// ============================================================
// Types
// ============================================================

export interface ParsedFrontmatter {
  /** Le bloc YAML brut (entre les deux ---), incluant les sauts de ligne */
  raw: string;
  /** Dictionnaire clé → valeur parsée (scalaires uniquement) */
  fields: Record<string, string | number | boolean | null>;
  /** Listes détectées : clé → valeurs[] */
  lists: Record<string, string[]>;
  /** Position du premier --- dans le fichier complet */
  startIndex: number;
  /** Position juste après le deuxième --- (incluant le \n qui suit) */
  endIndex: number;
}

export interface ObsidianFile {
  frontmatter: ParsedFrontmatter | null;
  body: string;
  /** Le contenu complet original (frontmatter + body) */
  fullContent: string;
}

// ============================================================
// Regex
// ============================================================

/**
 * Regex pour extraire le frontmatter YAML.
 * Capture le bloc entre les deux --- (non-greedy).
 * Le premier --- doit être en tout début de fichier.
 */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

// ============================================================
// Parse
// ============================================================

/**
 * Parse le frontmatter YAML d'un fichier Obsidian.
 *
 * Retourne les champs scalaires dans `fields` et les listes dans `lists`.
 * L'ordre des clés est préservé dans `raw` (texte brut non modifié).
 *
 * @param content Contenu complet du fichier .md
 * @returns ObsidianFile avec frontmatter parsé (ou null si pas de frontmatter)
 */
export function parseObsidianFile(content: string): ObsidianFile {
  const match = FRONTMATTER_RE.exec(content);

  if (!match || match[0] === undefined || match[1] === undefined) {
    return {
      frontmatter: null,
      body: content,
      fullContent: content,
    };
  }

  const raw = match[1];
  const startIndex = 0;
  const endIndex = match[0].length;
  const body = content.slice(endIndex);

  const fields: Record<string, string | number | boolean | null> = {};
  const lists: Record<string, string[]> = {};

  const lines = raw.split('\n');
  let currentListKey: string | null = null;

  for (const line of lines) {
    // Détection d'un item de liste (  - valeur)
    const listItemMatch = /^\s+-\s+(.+)$/.exec(line);
    if (listItemMatch && currentListKey) {
      const val = unquote(listItemMatch[1]!.trim());
      lists[currentListKey]!.push(val);
      continue;
    }

    // Détection d'une ligne clé: valeur
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      currentListKey = null;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    // Si la valeur est vide, cela peut être le début d'une liste
    if (rawValue === '' || rawValue === '[]') {
      currentListKey = key;
      if (!lists[key]) {
        lists[key] = [];
      }
      if (rawValue === '[]') {
        fields[key] = null;
        currentListKey = null;
      } else {
        fields[key] = null;
      }
      continue;
    }

    currentListKey = null;

    // Parse la valeur
    fields[key] = parseYamlValue(rawValue);
  }

  return {
    frontmatter: { raw, fields, lists, startIndex, endIndex },
    body,
    fullContent: content,
  };
}

/**
 * Parse une valeur YAML scalaire.
 */
function parseYamlValue(raw: string): string | number | boolean | null {
  if (raw === 'null' || raw === '~' || raw === '') {
    return null;
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Valeur entre guillemets
  const unquoted = unquote(raw);

  // Essayer comme nombre (mais pas les dates YYYY-MM-DD)
  if (!/^\d{4}-\d{2}/.test(unquoted)) {
    const num = Number(unquoted);
    if (!Number.isNaN(num) && unquoted !== '') {
      return num;
    }
  }

  return unquoted;
}

/**
 * Retire les guillemets simples ou doubles autour d'une valeur.
 */
function unquote(val: string): string {
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1);
  }
  return val;
}

// ============================================================
// Patch (modification chirurgicale)
// ============================================================

/**
 * Modifie la valeur d'un champ frontmatter dans le contenu brut.
 *
 * Ne modifie QUE la ligne du champ ciblé. Tout le reste est préservé
 * caractère pour caractère (y compris l'ordre des autres clés,
 * les espaces, les commentaires, les listes).
 *
 * @param content Contenu complet du fichier .md
 * @param key Clé du champ à modifier (ex: "date_dernière_interaction")
 * @param newValue Nouvelle valeur (string, nombre, ou null)
 * @returns Contenu modifié, ou le contenu original si la clé n'est pas trouvée
 */
export function patchFrontmatterField(
  content: string,
  key: string,
  newValue: string | number | boolean | null,
): string {
  const match = FRONTMATTER_RE.exec(content);
  if (!match || match[1] === undefined) {
    return content;
  }

  const fmRaw = match[1];
  const lines = fmRaw.split('\n');
  let found = false;
  let keyLineIndex = -1;

  // Trouver la ligne de la clé
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const lineKey = line.slice(0, colonIdx).trim();
    if (lineKey === key) {
      keyLineIndex = i;
      found = true;
      break;
    }
  }

  if (!found || keyLineIndex === -1) {
    return content;
  }

  // Construire la nouvelle ligne
  const formattedValue = formatYamlValue(newValue);
  lines[keyLineIndex] = `${key}: ${formattedValue}`;

  // Reconstruire le frontmatter
  const newFm = lines.join('\n');
  const before = content.slice(0, match.index!);
  const fmDelimStart = content.slice(match.index!, match.index! + match[0].indexOf(fmRaw));
  const fmDelimEnd = content.slice(match.index! + match[0].indexOf(fmRaw) + fmRaw.length, match.index! + match[0].length);

  return before + fmDelimStart + newFm + fmDelimEnd + content.slice(match.index! + match[0].length);
}

/**
 * Formate une valeur pour l'insertion dans le YAML.
 */
function formatYamlValue(value: string | number | boolean | null): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);

  // Les strings contenant des caractères spéciaux YAML sont quotées
  if (/[:#\[\]{}&*!|>'"%@`]/.test(value) || value.includes('\n')) {
    // Escape les guillemets doubles internes
    return `"${value.replace(/"/g, '\\"')}"`;
  }

  return value;
}

// ============================================================
// Utilitaires
// ============================================================

/**
 * Extrait un champ email du frontmatter (champ `email` ou `alias_email` liste).
 *
 * @returns Tableau de tous les emails trouvés (principal + alias)
 */
export function extractEmails(parsed: ObsidianFile): string[] {
  if (!parsed.frontmatter) return [];

  const emails: string[] = [];

  // Champ email principal
  const email = parsed.frontmatter.fields['email'];
  if (typeof email === 'string' && email.includes('@')) {
    emails.push(email.toLowerCase().trim());
  }

  // Liste alias_email
  const aliases = parsed.frontmatter.lists['alias_email'];
  if (aliases) {
    for (const alias of aliases) {
      if (alias.includes('@')) {
        emails.push(alias.toLowerCase().trim());
      }
    }
  }

  return emails;
}

/**
 * Vérifie si le contenu re-sérialisé est bit-identique à l'original.
 * Utile pour les tests.
 */
export function isBitIdentical(original: string, modified: string): boolean {
  return original === modified;
}
