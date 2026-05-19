/**
 * Source Google Calendar — fetch des events sur fenêtre temporelle.
 *
 * Réutilise getAccessToken() mutualisé (drive-upload.ts) — même flow OAuth que
 * Gmail + Drive. Scope requis : `https://www.googleapis.com/auth/calendar.readonly`.
 * Si non inclus dans le refresh_token actuel → documenter dans REPLIT_ACTIONS.md.
 *
 * Endpoint : GET /calendars/{calendarId}/events
 * Doc : https://developers.google.com/calendar/api/v3/reference/events/list
 *
 * Règle CLAUDE.md n22 : console.warn pour les logs diagnostic.
 * Timeout explicite 10s (cohérent avec gmail-client).
 */

import { getAccessToken } from '../drive-upload';
import type { CalendarEvent, CalendarEventAttendee } from './types';

// ============================================================
// Constantes
// ============================================================

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TIMEOUT_MS = 10_000;

/** ID du calendrier — `primary` = calendrier principal du compte authentifié */
const DEFAULT_CALENDAR_ID = 'primary';

// ============================================================
// Types bruts Google Calendar API
// ============================================================

interface GcalDateField {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GcalAttendee {
  email?: string;
  displayName?: string;
  organizer?: boolean;
  self?: boolean;
  responseStatus?: string;
}

interface GcalOrganizer {
  email?: string;
  displayName?: string;
  self?: boolean;
}

interface GcalEvent {
  id?: string;
  status?: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GcalDateField;
  end?: GcalDateField;
  attendees?: GcalAttendee[];
  organizer?: GcalOrganizer;
  recurringEventId?: string;
  hangoutLink?: string;
}

interface GcalListResponse {
  items?: GcalEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

// ============================================================
// API publique — fetch events
// ============================================================

export interface ListEventsOptions {
  /** ID du calendrier (défaut 'primary') */
  calendarId?: string;
  /** ISO 8601 — events updated after this timestamp (sync incrémental) */
  updatedMin?: string;
  /** ISO 8601 — events starting on or after */
  timeMin?: string;
  /** ISO 8601 — events starting before */
  timeMax?: string;
  /** Inclure les events annulés (status=cancelled) */
  showDeleted?: boolean;
  /** Max résultats par page (max 2500, défaut 250) */
  maxResults?: number;
  /** Étendre les récurrences en occurrences individuelles */
  singleEvents?: boolean;
}

/**
 * Liste les events Google Calendar selon les filtres fournis.
 *
 * Gère la pagination via nextPageToken (boucle jusqu'à épuisement).
 *
 * @returns Liste des events normalisés, ou [] si erreur.
 */
export async function listCalendarEvents(
  opts: ListEventsOptions = {},
): Promise<CalendarEvent[]> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('[calendar-source] pas de token OAuth2 — Calendar désactivé');
    return [];
  }

  const calendarId = opts.calendarId ?? DEFAULT_CALENDAR_ID;
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    );
    url.searchParams.set('maxResults', String(opts.maxResults ?? 250));
    url.searchParams.set('singleEvents', String(opts.singleEvents ?? true));
    url.searchParams.set('orderBy', 'updated');
    if (opts.updatedMin) url.searchParams.set('updatedMin', opts.updatedMin);
    if (opts.timeMin) url.searchParams.set('timeMin', opts.timeMin);
    if (opts.timeMax) url.searchParams.set('timeMax', opts.timeMax);
    if (opts.showDeleted) url.searchParams.set('showDeleted', 'true');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      console.warn(
        `[calendar-source] fetch erreur : ${err instanceof Error ? err.message : String(err)}`,
      );
      return events;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(
        `[calendar-source] listEvents HTTP ${response.status} — ${errText.slice(0, 300)}`,
      );
      return events;
    }

    const data = (await response.json()) as GcalListResponse;
    const items = data.items ?? [];

    for (const raw of items) {
      const normalized = normalizeEvent(raw);
      if (normalized) events.push(normalized);
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  // recordOAuthUsage : pas de provider 'calendar' dans health-monitor pour l'instant
  // (le refresh_token Google est partagé Gmail + Drive + Calendar — déjà tracké via 'gmail').

  console.warn(
    `[calendar-source] listEvents : ${events.length} event(s) (calendar=${calendarId})`,
  );
  return events;
}

// ============================================================
// Normalisation event brut → CalendarEvent
// ============================================================

export function normalizeEvent(raw: GcalEvent): CalendarEvent | null {
  if (!raw.id) return null;

  const status = (raw.status as CalendarEvent['status']) ?? 'confirmed';
  const updated = raw.updated ?? new Date().toISOString();

  // Détection all-day : start.date présent + pas de dateTime
  const isAllDay = Boolean(raw.start?.date && !raw.start?.dateTime);

  const attendees: CalendarEventAttendee[] = (raw.attendees ?? []).map((a) => ({
    email: (a.email ?? '').toLowerCase().trim(),
    displayName: a.displayName,
    organizer: a.organizer,
    self: a.self,
    responseStatus: a.responseStatus,
  })).filter((a) => a.email.length > 0);

  const event: CalendarEvent = {
    id: raw.id,
    status,
    htmlLink: raw.htmlLink ?? '',
    created: raw.created,
    updated,
    summary: (raw.summary ?? '(Sans titre)').trim(),
    description: raw.description,
    location: raw.location,
    startDateTime: raw.start?.dateTime,
    startDate: raw.start?.date,
    endDateTime: raw.end?.dateTime,
    endDate: raw.end?.date,
    timeZone: raw.start?.timeZone ?? raw.end?.timeZone,
    attendees,
    organizer: raw.organizer
      ? {
          email: (raw.organizer.email ?? '').toLowerCase().trim(),
          displayName: raw.organizer.displayName,
          self: raw.organizer.self,
        }
      : undefined,
    recurringEventId: raw.recurringEventId,
    hangoutLink: raw.hangoutLink,
    isAllDay,
  };

  return event;
}

// ============================================================
// Helpers exposés pour tests
// ============================================================

export const _internals = {
  DEFAULT_CALENDAR_ID,
  CALENDAR_API,
  normalizeEvent,
};
