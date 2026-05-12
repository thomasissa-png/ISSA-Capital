/**
 * Chargement de la signature PNG pour les quittances.
 *
 * La signature est stockée dans second-cerveau/signature-thomas-issa.png (11 Ko).
 * Au runtime, on la charge et on la convertit en base64 pour l'insérer dans le PDF.
 *
 * Chemin de résolution :
 * 1. Variable d'env SIGNATURE_PNG_PATH (override explicite)
 * 2. second-cerveau/signature-thomas-issa.png (chemin relatif au projet)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Cache en mémoire — la signature ne change pas entre les requêtes */
let cachedSignature: Buffer | null = null;
let cacheLoaded = false;

/**
 * Résout le chemin vers le fichier signature PNG.
 */
function resolveSignaturePath(): string {
  // 1. Override par env var (comme dans pdf-generator.ts pour le CR)
  if (process.env.SIGNATURE_PNG_PATH) {
    return process.env.SIGNATURE_PNG_PATH;
  }

  // 2. Chemin relatif au CWD (racine du projet)
  return resolve(process.cwd(), 'second-cerveau', 'signature-thomas-issa.png');
}

/**
 * Charge la signature PNG et retourne un Buffer.
 *
 * @returns Buffer PNG ou null si le fichier n'existe pas
 */
export function chargerSignature(): Buffer | null {
  if (cacheLoaded) return cachedSignature;

  const signaturePath = resolveSignaturePath();
  try {
    if (existsSync(signaturePath)) {
      cachedSignature = readFileSync(signaturePath);
    } else {
      console.warn(`[quittance] signature non trouvée : ${signaturePath}`);
      cachedSignature = null;
    }
  } catch (err) {
    console.error(
      `[quittance] erreur chargement signature : ${err instanceof Error ? err.message : err}`,
    );
    cachedSignature = null;
  }

  cacheLoaded = true;
  return cachedSignature;
}

/**
 * Retourne la signature en base64 pour insertion dans le PDF.
 *
 * @returns Base64 string ou null si signature indisponible
 */
export function chargerSignatureBase64(): string | null {
  const buffer = chargerSignature();
  if (!buffer) return null;
  return buffer.toString('base64');
}

/**
 * Réinitialise le cache signature (utile pour les tests).
 */
export function resetSignatureCache(): void {
  cachedSignature = null;
  cacheLoaded = false;
}
