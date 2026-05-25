/**
 * Collecteur agenda du jour pour le brief du matin.
 *
 * Réunions Google Calendar d'aujourd'hui (fenêtre = jour Paris). Réutilise
 * `listCalendarEvents` (calendar-ingest/calendar-source). Heure + titre +
 * participants. Déterministe (0 LLM).
 *
 * R8 : timeMin/timeMax = bornes du jour Paris (DST-safe), passées en ISO UTC.
 */

import { listCalendarEvents } from '../calendar-ingest/calendar-source';
import type { CalendarEvent } from '../calendar-ingest/types';
import { formatParisTime } from './paris-date';

export interface BriefEvent {
  /** « HH:mm » Paris, ou null si all-day. */
  time: string | null;
  title: string;
  /** Noms (ou emails) des participants hors Thomas, dédupliqués. */
  attendees: string[];
  allDay: boolean;
}

export interface CalendarSection {
  events: BriefEvent[];
}

/**
 * Récupère les réunions du jour (confirmées / tentatives), triées par heure.
 *
 * @param startUtcIso Début de journée Paris (ISO UTC).
 * @param endUtcIso   Fin de journée Paris (ISO UTC).
 */
export async function collectCalendar(
  startUtcIso: string,
  endUtcIso: string,
): Promise<CalendarSection> {
  const raw = await listCalendarEvents({
    timeMin: startUtcIso,
    timeMax: endUtcIso,
    singleEvents: true,
  });

  const events: BriefEvent[] = raw
    .filter((e: CalendarEvent) => e.status !== 'cancelled')
    .map((e) => {
      const startIso = e.startDateTime ?? e.startDate;
      const attendees = (e.attendees ?? [])
        .filter((a) => !a.self)
        .map((a) => a.displayName?.trim() || a.email)
        .filter((n): n is string => Boolean(n));
      const uniqueAttendees = [...new Set(attendees)];
      return {
        time: e.isAllDay || !e.startDateTime ? null : formatParisTime(startIso ?? ''),
        title: e.summary.trim() || '(Sans titre)',
        attendees: uniqueAttendees,
        allDay: e.isAllDay,
      };
    });

  // Tri : all-day d'abord, puis par heure croissante.
  events.sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return (a.time ?? '').localeCompare(b.time ?? '');
  });

  return { events };
}
