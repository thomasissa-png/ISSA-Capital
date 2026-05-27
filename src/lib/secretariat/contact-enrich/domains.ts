/**
 * Mapping domaine email → société (S24, enrichissement fiche contact).
 *
 * Lit un fichier YAML plat (`domaine: "Société"`). Chemin par défaut :
 * `domains.yml` colocalisé ; surchargé par `ENRICH_DOMAINS_YML_PATH`.
 *
 * Parser minimal volontaire (zéro dépendance) : une paire `clé: valeur` par
 * ligne, commentaires `#` ignorés. Cache mémoire par chemin (le fichier est
 * stable au runtime). Ne throw jamais : fichier absent/illisible → map vide.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_YML_PATH = join(__dirname, 'domains.yml');

interface CachedMap {
  path: string;
  map: Map<string, string>;
}

const CACHE_KEY = '__issa_enrich_domains_cache__' as const;

function getCache(): CachedMap | null {
  return (globalThis as Record<string, unknown>)[CACHE_KEY] as CachedMap | null;
}
function setCache(c: CachedMap): void {
  (globalThis as Record<string, unknown>)[CACHE_KEY] = c;
}

/** Parse un YAML plat `clé: valeur` (valeur éventuellement entre guillemets). */
export function parseFlatYaml(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim().toLowerCase();
    let value = trimmed.slice(colon + 1).trim();
    // Retire un commentaire en fin de ligne (hors guillemets) puis les guillemets.
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hash = value.indexOf(' #');
      if (hash !== -1) value = value.slice(0, hash).trim();
    }
    value = value.replace(/^["']|["']$/g, '').trim();
    if (key && value) map.set(key, value);
  }
  return map;
}

function loadMap(): Map<string, string> {
  const path = (process.env.ENRICH_DOMAINS_YML_PATH ?? '').trim() || DEFAULT_YML_PATH;
  const cached = getCache();
  if (cached && cached.path === path) return cached.map;

  let map = new Map<string, string>();
  try {
    map = parseFlatYaml(readFileSync(path, 'utf8'));
  } catch (err) {
    console.warn(
      `[enrich-domains] lecture ${path} échouée : ${err instanceof Error ? err.message : String(err)} — map vide`,
    );
  }
  setCache({ path, map });
  return map;
}

/** Extrait le domaine (après @, minuscule) d'une adresse email. */
export function domainOf(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

/**
 * Retourne la société associée au domaine de l'email, ou null si inconnue.
 * Domaines génériques (gmail, outlook, etc.) → toujours null (pas de devinette).
 */
export function lookupSocieteByEmail(email: string): string | null {
  const domain = domainOf(email);
  if (!domain) return null;
  return loadMap().get(domain) ?? null;
}

/** Réinitialise le cache (tests). */
export function _clearDomainsCache(): void {
  delete (globalThis as Record<string, unknown>)[CACHE_KEY];
}
