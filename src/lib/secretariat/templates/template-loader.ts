/**
 * Loader de structure de template Contact depuis le vault Drive.
 *
 * Source de vérité (templates) :
 *  - `Templates/Contact pro.md`         — type='pro'
 *  - `Templates/Contact relationnel.md` — type='famille'|'amis'|'autres'
 *
 * Règle R1 (vault = SOT) + Règle R7 (source live remplace hardcoded) :
 * la STRUCTURE (ordre des clés frontmatter + ordre des sections H2) est lue
 * au runtime depuis Drive. Le renderer (`fiche-renderer.ts`) GARDE la logique
 * de VALEUR par clé/section. Une clé ou un titre inconnu du renderer est
 * émis vide (jamais de placeholder, jamais d'invention — Cmd #2).
 *
 * Robustesse : Drive down, fichier introuvable, parse vide → fallback hardcodé
 * (= structure de référence au moment de l'écriture). Pas de throw : la
 * création de fiche n'est JAMAIS bloquée par un loader template.
 *
 * Cache module-level : 1h, alignée sur le cache drive-resolver.
 *
 * S25 (2026-05-29) : création initiale (P1 #3).
 */

import { resolvePath } from '../vault-client/drive-resolver';
import { readFileById } from '../vault-client/obsidian-file';
import { getAccessToken } from '../drive-upload';

// ============================================================
// Types publics
// ============================================================

export type TemplateName = 'Contact pro' | 'Contact relationnel';

export interface TemplateStructure {
  /** Clés top-level du frontmatter YAML, dans l'ordre du template. */
  frontmatterKeys: string[];
  /** Titres des sections `## ...`, dans l'ordre du template. */
  sections: string[];
  /** Indique si la structure provient du Drive (live) ou du fallback hardcodé. */
  source: 'drive' | 'fallback';
}

// ============================================================
// Constantes
// ============================================================

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure

/**
 * Fallback hardcodé — STRICTEMENT identique à l'ordre du hardcode historique
 * de `fiche-renderer.ts` (cf. Templates/Contact pro.md v3 et
 * Templates/Contact relationnel.md). Modifier seulement si le template vault
 * est lui-même modifié de façon irréversible (sinon laisser le loader live
 * faire son job).
 */
const FALLBACK: Record<TemplateName, { frontmatterKeys: string[]; sections: string[] }> = {
  'Contact pro': {
    frontmatterKeys: [
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
    ],
    sections: [
      "Qui c'est",
      'Statut courant',
      'Projets liés',
      'Notes',
      'Tonalité de communication',
      'Historique',
    ],
  },
  'Contact relationnel': {
    frontmatterKeys: [
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
    ],
    sections: [
      "Qui c'est",
      'Famille / Liens',
      'Notes',
      'Tonalité de communication',
      'Historique',
    ],
  },
};

// ============================================================
// Cache module-level
// ============================================================

interface CacheEntry {
  value: TemplateStructure;
  expiresAt: number;
}

const cache = new Map<TemplateName, CacheEntry>();

/** Vide le cache (réservé aux tests). */
export function _clearTemplateCache(): void {
  cache.clear();
}

// ============================================================
// API publique
// ============================================================

/**
 * Charge la structure d'un template Contact depuis le vault Drive.
 *
 * - Hit cache valide → retour direct.
 * - Sinon : resolvePath + readFileById + parse, cache et retour `source:'drive'`.
 * - Erreur (Drive down, fichier introuvable, parse vide) → console.warn +
 *   fallback hardcodé `source:'fallback'`. Ne throw JAMAIS.
 */
export async function loadTemplate(name: TemplateName): Promise<TemplateStructure> {
  const cached = cache.get(name);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const live = await tryLoadFromDrive(name);
  if (live) {
    cache.set(name, { value: live, expiresAt: Date.now() + CACHE_TTL_MS });
    return live;
  }

  // Fallback — pas de cache (on retentera Drive au prochain appel après TTL
  // si jamais on cachait, on resterait coincés en fallback 1h). On garde
  // cohérence : cache uniquement les structures live.
  const fb = FALLBACK[name];
  return {
    frontmatterKeys: [...fb.frontmatterKeys],
    sections: [...fb.sections],
    source: 'fallback',
  };
}

