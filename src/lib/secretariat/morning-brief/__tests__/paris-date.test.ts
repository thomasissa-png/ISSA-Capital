/**
 * Tests `paris-date.ts` — bornes du jour Paris, DST-safe (R8). Pas de mock.
 */

import { describe, it, expect } from 'vitest';
import { getParisDayBounds, formatParisTime, getParisHour } from '../paris-date';

describe('getParisHour — DST-safe (garde-fou 7h du brief)', () => {
  it('été (CEST) : 05:00 UTC = 7h Paris', () => {
    expect(getParisHour(new Date('2026-07-15T05:00:00Z'))).toBe(7);
  });
  it('été (CEST) : 06:00 UTC = 8h Paris (occurrence skippée)', () => {
    expect(getParisHour(new Date('2026-07-15T06:00:00Z'))).toBe(8);
  });
  it('hiver (CET) : 06:00 UTC = 7h Paris', () => {
    expect(getParisHour(new Date('2026-01-15T06:00:00Z'))).toBe(7);
  });
  it('hiver (CET) : 05:00 UTC = 6h Paris (occurrence skippée)', () => {
    expect(getParisHour(new Date('2026-01-15T05:00:00Z'))).toBe(6);
  });
});

describe('getParisDayBounds — hiver (UTC+1)', () => {
  // 15 janvier 2026, 06:00 UTC = 07:00 Paris (hiver).
  const bounds = getParisDayBounds(new Date('2026-01-15T06:00:00Z'));

  it('date Paris = 2026-01-15', () => {
    expect(bounds.date).toBe('2026-01-15');
  });

  it('début de journée Paris = 23:00 UTC la veille', () => {
    // 00:00 Paris hiver = 23:00 UTC J-1.
    expect(bounds.startUtcIso).toBe('2026-01-14T23:00:00.000Z');
  });

  it('fin de journée Paris = 22:59:59.999 UTC le jour même', () => {
    expect(bounds.endUtcIso).toBe('2026-01-15T22:59:59.999Z');
  });

  it('dayOfYear = 15', () => {
    expect(bounds.dayOfYear).toBe(15);
  });
});

describe('getParisDayBounds — été (UTC+2)', () => {
  // 15 juillet 2026, 05:00 UTC = 07:00 Paris (été).
  const bounds = getParisDayBounds(new Date('2026-07-15T05:00:00Z'));

  it('date Paris = 2026-07-15', () => {
    expect(bounds.date).toBe('2026-07-15');
  });

  it('début de journée Paris = 22:00 UTC la veille', () => {
    // 00:00 Paris été = 22:00 UTC J-1.
    expect(bounds.startUtcIso).toBe('2026-07-14T22:00:00.000Z');
  });

  it('fin de journée Paris = 21:59:59.999 UTC le jour même', () => {
    expect(bounds.endUtcIso).toBe('2026-07-15T21:59:59.999Z');
  });

  it('dayOfYear = 196', () => {
    // janv 31 + fév 28 + mars 31 + avr 30 + mai 31 + juin 30 + 15 = 196.
    expect(bounds.dayOfYear).toBe(196);
  });
});

describe('getParisDayBounds — bascule de jour près de minuit Paris', () => {
  it('23:30 UTC en hiver = déjà le lendemain à Paris (00:30)', () => {
    const bounds = getParisDayBounds(new Date('2026-01-14T23:30:00Z'));
    expect(bounds.date).toBe('2026-01-15');
  });
});

describe('formatParisTime', () => {
  it('formate un ISO UTC en HH:mm Paris (été)', () => {
    // 08:00 UTC été = 10:00 Paris.
    expect(formatParisTime('2026-07-15T08:00:00Z')).toBe('10:00');
  });

  it('formate un ISO UTC en HH:mm Paris (hiver)', () => {
    // 08:00 UTC hiver = 09:00 Paris.
    expect(formatParisTime('2026-01-15T08:00:00Z')).toBe('09:00');
  });

  it('retourne chaîne vide sur ISO invalide', () => {
    expect(formatParisTime('pas-une-date')).toBe('');
  });
});
