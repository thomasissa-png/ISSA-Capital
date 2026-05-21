/**
 * Skill-loader Anya — chargement vault-driven des prompts de skills (S20).
 *
 * Source de vérité : vault Drive `08. Outils/Anya/Skills/Workflow {Name}.md` (R1).
 * Fallback : `docs/anya/skills-anya/Workflow {Name}.md` (repo) si Drive down.
 *
 * Cache mémoire TTL 1h aligné sur `drive-resolver` (`CACHE_TTL_MS`).
 * Intégrité vérifiée à chaque chargement : frontmatter + 4 sections cibles présentes.
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

/** Dossier vault contenant les skills (R1 source de vérité) */
const VAULT_SKILLS_FOLDER = '08. Outils/Anya/Skills';

/** Dossier repo fallback (committé) */
const REPO_SKILLS_FOLDER = 'docs/anya/skills-anya';

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

/** In-flight promises pour dédupliquer les loads concurrents (test 14) */
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
 * de niveau ≤ 3 (### ou ##) — en ignorant ceux dans les code-fences.
 */
function extractSubSection(content: string, sectionNumber: string): string | null {
  const escaped = sectionNumber.replace(/\./g, '\\.');
  const headerRe = new RegExp(`^### ${escaped}[.\\s]`);
  const headerStart = findHeaderOutsideFences(content, headerRe);
  if (headerStart === -1) return null;

  // Skip la ligne d'en-tête elle-même
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
 * Extrait le gabarit récap Telegram de la section 4.
 * Il est dans un sous-bloc `### Récap` contenant un code-fence triple-backticks.
 */
function extractRecapTemplate(section4Body: string): string | null {
  const recapHeaderRe = /^### Récap[^\n]*$/m;
  const match = recapHeaderRe.exec(section4Body);
  if (!match) return null;

  const startIdx = match.index + match[0].length;
  const tail = section4Body.slice(startIdx);
  // Cherche le code-fence ```
  const fenceOpen = tail.indexOf('```');
  if (fenceOpen === -1) return null;
  const afterOpen = fenceOpen + 3;
  // Skip language tag éventuel jusqu'au \n
  const firstNl = tail.indexOf('\n', afterOpen);
  if (firstNl === -1) return null;
  const fenceClose = tail.indexOf('```', firstNl + 1);
  if (fenceClose === -1) return null;
  return tail.slice(firstNl + 1, fenceClose).trim();
}

// ============================================================
// Check intégrité
// ============================================================

/**
 * Vérifie qu'un skill markdown contient le frontmatter et les sections cibles.
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

  // 2) Sections cibles (5.1, 5.2, 5.4, et ## 4. Output)
  const requiredSubs: Array<{ num: string; label: string }> = [
    { num: '5.1', label: 'Red lines' },
    { num: '5.2', label: 'Arbre de décision' },
    { num: '5.4', label: 'Exemple complet' },
  ];

  for (const { num, label } of requiredSubs) {
    if (extractSubSection(content, num) === null) {
      issues.push({
        level: 'error',
        reason: 'missing_section',
        details: `Section "### ${num} ${label}" manquante`,
      });
    }
  }

  const section4 = extractH2Section(content, '4');
  if (section4 === null) {
    issues.push({
      level: 'error',
      reason: 'missing_section',
      details: 'Section "## 4. Output" manquante',
    });
  }

  // 3) [À CONFIRMER] dans une section injectée → warn
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
// Lecture vault ou fallback repo
// ============================================================

/**
 * Lit le markdown d'un skill depuis le vault Drive (R1).
 * Retourne null si échec (Drive down, fichier manquant, etc.).
 */
async function readSkillFromVault(skillName: string): Promise<string | null> {
  try {
    const result = await readVaultFile(
      VAULT_SKILLS_FOLDER,
      `Workflow ${skillName}.md`,
    );
    if (!result.success || !result.content) return null;
    return result.content;
  } catch {
    return null;
  }
}

/**
 * Fallback : lit le skill depuis le repo (committé dans docs/anya/skills-anya/).
 * Retourne null si le fichier n'existe pas.
 */
function readSkillFromRepo(skillName: string): string | null {
  try {
    const filePath = join(
      process.cwd(),
      REPO_SKILLS_FOLDER,
      `Workflow ${skillName}.md`,
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
 * @param skillName Nom court du workflow (ex: "CR Reunion", "Email Ingest").
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
      // 3) Lecture vault
      let content = await readSkillFromVault(skillName);
      let vaultPath = `${VAULT_SKILLS_FOLDER}/Workflow ${skillName}.md`;

      // 4) Fallback repo si vault down
      if (content === null) {
        content = readSkillFromRepo(skillName);
        vaultPath = FALLBACK_REPO_MARKER;
      }

      if (content === null) {
        throw new SkillLoadError(
          skillName,
          `Skill introuvable (ni vault "${VAULT_SKILLS_FOLDER}", ni repo "${REPO_SKILLS_FOLDER}")`,
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
        // TODO S21 : brancher alert Telegram à Thomas pour les warns
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
