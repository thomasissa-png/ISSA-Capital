/**
 * Tests — nombreEnLettres (conversion nombre en toutes lettres français).
 *
 * Couvre : unités, dizaines spéciales (70, 80, 90), centaines,
 * milliers, accord du pluriel, montants de loyer réalistes.
 */

import { describe, it, expect } from 'vitest';
import { nombreEnLettres } from '../num-en-lettres';

describe('nombreEnLettres', () => {
  // Unités
  it('convertit 0', () => {
    expect(nombreEnLettres(0)).toBe('zéro euros');
  });

  it('convertit 1', () => {
    expect(nombreEnLettres(1)).toBe('un euros');
  });

  it('convertit 5', () => {
    expect(nombreEnLettres(5)).toBe('cinq euros');
  });

  it('convertit 16', () => {
    expect(nombreEnLettres(16)).toBe('seize euros');
  });

  it('convertit 19', () => {
    expect(nombreEnLettres(19)).toBe('dix-neuf euros');
  });

  // Dizaines classiques
  it('convertit 20', () => {
    expect(nombreEnLettres(20)).toBe('vingt euros');
  });

  it('convertit 21 (vingt-et-un)', () => {
    expect(nombreEnLettres(21)).toBe('vingt-et-un euros');
  });

  it('convertit 30', () => {
    expect(nombreEnLettres(30)).toBe('trente euros');
  });

  it('convertit 42', () => {
    expect(nombreEnLettres(42)).toBe('quarante-deux euros');
  });

  // Spécial : 70, 71, 80, 90
  it('convertit 70 (soixante-dix)', () => {
    expect(nombreEnLettres(70)).toBe('soixante-dix euros');
  });

  it('convertit 71 (soixante-et-onze)', () => {
    expect(nombreEnLettres(71)).toBe('soixante-et-onze euros');
  });

  it('convertit 72 (soixante-douze)', () => {
    expect(nombreEnLettres(72)).toBe('soixante-douze euros');
  });

  it('convertit 79 (soixante-dix-neuf)', () => {
    expect(nombreEnLettres(79)).toBe('soixante-dix-neuf euros');
  });

  it('convertit 80 (quatre-vingts avec S)', () => {
    expect(nombreEnLettres(80)).toBe('quatre-vingts euros');
  });

  it('convertit 81 (quatre-vingt-un sans S)', () => {
    expect(nombreEnLettres(81)).toBe('quatre-vingt-un euros');
  });

  it('convertit 90 (quatre-vingt-dix)', () => {
    expect(nombreEnLettres(90)).toBe('quatre-vingt-dix euros');
  });

  it('convertit 99 (quatre-vingt-dix-neuf)', () => {
    expect(nombreEnLettres(99)).toBe('quatre-vingt-dix-neuf euros');
  });

  // Centaines
  it('convertit 100 (cent)', () => {
    expect(nombreEnLettres(100)).toBe('cent euros');
  });

  it('convertit 101 (cent un)', () => {
    expect(nombreEnLettres(101)).toBe('cent un euros');
  });

  it('convertit 200 (deux cents avec S)', () => {
    expect(nombreEnLettres(200)).toBe('deux cents euros');
  });

  it('convertit 201 (deux cent un sans S)', () => {
    expect(nombreEnLettres(201)).toBe('deux cent un euros');
  });

  it('convertit 300', () => {
    expect(nombreEnLettres(300)).toBe('trois cents euros');
  });

  // Milliers
  it('convertit 1000 (mille, pas un mille)', () => {
    expect(nombreEnLettres(1000)).toBe('mille euros');
  });

  it('convertit 1100 (mille cent)', () => {
    expect(nombreEnLettres(1100)).toBe('mille cent euros');
  });

  it('convertit 2000 (deux mille)', () => {
    expect(nombreEnLettres(2000)).toBe('deux mille euros');
  });

  // Montants de loyer réalistes
  it('convertit 590 (loyer type)', () => {
    expect(nombreEnLettres(590)).toBe('cinq cent quatre-vingt-dix euros');
  });

  it('convertit 690 (loyer type)', () => {
    expect(nombreEnLettres(690)).toBe('six cent quatre-vingt-dix euros');
  });

  it('convertit 100 (charges type)', () => {
    expect(nombreEnLettres(100)).toBe('cent euros');
  });

  // Arrondi
  it('arrondit 690.50 à 691', () => {
    expect(nombreEnLettres(690.5)).toBe('six cent quatre-vingt-onze euros');
  });

  it('arrondit 689.4 à 689', () => {
    expect(nombreEnLettres(689.4)).toBe('six cent quatre-vingt-neuf euros');
  });

  // Devise personnalisée
  it('accepte une devise personnalisée', () => {
    expect(nombreEnLettres(100, 'francs')).toBe('cent francs');
  });

  // Erreurs
  it('rejette les montants négatifs', () => {
    expect(() => nombreEnLettres(-1)).toThrow('négatif');
  });

  it('rejette les montants > 999 999', () => {
    expect(() => nombreEnLettres(1_000_000)).toThrow('trop élevé');
  });

  // Grands montants
  it('convertit 10 000', () => {
    expect(nombreEnLettres(10_000)).toBe('dix mille euros');
  });

  it('convertit 999 999', () => {
    expect(nombreEnLettres(999_999)).toBe(
      'neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf euros',
    );
  });
});
