/**
 * Calendar-ingest — API publique (refonte S23).
 *
 * Point d'entrée unique pour le sync Google Calendar → vault + TickTick.
 * Plus de fiche réunion : enrichissement historiques contacts/projet + todo TickTick.
 *
 * Usage typique (endpoint cron) :
 *   ```ts
 *   import { runCalendarIngest, sendCalendarRecapCard } from '@/lib/secretariat/calendar-ingest';
 *
 *   const { stats, results } = await runCalendarIngest();
 *   await sendCalendarRecapCard(results); // silence si rien à dire
 *   ```
 */

export { runCalendarIngest } from './runner';
export type {
  RunCalendarIngestOpts,
  RunCalendarIngestOutput,
} from './runner';

export {
  listCalendarEvents,
  normalizeEvent,
} from './calendar-source';
export type { ListEventsOptions } from './calendar-source';

export {
  mapEventToProjection,
  detectProjectFromEvent,
  isEventTodoEligible,
  extractDate,
  extractHeure,
  extractDuree,
  partitionAttendees,
  isSystemEmail,
} from './event-mapper';

export {
  enrichContactsFromEvent,
  countEnriched,
  countNoContact,
} from './contact-enricher';
export type { EnrichResult } from './contact-enricher';

export { enrichProjetHistorique } from './projet-enricher';
export type { ProjetEnrichResult } from './projet-enricher';

export { createCrTodo } from './todo-creator';
export type { TodoCreateResult } from './todo-creator';

export {
  loadCalendarIngestState,
  saveCalendarIngestState,
  STATE_FILENAME,
} from './state-store';

export {
  appendCalendarAuditLog,
  serializeCalendarAuditEntry,
  auditLogFilename,
  auditLogPath,
} from './audit-log';

export {
  sendCalendarRecapCard,
  buildRecapMessage,
} from './telegram-recap';

export type {
  CalendarEvent,
  CalendarEventAttendee,
  EventProjection,
  ProcessedEventRecord,
  CalendarIngestState,
  CalendarIngestStats,
  CalendarIngestResult,
  CalendarIngestOp,
} from './types';

export { emptyCalendarIngestState, emptyStats } from './types';
