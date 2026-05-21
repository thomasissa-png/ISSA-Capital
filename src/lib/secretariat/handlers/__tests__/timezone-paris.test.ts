/**
 * Tests S20.3 — Conversion heure locale Paris → TickTick API (DST-safe).
 *
 * Bug Thomas verbatim : "Il n'a pas créé à l'heure indiqué alors qu'il l'avait
 * bien comprise. Ça se retrouve dans ticktick à minuit pile au lieu de l'heure
 * demandée."
 *
 * Cause : Sonnet renvoyait `T15:00:00.000Z` (UTC) → TickTick interprétait
 * comme journée entière (pas de isAllDay/timeZone passés) → minuit affiché.
 *
 * Fix : Sonnet renvoie heure locale Paris (sans Z), code TS calcule l'UTC
 * correct + ajoute `isAllDay` + `timeZone: Europe/Paris`.
 */
import { describe, it, expect } from 'vitest';
import { parisLocalToTickTickFields } from '../todo-from-telegram';

describe('parisLocalToTickTickFields — DST-safe conversion Paris → UTC', () => {
  it('15h Paris été (mai = UTC+2) → 13h UTC', () => {
    const result = parisLocalToTickTickFields('2026-05-22T15:00:00');
    expect(result.dueDate).toBe('2026-05-22T13:00:00.000Z');
    expect(result.isAllDay).toBe(false);
    expect(result.timeZone).toBe('Europe/Paris');
  });

  it('15h Paris hiver (décembre = UTC+1) → 14h UTC', () => {
    const result = parisLocalToTickTickFields('2026-12-15T15:00:00');
    expect(result.dueDate).toBe('2026-12-15T14:00:00.000Z');
    expect(result.isAllDay).toBe(false);
    expect(result.timeZone).toBe('Europe/Paris');
  });

  it('09h30 Paris été (juin = UTC+2) → 07h30 UTC', () => {
    const result = parisLocalToTickTickFields('2026-06-15T09:30:00');
    expect(result.dueDate).toBe('2026-06-15T07:30:00.000Z');
    expect(result.isAllDay).toBe(false);
  });

  it('Journée entière (00:00:00) → isAllDay true', () => {
    const result = parisLocalToTickTickFields('2026-05-24T00:00:00');
    expect(result.isAllDay).toBe(true);
    // Pour journée entière, le dueDate reste UTC mais TickTick ignore l'heure
    expect(result.dueDate).toMatch(/^2026-05-2[34]T22:00:00\.000Z$/);
    expect(result.timeZone).toBe('Europe/Paris');
  });

  it('dueDate undefined → tous champs undefined', () => {
    const result = parisLocalToTickTickFields(undefined);
    expect(result.dueDate).toBeUndefined();
    expect(result.isAllDay).toBeUndefined();
    expect(result.timeZone).toBeUndefined();
  });

  it('Format invalide → fallback envoi tel quel + timeZone Paris', () => {
    const result = parisLocalToTickTickFields('pas-une-date');
    expect(result.dueDate).toBe('pas-une-date');
    expect(result.isAllDay).toBe(false);
    expect(result.timeZone).toBe('Europe/Paris');
  });

  it('Passage à l\'heure d\'été (dernier dimanche mars 2026 = 29 mars 02:00→03:00) — 15h juste après → UTC+2', () => {
    // 29 mars 2026 à 15h Paris = 13h UTC (DST appliqué dès 2h locales)
    const result = parisLocalToTickTickFields('2026-03-29T15:00:00');
    expect(result.dueDate).toBe('2026-03-29T13:00:00.000Z');
  });

  it('Passage à l\'heure d\'hiver (dernier dimanche octobre 2026 = 25 oct) — 15h juste après → UTC+1', () => {
    // 25 oct 2026 à 15h Paris = 14h UTC (DST levé dès 3h→2h locales)
    const result = parisLocalToTickTickFields('2026-10-25T15:00:00');
    expect(result.dueDate).toBe('2026-10-25T14:00:00.000Z');
  });
});
