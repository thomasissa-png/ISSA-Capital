/**
 * Calendar-ingest — API publique.
 *
 * Point d'entrée unique pour le sync Google Calendar → vault Reunions.
 *
 * Usage typique (endpoint cron) :
 *   ```ts
 *   import { runCalendarIngest, sendCalendarRecapCard } from '@/lib/secretariat/calendar-ingest';
 *
 *   const { stats, results } = await runCalendarIngest();
 *   if (stats.reunionsCreated + stats.reunionsUpdated > 0) {
 *     await sendCalendarRecapCard(results);
 *   }
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
  mapEventToReunion,
  serializeReunionMarkdown,
  extractDate,
  extractHeure,
  extractDuree,
  partitionAttendees,
  isSystemEmail,
  attendeeToName,
  buildParticipantsForFilename,
  buildParticipantsFrontmatter,
} from './event-mapper';

export {
  writeReunion,
  findReunionByEventId,
} from './reunion-writer';
export type { WriteReunionResult } from './reunion-writer';

export {
  enrichContactsFromEvent,
  countEnriched,
  countNoContact,
} from './contact-enricher';
export type { EnrichResult } from './contact-enricher';

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
  ReunionVaultEntry,
  CalendarIngestState,
  CalendarIngestStats,
  CalendarIngestResult,
  CalendarIngestOp,
} from './types';

export { emptyCalendarIngestState, emptyStats } from './types';
