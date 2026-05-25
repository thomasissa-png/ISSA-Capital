/**
 * Tests runner — E2E avec mocks complets (refonte S23).
 *
 * Vérifie :
 *   - Orchestration contacts + projet + todo
 *   - Idempotence (event.updated inchangé → no-change ; replan → update todo)
 *   - Fix racine : event marqué traité même sans fiche (plus de boucle infinie)
 *   - Ambiguïté projet → carte Telegram, historique NON écrit
 *   - Exclusions todo (récurrent / all-day / perso)
 *   - Erreurs loggées par event (logging #2), pas avalées
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
    attendees: [
      { email: 'thomas@i.com', self: true },
      { email: 'max@v.com', displayName: 'Maxime' },
    ],
    isAllDay: false,
    ...overrides,
  };
}

/** Deps par défaut (tous mockés, zéro réseau). */
function deps(over: Record<string, unknown> = {}) {
  return {
    _enrichContacts: vi.fn().mockResolvedValue([]),
    _enrichProjet: vi.fn().mockResolvedValue({ code: 'VI', status: 'enriched', ficheName: 'Versi Immobilier' }),
    _createTodo: vi.fn().mockResolvedValue({ status: 'created', todoId: 'tt_1' }),
    _findProjetFiche: vi.fn().mockResolvedValue({
      fileId: 'f1',
      ficheName: 'Versi Immobilier',
      resolvedFilename: 'Versi Immobilier.md',
      folderPath: '02. Projets/02. Pro',
    }),
    _sendCalProjetCard: vi.fn().mockResolvedValue(true),
    _appendAudit: vi.fn().mockResolvedValue(true),
    _loadState: vi.fn().mockResolvedValue(emptyCalendarIngestState()),
    _saveState: vi.fn().mockResolvedValue(true),
    ...over,
  };
}

