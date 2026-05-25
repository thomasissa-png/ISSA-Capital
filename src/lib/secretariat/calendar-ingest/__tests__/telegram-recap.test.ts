/**
 * Tests telegram-recap — carte récap post-cron (refonte S23).
 */

import { describe, it, expect } from 'vitest';
import { buildRecapMessage } from '../telegram-recap';
import type { CalendarIngestResult } from '../types';

function makeResult(
  overrides: Partial<CalendarIngestResult> = {},
): CalendarIngestResult {
  return {
    eventId: 'evt_1',
    summary: 'Point Versi Immobilier',
    date: '2026-05-22',
    op: 'processed',
    participantsTotal: 2,
    contactsEnriched: 1,
    projectsEnriched: [],
    projectAmbiguous: false,
    todoCreated: false,
    errors: [],
    ...overrides,
  };
}

describe('buildRecapMessage', () => {
  it('retourne chaîne vide si aucun event traité ni erreur', () => {
    const msg = buildRecapMessage([
      makeResult({ op: 'no-change' }),
      makeResult({ op: 'skipped' }),
    ]);
    expect(msg).toBe('');
  });

  it('liste les réunions traitées avec détail (contacts / projet / todo)', () => {
    const msg = buildRecapMessage([
      makeResult({
        summary: 'Point A',
        contactsEnriched: 2,
        projectsEnriched: ['VI'],
        todoCreated: true,
      }),
      makeResult({ summary: 'Point B', contactsEnriched: 0, todoCreated: true }),
    ]);
    expect(msg).toContain('2 réunion(s) traitée(s)');
    expect(msg).toContain('Point A');
    expect(msg).toContain('2 contact(s)');
    expect(msg).toContain('projet VI');
    expect(msg).toContain('todo CR');
    expect(msg).toContain('Point B');
  });

  it('affiche « projet à confirmer » si ambigu', () => {
    const msg = buildRecapMessage([
      makeResult({ summary: 'Sync multi', projectAmbiguous: true }),
    ]);
    expect(msg).toContain('projet à confirmer');
  });

  it('liste les erreurs détaillées (logging #2)', () => {
    const msg = buildRecapMessage([
      makeResult({ summary: 'KO meeting', op: 'processed', errors: ['todo : Drive timeout'] }),
    ]);
    expect(msg).toContain('1 erreur(s)');
    expect(msg).toContain('Drive timeout');
  });

  it('tronque au-delà de 8 events et affiche le compteur', () => {
    const results: CalendarIngestResult[] = [];
    for (let i = 0; i < 12; i++) {
      results.push(makeResult({ eventId: `e${i}`, summary: `Réunion ${i}`, todoCreated: true }));
    }
    const msg = buildRecapMessage(results);
    expect(msg).toContain('12 réunion(s) traitée(s)');
    expect(msg).toContain('et 4 autre(s)');
  });

  it('tronque les sujets longs', () => {
    const longTitle = 'A'.repeat(100);
    const msg = buildRecapMessage([makeResult({ summary: longTitle, todoCreated: true })]);
    expect(msg).not.toContain(longTitle);
    expect(msg).toContain('...');
  });
});
