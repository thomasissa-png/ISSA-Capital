/**
 * Tests event-mapper — projection CalendarEvent + détection projet (refonte S23).
 */

import { describe, it, expect } from 'vitest';
import {
  mapEventToProjection,
  detectProjectFromEvent,
  isEventTodoEligible,
  extractDate,
  extractHeure,
  extractDuree,
  partitionAttendees,
  isSystemEmail,
} from '../event-mapper';
import type { CalendarEvent } from '../types';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt_test_001',
    status: 'confirmed',
    htmlLink: 'https://calendar.google.com/event?eid=evt_test_001',
    updated: '2026-05-19T10:00:00Z',
    summary: 'Point Versi Immobilier',
    description: 'Discussion avancement plateforme',
    startDateTime: '2026-05-22T14:00:00+02:00',
    endDateTime: '2026-05-22T15:00:00+02:00',
    timeZone: 'Europe/Paris',
    attendees: [
      { email: 'thomas@issa-capital.com', self: true, organizer: true },
      { email: 'maxime@versi.com', displayName: 'Maxime Durand' },
    ],
    isAllDay: false,
    ...overrides,
  };
}

describe('isSystemEmail', () => {
  it('détecte noreply et notifications', () => {
    expect(isSystemEmail('noreply@google.com')).toBe(true);
    expect(isSystemEmail('notifications@calendar.google.com')).toBe(true);
    expect(isSystemEmail('calendar-notification@google.com')).toBe(true);
  });

  it('détecte resource.calendar.google.com', () => {
    expect(isSystemEmail('paris-room-a@resource.calendar.google.com')).toBe(true);
  });

  it('ignore les vrais emails', () => {
    expect(isSystemEmail('thomas@issa-capital.com')).toBe(false);
    expect(isSystemEmail('maxime@versi.com')).toBe(false);
  });
});

describe('extractDate / extractHeure / extractDuree', () => {
  it('extrait date YYYY-MM-DD depuis startDateTime ISO', () => {
    expect(extractDate(makeEvent())).toBe('2026-05-22');
  });

  it('extrait date depuis startDate (all-day)', () => {
    const ev = makeEvent({
      startDate: '2026-06-01',
      startDateTime: undefined,
      isAllDay: true,
    });
    expect(extractDate(ev)).toBe('2026-06-01');
  });

  it('extrait heure HH:MM', () => {
    expect(extractHeure(makeEvent())).toBe('14:00');
  });

  it('retourne undefined pour all-day', () => {
    const ev = makeEvent({
      isAllDay: true,
      startDate: '2026-06-01',
      startDateTime: undefined,
    });
    expect(extractHeure(ev)).toBeUndefined();
  });

  it('calcule durée en minutes', () => {
    expect(extractDuree(makeEvent())).toBe(60);
  });

  it('calcule durée correctement pour 90 minutes', () => {
    const ev = makeEvent({
      startDateTime: '2026-05-22T14:00:00+02:00',
      endDateTime: '2026-05-22T15:30:00+02:00',
    });
    expect(extractDuree(ev)).toBe(90);
  });
});

describe('partitionAttendees', () => {
  it('sépare self et others', () => {
    const { others, self } = partitionAttendees(makeEvent());
    expect(self?.email).toBe('thomas@issa-capital.com');
    expect(others).toHaveLength(1);
    expect(others[0]!.email).toBe('maxime@versi.com');
  });

  it('exclut emails système', () => {
    const ev = makeEvent({
      attendees: [
        { email: 'thomas@issa-capital.com', self: true },
        { email: 'maxime@versi.com' },
        { email: 'paris-room@resource.calendar.google.com' },
        { email: 'noreply@google.com' },
      ],
    });
    const { others } = partitionAttendees(ev);
    expect(others).toHaveLength(1);
    expect(others[0]!.email).toBe('maxime@versi.com');
  });
});

describe('detectProjectFromEvent', () => {
  it('détecte 1 projet via le titre (Versi Immobilier → VI)', () => {
    const ev = makeEvent({ summary: 'Point Versi Immobilier', description: '' });
    expect(detectProjectFromEvent(ev)).toEqual(['VI']);
  });

  it('détecte ISSA Capital (IC) insensible à la casse + accents', () => {
    const ev = makeEvent({ summary: 'Réunion issa capital Q3', description: '' });
    expect(detectProjectFromEvent(ev)).toEqual(['IC']);
  });

  it('détecte Versimo (VM) sans matcher Versi Immobilier', () => {
    const ev = makeEvent({ summary: 'Démo Versimo', description: '' });
    expect(detectProjectFromEvent(ev)).toEqual(['VM']);
  });

  it('retourne 2+ codes triés si ambigu (Versi Immobilier + Gradient)', () => {
    const ev = makeEvent({
      summary: 'Sync Versi Immobilier et Gradient One',
      description: '',
    });
    expect(detectProjectFromEvent(ev)).toEqual(['GO', 'VI']);
  });

  it('retourne [] si aucun match', () => {
    const ev = makeEvent({ summary: 'Déjeuner équipe', description: 'cantine' });
    expect(detectProjectFromEvent(ev)).toEqual([]);
  });

  it('match aussi via la description', () => {
    const ev = makeEvent({ summary: 'Point hebdo', description: 'sujet : Immocrew' });
    expect(detectProjectFromEvent(ev)).toEqual(['IM']);
  });
});

describe('mapEventToProjection', () => {
  it('projette date/heure/durée/sujet + projets détectés', () => {
    const p = mapEventToProjection(makeEvent());
    expect(p).not.toBeNull();
    expect(p!.date).toBe('2026-05-22');
    expect(p!.heure).toBe('14:00');
    expect(p!.duree).toBe(60);
    expect(p!.sujet).toBe('Point Versi Immobilier');
    expect(p!.projectCodes).toEqual(['VI']);
  });

  it('lieu = Google Meet si hangoutLink', () => {
    const p = mapEventToProjection(
      makeEvent({ hangoutLink: 'https://meet.google.com/abc' }),
    );
    expect(p!.lieu).toBe('Online (Google Meet)');
  });

  it('retourne null si pas de date exploitable', () => {
    const ev = makeEvent({ startDateTime: undefined, startDate: undefined });
    expect(mapEventToProjection(ev)).toBeNull();
  });
});

describe('isEventTodoEligible', () => {
  it('event timed avec participant externe → éligible', () => {
    expect(isEventTodoEligible(makeEvent())).toBe(true);
  });

  it('event récurrent → exclu', () => {
    expect(isEventTodoEligible(makeEvent({ recurringEventId: 'rec_1' }))).toBe(false);
  });

  it('event all-day → exclu', () => {
    const ev = makeEvent({
      isAllDay: true,
      startDate: '2026-06-01',
      startDateTime: undefined,
    });
    expect(isEventTodoEligible(ev)).toBe(false);
  });

  it('event perso (0 participant externe) → exclu', () => {
    const ev = makeEvent({
      attendees: [{ email: 'thomas@issa-capital.com', self: true }],
    });
    expect(isEventTodoEligible(ev)).toBe(false);
  });
});
