/**
 * Types — calendar-ingest Google Calendar → vault + TickTick.
 *
 * Refonte S23 : les réunions ne créent PLUS de fiche `06. Réunions`. Pour chaque
 * event confirmé (fenêtre ±14j) :
 *   - enrichissement des historiques CONTACTS (fiches vault existantes)
 *   - enrichissement de l'historique PROJET (détecté via titre/description)
 *   - création d'UN todo « CR à faire » dans TickTick (hub unique S20)
 *
 * Hors scope : bidirectionnel (vault → Google Calendar), conflits, reschedule,
 * fiches réunion (abandonnées S23, Thomas verbatim : « 06. Réunions ABANDONNÉ »).
 *
 * Origine : mission S18.6 (« mon google calendar n'est pas sync avec ticktick et
 * le vault ? C'est tres important. ») — pivot S23.
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
// EventProjection — données extraites d'un event (refonte S23)
// ============================================================

/**
 * Projection minimale d'un CalendarEvent : date/heure/durée/sujet/participants
 * + codes entité projet détectés. Remplace `ReunionVaultEntry` (plus de fiche
 * réunion). Sert d'entrée à l'enrichissement contacts/projet + à la création du
 * todo TickTick.
 */
export interface EventProjection {
  /** Date YYYY-MM-DD (locale Paris, pas de conversion UTC) */
  date: string;
  /** Heure de début HH:MM si event timed (sinon undefined) */
  heure?: string;
  /** Durée en minutes */
  duree?: number;
  /** Sujet de l'event (event.summary) */
  sujet: string;
  /** Description Google event */
  description?: string;
  /** Lieu (location ou visio) */
  lieu?: string;
  /** Lien HTML Google Calendar */
  googleHtmlLink: string;
  /**
   * Codes entité projet détectés (IC | GO | VI | VV | VM | IM).
   * 0 → pas de projet ; 1 → enrichissement direct ; 2+ → désambiguïsation Telegram.
   */
  projectCodes: string[];
}

// ============================================================
// State store — _Inbox/AnyaState/calendar-ingest-state.json
// ============================================================

/** Payload d'un event traité (refonte S23). */
export interface ProcessedEventRecord {
  /** event.updated du dernier traitement (idempotence) */
  lastSeenUpdated: string;
  /** Timestamp ISO 8601 du traitement */
  processedAt: string;
  /** Date de la réunion YYYY-MM-DD */
  date: string;
  /** Emails des contacts enrichis (historiques mis à jour) */
  contactsEnriched: string[];
  /** Codes entité dont l'historique projet a été enrichi */
  projectsEnriched: string[];
  /** ID du todo TickTick créé (réutilisé en update si l'event est replanifié) */
  todoId?: string;
}

export interface CalendarIngestState {
  version: 1;
  /** Timestamp ISO 8601 du dernier sync réussi */
  lastSync: string | null;
  /** Map eventId → ProcessedEventRecord pour idempotence */
  processedEvents: Record<string, ProcessedEventRecord>;
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
  /** Nb total de contacts enrichis (somme sur tous les events) */
  contactsEnriched: number;
  /** Nb d'historiques projet enrichis (match direct, hors pending Telegram) */
  projectsEnriched: number;
  /** Nb d'events ayant déclenché une carte de désambiguïsation projet */
  projectsAmbiguous: number;
  /** Nb de todos TickTick créés */
  todosCreated: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

export function emptyStats(): CalendarIngestStats {
  return {
    eventsFetched: 0,
    eventsProcessed: 0,
    contactsEnriched: 0,
    projectsEnriched: 0,
    projectsAmbiguous: 0,
    todosCreated: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
  };
}

// ============================================================
// Résultat par event (pour audit + carte Telegram)
// ============================================================

export type CalendarIngestOp =
  | 'processed' // event traité (contacts/projet/todo selon éligibilité)
  | 'cancelled' // event annulé (déjà connu)
  | 'skipped' // hors scope (pas de date, annulé jamais vu)
  | 'no-change' // déjà traité, event.updated identique
  | 'error';

export interface CalendarIngestResult {
  eventId: string;
  summary: string;
  date: string;
  op: CalendarIngestOp;
  participantsTotal: number;
  /** Nb de contacts enrichis sur cet event */
  contactsEnriched: number;
  /** Codes entité dont l'historique projet a été enrichi (match direct) */
  projectsEnriched: string[];
  /** True si une carte de désambiguïsation projet a été envoyée */
  projectAmbiguous: boolean;
  /** True si un todo TickTick a été créé (ou mis à jour) */
  todoCreated: boolean;
  errors: string[];
}
