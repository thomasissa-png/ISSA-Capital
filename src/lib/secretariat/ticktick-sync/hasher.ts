/**
 * Hasher — SHA-1 stable d'une ligne markdown.
 *
 * Utilisé pour détecter les modifications de tâches entre 2 runs :
 *   - même ligne brute = même hash = no-op
 *   - hash différent = MODIFIED → PATCH TickTick
 *
 * On hash la ligne RAW (trim seulement) pour éviter les faux positifs
 * causés par la normalisation. Caractères UTF-8 préservés bit-perfect.
 */

import { createHash } from 'node:crypto';

/**
 * Calcule le SHA-1 hex d'une ligne markdown.
 * Trim seulement les espaces de fin (préserve indentation).
 */
export function hashLine(line: string): string {
  // Trim end seulement : préserve l'indentation `- [ ]` mais évite \r\n vs \n
  const normalized = line.replace(/\s+$/u, '');
  return createHash('sha1').update(normalized, 'utf8').digest('hex');
}
