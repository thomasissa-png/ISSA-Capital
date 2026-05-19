/**
 * Tests telegram-recap — carte récap post-cron.
 */

import { describe, it, expect } from 'vitest';
import { buildRecapMessage } from '../telegram-recap';
import type { CalendarIngestResult } from '../types';

function makeResult(
  overrides: Partial<CalendarIngestResult> = {},
): CalendarIngestResult {
  return {
    eventId: 'evt_1',
    summary: 'Point Versi',
    date: '2026-05-22',
    op: 'reunion-created',
    participantsTotal: 2,
    contactsEnriched: 1,
    errors: [],
    ...overrides,
  };
}

describe('buildRecapMessage', () => {
  it('retourne chaîne vide si aucun actionable', () => {
    const msg = buildRecapMessage([
      makeResult({ op: 'no-change' }),
      makeResult({ op: 'skipped' }),
    ]);
    expect(msg).toBe('');
  });

  it('liste les réunions créées', () => {
    const msg = buildRecapMessage([
      makeResult({ summary: 'Point A', op: 'reunion-created', contactsEnriched: 1 }),
      makeResult({ summary: 'Point B', op: 'reunion-updated', contactsEnriched: 0 }),
    ]);
    expect(msg).toContain('2 réunion(s) traitée(s)');
    expect(msg).toContain('Point A');
    expect(msg).toContain('fiche créée');
    expect(msg).toContain('Point B');
    expect(msg).toContain('fiche mise à jour');
    expect(msg).toContain('1 contact(s) enrichi(s)');
  });

  it('tronque au-delà de 8 et affiche le compteur', () => {
    const results: CalendarIngestResult[] = [];
    for (let i = 0; i < 12; i++) {
      results.push(makeResult({ eventId: `e${i}`, summary: `Réunion ${i}` }));
    }
    const msg = buildRecapMessage(results);
    expect(msg).toContain('12 réunion(s) traitée(s)');
    expect(msg).toContain('et 4 autre(s)');
  });

  it('tronque les sujets longs à 60 chars', () => {
    const longTitle = 'A'.repeat(100);
    const msg = buildRecapMessage([makeResult({ summary: longTitle })]);
    expect(msg).not.toContain(longTitle);
    expect(msg).toContain('...');
  });

  it('reunion-cancelled est listée', () => {
    const msg = buildRecapMessage([
      makeResult({ op: 'reunion-cancelled', summary: 'Annulée' }),
    ]);
    expect(msg).toContain('réunion annulée');
    expect(msg).toContain('Annulée');
  });
});
