/**
 * Runner calendar-ingest — orchestre le cycle complet Google Calendar → vault.
 *
 * Algorithme :
 *   1. Charger le state (lastSync, processedEvents)
 *   2. Fetch events Google Calendar :
 *      - timeMin = now - windowDays (rattrape historique récent)
 *      - timeMax = now + windowDays (events à venir)
 *      - showDeleted = true (gérer annulations)
 *   3. Pour chaque event :
 *      a. Skip si déjà processed avec même event.updated (idempotence)
 *      b. mapEventToReunion → fiche vault
 *      c. writeReunion (PATCH in-place R5 ou CREATE)
 *      d. enrichContactsFromEvent
 *      e. appendCalendarAuditLog
 *      f. update state.processedEvents
 *   4. Sauver state
 *   5. Retourner stats + résultats (pour carte Telegram)
 */

import {
  loadCalendarIngestState,
  saveCalendarIngestState,
} from './state-store';
import { listCalendarEvents } from './calendar-source';
import { mapEventToReunion } from './event-mapper';
import { writeReunion } from './reunion-writer';
import {
  enrichContactsFromEvent,
  countEnriched,
} from './contact-enricher';
import { appendCalendarAuditLog } from './audit-log';
import type {
  CalendarEvent,
  CalendarIngestResult,
  CalendarIngestStats,
  CalendarIngestState,
} from './types';
import { emptyStats } from './types';

// ============================================================
// Constantes
// ============================================================

const DEFAULT_WINDOW_DAYS = 14;

// ============================================================
// API publique
// ============================================================

export interface RunCalendarIngestOpts {
  /** Fenêtre temporelle ± jours autour de now (défaut 14) */
  windowDays?: number;
  /** Si true : ne sauve pas le state + n'écrit pas vault (preview only) */
  dryRun?: boolean;
  /** Override pour tests : injection client custom */
  _calendarClient?: typeof listCalendarEvents;
  _writeReunion?: typeof writeReunion;
  _enrichContacts?: typeof enrichContactsFromEvent;
  _appendAudit?: typeof appendCalendarAuditLog;
  _loadState?: typeof loadCalendarIngestState;
  _saveState?: typeof saveCalendarIngestState;
}

export interface RunCalendarIngestOutput {
  stats: CalendarIngestStats;
  results: CalendarIngestResult[];
  stateSaved: boolean;
}

/**
 * Exécute un cycle calendar-ingest complet.
 */
