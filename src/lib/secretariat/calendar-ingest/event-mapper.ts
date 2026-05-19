/**
 * Mapper CalendarEvent → ReunionVaultEntry.
 *
 * Génère la projection vault d'un event Google Calendar :
 *   - filename : `YYYY-MM-DD - [Participants] - [Sujet].md`
 *   - folderPath : `06. Réunions/YYYY/MM` (via vault-paths R7)
 *   - frontmatter : type, date, heure, duree, participants (wikilinks),
 *                   lieu, categorie, google_calendar_event_id, google_calendar_html_link
 *   - body : description Google event + section ## Notes vide
 *
 * Convention nommage : alignée avec `second-cerveau/CLAUDE.md` et fiches
 * Reunions/ existantes (S18.3a iCal feed lit le même format).
 *
 * Slugify ASCII : utilise slugifyVaultFilename (handlers/vault-paths) pour
 * éliminer accents + caractères interdits Drive (` / \ : * ? " < > | '`).
 */

import type { CalendarEvent, ReunionVaultEntry } from './types';
import {
  reunionsPath,
  slugifyVaultFilename,
} from '../handlers/vault-paths';

// ============================================================
// Constantes
// ============================================================

/**
 * Longueur max du sujet dans le filename (avant slugify final).
 * Le slugify global tronque à 80 chars (cap dur). On garde un peu de marge
 * pour le préfixe date + participants.
 */
const MAX_SUBJECT_LEN = 50;

/**
 * Nombre max de participants nommés dans le filename
 * (le reste : suffixe " +N").
 */
const MAX_PARTICIPANTS_IN_FILENAME = 3;

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
// Helpers — formatage filename + wikilinks participants
// ============================================================

/**
 * Extrait le prénom + nom depuis un attendee.
 * - Si displayName présent : utilise "Prénom Nom"
 * - Sinon : extrait le local-part de l'email + capitalize
 */
export function attendeeToName(a: {
  email: string;
  displayName?: string;
}): string {
  if (a.displayName && a.displayName.trim()) {
    return a.displayName.trim();
  }
  // Fallback : extraire prénom du local-part
  const localPart = a.email.split('@')[0] ?? a.email;
  // "thomas.issa" → "Thomas Issa"
  const cleaned = localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return cleaned || localPart;
}

/**
 * Construit le bloc participants pour le filename.
 * Limite à MAX_PARTICIPANTS_IN_FILENAME, suffixe " +N" si plus.
 */
export function buildParticipantsForFilename(
  attendees: Array<{ email: string; displayName?: string }>,
): string {
  if (attendees.length === 0) return '';
  const names = attendees.slice(0, MAX_PARTICIPANTS_IN_FILENAME).map(
    (a) => attendeeToName(a).split(' ')[0] ?? attendeeToName(a),
  );
  const suffix =
    attendees.length > MAX_PARTICIPANTS_IN_FILENAME
      ? ` +${attendees.length - MAX_PARTICIPANTS_IN_FILENAME}`
      : '';
  return names.join(', ') + suffix;
}

/**
 * Construit la liste participants pour le frontmatter YAML.
 * Inclut Thomas (self) en premier s'il est attendee.
 * Format wikilink si nom propre détecté.
 */
export function buildParticipantsFrontmatter(
  attendees: Array<{ email: string; displayName?: string }>,
  self?: { email: string; displayName?: string },
): string[] {
  const items: string[] = [];
  if (self) {
    const name = attendeeToName(self);
    items.push(`[[${name}]]`);
  }
  for (const a of attendees) {
    const name = attendeeToName(a);
    items.push(`[[${name}]]`);
  }
  return items;
}

// ============================================================
// API publique — mapEventToReunion
// ============================================================

