import { clsx, type ClassValue } from 'clsx';

/**
 * Concatène des classes Tailwind de façon conditionnelle.
 * Wrapper simple autour de clsx — pas de tailwind-merge (ajout d'une dépendance injustifié
 * sur un projet de cette taille). Les conflits Tailwind éventuels sont gérés à la main.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
