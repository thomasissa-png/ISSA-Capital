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

/**
 * Mapping domaine email → société (S24, enrichissement fiche contact).
 *
 * Le seed (écosystème ISSA + partenaires factuels) est embarqué EN DUR ci-dessous
 * pour survivre au bundling Next.js (un `.yml` colocalisé n'est pas copié dans
 * `.next/server/chunks/` → ENOENT en prod, bug S24). Un fichier externe optionnel
 * (`ENRICH_DOMAINS_YML_PATH`) est fusionné par-dessus s'il est lisible.
 *
 * Parser minimal volontaire (zéro dépendance) : une paire `clé: valeur` par
 * ligne, commentaires `#` ignorés. Cache mémoire. Ne throw jamais.
 */

import { readFileSync } from 'node:fs';

/**
 * Seed factuel embarqué (miroir de l'ancien domains.yml). Ne contient QUE des
 * correspondances connues ; jamais de domaine générique (gmail, outlook…).
 */
const SEED_DOMAINS: Record<string, string> = {
  'sarani.studio': 'Sarani',
  'versi.fr': 'Versi',
  'immocrew.fr': 'Immocrew',
  'versimo.fr': 'Versimo',
  'issa-capital.com': 'ISSA Capital',
};

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
  const path = (process.env.ENRICH_DOMAINS_YML_PATH ?? '').trim();
  const cached = getCache();
  if (cached && cached.path === path) return cached.map;

  // Seed embarqué (toujours présent, bundler-safe).
  const map = new Map<string, string>(
    Object.entries(SEED_DOMAINS).map(([k, v]) => [k.toLowerCase(), v]),
  );

  // Fichier externe optionnel : fusionné par-dessus le seed.
  if (path) {
    try {
      for (const [k, v] of parseFlatYaml(readFileSync(path, 'utf8'))) {
        map.set(k, v);
      }
    } catch (err) {
      console.warn(
        `[enrich-domains] override ${path} illisible : ${err instanceof Error ? err.message : String(err)} — seed embarqué seul`,
      );
    }
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
