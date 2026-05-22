/**
 * Skill-loader Anya — chargement vault-driven des prompts de skills (S20 → S21).
 *
 * Source de vérité (R1, S21) : vault Drive `00. Me/08. Outils/Skills/<skillName>/SKILL.md`.
 *   - Frontmatter YAML : `name` (obligatoire) + `description`
 *   - 5 sections H2 : `## 1. Trigger` / `## 2. Input` / `## 3. Étapes` /
 *     `## 4. Output` / `## 5. Méthode`
 *   - Section 5 sous-divisée (H3) : `### 5.1 Red lines`, `### 5.2 Arbre de décision`,
 *     `### 5.3 Critères de qualité`, optionnellement `### 5.4 Exemple complet`.
 *
 * Fallback résilience prod (R7) : `docs/ia/skills/<skillName>/SKILL.md` (repo) si Drive down.
 *
 * Cache mémoire TTL 1h aligné sur `drive-resolver` (`CACHE_TTL_MS`).
 *
 * Intégrité vérifiée à chaque chargement :
 *   - frontmatter présent (avec champ `name`)
 *   - sections H2 obligatoires : 1. Trigger, 2. Input, 3. Étapes, 4. Output
 *   - sections H3 5.1 Red lines et 5.2 Arbre de décision présentes
 *   - 5.4 Exemple complet : optionnel (tous les skills n'ont pas d'exemple)
 *
 * API publique :
 *  - loadSkill(name)                 — récupère le SkillContext (cache → vault → repo)
 *  - invalidateSkillCache(name?)     — flush ciblé ou complet
 *  - checkSkillIntegrity(content)    — diagnostic standalone (utilisé par les tests)
 */

import { readFile as readVaultFile } from '../vault-client/obsidian-file';
import { parseObsidianFile } from '../vault-client/frontmatter';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  SkillContext,
  SkillIntegrityIssue,
} from './types';
import { SkillLoadError } from './types';

// ============================================================
// Constantes
// ============================================================

/** TTL cache mémoire (1h, aligné drive-resolver) */
export const SKILL_CACHE_TTL_MS = 60 * 60 * 1000;

/** Dossier vault contenant les skills (R1 source de vérité — vrai path S21) */
const VAULT_SKILLS_FOLDER = '00. Me/08. Outils/Skills';

/** Dossier repo fallback (committé) — nouveau path S21 aligné sur structure vault */
const REPO_SKILLS_FOLDER = 'docs/ia/skills';

/** Nom de fichier standard d'un skill (un sous-dossier par skill) */
const SKILL_FILENAME = 'SKILL.md';

/** Marqueur vaultPath quand le fallback repo a servi */
export const FALLBACK_REPO_MARKER = 'FALLBACK_REPO';

// ============================================================
// Cache mémoire
// ============================================================

interface CacheEntry {
  context: SkillContext;
  loadedAt: number;
}

const skillCache = new Map<string, CacheEntry>();

/** In-flight promises pour dédupliquer les loads concurrents */
const inflight = new Map<string, Promise<SkillContext>>();

/**
 * Invalide une entrée du cache, ou tout le cache si `skillName` est omis.
 */
export function invalidateSkillCache(skillName?: string): void {
  if (skillName === undefined) {
    skillCache.clear();
    inflight.clear();
    return;
  }
  skillCache.delete(skillName);
  inflight.delete(skillName);
}

// ============================================================
// Extraction de sections markdown
// ============================================================

/**
 * Trouve l'index du prochain header markdown qui matche `headerRe`,
 * en ignorant les occurrences situées dans des code-fences ``` ... ```.
 * Retourne -1 si aucun match.
 */
function findHeaderOutsideFences(text: string, headerRe: RegExp): number {
  const lines = text.split('\n');
  let inFence = false;
  let cursor = 0;
  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence;
    } else if (!inFence && headerRe.test(line)) {
      return cursor;
    }
    cursor += line.length + 1; // +1 pour le \n
  }
  return -1;
}

/**
 * Extrait le contenu d'une section `### X.Y Titre` jusqu'au prochain header
 * de niveau <= 3 (### ou ##) — en ignorant ceux dans les code-fences.
 */
