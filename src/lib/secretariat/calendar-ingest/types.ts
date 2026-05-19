/**
 * Types — calendar-ingest Google Calendar → vault Reunions.
 *
 * V1 one-way : Google Calendar = source des invitations reçues,
 * vault Reunions = miroir (canonique pour TickTick via iCal feed S18.3a).
 *
 * Hors scope V1 : bidirectionnel (vault → Google Calendar), conflits, reschedule.
 *
 * Spec : mission S18.6 (Thomas verbatim : "mon google calendar n'est pas sync
 * avec ticktick et le vault ? C'est tres important.").
 */

// ============================================================
// CalendarEvent — événement brut Google Calendar normalisé
// ============================================================

export interface CalendarEventAttendee {
  /** Email de l'attendee (normalisé lowercase) */
  email: string;
  /** Nom d'affichage si disponible */
  displayName?: string;
  /** True si organisateur */
  organizer?: boolean;
  /** True si self (Thomas lui-même) */
  self?: boolean;
  /** "needsAction" | "declined" | "tentative" | "accepted" */
  responseStatus?: string;
}

export interface CalendarEvent {
  /** ID Google Calendar (stable, unique) */
  id: string;
  /** Status : "confirmed" | "tentative" | "cancelled" */
  status: 'confirmed' | 'tentative' | 'cancelled';
  /** Lien HTML vers l'event Google Calendar */
  htmlLink: string;
  /** Date de création ISO 8601 */
  created?: string;
  /** Date de dernière modification ISO 8601 */
  updated: string;
  /** Sujet (event.summary) */
  summary: string;
  /** Description longue */
  description?: string;
  /** Lieu (event.location) */
  location?: string;
  /** Date de début ISO 8601 ou YYYY-MM-DD (all-day) */
  startDateTime?: string;
  startDate?: string;
  /** Date de fin ISO 8601 ou YYYY-MM-DD (all-day) */
  endDateTime?: string;
  endDate?: string;
  /** Timezone IANA (Europe/Paris) */
  timeZone?: string;
  /** Participants */
  attendees: CalendarEventAttendee[];
  /** Organisateur */
  organizer?: { email: string; displayName?: string; self?: boolean };
  /** Recurring event ID (si occurrence d'une récurrence) */
  recurringEventId?: string;
  /** Liens visioconférence Google Meet (event.hangoutLink) */
  hangoutLink?: string;
  /** True si event tout-jour */
  isAllDay: boolean;
}

// ============================================================
// ReunionVaultEntry — projection vers une fiche vault
// ============================================================

export interface ReunionVaultEntry {
  /** Filename sans extension (ex: "2026-05-22 - Maxime - Point Versi") */
  filename: string;
  /** Dossier vault (ex: "06. Réunions/2026/05") */
  folderPath: string;
  /** Date YYYY-MM-DD */
  date: string;
  /** Heure de début HH:MM si event timed (sinon undefined) */
  heure?: string;
  /** Durée en minutes */
  duree?: number;
  /** Liste des participants formatés (wikilink ou texte) */
  participants: string[];
  /** Lieu */
  lieu?: string;
  /** Sujet pour le filename + frontmatter `sujet` éventuel */
  sujet: string;
  /** Description Google event */
  description?: string;
  /** ID Google Calendar event (frontmatter pour matching) */
  googleEventId: string;
  /** Lien HTML Google Calendar */
  googleHtmlLink: string;
  /** Catégorie (toujours "meeting" pour calendar-ingest) */
  categorie: 'meeting';
}

// ============================================================
// State store — _Inbox/AnyaState/calendar-ingest-state.json
// ============================================================

export interface CalendarIngestState {
  version: 1;
  /** Timestamp ISO 8601 du dernier sync réussi */
  lastSync: string | null;
  /** Map eventId → { lastSeenUpdated, vaultPath } pour idempotence */
  processedEvents: Record<
    string,
    {
      /** event.updated du dernier traitement */
      lastSeenUpdated: string;
      /** Chemin vault de la fiche réunion créée */
      vaultPath: string;
      /** Date de la réunion YYYY-MM-DD */
      date: string;
    }
  >;
}

export function emptyCalendarIngestState(): CalendarIngestState {
  return {
    version: 1,
    lastSync: null,
    processedEvents: {},
  };
}

// ============================================================
// Stats du run
// ============================================================

export interface CalendarIngestStats {
  eventsFetched: number;
  eventsProcessed: number;
  reunionsCreated: number;
  reunionsUpdated: number;
  contactsEnriched: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

export function emptyStats(): CalendarIngestStats {
  return {
    eventsFetched: 0,
    eventsProcessed: 0,
    reunionsCreated: 0,
    reunionsUpdated: 0,
    contactsEnriched: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
  };
}

// ============================================================
// Résultat par event (pour audit + carte Telegram)
// ============================================================

export type CalendarIngestOp =
  | 'reunion-created'
  | 'reunion-updated'
  | 'reunion-cancelled'
  | 'skipped'
  | 'no-change'
  | 'error';

export interface CalendarIngestResult {
  eventId: string;
  summary: string;
  date: string;
  vaultPath?: string;
  op: CalendarIngestOp;
  participantsTotal: number;
  contactsEnriched: number;
  errors: string[];
}
