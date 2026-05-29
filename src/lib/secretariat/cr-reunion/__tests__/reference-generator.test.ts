/**
 * Tests du generateur/validateur de references CR.
 *
 * Le compteur sous-jacent (reference-counter.ts) ecrit sur disque local.
 * Pour eviter l'I/O dans ce test :
 *  - on mocke `getNextReference` (seul appel runtime de reference-generator)
 *  - on teste `isValidReference` / `parseReference` / `REFERENCE_REGEX` en pur
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../reference-counter', () => ({
  getNextReference: vi.fn(),
}));

import { getNextReference } from '../../reference-counter';
import {
  REFERENCE_REGEX,
  generateReference,
  isValidReference,
  parseReference,
} from '../reference-generator';

describe('REFERENCE_REGEX', () => {
  it('accepte le format canonique', () => {
    expect(REFERENCE_REGEX.test('IC-CR-2026-0003')).toBe(true);
    expect(REFERENCE_REGEX.test('GO-CR-2025-0001')).toBe(true);
    expect(REFERENCE_REGEX.test('VI-CR-2030-9999')).toBe(true);
    expect(REFERENCE_REGEX.test('VV-CR-2026-0042')).toBe(true);
  });

  it('rejette les variantes mal formees', () => {
    expect(REFERENCE_REGEX.test('IC-CR-26-3')).toBe(false); // annee 2 chiffres
    expect(REFERENCE_REGEX.test('IC-CR-2026-3')).toBe(false); // sequence non paddee
    expect(REFERENCE_REGEX.test('IC-CR-2026-00003')).toBe(false); // sequence 5 chiffres
    expect(REFERENCE_REGEX.test('XX-CR-2026-0003')).toBe(false); // entite hors enum
    expect(REFERENCE_REGEX.test('ic-CR-2026-0003')).toBe(false); // casse
    expect(REFERENCE_REGEX.test('IC-cr-2026-0003')).toBe(false);
    expect(REFERENCE_REGEX.test('IC_CR_2026_0003')).toBe(false); // separateurs
    expect(REFERENCE_REGEX.test('IC-CR-2026')).toBe(false); // tronque
    expect(REFERENCE_REGEX.test('')).toBe(false);
  });
});

describe('isValidReference', () => {
  it('accepte une reference canonique', () => {
    expect(isValidReference('IC-CR-2026-0003')).toBe(true);
  });

  it('rejette une reference mal formee', () => {
    expect(isValidReference('IC-CR-26-3')).toBe(false);
    expect(isValidReference('XX-CR-2026-0001')).toBe(false);
  });

  it('rejette les non-strings sans crash', () => {
    expect(isValidReference(undefined as unknown as string)).toBe(false);
    expect(isValidReference(null as unknown as string)).toBe(false);
    expect(isValidReference(42 as unknown as string)).toBe(false);
  });
});

describe('parseReference', () => {
  it('parse une reference canonique', () => {
    expect(parseReference('IC-CR-2026-0003')).toEqual({
      entite: 'IC',
      year: 2026,
      sequence: 3,
    });
    expect(parseReference('VV-CR-2030-9999')).toEqual({
      entite: 'VV',
      year: 2030,
      sequence: 9999,
    });
  });

  it('retourne null pour une reference invalide', () => {
    expect(parseReference('XX-CR-2026-0001')).toBeNull();
    expect(parseReference('IC-CR-2026-3')).toBeNull();
    expect(parseReference('')).toBeNull();
    expect(parseReference(undefined as unknown as string)).toBeNull();
  });
});

describe('generateReference (wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegue a getNextReference avec l\'entite passee', () => {
    vi.mocked(getNextReference).mockReturnValue('GO-CR-2026-0042');
    const ref = generateReference('GO');
    expect(getNextReference).toHaveBeenCalledWith('GO');
    expect(ref).toBe('GO-CR-2026-0042');
  });
});
