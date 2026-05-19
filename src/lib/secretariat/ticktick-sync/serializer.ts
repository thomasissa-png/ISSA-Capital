/**
 * Serializer VaultTask → ligne markdown.
 *
 * Réversible : `parseTaskLine(serializeTaskToLine(t))` doit produire un objet
 * équivalent à `t` (modulo position). Utilisé en S18.2 pour pull TickTick→vault
 * (création depuis TickTick → ligne dans `Todo.md`).
 *
 * Pour S18.1 (push only), le serializer n'est pas appelé en prod mais est
 * livré dès maintenant pour préparer S18.2 et faciliter les tests.
 */

import type { VaultTask } from './types';

/** Convertit ISO → "YYYY-MM-DD" UTC */
function isoToDate(iso: string): string {
  return iso.slice(0, 10);
}

/** Convertit ISO → "HH:MM" UTC */
function isoToTime(iso: string): string {
  // "2026-05-19T09:30:00.000Z" → "09:30"
  return iso.slice(11, 16);
}

/** Map RRULE → keyword vault */
function mapRepeatFlagToKeyword(rrule: string): string | undefined {
  const m = rrule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i);
  const freq = m?.[1];
  if (!freq) return undefined;
  return freq.toLowerCase();
}

/**
 * Sérialise une VaultTask en ligne markdown.
 *
 * Format de sortie (ordre stable pour idempotence) :
 *   `- [ ] title 📅 YYYY-MM-DD [⏰ HH:MM] [#tag1 #tag2] [⏫|🔼|🔽] [🔁 freq]`
 *
 * Mapping priority → emoji (convention Obsidian Tasks, S18.4) :
 *   - 5 → ⏫ (high → "Critique")
 *   - 3 → 🔼 (medium → "Important")
 *   - 0 → aucun emoji (défaut → "Important")
 *   - 1 → 🔽 (low → "Priorité basse" ; ⏬ lowest n'est PAS re-émis, mappé low)
 */
export function serializeTaskToLine(task: VaultTask): string {
  const checkbox = task.status === 2 ? '[x]' : '[ ]';
  const parts: string[] = [`- ${checkbox}`, task.title];

  if (task.dueDate) {
    parts.push(`📅 ${isoToDate(task.dueDate)}`);
    if (!task.isAllDay) {
      parts.push(`⏰ ${isoToTime(task.dueDate)}`);
    }
  }

  for (const tag of task.tags) {
    parts.push(`#${tag}`);
  }

  if (task.priority === 5) parts.push('⏫');
  else if (task.priority === 3) parts.push('🔼');
  else if (task.priority === 1) parts.push('🔽');

  if (task.repeatFlag) {
    const keyword = mapRepeatFlagToKeyword(task.repeatFlag);
    if (keyword) parts.push(`🔁 ${keyword}`);
  }

  return parts.join(' ');
}

// ============================================================
// Test helpers
// ============================================================

export const _serializerInternals = {
  isoToDate,
  isoToTime,
  mapRepeatFlagToKeyword,
};