describe('runCalendarIngest — E2E mocké (S23)', () => {
  it('event 2 contacts pro + titre projet VI → contacts + historique VI + todo', async () => {
    const event = makeEvent({
      id: 'evt_full',
      summary: 'Point Versi Immobilier',
      attendees: [
        { email: 'thomas@i.com', self: true },
        { email: 'max@v.com', displayName: 'Maxime' },
        { email: 'leo@v.com', displayName: 'Léo' },
      ],
    });
    const state = emptyCalendarIngestState();
    const enrichContacts = vi.fn().mockResolvedValue([
      { email: 'max@v.com', status: 'enriched', contactPath: 'a.md' },
      { email: 'leo@v.com', status: 'enriched', contactPath: 'b.md' },
    ]);
    const enrichProjet = vi
      .fn()
      .mockResolvedValue({ code: 'VI', status: 'enriched', ficheName: 'Versi Immobilier' });
    const createTodo = vi.fn().mockResolvedValue({ status: 'created', todoId: 'tt_42' });

    const { stats, results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      ...deps({
        _enrichContacts: enrichContacts,
        _enrichProjet: enrichProjet,
        _createTodo: createTodo,
        _loadState: vi.fn().mockResolvedValue(state),
      }),
    });

    expect(stats.eventsProcessed).toBe(1);
    expect(stats.contactsEnriched).toBe(2);
    expect(stats.projectsEnriched).toBe(1);
    expect(stats.todosCreated).toBe(1);
    expect(stats.errors).toBe(0);
    expect(enrichProjet).toHaveBeenCalledWith('VI', expect.any(Object), 'evt_full');
    expect(results[0]!.op).toBe('processed');
    expect(results[0]!.projectsEnriched).toEqual(['VI']);
    expect(results[0]!.todoCreated).toBe(true);
    // Fix racine : event marqué traité avec todoId.
    expect(state.processedEvents['evt_full']).toBeDefined();
    expect(state.processedEvents['evt_full']!.todoId).toBe('tt_42');
    expect(state.processedEvents['evt_full']!.projectsEnriched).toEqual(['VI']);
  });

  it('idempotence : event.updated identique → no-change, aucun travail', async () => {
    const event = makeEvent({ id: 'evt_idem', updated: '2026-05-19T10:00:00Z' });
    const state: CalendarIngestState = {
      version: 1,
      lastSync: '2026-05-19T09:00:00Z',
      processedEvents: {
        evt_idem: {
          lastSeenUpdated: '2026-05-19T10:00:00Z',
          processedAt: '2026-05-19T10:01:00Z',
          date: '2026-05-22',
          contactsEnriched: [],
          projectsEnriched: [],
          todoId: 'tt_old',
        },
      },
    };
    const enrichContacts = vi.fn();
    const createTodo = vi.fn();

    const { stats, results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      ...deps({
        _enrichContacts: enrichContacts,
        _createTodo: createTodo,
        _loadState: vi.fn().mockResolvedValue(state),
      }),
    });

    expect(stats.skipped).toBe(1);
    expect(results[0]!.op).toBe('no-change');
    expect(enrichContacts).not.toHaveBeenCalled();
    expect(createTodo).not.toHaveBeenCalled();
  });

  it('event replanifié (updated différent) → todo réutilisé en update', async () => {
    const event = makeEvent({ id: 'evt_replan', updated: '2026-05-20T11:00:00Z' });
    const state: CalendarIngestState = {
      version: 1,
      lastSync: null,
      processedEvents: {
        evt_replan: {
          lastSeenUpdated: '2026-05-19T10:00:00Z',
          processedAt: '2026-05-19T10:01:00Z',
          date: '2026-05-22',
          contactsEnriched: [],
          projectsEnriched: [],
          todoId: 'tt_existing',
        },
      },
    };
    const createTodo = vi.fn().mockResolvedValue({ status: 'updated', todoId: 'tt_existing' });

    const { stats } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      ...deps({
        _createTodo: createTodo,
        _loadState: vi.fn().mockResolvedValue(state),
      }),
    });

    expect(stats.todosCreated).toBe(1);
    // 3e argument = existingTodoId réutilisé (event sans projet → projectName undefined).
    expect(createTodo).toHaveBeenCalledWith(expect.any(Object), undefined, 'tt_existing');
  });

  it('projet ambigu (2 matchs) → carte Telegram, historique NON écrit', async () => {
    const event = makeEvent({
      id: 'evt_ambig',
      summary: 'Sync Versi Immobilier et Gradient One',
    });
    const enrichProjet = vi.fn();
    const sendCard = vi.fn().mockResolvedValue(true);

    const { stats, results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      ...deps({
        _enrichProjet: enrichProjet,
        _sendCalProjetCard: sendCard,
      }),
    });

    expect(stats.projectsAmbiguous).toBe(1);
    expect(stats.projectsEnriched).toBe(0);
    expect(enrichProjet).not.toHaveBeenCalled();
    expect(sendCard).toHaveBeenCalledOnce();
    expect(results[0]!.projectAmbiguous).toBe(true);
    // todo créé quand même (event éligible).
    expect(results[0]!.todoCreated).toBe(true);
  });

  it('event récurrent → contacts oui, todo NON', async () => {
    const event = makeEvent({ id: 'evt_rec', recurringEventId: 'rec_root' });
    const createTodo = vi.fn();
    const enrichContacts = vi
      .fn()
      .mockResolvedValue([{ email: 'max@v.com', status: 'enriched' }]);

    const { stats, results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      ...deps({ _createTodo: createTodo, _enrichContacts: enrichContacts }),
    });

    expect(createTodo).not.toHaveBeenCalled();
    expect(stats.todosCreated).toBe(0);
    expect(stats.contactsEnriched).toBe(1);
    expect(results[0]!.op).toBe('processed');
  });

  it('event perso (0 participant externe) → pas de todo', async () => {
    const event = makeEvent({
      id: 'evt_perso',
      attendees: [{ email: 'thomas@i.com', self: true }],
    });
    const createTodo = vi.fn();

    const { stats } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      ...deps({ _createTodo: createTodo }),
    });

    expect(createTodo).not.toHaveBeenCalled();
    expect(stats.todosCreated).toBe(0);
  });

  it('event cancelled connu → cancelled, jamais vu → skipped', async () => {
    const known = makeEvent({ id: 'evt_c_known', status: 'cancelled' });
    const unknown = makeEvent({ id: 'evt_c_unknown', status: 'cancelled' });
    const state: CalendarIngestState = {
      version: 1,
      lastSync: null,
      processedEvents: {
        evt_c_known: {
          lastSeenUpdated: '2026-05-18T10:00:00Z',
          processedAt: '2026-05-18T10:01:00Z',
          date: '2026-05-22',
          contactsEnriched: [],
          projectsEnriched: [],
        },
      },
    };

    const { results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([known, unknown]),
      ...deps({ _loadState: vi.fn().mockResolvedValue(state) }),
    });

    expect(results.find((r) => r.eventId === 'evt_c_known')!.op).toBe('cancelled');
    expect(results.find((r) => r.eventId === 'evt_c_unknown')!.op).toBe('skipped');
  });

  it('fix racine : enrichProjet échoue → event quand même marqué traité + erreur loggée', async () => {
    const event = makeEvent({ id: 'evt_fail', summary: 'Point Versi Immobilier' });
    const state = emptyCalendarIngestState();
    const enrichProjet = vi
      .fn()
      .mockResolvedValue({ code: 'VI', status: 'error', error: 'Drive timeout' });

    const { stats, results } = await runCalendarIngest({
      _calendarClient: vi.fn().mockResolvedValue([event]),
      ...deps({
        _enrichProjet: enrichProjet,
        _loadState: vi.fn().mockResolvedValue(state),
      }),
    });

    // Erreur remontée (logging #2) mais event marqué traité → pas de re-tentative infinie.
    expect(results[0]!.errors.some((e) => e.includes('Drive timeout'))).toBe(true);
    expect(stats.errors).toBeGreaterThan(0);
    expect(state.processedEvents['evt_fail']).toBeDefined();
    expect(state.processedEvents['evt_fail']!.lastSeenUpdated).toBe(event.updated);
  });

  it('dryRun ne sauve pas state + n\'écrit rien', async () => {
    const event = makeEvent({ id: 'evt_dry', summary: 'Point Versi Immobilier' });
    const saveState = vi.fn().mockResolvedValue(true);
    const createTodo = vi.fn();
    const enrichProjet = vi.fn();

    const { stateSaved } = await runCalendarIngest({
      dryRun: true,
      _calendarClient: vi.fn().mockResolvedValue([event]),
      ...deps({
        _saveState: saveState,
        _createTodo: createTodo,
        _enrichProjet: enrichProjet,
      }),
    });

    expect(saveState).not.toHaveBeenCalled();
    expect(stateSaved).toBe(false);
    expect(createTodo).not.toHaveBeenCalled();
    expect(enrichProjet).not.toHaveBeenCalled();
  });

  it('fetch erreur → stats.errors = 1, retour gracieux', async () => {
    const { stats } = await runCalendarIngest({
      _calendarClient: vi.fn().mockRejectedValue(new Error('Network down')),
      ...deps(),
    });

    expect(stats.errors).toBe(1);
    expect(stats.eventsFetched).toBe(0);
  });
});