/**
 * Mappe un CalendarEvent en ReunionVaultEntry prêt à écrire.
 *
 * Retourne null si :
 *   - event sans date exploitable
 *   - event cancelled (le runner gère séparément la suppression/notification)
 *
 * Le filename est slugifié ASCII (slugifyVaultFilename) — pas d'accents,
 * pas de caractères interdits Drive.
 */
export function mapEventToReunion(event: CalendarEvent): ReunionVaultEntry | null {
  const date = extractDate(event);
  if (!date) return null;

  const { others, self } = partitionAttendees(event);

  const [year, month] = date.split('-');
  const folderPath = reunionsPath(Number(year), Number(month));

  const heure = extractHeure(event);
  const duree = extractDuree(event);

  // Sujet tronqué pour le filename
  const subjectShort = event.summary.slice(0, MAX_SUBJECT_LEN).trim();

  // Bloc participants pour filename
  const participantsBlock = buildParticipantsForFilename(others);

  // Filename brut : "YYYY-MM-DD - Participants - Sujet"
  let filenameRaw: string;
  if (participantsBlock) {
    filenameRaw = `${date} - ${participantsBlock} - ${subjectShort}`;
  } else {
    filenameRaw = `${date} - ${subjectShort}`;
  }
  const filename = slugifyVaultFilename(filenameRaw);

  // Lieu : préférer hangoutLink → location
  let lieu: string | undefined;
  if (event.hangoutLink) {
    lieu = 'Online (Google Meet)';
  } else if (event.location && event.location.trim()) {
    lieu = event.location.trim();
  }

  const participants = buildParticipantsFrontmatter(others, self);

  const entry: ReunionVaultEntry = {
    filename,
    folderPath,
    date,
    heure,
    duree,
    participants,
    lieu,
    sujet: event.summary,
    description: event.description?.trim() || undefined,
    googleEventId: event.id,
    googleHtmlLink: event.htmlLink,
    categorie: 'meeting',
  };

  return entry;
}

// ============================================================
// API publique — sérialisation Markdown
// ============================================================

/**
 * Sérialise un ReunionVaultEntry en contenu Markdown complet (frontmatter + body).
 *
 * Convention :
 *   - frontmatter YAML : ordre fixe (type, date, heure, duree, participants,
 *     lieu, categorie, google_calendar_event_id, google_calendar_html_link)
 *   - body : description Google event + section `## Notes` vide
 *
 * Le contenu est idempotent : sérialiser le même entry produit le même output
 * (important pour PATCH in-place R5 — pas de diff parasite).
 */
export function serializeReunionMarkdown(entry: ReunionVaultEntry): string {
  const lines: string[] = ['---'];
  lines.push(`type: reunion`);
  lines.push(`date: ${entry.date}`);
  if (entry.heure) lines.push(`heure: ${entry.heure}`);
  if (entry.duree !== undefined) lines.push(`duree: ${entry.duree}`);

  if (entry.participants.length > 0) {
    lines.push(`participants:`);
    for (const p of entry.participants) {
      // Échapper double-quotes dans la valeur
      const safe = p.replace(/"/g, '\\"');
      lines.push(`  - "${safe}"`);
    }
  } else {
    lines.push(`participants: []`);
  }

  if (entry.lieu) {
    const safeLieu = entry.lieu.replace(/"/g, '\\"');
    lines.push(`lieu: "${safeLieu}"`);
  }
  lines.push(`categorie: ${entry.categorie}`);
  lines.push(`google_calendar_event_id: ${entry.googleEventId}`);
  if (entry.googleHtmlLink) {
    lines.push(`google_calendar_html_link: ${entry.googleHtmlLink}`);
  }
  lines.push('---');
  lines.push('');

  // Body
  lines.push(`# ${entry.sujet}`);
  lines.push('');
  if (entry.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(entry.description);
    lines.push('');
  }
  lines.push('## Notes');
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// Exports internes pour tests
// ============================================================

export const _internals = {
  MAX_SUBJECT_LEN,
  MAX_PARTICIPANTS_IN_FILENAME,
};