function extractSubSection(content: string, sectionNumber: string): string | null {
  const escaped = sectionNumber.replace(/\./g, '\\.');
  const headerRe = new RegExp(`^### ${escaped}[.\\s]`);
  const headerStart = findHeaderOutsideFences(content, headerRe);
  if (headerStart === -1) return null;

  const newlineAfterHeader = content.indexOf('\n', headerStart);
  if (newlineAfterHeader === -1) return '';
  const bodyStart = newlineAfterHeader + 1;

  const tail = content.slice(bodyStart);
  const nextRel = findHeaderOutsideFences(tail, /^#{2,3} /);
  const sectionBody = nextRel === -1 ? tail : tail.slice(0, nextRel);
  return sectionBody.trim();
}

/**
 * Extrait une section H2 complète (## 4. Output) jusqu'au prochain `## `
 * — en ignorant les `## ` dans les code-fences.
 */
function extractH2Section(content: string, sectionPrefix: string): string | null {
  const escaped = sectionPrefix.replace(/\./g, '\\.');
  const headerRe = new RegExp(`^## ${escaped}[.\\s]`);
  const headerStart = findHeaderOutsideFences(content, headerRe);
  if (headerStart === -1) return null;

  const newlineAfterHeader = content.indexOf('\n', headerStart);
  if (newlineAfterHeader === -1) return '';
  const bodyStart = newlineAfterHeader + 1;

  const tail = content.slice(bodyStart);
  const nextRel = findHeaderOutsideFences(tail, /^## /);
  const sectionBody = nextRel === -1 ? tail : tail.slice(0, nextRel);
  return sectionBody.trim();
}

/**
 * Extrait le gabarit récap Telegram de la section 4 si présent.
 * Format legacy : sous-bloc `### Récap` avec un code-fence triple-backticks.
 * Sur le nouveau format vault SKILL.md, la section 4 contient une description en prose
 * (pas de gabarit explicite) → retourner chaîne vide (champ optionnel).
 */
function extractRecapTemplate(section4Body: string): string | null {
  const recapHeaderRe = /^### Récap[^\n]*$/m;
  const match = recapHeaderRe.exec(section4Body);
  if (!match) return null;

  const startIdx = match.index + match[0].length;
  const tail = section4Body.slice(startIdx);
  const fenceOpen = tail.indexOf('```');
  if (fenceOpen === -1) return null;
  const afterOpen = fenceOpen + 3;
  const firstNl = tail.indexOf('\n', afterOpen);
  if (firstNl === -1) return null;
  const fenceClose = tail.indexOf('```', firstNl + 1);
  if (fenceClose === -1) return null;
  return tail.slice(firstNl + 1, fenceClose).trim();
}

// ============================================================
// Check intégrité (format SKILL.md S21)
// ============================================================

/**
 * Vérifie qu'un skill markdown respecte le format SKILL.md S21 :
 *  - frontmatter YAML présent (avec champ `name` ou `skill` legacy)
 *  - sections H2 : `## 1. Trigger`, `## 2. Input`, `## 3. Étapes`, `## 4. Output`
 *  - sections H3 : `### 5.1 Red lines`, `### 5.2 Arbre de décision`
 *  - 5.4 Exemple complet : optionnel (warn si absent, jamais bloquant)
 *
 * Retourne la liste des issues (vide si tout est OK).
 */
export async function checkSkillIntegrity(
  content: string,
): Promise<SkillIntegrityIssue[]> {
  const issues: SkillIntegrityIssue[] = [];

  // 1) Frontmatter
  let parsed: ReturnType<typeof parseObsidianFile>;
  try {
    parsed = parseObsidianFile(content);
  } catch (err) {
    issues.push({
      level: 'error',
      reason: 'parse_error',
      details: `Frontmatter YAML invalide : ${(err as Error).message}`,
    });
    return issues;
  }

  if (!parsed.frontmatter) {
    issues.push({
      level: 'error',
      reason: 'missing_frontmatter',
      details: 'Aucun bloc YAML frontmatter (--- ... ---) trouvé en tête de fichier',
    });
  }

  // 2) Sections H2 obligatoires (nouveau format SKILL.md S21)
  const requiredH2: Array<{ num: string; label: string }> = [
    { num: '1', label: 'Trigger' },
    { num: '2', label: 'Input' },
    { num: '3', label: 'Étapes' },
    { num: '4', label: 'Output' },
  ];

  for (const { num, label } of requiredH2) {
    if (extractH2Section(content, num) === null) {
      issues.push({
        level: 'error',
        reason: 'missing_section',
        details: `Section "## ${num}. ${label}" manquante`,
      });
    }
  }

  // 3) Sections H3 obligatoires dans la section 5 (red lines + arbre décision)
  const requiredH3: Array<{ num: string; label: string }> = [
    { num: '5.1', label: 'Red lines' },
    { num: '5.2', label: 'Arbre de décision' },
  ];

  for (const { num, label } of requiredH3) {
    if (extractSubSection(content, num) === null) {
      issues.push({
        level: 'error',
        reason: 'missing_section',
        details: `Section "### ${num} ${label}" manquante`,
      });
    }
  }

  // 4) [À CONFIRMER] dans une section injectée → warn
  const section4 = extractH2Section(content, '4');
  const injectedConcat = [
    extractSubSection(content, '5.1') ?? '',
    extractSubSection(content, '5.2') ?? '',
    extractSubSection(content, '5.4') ?? '',
    section4 ?? '',
  ].join('\n');

  if (injectedConcat.includes('[À CONFIRMER]')) {
    issues.push({
      level: 'warn',
      reason: 'pending_confirmation',
      details: 'Une section injectée contient encore un marqueur [À CONFIRMER]',
    });
  }

  return issues;
}

// ============================================================
// Lecture vault ou fallback repo (format SKILL.md S21)
// ============================================================

/**
 * Lit le SKILL.md d'un skill depuis le vault Drive (R1).
 * Path : `00. Me/08. Outils/Skills/<skillName>/SKILL.md`.
 * Retourne null si échec (Drive down, dossier manquant, etc.).
 */
async function readSkillFromVault(skillName: string): Promise<string | null> {
  try {
    const folder = `${VAULT_SKILLS_FOLDER}/${skillName}`;
    const result = await readVaultFile(folder, SKILL_FILENAME);
    if (!result.success || !result.content) return null;
    return result.content;
  } catch {
    return null;
  }
}

/**
 * Fallback résilience prod (R7) : lit le skill depuis le repo
 * (`docs/ia/skills/<skillName>/SKILL.md`).
 * Retourne null si le fichier n'existe pas.
 *
 * Note : ce fallback existe pour le cas où Drive serait inaccessible.
 * Il NE remplace PAS la source de vérité vault — il dépanne uniquement.
 */
function readSkillFromRepo(skillName: string): string | null {
  try {
    const filePath = join(
      process.cwd(),
      REPO_SKILLS_FOLDER,
      skillName,
      SKILL_FILENAME,
    );
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ============================================================
// Build SkillContext
// ============================================================

function buildContext(
  skillName: string,
  content: string,
  vaultPath: string,
): SkillContext {
  const parsed = parseObsidianFile(content);
  const fields = parsed.frontmatter?.fields ?? {};
  const lists = parsed.frontmatter?.lists ?? {};
  const frontmatter: Record<string, unknown> = { ...fields, ...lists };

  const redLines = extractSubSection(content, '5.1') ?? '';
  const decisionTree = extractSubSection(content, '5.2') ?? '';
  const example = extractSubSection(content, '5.4') ?? '';
  const section4 = extractH2Section(content, '4') ?? '';
  const recapTemplate = extractRecapTemplate(section4) ?? '';

  return {
    name: skillName,
    vaultPath,
    loadedAt: new Date(),
    frontmatter,
    redLines,
    decisionTree,
    example,
    recapTemplate,
  };
}

// ============================================================
// API principale : loadSkill
// ============================================================

/**
 * Charge un skill (cache → vault → fallback repo).
 *
 * @param skillName Nom court du skill = nom du dossier vault (ex: "cr-reunion", "fin-de-bail").
 * @throws SkillLoadError si vault ET fallback échouent, ou si intégrité KO.
 */
export async function loadSkill(skillName: string): Promise<SkillContext> {
  // 1) Cache mémoire
  const cached = skillCache.get(skillName);
  if (cached && Date.now() - cached.loadedAt < SKILL_CACHE_TTL_MS) {
    return cached.context;
  }

  // 2) Dédup loads concurrents
  const pending = inflight.get(skillName);
  if (pending) return pending;

  const promise = (async () => {
    try {
      // 3) Lecture vault (source de vérité R1)
      let content = await readSkillFromVault(skillName);
      let vaultPath = `${VAULT_SKILLS_FOLDER}/${skillName}/${SKILL_FILENAME}`;

      // 4) Fallback repo si vault down (R7 — résilience prod, jamais SOT)
      if (content === null) {
        content = readSkillFromRepo(skillName);
        vaultPath = FALLBACK_REPO_MARKER;
      }

      if (content === null) {
        throw new SkillLoadError(
          skillName,
          `Skill introuvable (ni vault "${VAULT_SKILLS_FOLDER}/${skillName}", ni repo "${REPO_SKILLS_FOLDER}/${skillName}")`,
        );
      }

      // 5) Check intégrité
      const issues = await checkSkillIntegrity(content);
      const errors = issues.filter((i) => i.level === 'error');
      const warns = issues.filter((i) => i.level === 'warn');

      if (errors.length > 0) {
        throw new SkillLoadError(
          skillName,
          `Intégrité KO : ${errors.map((e) => e.reason).join(', ')}`,
          issues,
        );
      }

      if (warns.length > 0) {
        for (const w of warns) {
          console.warn(`[skill-loader] ${skillName} — ${w.reason}: ${w.details}`);
        }
      }

      // 6) Build + cache
      const context = buildContext(skillName, content, vaultPath);
      skillCache.set(skillName, { context, loadedAt: Date.now() });
      return context;
    } finally {
      inflight.delete(skillName);
    }
  })();

  inflight.set(skillName, promise);
  return promise;
}
