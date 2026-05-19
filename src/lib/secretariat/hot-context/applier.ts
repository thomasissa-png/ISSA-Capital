/**
 * Applier — applique un Patch sur le contenu live de `hot-context.md`.
 *
 * Source de vérité : `docs/hot-context-spec.md` §1.4 + §8 (R-A race condition).
 *
 * Garanties :
 *  1. Anti-race : re-lit `hot-context.md` LIVE avant chaque PATCH (pas de cache).
 *  2. Mutex write-lock par path (réutilise `vault-client/write-lock.ts`).
 *  3. PATCH in-place R5 via `writeFileById` (preserve fileId + wikilinks).
 *  4. Maintenance INTOUCHABLE — `maintenanceChanged` check obligatoire après apply.
 *  5. Idempotence : un même `patchId` appliqué 2× → 2ème = no-op silencieux.
 *
 * Le applier ne touche PAS au state — c'est la responsabilité du caller
 * (callback handler Telegram) d'enregistrer le résultat dans state.
 */

import { readFile, writeFileById } from '../vault-client/obsidian-file';
import { resolveFilePath } from '../vault-client/drive-resolver';
import { getAccessToken } from '../drive-upload';
import { withWriteLock } from '../vault-client/write-lock';
import {
  maintenanceChanged,
  parseHotContext,
  serializeHotContext,
} from './parser';
import type {
  ArbitragePayload,
  AttendsPayload,
  BougePayload,
  HotContextAst,
  Patch,
  SectionBlock,
} from './types';

// ============================================================
// Constantes
// ============================================================

/** Chemin logique vault — résolu live via vault-reader (R7). */
export const HOT_CONTEXT_FOLDER = '00. Me';
export const HOT_CONTEXT_FILENAME = 'hot-context.md';

// ============================================================
// Résultat
// ============================================================

export interface ApplyPatchResult {
  success: boolean;
  /** Tokens estimés AVANT apply (pour audit JSONL). */
  fileTokensBefore: number;
  /** Tokens estimés APRÈS apply. */
  fileTokensAfter: number;
  /** true si le cap warn 500 est dépassé après apply. */
  capWarnTriggered: boolean;
  /** Si !success, raison textuelle. */
  error?: string;
  /** Si !success et raison = idempotence, true. */
  alreadyApplied?: boolean;
}

// ============================================================
// Rendu des payloads en lignes markdown
// ============================================================

/**
 * Transforme un payload en ligne markdown selon la section.
 */
