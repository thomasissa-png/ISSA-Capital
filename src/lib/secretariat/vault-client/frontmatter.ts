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
 * Comme patchFrontmatterField, mais AJOUTE la clé si elle est absente
 * (insérée en dernière ligne du bloc frontmatter). Si aucun frontmatter
 * n'existe, le contenu est renvoyé inchangé (on ne fabrique pas de bloc).
 *
 * Sert aux champs dérivés auto (canal_préféré, fréquence_échanges — S24) qui
 * n'existent pas encore sur la plupart des fiches.
 */
export function upsertFrontmatterField(
  content: string,
  key: string,
  newValue: string | number | boolean | null,
): string {
  const match = FRONTMATTER_RE.exec(content);
  if (!match || match[1] === undefined) {
    return content;
  }

  const fmRaw = match[1];
  const hasKey = fmRaw
    .split('\n')
    .some((line) => {
      const colonIdx = line.indexOf(':');
      return colonIdx !== -1 && line.slice(0, colonIdx).trim() === key;
    });

  if (hasKey) {
    return patchFrontmatterField(content, key, newValue);
  }

  // Insérer la nouvelle clé en fin de bloc frontmatter.
  const newLine = `${key}: ${formatYamlValue(newValue)}`;
  const newFm = fmRaw.length > 0 ? `${fmRaw}\n${newLine}` : newLine;
  const before = content.slice(0, match.index!);
  const fmDelimStart = content.slice(match.index!, match.index! + match[0].indexOf(fmRaw));
  const fmDelimEnd = content.slice(
    match.index! + match[0].indexOf(fmRaw) + fmRaw.length,
    match.index! + match[0].length,
  );
  return before + fmDelimStart + newFm + fmDelimEnd + content.slice(match.index! + match[0].length);
}

/**
 * Ajoute une entrée à une LISTE YAML du frontmatter (pattern `clé:\n  - val\n`).
 * Si la liste n'existe pas, on la crée juste après une clé scalaire « ancre »
 * (par défaut le champ ciblé sans valeur — ex `alias_email:` vide, ou après
 * `email:` pour alias_email). Si la valeur est déjà dans la liste (match
 * insensible casse), on no-op. Idempotent.
 *
 * S24 nuit — utilisé par le bouton « 🔗 Lier à <contact> » pour ajouter un
 * email/téléphone secondaire à une fiche existante au même nom.
 *
 * @param content Contenu Markdown complet (frontmatter + body).
 * @param listKey Clé de la liste (ex `alias_email`).
 * @param newValue Valeur à ajouter (ex `maxime@versi.fr`).
 * @param anchorKey Clé après laquelle insérer la liste si elle n'existe pas
 *                  (ex `email`). Doit exister dans le frontmatter.
 * @returns Contenu modifié, ou le contenu inchangé si frontmatter absent.
 */
export function addToFrontmatterList(
  content: string,
  listKey: string,
  newValue: string,
  anchorKey: string,
): string {
  const match = FRONTMATTER_RE.exec(content);
  if (!match || match[1] === undefined) return content;

  const fmRaw = match[1];
  const lines = fmRaw.split('\n');
  const normalizedNew = newValue.trim().toLowerCase();

  // Localiser la clé liste (`listKey:`) et collecter ses entrées contiguës.
  let listKeyIdx = -1;
  let lastListEntryIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]!;
    const colonIdx = ln.indexOf(':');
    if (colonIdx !== -1 && ln.slice(0, colonIdx).trim() === listKey) {
      listKeyIdx = i;
      // Parcourir les entrées suivantes en `  - val`.
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j]!)) {
        const entryVal = lines[j]!.replace(/^\s+-\s+/, '').trim().toLowerCase();
        if (entryVal === normalizedNew) return content; // déjà présent : no-op
        lastListEntryIdx = j;
        j++;
      }
      break;
    }
  }

  if (listKeyIdx === -1) {
    // Pas de clé liste → on la crée après l'anchor.
    let anchorIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i]!;
      const colonIdx = ln.indexOf(':');
      if (colonIdx !== -1 && ln.slice(0, colonIdx).trim() === anchorKey) {
        anchorIdx = i;
        break;
      }
    }
    if (anchorIdx === -1) return content; // pas d'anchor → on ne crée pas
    const insert = [`${listKey}:`, `  - ${newValue}`];
    const newLines = [...lines.slice(0, anchorIdx + 1), ...insert, ...lines.slice(anchorIdx + 1)];
    return rebuildContentWithFrontmatter(content, match, newLines.join('\n'));
  }

  // Liste existante : append une entrée après la dernière (ou après la clé si vide).
  const insertAfter = lastListEntryIdx === -1 ? listKeyIdx : lastListEntryIdx;
  const newLines = [
    ...lines.slice(0, insertAfter + 1),
    `  - ${newValue}`,
    ...lines.slice(insertAfter + 1),
  ];
  return rebuildContentWithFrontmatter(content, match, newLines.join('\n'));
}

