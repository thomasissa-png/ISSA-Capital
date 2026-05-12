/**
 * Google Calendar API client — création d'événements.
 *
 * Utilise OAuth2 via le même refresh token que Drive (GOOGLE_REFRESH_TOKEN).
 * Le scope `https://www.googleapis.com/auth/calendar.events` est nécessaire.
 * Comme le scope demandé est déjà `drive` (full), et que le consentement
 * ne couvre pas calendar, Thomas devra re-OAuth avec le scope élargi.
 *
 * Règle CLAUDE.md n°21 : le code demandant le nouveau scope doit être
 * déployé AVANT que Thomas re-OAuth.
 *
 * Env vars :
 *   GOOGLE_CLIENT_ID — OAuth2 Client ID
 *   GOOGLE_CLIENT_SECRET — OAuth2 Client Secret
 *   GOOGLE_REFRESH_TOKEN — Refresh token (obtenu via /api/drive-auth)
 */

import { getAccessToken } from '@/lib/secretariat/drive-upload';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const CALENDAR_TIMEOUT_MS = 10_000;

export interface CalendarEventInput {
  summary: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM (24h)
  location?: string;
  description?: string;
}

export interface CalendarEventResult {
  success: boolean;
  eventId?: string;
  htmlLink?: string;
  error?: string;
}

/**
 * Crée un événement dans le calendrier principal de Thomas.
 *
 * Si `time` est fourni → événement avec heure (1h par défaut).
 * Si `time` est absent → événement "toute la journée" (all-day).
 *
 * @param eventData Données de l'événement à créer
 */
export async function createCalendarEvent(
  eventData: CalendarEventInput,
): Promise<CalendarEventResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      error: 'Calendrier désactivé — credentials OAuth2 manquants (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)',
    };
  }

  // Construire le body de l'événement
  let start: Record<string, string>;
  let end: Record<string, string>;

  if (eventData.time) {
    // Événement avec heure — durée 1h par défaut
    const startDateTime = `${eventData.date}T${eventData.time}:00`;
    const endHour = parseInt(eventData.time.split(':')[0] ?? '0', 10) + 1;
    const endMinute = eventData.time.split(':')[1] ?? '00';
    const endTime = `${String(endHour).padStart(2, '0')}:${endMinute}`;
    const endDateTime = `${eventData.date}T${endTime}:00`;

    start = { dateTime: startDateTime, timeZone: 'Europe/Paris' };
    end = { dateTime: endDateTime, timeZone: 'Europe/Paris' };
  } else {
    // Événement toute la journée
    // L'API Google Calendar attend end = jour suivant pour all-day events
    const startDate = new Date(eventData.date + 'T12:00:00Z');
    const endDate = new Date(startDate.getTime() + 86_400_000);
    const endDateStr = endDate.toISOString().split('T')[0];

    start = { date: eventData.date };
    end = { date: endDateStr! };
  }

  const body = {
    summary: eventData.summary,
    start,
    end,
    ...(eventData.location ? { location: eventData.location } : {}),
    ...(eventData.description ? { description: eventData.description } : {}),
  };

  const url = `${CALENDAR_API}/calendars/primary/events`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALENDAR_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `Calendar API ${response.status}: ${errorText.slice(0, 300)}`;

      // Diagnostic scope insuffisant
      if (response.status === 403 || response.status === 401) {
        console.warn(`[calendar] scope probablement insuffisant — ${errorMsg}`);
        return {
          success: false,
          error: 'Google Calendar non autorisé. Re-autorise via /api/drive-auth pour obtenir le scope calendar.',
        };
      }

      return { success: false, error: errorMsg };
    }

    const data = (await response.json()) as {
      id?: string;
      htmlLink?: string;
    };

    console.warn(`[calendar] événement créé : ${data.id} — ${eventData.summary}`);

    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort = err instanceof Error && (err.name === 'AbortError' || msg.includes('aborted'));

    if (isAbort) {
      return { success: false, error: 'Timeout Calendar API (10s dépassées)' };
    }

    return {
      success: false,
      error: `Erreur Calendar : ${msg.slice(0, 200)}`,
    };
  }
}
