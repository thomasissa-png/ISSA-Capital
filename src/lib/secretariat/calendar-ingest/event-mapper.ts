/**
 * Mapper CalendarEvent → EventProjection (refonte S23).
 *
 * Plus de fiche réunion (`06. Réunions` abandonné). Ce module :
 *   - extrait date/heure/durée/participants d'un event Google Calendar
 *   - détecte le(s) projet(s) concerné(s) via match du titre + description
 *     contre les noms canoniques + alias (`detectProjectFromEvent`)
 *   - produit une `EventProjection` consommée par le runner pour enrichir
 *     contacts/projet et créer le todo TickTick.
 *
 * Conservés depuis l'ancien mapper : extraction date/heure/durée, partition des
 * participants, détection des emails système.
 */

import type { CalendarEvent, EventProjection } from './types';

// ============================================================
// Helpers — extraction date/heure
// ============================================================

/**
 * Extrait la date YYYY-MM-DD du startDateTime ou startDate.
 * Si event timed avec timezone, conserve la date locale (pas de conversion UTC).
 */
export function extractDate(event: CalendarEvent): string | null {
  if (event.startDate) {
    // All-day event : startDate au format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(event.startDate)) {
      return event.startDate;
    }
  }
  if (event.startDateTime) {
    // ISO 8601 — extraire les 10 premiers chars (YYYY-MM-DD)
    const match = event.startDateTime.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1]!;
  }
  return null;
}

/**
 * Extrait l'heure HH:MM du startDateTime.
 * Retourne undefined si all-day.
 */
export function extractHeure(event: CalendarEvent): string | undefined {
  if (event.isAllDay || !event.startDateTime) return undefined;
  // Format ISO 8601 : 2026-05-22T14:30:00+02:00 ou 2026-05-22T14:30:00Z
  const match = event.startDateTime.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  return undefined;
}

/**
 * Calcule la durée en minutes entre startDateTime et endDateTime.
 * Retourne undefined si all-day ou champs manquants.
 */
export function extractDuree(event: CalendarEvent): number | undefined {
  if (event.isAllDay) return undefined;
  if (!event.startDateTime || !event.endDateTime) return undefined;
  const start = new Date(event.startDateTime).getTime();
  const end = new Date(event.endDateTime).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return undefined;
  return Math.round((end - start) / 60000);
}

// ============================================================
// Helpers — extraction participants
// ============================================================

/**
 * Sépare les participants en :
 *   - "humains" (à utiliser pour le filename + frontmatter)
 *   - "self" (Thomas, à exclure du filename mais garder en frontmatter)
 *
 * Filtre les emails système / ressources (rooms@..., noreply@...).
 */
export function partitionAttendees(event: CalendarEvent): {
  others: Array<{ email: string; displayName?: string }>;
  self?: { email: string; displayName?: string };
} {
  const others: Array<{ email: string; displayName?: string }> = [];
  let self: { email: string; displayName?: string } | undefined;

  for (const a of event.attendees) {
    if (!a.email || !a.email.includes('@')) continue;
    if (isSystemEmail(a.email)) continue;

    if (a.self) {
      self = { email: a.email, displayName: a.displayName };
      continue;
    }
    others.push({ email: a.email, displayName: a.displayName });
  }

  // Si l'organizer est dans Thomas et n'a pas été détecté comme self via attendees
  if (!self && event.organizer?.self) {
    self = {
      email: event.organizer.email,
      displayName: event.organizer.displayName,
    };
  }

  return { others, self };
}

/**
 * Détecte un email système / no-reply à exclure des participants.
 * Patterns inspirés de email-ingest/pre-filter.ts (cohérence cross-modules).
 */
export function isSystemEmail(email: string): boolean {
  const lower = email.toLowerCase();
  // Patterns no-reply / system
  if (
    /^(noreply|no-reply|notifications?|mailer-daemon|postmaster|calendar-notification)@/.test(
      lower,
    )
  ) {
    return true;
  }
  // Google resources (rooms, equipment) : domaine resource.calendar.google.com
  if (lower.endsWith('@resource.calendar.google.com')) return true;
  if (lower.endsWith('@group.calendar.google.com')) return true;
  return false;
}