// ============================================================
// Internals — chargement Drive
// ============================================================

async function tryLoadFromDrive(name: TemplateName): Promise<TemplateStructure | null> {
  try {
    const logicalPath = `Templates/${name}.md`;
    const resolved = await resolvePath(logicalPath, true);
    if (!resolved.success || !resolved.fileId) {
      console.warn(
        `[template-loader] resolve ${logicalPath} échec : ${resolved.error ?? 'unknown'} — fallback hardcodé`,
      );
      return null;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      console.warn(
        `[template-loader] getAccessToken null pour ${logicalPath} — fallback hardcodé`,
      );
      return null;
    }

    const file = await readFileById(accessToken, resolved.fileId);
    if (!file.success || !file.content) {
      console.warn(
        `[template-loader] read ${logicalPath} échec : ${file.error ?? 'unknown'} — fallback hardcodé`,
      );
      return null;
    }

    const parsed = parseTemplateStructure(file.content);
    if (parsed.frontmatterKeys.length === 0 && parsed.sections.length === 0) {
      console.warn(
        `[template-loader] parse ${logicalPath} vide (ni clés ni sections) — fallback hardcodé`,
      );
      return null;
    }

    return { ...parsed, source: 'drive' };
  } catch (err) {
    console.warn(
      `[template-loader] exception charge ${name} : ${err instanceof Error ? err.message : String(err)} — fallback hardcodé`,
    );
    return null;
  }
}

// ============================================================
// Internals — parsing
// ============================================================

/**
 * Parse un template markdown :
 *  - frontmatter YAML entre les deux premiers `---` : clés top-level dans
 *    l'ordre, lignes `clef:` au niveau 0 (col 0, suivies de `:`). Les
 *    sous-items YAML (indentés, `  - x`) sont ignorés.
 *  - sections `## Titre` AVANT le premier `<!--` (le template contient un gros
 *    bloc de commentaire d'instructions en bas — il ne doit pas être parsé).
 */
export function parseTemplateStructure(raw: string): {
  frontmatterKeys: string[];
  sections: string[];
} {
  const frontmatterKeys = parseFrontmatterKeys(raw);
  const sections = parseSections(raw);
  return { frontmatterKeys, sections };
}

function parseFrontmatterKeys(raw: string): string[] {
  const lines = raw.split('\n');
  // Trouver le 1er `---` (au début, en sautant d'éventuelles lignes vides en tête).
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!.trim();
    if (l === '') continue;
    if (l === '---') {
      start = i;
      break;
    }
    // Première ligne non-vide n'est pas `---` → pas de frontmatter.
    return [];
  }
  if (start === -1) return [];

  // Trouver le `---` de fermeture.
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i]!.trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return [];

  const keys: string[] = [];
  for (let i = start + 1; i < end; i++) {
    const line = lines[i]!;
    // Ligne top-level : non-indentée, format `clef:` (avec ou sans valeur derrière).
    // On accepte les caractères français dans la clé (é, è, …) → on prend
    // tout ce qui est avant le PREMIER `:`, en exigeant que la ligne ne
    // commence pas par un espace/tab (top-level) et ne soit pas un sous-item
    // (`- x`) ni un commentaire (`#`).
    if (line.length === 0) continue;
    if (line.startsWith(' ') || line.startsWith('\t')) continue;
    if (line.startsWith('-')) continue;
    if (line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    if (key.length === 0) continue;
    keys.push(key);
  }
  return keys;
}

function parseSections(raw: string): string[] {
  // Coupure au premier `<!--` (bloc d'instructions du template).
  const cutIdx = raw.indexOf('<!--');
  const body = cutIdx >= 0 ? raw.slice(0, cutIdx) : raw;

  const sections: string[] = [];
  const lines = body.split('\n');
  for (const line of lines) {
    // Match `## Titre` strict (deux dièses + espace), pas `###`.
    if (line.startsWith('## ') && !line.startsWith('### ')) {
      const title = line.slice(3).trim();
      if (title.length > 0) sections.push(title);
    }
  }
  return sections;
}
