/**
 * Tests — types.ts (helpers Locataire).
 */

import { describe, it, expect } from 'vitest';
import {
  locataireTotal,
  locataireNomAvecCivilite,
  locataireInitiales,
} from '../types';
import type { Locataire } from '../types';

function makeLocataire(overrides: Partial<Locataire> = {}): Locataire {
  return {
    nomFichier: 'Kenan Beguigneau',
    nomAffiche: 'Kenan Beguigneau',
    civilite: 'Monsieur',
    email: null,
    adresseBien: '2 bis boulevard de la Seine',
    montantLoyer: 590,
    montantCharges: 100,
    dateEntreeBail: null,
    dateFinBail: null,
    moyenPaiement: 'Virement bancaire',
    ...overrides,
  };
}

describe('locataireTotal', () => {
  it('calcule loyer + charges', () => {
    const loc = makeLocataire({ montantLoyer: 590, montantCharges: 100 });
    expect(locataireTotal(loc)).toBe(690);
  });

  it('gère charges à 0', () => {
    const loc = makeLocataire({ montantLoyer: 500, montantCharges: 0 });
    expect(locataireTotal(loc)).toBe(500);
  });
});

describe('locataireNomAvecCivilite', () => {
  it('ajoute la civilité devant le nom', () => {
    const loc = makeLocataire({ civilite: 'Monsieur', nomAffiche: 'Kenan Beguigneau' });
    expect(locataireNomAvecCivilite(loc)).toBe('Monsieur Kenan Beguigneau');
  });

  it('retourne le nom seul si pas de civilité', () => {
    const loc = makeLocataire({ civilite: null, nomAffiche: 'Kenan Beguigneau' });
    expect(locataireNomAvecCivilite(loc)).toBe('Kenan Beguigneau');
  });

  it('gère Madame', () => {
    const loc = makeLocataire({ civilite: 'Madame', nomAffiche: 'Marie Dupont' });
    expect(locataireNomAvecCivilite(loc)).toBe('Madame Marie Dupont');
  });
});

describe('locataireInitiales', () => {
  it('génère KBE pour Kenan Beguigneau', () => {
    const loc = makeLocataire({ nomFichier: 'Kenan Beguigneau' });
    expect(locataireInitiales(loc)).toBe('KBE');
  });

  it('génère HTA pour Hella Taoutaou', () => {
    const loc = makeLocataire({ nomFichier: 'Hella Taoutaou' });
    expect(locataireInitiales(loc)).toBe('HTA');
  });

  it('gère un nom simple (< 2 mots)', () => {
    const loc = makeLocataire({ nomFichier: 'Madonna' });
    expect(locataireInitiales(loc)).toBe('MAD');
  });

  it('gère un nom composé (> 2 mots)', () => {
    const loc = makeLocataire({ nomFichier: 'Jean Pierre Dupont' });
    expect(locataireInitiales(loc)).toBe('JDU');
  });
});
