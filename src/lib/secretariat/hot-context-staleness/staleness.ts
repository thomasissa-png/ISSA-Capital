/**
 * Hot-context staleness (V0) — logique pure (testable, zéro I/O).
 *
 * Détecte si `hot-context.md` est périmé en comparant son frontmatter
 * (`semaine` ISO + `date_mise_a_jour`) à la date courante Europe/Paris, et
 * fournit le bumper de frontmatter (préserve le corps bit-parfait).
 *
 * V0 = garde-fou anti-dérive hebdomadaire (pas de détection de patches de
 * contenu — ça, c'est V1, module `hot-context/`). Voir
 * `08. Outils/Anya/Prompt Claude Code hot-context-updater.md`.
 */

import { parseObsidianFile, patchFrontmatterField } from '../vault-client/frontmatter';

export type StalenessSeverity = 'fresh' | 'warn' | 'critical' | 'invalid';

export interface StalenessVerdict {
  severity: StalenessSeverity;
  /** Semaine ISO du frontmatter (ex « 2026-W21 »), ou null si absente. */
  fileWeek: string | null;
  /** date_mise_a_jour du frontmatter (ex « 2026-05-25 »), ou null. */
  fileDate: string | null;
  /** Semaine ISO courante Paris (ex « 2026-W22 »). */
  currentWeek: string;
  /** Date courante Paris (ex « 2026-05-27 »). */
  currentDate: string;
  /** Jours écoulés depuis date_mise_a_jour (null si date absente/invalide). */
  daysSince: number | null;
  /** Semaine du frontmatter antérieure à la semaine courante. */
  weekStale: boolean;
}

// ============================================================
// Date / semaine Europe/Paris
// ============================================================

export interface ParisParts {
  /** « YYYY-MM-DD » */
  dateStr: string;
  /** « YYYY-Www » (ISO 8601) */
  isoWeekStr: string;
  /** 0 = dimanche … 6 = samedi */
  weekday: number;
  /** 0-23 */
  hour: number;
}

/** Décompose `now` en parties calendaires Europe/Paris (DST-safe via Intl). */
export function parisParts(now: Date = new Date()): ParisParts {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      hour12: false,
    })
      .format(now)
      .replace(/[^0-9]/g, ''),
  );
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const utc = new Date(Date.UTC(y, m - 1, d));
  const weekday = utc.getUTCDay();
  return { dateStr, isoWeekStr: isoWeekString(utc), weekday, hour };
}

/** Numéro de semaine ISO 8601 + année ISO pour une date UTC-midnight. */
export function isoWeekString(utcMidnight: Date): string {
  const date = new Date(
    Date.UTC(utcMidnight.getUTCFullYear(), utcMidnight.getUTCMonth(), utcMidnight.getUTCDate()),
  );
  const dayNum = (date.getUTCDay() + 6) % 7; // Lundi=0 … Dimanche=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // jeudi de la semaine
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** Parse « YYYY-Www » → comparable numérique (year*100 + week). null si invalide. */
function parseIsoWeek(s: string | null): number | null {
  if (!s) return null;
  const m = /^(\d{4})-W(\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number(m[2]);
}

// ============================================================
// Verdict
// ============================================================

/**
 * Évalue la fraîcheur du contenu d'un `hot-context.md`.
 *
 * - `invalid` : frontmatter sans `semaine` exploitable (on alertera quand même).
 * - `critical` : pas touché depuis > 7 jours.
 * - `warn` : semaine périmée OU pas touché depuis > 3 jours.
 * - `fresh` : à jour.
 */
export function evaluateStaleness(content: string, now: Date = new Date()): StalenessVerdict {
  const parsed = parseObsidianFile(content);
  const fields = parsed.frontmatter?.fields ?? {};
  const fileWeek = typeof fields['semaine'] === 'string' ? (fields['semaine'] as string) : null;
  const fileDate =
    typeof fields['date_mise_a_jour'] === 'string' ? (fields['date_mise_a_jour'] as string) : null;

  const p = parisParts(now);
  const currentWeek = p.isoWeekStr;
  const currentDate = p.dateStr;

  const fw = parseIsoWeek(fileWeek);
  const cw = parseIsoWeek(currentWeek)!;
  const weekStale = fw !== null && fw < cw;

  let daysSince: number | null = null;
  if (fileDate && /^\d{4}-\d{2}-\d{2}$/.test(fileDate)) {
    const fileMs = Date.parse(`${fileDate}T00:00:00Z`);
    const curMs = Date.parse(`${currentDate}T00:00:00Z`);
    if (!Number.isNaN(fileMs) && !Number.isNaN(curMs)) {
      daysSince = Math.round((curMs - fileMs) / (24 * 3600 * 1000));
    }
  }

  let severity: StalenessSeverity;
  if (fw === null && daysSince === null) {
    severity = 'invalid';
  } else if (daysSince !== null && daysSince > 7) {
    severity = 'critical';
  } else if (weekStale || (daysSince !== null && daysSince > 3)) {
    severity = 'warn';
  } else {
    severity = 'fresh';
  }

  return { severity, fileWeek, fileDate, currentWeek, currentDate, daysSince, weekStale };
}

// ============================================================
// Bumper de frontmatter (préserve le corps)
// ============================================================

/**
 * Met `semaine` + `date_mise_a_jour` à jour dans le frontmatter, sans toucher
 * au corps. Réutilise `patchFrontmatterField` (préservation bit-parfaite). Si un
 * champ est absent du frontmatter, il n'est PAS créé (V0 ne fabrique pas de clé).
 */
export function bumpFrontmatter(content: string, week: string, date: string): string {
  let out = patchFrontmatterField(content, 'semaine', week);
  out = patchFrontmatterField(out, 'date_mise_a_jour', date);
  return out;
}
