/**
 * Tests event-mapper — mapping CalendarEvent → ReunionVaultEntry.
 */

import { describe, it, expect } from 'vitest';
import {
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
} from '../event-mapper';
import type { CalendarEvent } from '../types';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt_test_001',
    status: 'confirmed',
    htmlLink: 'https://calendar.google.com/event?eid=evt_test_001',
    updated: '2026-05-19T10:00:00Z',
    summary: 'Point Versi',
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

describe('attendeeToName', () => {
  it('utilise displayName si présent', () => {
    expect(
      attendeeToName({ email: 'm@x.com', displayName: 'Marie Dubois' }),
    ).toBe('Marie Dubois');
  });

  it('extrait prénom du local-part sinon', () => {
    expect(attendeeToName({ email: 'thomas.issa@example.com' })).toBe(
      'Thomas Issa',
    );
    expect(attendeeToName({ email: 'jean-marc@example.com' })).toBe('Jean Marc');
  });
});

describe('buildParticipantsForFilename', () => {
  it('liste les prénoms séparés par virgules', () => {
    const result = buildParticipantsForFilename([
      { email: 'maxime@v.com', displayName: 'Maxime Durand' },
      { email: 'leo@v.com', displayName: 'Léo Martin' },
    ]);
    expect(result).toBe('Maxime, Léo');
  });

  it('tronque au-delà de 3 + suffixe +N', () => {
    const result = buildParticipantsForFilename([
      { email: 'a@x.com', displayName: 'Alice Aa' },
      { email: 'b@x.com', displayName: 'Bob Bb' },
      { email: 'c@x.com', displayName: 'Carol Cc' },
      { email: 'd@x.com', displayName: 'Dave Dd' },
      { email: 'e@x.com', displayName: 'Eve Ee' },
    ]);
    expect(result).toBe('Alice, Bob, Carol +2');
  });

  it('retourne chaîne vide si pas de participants', () => {
    expect(buildParticipantsForFilename([])).toBe('');
  });
});

describe('buildParticipantsFrontmatter', () => {
  it('inclut self en premier en wikilink', () => {
    const result = buildParticipantsFrontmatter(
      [{ email: 'maxime@v.com', displayName: 'Maxime Durand' }],
      { email: 'thomas@i.com', displayName: 'Thomas Issa' },
    );
    expect(result).toEqual(['[[Thomas Issa]]', '[[Maxime Durand]]']);
  });
});

describe('mapEventToReunion', () => {
  it('mappe un event standard', () => {
    const entry = mapEventToReunion(makeEvent());
    expect(entry).not.toBeNull();
    expect(entry!.date).toBe('2026-05-22');
    expect(entry!.heure).toBe('14:00');
    expect(entry!.duree).toBe(60);
    expect(entry!.folderPath).toBe('06. Réunions/2026/05');
    expect(entry!.filename).toContain('2026-05-22');
    expect(entry!.filename).toContain('Maxime');
    expect(entry!.filename).toContain('Point Versi');
    expect(entry!.googleEventId).toBe('evt_test_001');
    expect(entry!.categorie).toBe('meeting');
  });

  it('retourne null si pas de date', () => {
    const ev = makeEvent({
      startDate: undefined,
      startDateTime: undefined,
    });
    expect(mapEventToReunion(ev)).toBeNull();
  });

  it('utilise hangoutLink pour lieu Online', () => {
    const ev = makeEvent({
      hangoutLink: 'https://meet.google.com/abc-defg-hij',
    });
    const entry = mapEventToReunion(ev);
    expect(entry!.lieu).toBe('Online (Google Meet)');
  });

  it('utilise location si pas de hangout', () => {
    const ev = makeEvent({
      location: '12 rue de la Paix, Paris',
      hangoutLink: undefined,
    });
    const entry = mapEventToReunion(ev);
    expect(entry!.lieu).toBe('12 rue de la Paix, Paris');
  });

  it('gère event all-day', () => {
    const ev = makeEvent({
      isAllDay: true,
      startDate: '2026-07-04',
      endDate: '2026-07-05',
      startDateTime: undefined,
      endDateTime: undefined,
    });
    const entry = mapEventToReunion(ev);
    expect(entry!.date).toBe('2026-07-04');
    expect(entry!.heure).toBeUndefined();
    expect(entry!.duree).toBeUndefined();
  });

  it('slugifie les accents dans le filename', () => {
    const ev = makeEvent({
      summary: 'Réunion sécurité confidentielle',
      attendees: [
        { email: 'thomas@i.com', self: true },
        { email: 'helene@i.com', displayName: 'Hélène Müller' },
      ],
    });
    const entry = mapEventToReunion(ev);
    // Diacritiques retirés (NFD + filtre)
    expect(entry!.filename).not.toMatch(/[éèêëàâäîïôöûüç]/);
    expect(entry!.filename).toContain('Helene');
    expect(entry!.filename).toContain('Reunion securite');
  });

  it('gère event sans participants (just Thomas)', () => {
    const ev = makeEvent({
      attendees: [{ email: 'thomas@i.com', self: true }],
    });
    const entry = mapEventToReunion(ev);
    expect(entry).not.toBeNull();
    expect(entry!.filename).toContain('Point Versi');
  });
});

describe('serializeReunionMarkdown', () => {
  it('génère un Markdown avec frontmatter YAML valide', () => {
    const entry = mapEventToReunion(makeEvent())!;
    const md = serializeReunionMarkdown(entry);
    expect(md).toContain('---\ntype: reunion\n');
    expect(md).toContain('date: 2026-05-22');
    expect(md).toContain('heure: 14:00');
    expect(md).toContain('duree: 60');
    expect(md).toContain('participants:');
    // self n'a pas de displayName dans makeEvent → fallback local-part = "Thomas"
    expect(md).toContain('[[Thomas]]');
    expect(md).toContain('[[Maxime Durand]]');
    expect(md).toContain('categorie: meeting');
    expect(md).toContain('google_calendar_event_id: evt_test_001');
    expect(md).toContain('## Notes');
  });

  it('est idempotent — sérialiser 2x produit le même output', () => {
    const entry = mapEventToReunion(makeEvent())!;
    const md1 = serializeReunionMarkdown(entry);
    const md2 = serializeReunionMarkdown(entry);
    expect(md1).toBe(md2);
  });

  it('omet heure et duree pour all-day', () => {
    const ev = makeEvent({
      isAllDay: true,
      startDate: '2026-07-04',
      startDateTime: undefined,
      endDateTime: undefined,
    });
    const entry = mapEventToReunion(ev)!;
    const md = serializeReunionMarkdown(entry);
    expect(md).not.toContain('heure:');
    expect(md).not.toContain('duree:');
  });

  it('inclut la description en section dédiée', () => {
    const entry = mapEventToReunion(makeEvent())!;
    const md = serializeReunionMarkdown(entry);
    expect(md).toContain('## Description');
    expect(md).toContain('Discussion avancement plateforme');
  });
});