export async function runCalendarIngest(
  opts: RunCalendarIngestOpts = {},
): Promise<RunCalendarIngestOutput> {
  const startMs = Date.now();
  const stats = emptyStats();
  const results: CalendarIngestResult[] = [];

  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const calendarClient = opts._calendarClient ?? listCalendarEvents;
  const writer = opts._writeReunion ?? writeReunion;
  const enricher = opts._enrichContacts ?? enrichContactsFromEvent;
  const auditLogger = opts._appendAudit ?? appendCalendarAuditLog;
  const loadState = opts._loadState ?? loadCalendarIngestState;
  const saveState = opts._saveState ?? saveCalendarIngestState;

  // 1. Charger state
  const state = await loadState();

  // 2. Fenêtre temporelle
  const now = new Date();
  const timeMin = new Date(now.getTime() - windowDays * 86400_000).toISOString();
  const timeMax = new Date(now.getTime() + windowDays * 86400_000).toISOString();

  // 3. Fetch events
  let events: CalendarEvent[];
  try {
    events = await calendarClient({
      timeMin,
      timeMax,
      showDeleted: true,
      singleEvents: true,
    });
  } catch (err) {
    console.warn(
      `[calendar-ingest] fetch erreur : ${err instanceof Error ? err.message : String(err)}`,
    );
    stats.errors = 1;
    stats.durationMs = Date.now() - startMs;
    return { stats, results, stateSaved: false };
  }

  stats.eventsFetched = events.length;
  console.warn(`[calendar-ingest] ${events.length} event(s) fetched`);

  // 4. Traiter chaque event
  for (const event of events) {
    try {
      const result = await processOneEvent(event, state, opts.dryRun ?? false, {
        writer,
        enricher,
        auditLogger,
      });
      results.push(result);
      updateStatsFromResult(stats, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[calendar-ingest] erreur sur event ${event.id} : ${msg}`,
      );
      stats.errors++;
      results.push({
        eventId: event.id,
        summary: event.summary,
        date: '',
        op: 'error',
        participantsTotal: event.attendees.length,
        contactsEnriched: 0,
        errors: [msg],
      });
    }
  }

  // 5. Sauver state
  state.lastSync = new Date().toISOString();
  let stateSaved = false;
  if (!opts.dryRun) {
    stateSaved = await saveState(state);
    if (!stateSaved) {
      console.warn('[calendar-ingest] saveState échec — sync next run risque doublons');
    }
  }

  stats.durationMs = Date.now() - startMs;

  console.warn(
    `[calendar-ingest] terminé en ${stats.durationMs}ms — ` +
      `fetched=${stats.eventsFetched} processed=${stats.eventsProcessed} ` +
      `created=${stats.reunionsCreated} updated=${stats.reunionsUpdated} ` +
      `contacts=${stats.contactsEnriched} skipped=${stats.skipped} errors=${stats.errors}`,
  );

  return { stats, results, stateSaved };
}

// ============================================================
// Traitement d'un event
// ============================================================

interface ProcessDeps {
  writer: typeof writeReunion;
  enricher: typeof enrichContactsFromEvent;
  auditLogger: typeof appendCalendarAuditLog;
}

async function processOneEvent(
  event: CalendarEvent,
  state: CalendarIngestState,
  dryRun: boolean,
  deps: ProcessDeps,
): Promise<CalendarIngestResult> {
  // Skip events annulés sans fiche connue (rien à faire)
  if (event.status === 'cancelled') {
    const seen = state.processedEvents[event.id];
    if (!seen) {
      return {
        eventId: event.id,
        summary: event.summary || '(annulé)',
        date: '',
        op: 'skipped',
        participantsTotal: event.attendees.length,
        contactsEnriched: 0,
        errors: [],
      };
    }
    // Event annulé qu'on avait déjà créé : on laisse la fiche vault (audit
    // trail) et on émet un résultat "reunion-cancelled" pour la carte Telegram
    if (!dryRun) {
      await deps.auditLogger({
        eventId: event.id,
        summary: event.summary,
        date: seen.date,
        op: 'reunion-cancelled',
        vaultPath: seen.vaultPath,
        participantsTotal: event.attendees.length,
        contactsEnriched: 0,
        errors: [],
      });
    }
    return {
      eventId: event.id,
      summary: event.summary,
      date: seen.date,
      vaultPath: seen.vaultPath,
      op: 'reunion-cancelled',
      participantsTotal: event.attendees.length,
      contactsEnriched: 0,
      errors: [],
    };
  }

  // Idempotence : skip si event.updated identique à la dernière fois
  const seen = state.processedEvents[event.id];
  if (seen && seen.lastSeenUpdated === event.updated) {
    return {
      eventId: event.id,
      summary: event.summary,
      date: seen.date,
      vaultPath: seen.vaultPath,
      op: 'no-change',
      participantsTotal: event.attendees.length,
      contactsEnriched: 0,
      errors: [],
    };
  }

  // Map vers fiche vault
  const entry = mapEventToReunion(event);
  if (!entry) {
    return {
      eventId: event.id,
      summary: event.summary,
      date: '',
      op: 'skipped',
      participantsTotal: event.attendees.length,
      contactsEnriched: 0,
      errors: ['mapEventToReunion null (date invalide)'],
    };
  }

  if (dryRun) {
    return {
      eventId: event.id,
      summary: event.summary,
      date: entry.date,
      vaultPath: `${entry.folderPath}/${entry.filename}.md`,
      op: 'reunion-created',
      participantsTotal: event.attendees.length,
      contactsEnriched: 0,
      errors: [],
    };
  }

  // Écrire fiche vault
  const writeResult = await deps.writer(entry, `calendar-ingest:${event.id}`);
  if (!writeResult.success) {
    return {
      eventId: event.id,
      summary: event.summary,
      date: entry.date,
      op: 'error',
      participantsTotal: event.attendees.length,
      contactsEnriched: 0,
      errors: [writeResult.error ?? 'writeReunion échec'],
    };
  }

  // Enrichir contacts
  let enrichResults: Awaited<ReturnType<typeof deps.enricher>> = [];
  try {
    enrichResults = await deps.enricher(event, entry.date, entry.sujet);
  } catch (err) {
    enrichResults = [];
    console.warn(
      `[calendar-ingest] enrichContacts erreur event=${event.id} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const contactsEnriched = countEnriched(enrichResults);

  // Update state
  state.processedEvents[event.id] = {
    lastSeenUpdated: event.updated,
    vaultPath: writeResult.vaultPath ?? `${entry.folderPath}/${entry.filename}.md`,
    date: entry.date,
  };

  const op =
    writeResult.op === 'created'
      ? ('reunion-created' as const)
      : writeResult.op === 'updated'
        ? ('reunion-updated' as const)
        : ('no-change' as const);

  const result: CalendarIngestResult = {
    eventId: event.id,
    summary: event.summary,
    date: entry.date,
    vaultPath: writeResult.vaultPath,
    op,
    participantsTotal: event.attendees.length,
    contactsEnriched,
    errors: [],
  };

  await deps.auditLogger(result);

  return result;
}

function updateStatsFromResult(
  stats: CalendarIngestStats,
  result: CalendarIngestResult,
): void {
  stats.eventsProcessed++;
  switch (result.op) {
    case 'reunion-created':
      stats.reunionsCreated++;
      break;
    case 'reunion-updated':
      stats.reunionsUpdated++;
      break;
    case 'reunion-cancelled':
      stats.reunionsUpdated++;
      break;
    case 'skipped':
    case 'no-change':
      stats.skipped++;
      break;
    case 'error':
      stats.errors++;
      break;
  }
  stats.contactsEnriched += result.contactsEnriched;
}
