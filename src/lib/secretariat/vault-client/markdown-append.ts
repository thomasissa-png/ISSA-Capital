/**
 * Append à une section H2 d'un fichier Markdown Obsidian.
 *
 * Contrainte critique : insérer une nouvelle sous-section (H3 datée)
 * en ordre chrono inverse (la plus récente en premier, juste après le H2).
 * Ne JAMAIS toucher le frontmatter ni les autres sections du fichier.
 *
 * Exemple :
 *   ## Historique
 *   ### 2026-05-13 — Demande quittance mai    ← NOUVELLE ENTRÉE (insérée ici)
 *   Résumé de l'email...
 *
 *   ### 2026-05-06 — Confirmation virement     ← Entrée existante
 *   Contenu existant...
 */

// ============================================================
// Types
// ============================================================

export interface AppendSection {
  /** Titre H3 de la sous-section (ex: "2026-05-13 — Demande quittance mai") */
  title: string;
  /** Contenu textuel de la sous-section (Markdown, sans le H3) */
  content: string;
}

// ============================================================
// Implémentation
// ============================================================

/**
 * Insère une nouvelle sous-section H3 dans une section H2 existante.
 *
 * Comportement :
 * 1. Si la section H2 existe → insère la nouvelle sous-section H3
 *    juste après le titre H2 (avant les H3 existantes = chrono inverse)
 * 2. Si la section H2 n'existe pas → l'ajoute à la fin du fichier
 *    avec la nouvelle sous-section H3
 * 3. Ne touche pas au frontmatter ni aux autres sections H2
 *
 * @param content Contenu complet du fichier .md
 * @param h2Title Titre exact de la section H2 (ex: "Historique")
 * @param section Sous-section H3 à insérer
 * @returns Contenu modifié
 */
export function appendToSection(
  content: string,
  h2Title: string,
  section: AppendSection,
): string {
  // Construire le bloc à insérer
  const newBlock = `### ${section.title}\n${section.content}\n`;

  // Chercher la section H2
  const h2Pattern = new RegExp(`^## ${escapeRegex(h2Title)}\\s*$`, 'm');
  const h2Match = h2Pattern.exec(content);

  if (!h2Match) {
    // Section H2 absente → ajouter à la fin du fichier
    const trimmed = content.trimEnd();
    return `${trimmed}\n\n## ${h2Title}\n\n${newBlock}`;
  }

  // Section H2 trouvée → insérer après le titre H2
  const insertPos = h2Match.index + h2Match[0].length;
  const before = content.slice(0, insertPos);
  const after = content.slice(insertPos);

  // Vérifier ce qui suit le H2
  // On insère avec un double saut de ligne après le H2 et avant le contenu existant
  if (after.startsWith('\n\n')) {
    // Déjà un double saut → insérer le bloc entre
    return `${before}\n\n${newBlock}${after.slice(1)}`;
  } else if (after.startsWith('\n')) {
    // Simple saut → ajouter le bloc
    return `${before}\n\n${newBlock}${after}`;
  } else {
    // Pas de saut → ajouter les sauts nécessaires
    return `${before}\n\n${newBlock}\n${after}`;
  }
}

/**
 * Vérifie si une section H2 existe dans le contenu.
 */
export function hasSection(content: string, h2Title: string): boolean {
  const h2Pattern = new RegExp(`^## ${escapeRegex(h2Title)}\\s*$`, 'm');
  return h2Pattern.test(content);
}

/**
 * Extrait le contenu d'une section H2 (tout entre ce H2 et le prochain H2 ou la fin).
 *
 * @returns Le contenu de la section (sans le titre H2), ou null si absent
 */
export function extractSection(
  content: string,
  h2Title: string,
): string | null {
  const h2Pattern = new RegExp(`^## ${escapeRegex(h2Title)}\\s*$`, 'm');
  const h2Match = h2Pattern.exec(content);

  if (!h2Match) return null;

  const startAfterH2 = h2Match.index + h2Match[0].length;
  const rest = content.slice(startAfterH2);

  // Trouver le prochain H2 (ou la fin du fichier)
  const nextH2Match = /^## /m.exec(rest);
  const sectionContent = nextH2Match
    ? rest.slice(0, nextH2Match.index)
    : rest;

  return sectionContent;
}

// ============================================================
// Utilitaires
// ============================================================

/**
 * Échappe les caractères spéciaux regex dans une chaîne.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
