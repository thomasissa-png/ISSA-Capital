/**
 * Parser markdown → VaultTask.
 *
 * Format attendu (cf. spec Phase 4 §1) :
 *   `- [ ] description 📅 YYYY-MM-DD #tag1 #tag2 🔼 🔁 weekly ⏰ HH:MM`
 *
 * Comportements clés :
 *   - `[ ]` ou `[x]` → status 0 ou 2
 *   - 📅 YYYY-MM-DD → dueDate ISO (UTC minuit, isAllDay true)
 *   - ⏰ HH:MM ou 🕐 HH:MM → ajoute heure, isAllDay false
 *   - 🔼 → priority 5 (high), 🔽 → priority 1 (low)
 *   - 🔁 weekly|daily|monthly → repeatFlag RRULE simple
 *   - #tag → tags (sans `#`), premier tag mappé détermine projectName
 *   - `#hide-tcw` présent → skip (return null)
 *
 * Renvoie `null` si :
 *   - la ligne n'est pas une checkbox markdown
 *   - le tag `#hide-tcw` est présent (red line spec §9.6)
 */

import {
  type VaultTask,
  type TaskPosition,
  resolveProjectName,
} from './types';

// ============================================================
// Regex patterns
// ============================================================

/** Détecte le préfixe checkbox markdown (avec indentation tolérée) */
const CHECKBOX_RE = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/u;

/** Date 📅 YYYY-MM-DD */
const DATE_EMOJI = '📅';
const DATE_RE = /📅\s*(\d{4}-\d{2}-\d{2})/u;

/** Heure ⏰ HH:MM ou 🕐 HH:MM */
const TIME_RE = /(?:⏰|🕐)\s*(\d{1,2}):(\d{2})/u;

/** Récurrence 🔁 weekly|daily|monthly|yearly */
const REPEAT_RE = /🔁\s*(daily|weekly|monthly|yearly)\b/iu;

/** Tag #slug — autorise lettres ASCII, chiffres, tiret, underscore */
const TAG_RE = /#([a-zA-Z0-9][a-zA-Z0-9_-]*)/gu;

/** Priority : 🔼 = high, 🔽 = low */
const PRIORITY_HIGH = '🔼';
const PRIORITY_LOW = '🔽';

/** Tag spécial à filtrer (red line §9.6) */
const HIDE_TAG = 'hide-tcw';

// ============================================================
// Helpers
// ============================================================

/**
 * Construit un ISO 8601 UTC à partir d'une date et d'une heure optionnelle.
 *
 * - Sans heure : minuit UTC (`2026-05-19T00:00:00.000Z`)
 * - Avec heure : combiné UTC (`2026-05-19T09:30:00.000Z`)
 */
function buildIsoDate(
  yyyymmdd: string,
  time?: { hours: number; minutes: number },
): string {
  if (time) {
    const iso = `${yyyymmdd}T${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}:00.000Z`;
    return iso;
  }
  return `${yyyymmdd}T00:00:00.000Z`;
}

/**
 * Nettoie le titre de tous les emojis/tags/dates spéciaux.
 * Garde uniquement le texte humain.
 */
function cleanTitle(raw: string): string {
  return raw
    .replace(DATE_RE, '')
    .replace(TIME_RE, '')
    .replace(REPEAT_RE, '')
    .replace(TAG_RE, '')
    .replaceAll(PRIORITY_HIGH, '')
    .replaceAll(PRIORITY_LOW, '')
    // Autres clocks possibles (⏰ déjà géré par TIME_RE si suivi de chiffres)
    .replaceAll(DATE_EMOJI, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Map récurrence vault → RRULE iCal-like */
function mapRepeatFlag(keyword: string): string | undefined {
  const k = keyword.toLowerCase();
  switch (k) {
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekly':
      return 'FREQ=WEEKLY';
    case 'monthly':
      return 'FREQ=MONTHLY';
    case 'yearly':
      return 'FREQ=YEARLY';
    default:
      return undefined;
  }
}

// ============================================================
// API publique
// ============================================================

/**
 * Parse une ligne markdown en VaultTask.
 *
 * @param line Ligne brute (sans \n final)
 * @param position Position vault {vaultPath, lineNumber}
 * @returns VaultTask ou null si :
 *   - pas une checkbox markdown
 *   - tag `#hide-tcw` présent
 */
export function parseTaskLine(
  line: string,
  position: TaskPosition,
): VaultTask | null {
  if (!line) return null;

  const m = line.match(CHECKBOX_RE);
  if (!m) return null;

  const checkboxChar = m[1] ?? ' ';
  const rest = m[2] ?? '';

  const status: 0 | 2 = checkboxChar.toLowerCase() === 'x' ? 2 : 0;

  // Tags
  const tags: string[] = [];
  for (const tagMatch of rest.matchAll(TAG_RE)) {
    const tag = tagMatch[1];
    if (tag) tags.push(tag.toLowerCase());
  }

  // Red line §9.6 : skip #hide-tcw
  if (tags.includes(HIDE_TAG)) return null;

  // Date
  let dueDate: string | undefined;
  let isAllDay = true;
  const dateMatch = rest.match(DATE_RE);
  const timeMatch = rest.match(TIME_RE);
  const dateStr = dateMatch?.[1];
  if (dateStr) {
    const hh = timeMatch?.[1];
    const mm = timeMatch?.[2];
    if (hh !== undefined && mm !== undefined) {
      isAllDay = false;
      dueDate = buildIsoDate(dateStr, {
        hours: Number(hh),
        minutes: Number(mm),
      });
    } else {
      dueDate = buildIsoDate(dateStr);
    }
  }

  // Priority
  let priority: 0 | 1 | 5 = 0;
  if (rest.includes(PRIORITY_HIGH)) priority = 5;
  else if (rest.includes(PRIORITY_LOW)) priority = 1;

  // Recurrence
  let repeatFlag: string | undefined;
  const repeatMatch = rest.match(REPEAT_RE);
  const repeatKw = repeatMatch?.[1];
  if (repeatKw) {
    repeatFlag = mapRepeatFlag(repeatKw);
  }

  // Title cleanup
  const title = cleanTitle(rest);
  if (!title) return null;

  // Filter out #hide-tcw from tags before projet resolution
  // (déjà gated par early-return ci-dessus, mais defensive)
  const projectTags = tags.filter((t) => t !== HIDE_TAG);
  const projectName = resolveProjectName(projectTags);

  const task: VaultTask = {
    title,
    status,
    priority,
    isAllDay,
    tags: projectTags,
    projectName,
    position,
  };
  if (dueDate !== undefined) task.dueDate = dueDate;
  if (repeatFlag !== undefined) task.repeatFlag = repeatFlag;

  return task;
}

// ============================================================
// Test helpers
// ============================================================

export const _parserInternals = {
  CHECKBOX_RE,
  DATE_RE,
  TIME_RE,
  REPEAT_RE,
  TAG_RE,
  HIDE_TAG,
  cleanTitle,
  buildIsoDate,
  mapRepeatFlag,
};
