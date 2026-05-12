/**
 * Tests — dates-fr (formatage dates en français).
 */

import { describe, it, expect } from 'vitest';
import { moisEnLettres, dateEnLettres, formatDateFr, dernierJourDuMois } from '../dates-fr';

describe('moisEnLettres', () => {
  it('retourne Janvier pour 1', () => {
    expect(moisEnLettres(1)).toBe('Janvier');
  });

  it('retourne Décembre pour 12', () => {
    expect(moisEnLettres(12)).toBe('Décembre');
  });

  it('retourne Août pour 8', () => {
    expect(moisEnLettres(8)).toBe('Août');
  });

  it('rejette mois 0', () => {
    expect(() => moisEnLettres(0)).toThrow('invalide');
  });

  it('rejette mois 13', () => {
    expect(() => moisEnLettres(13)).toThrow('invalide');
  });
});

describe('dateEnLettres', () => {
  it('formate le 25 janvier 2026', () => {
    const date = new Date(2026, 0, 25); // mois 0-indexed
    expect(dateEnLettres(date)).toBe('vingt-cinq janvier deux mille vingt-six');
  });

  it('formate le 1er mai 2026 (premier)', () => {
    const date = new Date(2026, 4, 1);
    expect(dateEnLettres(date)).toBe('premier mai deux mille vingt-six');
  });

  it('formate le 31 décembre 2025', () => {
    const date = new Date(2025, 11, 31);
    expect(dateEnLettres(date)).toBe('trente-et-un décembre deux mille vingt-cinq');
  });

  it('formate le 14 juillet 2024', () => {
    const date = new Date(2024, 6, 14);
    expect(dateEnLettres(date)).toBe('quatorze juillet deux mille vingt-quatre');
  });
});

describe('formatDateFr', () => {
  it('formate en DD/MM/YYYY', () => {
    const date = new Date(2026, 4, 3); // 3 mai 2026
    expect(formatDateFr(date)).toBe('03/05/2026');
  });

  it('pad les jours et mois à 2 chiffres', () => {
    const date = new Date(2026, 0, 1); // 1 janvier 2026
    expect(formatDateFr(date)).toBe('01/01/2026');
  });
});

describe('dernierJourDuMois', () => {
  it('janvier = 31', () => {
    expect(dernierJourDuMois(2026, 1)).toBe(31);
  });

  it('février 2024 (bissextile) = 29', () => {
    expect(dernierJourDuMois(2024, 2)).toBe(29);
  });

  it('février 2025 (non bissextile) = 28', () => {
    expect(dernierJourDuMois(2025, 2)).toBe(28);
  });

  it('avril = 30', () => {
    expect(dernierJourDuMois(2026, 4)).toBe(30);
  });

  it('décembre = 31', () => {
    expect(dernierJourDuMois(2026, 12)).toBe(31);
  });
});