// ============================================================
// Détection projet — match titre/description contre noms canoniques + alias
// ============================================================

/**
 * Alias par code entité. Chaque pattern est testé (insensible à la casse,
 * sur frontières de mots) contre `summary + description`.
 *
 * Codes : IC (ISSA Capital), GO (Gradient One), VI (Versi Immobilier),
 * VV (Versi Invest), VM (Versimo), IM (Immocrew).
 *
 * Règle d'ambiguïté volontaire : « Versi » seul N'EST PAS un alias (il matcherait
 * 3 entités VI/VV/VM → toujours ambigu). On exige le nom complet ou un alias
 * discriminant. Si Thomas constate des trous, ajuster ici (1 ligne par alias).
 */
const PROJECT_ALIASES: Record<string, string[]> = {
  IC: ['ISSA Capital', 'ISSA'],
  GO: ['Gradient One', 'Gradient'],
  VI: ['Versi Immobilier', 'Versi Immo'],
  VV: ['Versi Invest', 'Versi Investissement'],
  VM: ['Versimo'],
  IM: ['Immocrew', 'Immo Crew'],
};

/** Normalise une chaîne pour le match : minuscules + accents retirés. */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Détecte les codes entité projet concernés par un event, via match du
 * `summary + description` contre les alias canoniques.
 *
 * Match sur frontière de mot (`\b`) pour éviter les faux positifs (« Versimo »
 * ne doit pas matcher « Versi Immobilier »). Le plus long alias d'une entité
 * suffit — on déduplique par code.
 *
 * @returns Liste triée et dédupliquée de codes entité (0, 1 ou 2+).
 */
export function detectProjectFromEvent(event: CalendarEvent): string[] {
  const haystack = normalizeForMatch(
    `${event.summary ?? ''} ${event.description ?? ''}`,
  );
  if (!haystack.trim()) return [];

  const matched = new Set<string>();
  for (const [code, aliases] of Object.entries(PROJECT_ALIASES)) {
    for (const alias of aliases) {
      const normAlias = normalizeForMatch(alias);
      // Frontière de mot : le terme entouré de non-alphanumériques ou bords.
      const escaped = normAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      if (re.test(haystack)) {
        matched.add(code);
        break; // un alias suffit pour cette entité
      }
    }
  }
  return Array.from(matched).sort();
}

// ============================================================
// API publique — mapEventToProjection
// ============================================================

/**
 * Projette un CalendarEvent vers une `EventProjection` (refonte S23).
 *
 * Retourne null si l'event n'a pas de date exploitable (le runner le marque
 * `skipped`). N'écrit RIEN — l'orchestration (contacts/projet/todo) est faite
 * par le runner.
 */
export function mapEventToProjection(event: CalendarEvent): EventProjection | null {
  const date = extractDate(event);
  if (!date) return null;

  const heure = extractHeure(event);
  const duree = extractDuree(event);

  // Lieu : préférer hangoutLink → location
  let lieu: string | undefined;
  if (event.hangoutLink) {
    lieu = 'Online (Google Meet)';
  } else if (event.location && event.location.trim()) {
    lieu = event.location.trim();
  }

  return {
    date,
    heure,
    duree,
    sujet: event.summary,
    description: event.description?.trim() || undefined,
    lieu,
    googleHtmlLink: event.htmlLink,
    projectCodes: detectProjectFromEvent(event),
  };
}

// ============================================================
// Éligibilité todo — exclusions (récurrent / all-day / perso)
// ============================================================

/**
 * Détermine si un event est éligible à la création d'un todo « CR à faire ».
 *
 * Exclusions (décision verrouillée S23 §7) :
 *   - event récurrent (`recurringEventId` présent)
 *   - event all-day (`isAllDay`)
 *   - event perso : 0 participant externe (non-self, non-système)
 *
 * @returns true si un todo doit être créé.
 */
export function isEventTodoEligible(event: CalendarEvent): boolean {
  if (event.recurringEventId) return false;
  if (event.isAllDay) return false;
  const { others } = partitionAttendees(event);
  if (others.length === 0) return false;
  return true;
}

// ============================================================
// Exports internes pour tests
// ============================================================

export const _internals = {
  PROJECT_ALIASES,
  normalizeForMatch,
};
