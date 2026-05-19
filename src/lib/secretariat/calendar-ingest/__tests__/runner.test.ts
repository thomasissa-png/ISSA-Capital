/**
 * Tests runner — E2E avec mocks complets.
 *
 * Vérifie :
 *   - Stats correctes (created / updated / skipped / errors)
 *   - Idempotence (event.updated inchangé → no-change)
 *   - State persistence (processedEvents mis à jour)
 *   - Audit JSONL appelé
 *   - Events cancelled → reunion-cancelled
 *   - dryRun ne sauve pas state
 */

import { describe, it, expect, vi } from 'vitest';
import { runCalendarIngest } from '../runner';
import type { CalendarEvent, CalendarIngestState } from '../types';
import { emptyCalendarIngestState } from '../types';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: `evt_${Math.random().toString(36).slice(2, 8)}`,
    status: 'confirmed',
    htmlLink: 'https://calendar.google.com/event?eid=test',
    updated: '2026-05-19T10:00:00Z',
    summary: 'Réunion test',
    startDateTime: '2026-05-22T14:00:00+02:00',
    endDateTime: '2026-05-22T15:00:00+02:00',
    attendees: [{ email: 'thomas@i.com', self: true }],
    isAllDay: false,
    ...overrides,
  };
}

describe('runCalendarIngest — E2E mocké', () => {
  it('traite 3 events nouveaux → 3 created + audit appelé 3x', async () => {
    const events = [
      makeEvent({ id: 'evt_001', summary: 'Point A' }),
      makeEvent({ id: 'evt_002', summary: 'Point B' }),
      makeEvent({ id: 'evt_003', summary: 'Point C' }),
    ];

    const state: CalendarIngestState = emptyCalendarIngestState();

    const writer = vi.fn().mockResolvedValue({
      success: true,
      op: 'created',
      vaultPath: '06. Réunions/2026/05/test.md',
    });
    const enricher = vi.fn().mockResolvedValue([]);
    const audit = vi.fn().mockResolvedValue(true);

    const { stats, results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue(events),
      _writeReunion: writer,
      _enrichContacts: enricher,
      _appendAudit: audit,
      _loadState: vi.fn().mockResolvedValue(state),
      _saveState: vi.fn().mockResolvedValue(true),
    });

    expect(stats.eventsFetched).toBe(3);
    expect(stats.eventsProcessed).toBe(3);
    expect(stats.reunionsCreated).toBe(3);
    expect(stats.errors).toBe(0);
    expect(writer).toHaveBeenCalledTimes(3);
    expect(audit).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(3);
    expect(state.processedEvents['evt_001']).toBeDefined();
    expect(state.processedEvents['evt_002']).toBeDefined();
    expect(state.processedEvents['evt_003']).toBeDefined();
  });

  it('idempotence : event avec updated identique → no-change, pas de writer', async () => {
    const event = makeEvent({ id: 'evt_idem', updated: '2026-05-19T10:00:00Z' });
    const state: CalendarIngestState = {
      version: 1,
      lastSync: '2026-05-19T09:00:00Z',
      processedEvents: {
        evt_idem: {
          lastSeenUpdated: '2026-05-19T10:00:00Z',
          vaultPath: '06. Réunions/2026/05/Test.md',
          date: '2026-05-22',
        },
      },
    };

    const writer = vi.fn();
    const { stats, results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      _writeReunion: writer,
      _enrichContacts: vi.fn().mockResolvedValue([]),
      _appendAudit: vi.fn().mockResolvedValue(true),
      _loadState: vi.fn().mockResolvedValue(state),
      _saveState: vi.fn().mockResolvedValue(true),
    });

    expect(stats.reunionsCreated).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(writer).not.toHaveBeenCalled();
    expect(results[0]!.op).toBe('no-change');
  });

  it('event modifié (updated different) → reunion-updated', async () => {
    const event = makeEvent({ id: 'evt_mod', updated: '2026-05-19T15:00:00Z' });
    const state: CalendarIngestState = {
      version: 1,
      lastSync: '2026-05-19T09:00:00Z',
      processedEvents: {
        evt_mod: {
          lastSeenUpdated: '2026-05-19T10:00:00Z', // ancien
          vaultPath: '06. Réunions/2026/05/Test.md',
          date: '2026-05-22',
        },
      },
    };

    const writer = vi.fn().mockResolvedValue({
      success: true,
      op: 'updated',
      vaultPath: '06. Réunions/2026/05/Test.md',
    });

    const { stats } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      _writeReunion: writer,
      _enrichContacts: vi.fn().mockResolvedValue([]),
      _appendAudit: vi.fn().mockResolvedValue(true),
      _loadState: vi.fn().mockResolvedValue(state),
      _saveState: vi.fn().mockResolvedValue(true),
    });

    expect(stats.reunionsUpdated).toBe(1);
    expect(writer).toHaveBeenCalledOnce();
  });

  it('event cancelled connu → reunion-cancelled', async () => {
    const event = makeEvent({
      id: 'evt_cancel',
      status: 'cancelled',
      summary: 'Annulée',
    });
    const state: CalendarIngestState = {
      version: 1,
      lastSync: null,
      processedEvents: {
        evt_cancel: {
          lastSeenUpdated: '2026-05-18T10:00:00Z',
          vaultPath: '06. Réunions/2026/05/Annulee.md',
          date: '2026-05-22',
        },
      },
    };

    const writer = vi.fn();
    const { stats, results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      _writeReunion: writer,
      _enrichContacts: vi.fn().mockResolvedValue([]),
      _appendAudit: vi.fn().mockResolvedValue(true),
      _loadState: vi.fn().mockResolvedValue(state),
      _saveState: vi.fn().mockResolvedValue(true),
    });

    // reunion-cancelled compte dans reunionsUpdated (cf. updateStatsFromResult)
    expect(stats.reunionsUpdated).toBe(1);
    expect(writer).not.toHaveBeenCalled();
    expect(results[0]!.op).toBe('reunion-cancelled');
  });

  it('event cancelled inconnu → skipped (rien à faire)', async () => {
    const event = makeEvent({
      id: 'evt_cancel_unknown',
      status: 'cancelled',
    });
    const state = emptyCalendarIngestState();

    const { stats, results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      _writeReunion: vi.fn(),
      _enrichContacts: vi.fn().mockResolvedValue([]),
      _appendAudit: vi.fn().mockResolvedValue(true),
      _loadState: vi.fn().mockResolvedValue(state),
      _saveState: vi.fn().mockResolvedValue(true),
    });

    expect(stats.skipped).toBe(1);
    expect(results[0]!.op).toBe('skipped');
  });

  it('contacts enrichis comptés dans stats', async () => {
    const event = makeEvent({
      id: 'evt_enrich',
      attendees: [
        { email: 'thomas@i.com', self: true },
        { email: 'max@v.com', displayName: 'Maxime' },
        { email: 'leo@v.com', displayName: 'Léo' },
      ],
    });

    const { stats } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      _writeReunion: vi.fn().mockResolvedValue({
        success: true,
        op: 'created',
        vaultPath: 'x.md',
      }),
      _enrichContacts: vi.fn().mockResolvedValue([
        { email: 'max@v.com', status: 'enriched', contactPath: 'a.md' },
        { email: 'leo@v.com', status: 'enriched', contactPath: 'b.md' },
      ]),
      _appendAudit: vi.fn().mockResolvedValue(true),
      _loadState: vi.fn().mockResolvedValue(emptyCalendarIngestState()),
      _saveState: vi.fn().mockResolvedValue(true),
    });

    expect(stats.contactsEnriched).toBe(2);
  });

  it('writer error → stats.errors incrémenté', async () => {
    const event = makeEvent({ id: 'evt_err' });
    const writer = vi.fn().mockResolvedValue({
      success: false,
      op: 'error',
      error: 'Drive timeout',
    });

    const { stats, results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      _writeReunion: writer,
      _enrichContacts: vi.fn().mockResolvedValue([]),
      _appendAudit: vi.fn().mockResolvedValue(true),
      _loadState: vi.fn().mockResolvedValue(emptyCalendarIngestState()),
      _saveState: vi.fn().mockResolvedValue(true),
    });

    expect(stats.errors).toBe(1);
    expect(results[0]!.op).toBe('error');
    expect(results[0]!.errors).toContain('Drive timeout');
  });

  it('dryRun ne sauve pas state', async () => {
    const event = makeEvent({ id: 'evt_dry' });
    const saveState = vi.fn().mockResolvedValue(true);

    const { stateSaved } = await runCalendarIngest({
      dryRun: true,
      _calendarClient: vi.fn().mockResolvedValue([event]),
      _writeReunion: vi.fn(),
      _enrichContacts: vi.fn(),
      _appendAudit: vi.fn(),
      _loadState: vi.fn().mockResolvedValue(emptyCalendarIngestState()),
      _saveState: saveState,
    });

    expect(saveState).not.toHaveBeenCalled();
    expect(stateSaved).toBe(false);
  });

  it('fetch erreur → stats.errors = 1, retour gracieux', async () => {
    const { stats } = await runCalendarIngest({
      _calendarClient: vi.fn().mockRejectedValue(new Error('Network down')),
      _writeReunion: vi.fn(),
      _enrichContacts: vi.fn(),
      _appendAudit: vi.fn(),
      _loadState: vi.fn().mockResolvedValue(emptyCalendarIngestState()),
      _saveState: vi.fn().mockResolvedValue(true),
    });

    expect(stats.errors).toBe(1);
    expect(stats.eventsFetched).toBe(0);
  });
});