/** Reconstruit le content complet avec un nouveau bloc frontmatter texte. */
function rebuildContentWithFrontmatter(
  original: string,
  match: RegExpExecArray,
  newFm: string,
): string {
  const fmRaw = match[1]!;
  const before = original.slice(0, match.index);
  const fmDelimStart = original.slice(match.index, match.index + match[0].indexOf(fmRaw));
  const fmDelimEnd = original.slice(
    match.index + match[0].indexOf(fmRaw) + fmRaw.length,
    match.index + match[0].length,
  );
  return before + fmDelimStart + newFm + fmDelimEnd + original.slice(match.index + match[0].length);
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
 * Regex pour détecter "Emails secondaires: a@x, b@y" dans ## Notes.
 * Spec: docs/ia/Anya - Reponse questionnaire vault-paths.md §D2.
 */
const SECONDARY_EMAILS_RE = /[Ee]mails?\s+secondaires?\s*:\s*(.+)/;

/**
 * Extrait tous les emails d'une fiche Obsidian :
 * 1. Champ `email` du frontmatter (primaire)
 * 2. Liste `alias_email` du frontmatter
 * 3. Ligne "Emails secondaires: a@x, b@y" dans la section ## Notes du body
 *
 * Tous normalisés en lowercase, dédupliqués.
 *
 * @returns Tableau de tous les emails trouvés (principal + alias + secondaires Notes)
 */
export function extractEmails(parsed: ObsidianFile): string[] {
  const emailSet = new Set<string>();

  if (parsed.frontmatter) {
    // Champ email principal
    const email = parsed.frontmatter.fields['email'];
    if (typeof email === 'string' && email.includes('@')) {
      emailSet.add(email.toLowerCase().trim());
    }

    // Liste alias_email
    const aliases = parsed.frontmatter.lists['alias_email'];
    if (aliases) {
      for (const alias of aliases) {
        if (alias.includes('@')) {
          emailSet.add(alias.toLowerCase().trim());
        }
      }
    }
  }

  // Emails secondaires dans le body (section ## Notes)
  // Format texte libre : "Emails secondaires: a@x, b@y"
  const secondaryMatch = SECONDARY_EMAILS_RE.exec(parsed.body);
  if (secondaryMatch && secondaryMatch[1]) {
    const rawEmails = secondaryMatch[1].split(',');
    for (const raw of rawEmails) {
      // Extraire l'adresse email brute (ignorer les annotations entre parenthèses)
      const emailOnly = raw.replace(/\([^)]*\)/g, '').trim().toLowerCase();
      if (emailOnly.includes('@')) {
        emailSet.add(emailOnly);
      }
    }
  }

  return [...emailSet];
}

/**
 * Vérifie si le contenu re-sérialisé est bit-identique à l'original.
 * Utile pour les tests.
 */
export function isBitIdentical(original: string, modified: string): boolean {
  return original === modified;
}