export function renderPatchLine(patch: Patch): string {
  switch (patch.section) {
    case 'bouge': {
      const p = patch.payload as BougePayload;
      return `- ${p.text}`;
    }
    case 'attends': {
      const p = patch.payload as AttendsPayload;
      // Tableau markdown : | Quoi | De qui | Depuis | Note |
      const note = p.note ?? '';
      return `| ${escapeCell(p.quoi)} | ${escapeCell(p.deQui)} | ${escapeCell(p.depuis)} | ${escapeCell(note)} |`;
    }
    case 'arbitrage': {
      const p = patch.payload as ArbitragePayload;
      return `- **${p.sujet}** — ${p.contexte}`;
    }
  }
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// ============================================================
// Application sur l'AST
// ============================================================

/**
 * Applique un patch sur un AST (pure function, testable sans Drive).
 *
 * Garantie : la section `maintenance` n'est jamais touchée. Si l'action
 * ciblerait `maintenance`, applyPatchOnAst retourne `null`.
 *
 * Idempotence add : si la ligne rendue existe déjà dans le body, no-op (retourne ast inchangé).
 * Idempotence remove : si la ligne n'existe pas, no-op.
 */
export function applyPatchOnAst(ast: HotContextAst, patch: Patch): HotContextAst | null {
  const sectionKey = patch.section;
  if (sectionKey !== 'bouge' && sectionKey !== 'attends' && sectionKey !== 'arbitrage') {
    return null; // red line maintenance protégée par le typage, mais safety net
  }

  const renderedLine = renderPatchLine(patch);
  const block: SectionBlock = ast[sectionKey];

  if (patch.action === 'add') {
    // Idempotence : déjà présent ?
    if (block.bodyLines.some((line) => line.trim() === renderedLine.trim())) {
      return ast;
    }
    // Insertion : pour 'attends', on insère après la dernière ligne tableau ;
    // pour 'bouge'/'arbitrage', on append à la fin du body utile.
    const newBodyLines = insertLine(sectionKey, block.bodyLines, renderedLine);
    return {
      ...ast,
      [sectionKey]: { heading: block.heading, bodyLines: newBodyLines },
    };
  }

  // action = remove
  const idx = block.bodyLines.findIndex((line) => line.trim() === renderedLine.trim());
  if (idx === -1) return ast; // idempotence
  const newBodyLines = [...block.bodyLines.slice(0, idx), ...block.bodyLines.slice(idx + 1)];
  return {
    ...ast,
    [sectionKey]: { heading: block.heading, bodyLines: newBodyLines },
  };
}

/**
 * Insère une nouvelle ligne dans le body d'une section.
 *
 * 'attends' (tableau) : insère après la dernière ligne `| ... |` détectée,
 * sinon append à la fin.
 * 'bouge' / 'arbitrage' : append à la fin du body utile (avant lignes vides
 * de fin), pour préserver la séparation visuelle avec la section suivante.
 */
function insertLine(
  sectionKey: 'bouge' | 'attends' | 'arbitrage',
  bodyLines: string[],
  newLine: string,
): string[] {
  if (sectionKey === 'attends') {
    // Trouver la dernière ligne tableau
    let lastTableIdx = -1;
    for (let i = bodyLines.length - 1; i >= 0; i--) {
      const cur = bodyLines[i] ?? '';
      if (cur.trim().startsWith('|') && cur.trim().endsWith('|')) {
        lastTableIdx = i;
        break;
      }
    }
    if (lastTableIdx === -1) {
      // Aucune ligne tableau : append à la fin
      return appendAtUsefulEnd(bodyLines, newLine);
    }
    return [
      ...bodyLines.slice(0, lastTableIdx + 1),
      newLine,
      ...bodyLines.slice(lastTableIdx + 1),
    ];
  }
  return appendAtUsefulEnd(bodyLines, newLine);
}

function appendAtUsefulEnd(bodyLines: string[], newLine: string): string[] {
  // Trouver la dernière ligne non vide
  let lastUsefulIdx = bodyLines.length - 1;
  while (lastUsefulIdx >= 0 && (bodyLines[lastUsefulIdx] ?? '').trim() === '') {
    lastUsefulIdx--;
  }
  if (lastUsefulIdx === -1) {
    // Body vide ou ne contient que des lignes vides
    return [newLine, ...bodyLines];
  }
  return [
    ...bodyLines.slice(0, lastUsefulIdx + 1),
    newLine,
    ...bodyLines.slice(lastUsefulIdx + 1),
  ];
}

// ============================================================
// Application end-to-end (Drive PATCH R5)
// ============================================================

/**
 * Applique un patch end-to-end sur le fichier Drive `hot-context.md`.
 *
 * Anti-race R-A : la lecture live est faite DANS le write-lock du path,
 * garantissant qu'aucune autre écriture Anya ne s'interpose entre read et
 * PATCH. Une édition manuelle Obsidian côté Thomas reste possible : si le
 * patch a déjà été appliqué (idempotence) → no-op silencieux.
 *
 * IMPORTANT : la section `maintenance` est vérifiée AVANT et APRÈS apply.
 * Si elle a changé entre les deux → on REFUSE le PATCH (rollback).
 */
export async function applyPatchToDrive(
  patch: Patch,
  estimateTokensFn: (content: string) => number,
): Promise<ApplyPatchResult> {
  const lockPath = `${HOT_CONTEXT_FOLDER}/${HOT_CONTEXT_FILENAME}`;
  return withWriteLock(lockPath, async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        success: false,
        fileTokensBefore: 0,
        fileTokensAfter: 0,
        capWarnTriggered: false,
        error: 'Drive désactivé — credentials OAuth2 manquants',
      };
    }

    const resolveResult = await resolveFilePath(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME);
    if (!resolveResult.success || !resolveResult.fileId) {
      return {
        success: false,
        fileTokensBefore: 0,
        fileTokensAfter: 0,
        capWarnTriggered: false,
        error: resolveResult.error ?? `Fichier "${HOT_CONTEXT_FILENAME}" introuvable`,
      };
    }

    // Re-lecture LIVE (anti-race R-A) — surtout pas de cache
    const read = await readFile(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME);
    if (!read.success || read.content === undefined) {
      return {
        success: false,
        fileTokensBefore: 0,
        fileTokensAfter: 0,
        capWarnTriggered: false,
        error: read.error ?? 'Lecture live échouée',
      };
    }

    const liveContent = read.content;
    const fileTokensBefore = estimateTokensFn(liveContent);

    const astBefore = parseHotContext(liveContent);
    const astAfter = applyPatchOnAst(astBefore, patch);
    if (astAfter === null) {
      return {
        success: false,
        fileTokensBefore,
        fileTokensAfter: fileTokensBefore,
        capWarnTriggered: false,
        error: `Section invalide pour patch : ${patch.section}`,
      };
    }

    // Vérification idempotence (no-op silencieux)
    if (astAfter === astBefore || serializeHotContext(astAfter) === liveContent) {
      return {
        success: true,
        fileTokensBefore,
        fileTokensAfter: fileTokensBefore,
        capWarnTriggered: false,
        alreadyApplied: true,
      };
    }

    // Red line : Maintenance intouchable
    if (maintenanceChanged(astBefore, astAfter)) {
      return {
        success: false,
        fileTokensBefore,
        fileTokensAfter: fileTokensBefore,
        capWarnTriggered: false,
        error: 'Red line : section Maintenance protégée — patch refusé',
      };
    }

    const newContent = serializeHotContext(astAfter);
    const fileTokensAfter = estimateTokensFn(newContent);
    const capWarnTriggered = fileTokensAfter > 500;

    const writeResult = await writeFileById(accessToken, resolveResult.fileId, newContent);
    if (!writeResult.success) {
      return {
        success: false,
        fileTokensBefore,
        fileTokensAfter,
        capWarnTriggered,
        error: writeResult.error ?? 'PATCH Drive échoué',
      };
    }

    return {
      success: true,
      fileTokensBefore,
      fileTokensAfter,
      capWarnTriggered,
    };
  });
}
