/**
 * Tests `collect-calendar.ts` — mapping events, participants, tri. calendar-source mocké.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  listCalendarEvents: vi.fn(),
}));

vi.mock('../../calendar-ingest/calendar-source', () => ({
  listCalendarEvents: mocks.listCalendarEvents,
}));

import { collectCalendar } from '../collect-calendar';

const START = '2026-07-14T22:00:00.000Z';
const END = '2026-07-15T21:59:59.999Z';

function event(over: Partial<Record<string, unknown>>) {
  return {
    id: 'e',
    status: 'confirmed',
    htmlLink: '',
    updated: '2026-07-15T00:00:00Z',
    summary: 'Réunion',
    attendees: [],
    isAllDay: false,
    ...over,
  };
}

describe('collectCalendar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mappe heure Paris + titre + participants hors self', async () => {
    mocks.listCalendarEvents.mockResolvedValue([
      event({
        summary: 'Point équipe',
        startDateTime: '2026-07-15T08:00:00Z', // 10:00 Paris
        attendees: [
          { email: 'thomas@x.com', self: true },
          { email: 'a@x.com', displayName: 'Alice' },
          { email: 'b@x.com' },
        ],
      }),
    ]);
    const res = await collectCalendar(START, END);
    expect(res.events).toHaveLength(1);
    expect(res.events[0]!.time).toBe('10:00');
    expect(res.events[0]!.title).toBe('Point équipe');
    expect(res.events[0]!.attendees).toEqual(['Alice', 'b@x.com']);
  });

  it('exclut les events annulés', async () => {
    mocks.listCalendarEvents.mockResolvedValue([
      event({ status: 'cancelled', summary: 'Annulé' }),
      event({ summary: 'OK', startDateTime: '2026-07-15T08:00:00Z' }),
    ]);
    const res = await collectCalendar(START, END);
    expect(res.events.map((e) => e.title)).toEqual(['OK']);
  });

  it('event all-day → time null, placé en premier', async () => {
    mocks.listCalendarEvents.mockResolvedValue([
      event({ summary: 'Réunion 14h', startDateTime: '2026-07-15T12:00:00Z' }),
      event({ summary: 'Congé', isAllDay: true, startDate: '2026-07-15', startDateTime: undefined }),
    ]);
    const res = await collectCalendar(START, END);
    expect(res.events[0]!.title).toBe('Congé');
    expect(res.events[0]!.time).toBeNull();
  });

  it('aucun event → liste vide', async () => {
    mocks.listCalendarEvents.mockResolvedValue([]);
    const res = await collectCalendar(START, END);
    expect(res.events).toEqual([]);
  });
});
