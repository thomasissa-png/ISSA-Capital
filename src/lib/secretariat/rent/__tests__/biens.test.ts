/**
 * Tests — biens.ts (résolution des biens immobiliers).
 *
 * Couvre les 4 biens du parc + les cas limites.
 */

import { describe, it, expect } from 'vitest';
import { resoudreBien, chargerBiens, chargerBailleurDepuisBiens } from '../biens';

describe('chargerBiens', () => {
  it('charge les 4 biens du référentiel', () => {
    const biens = chargerBiens();
    expect(biens).toHaveLength(4);
    expect(biens.map((b) => b.id)).toEqual([
      'barbusse-studio',
      'bd-seine-nanterre',
      'myrha-paris',
      'saint-michel-rue',
    ]);
  });
});

describe('chargerBailleurDepuisBiens', () => {
  it('charge la config bailleur Thomas Issa', () => {
    const bailleur = chargerBailleurDepuisBiens();
    expect(bailleur.nom).toBe('Thomas Issa');
    expect(bailleur.telephone).toBe('06 64 85 06 31');
    expect(bailleur.adresse).toBe('54 rue Henri Barbusse');
    expect(bailleur.cpVille).toBe('92000 Nanterre');
    expect(bailleur.signatureLargeurMm).toBe(40);
  });
});

describe('resoudreBien', () => {
  // Barbusse
  it('résout Barbusse par adresse complète', () => {
    const bien = resoudreBien('54 rue Henri Barbusse, 92000 Nanterre');
    expect(bien).not.toBeNull();
    expect(bien!.ligne1).toBe('54 rue Henri Barbusse');
    expect(bien!.ligne2).toBe('Studio RDC');
    expect(bien!.cpVille).toBe('92000 Nanterre');
  });

  it('résout Barbusse par fragment', () => {
    const bien = resoudreBien('Henri Barbusse studio');
    expect(bien).not.toBeNull();
    expect(bien!.ligne1).toBe('54 rue Henri Barbusse');
  });

  // Boulevard de la Seine (template)
  it('résout Bd Seine avec Studio 7', () => {
    const bien = resoudreBien('2 bis boulevard de la Seine, Studio 7, 92000 Nanterre');
    expect(bien).not.toBeNull();
    expect(bien!.ligne1).toBe('2 bis boulevard de la Seine');
    expect(bien!.ligne2).toBe('Studio 7, 6e étage');
    expect(bien!.cpVille).toBe('92000 Nanterre');
  });

  it('résout Bd Seine sans numéro de studio → "Studio" par défaut', () => {
    const bien = resoudreBien('2 bis boulevard de la Seine, 92000 Nanterre');
    expect(bien).not.toBeNull();
    expect(bien!.ligne2).toBe('Studio, 6e étage');
  });

  // Myrha
  it('résout Myrha', () => {
    const bien = resoudreBien('74 rue Myrha, 75018 Paris');
    expect(bien).not.toBeNull();
    expect(bien!.ligne1).toBe('74 rue Myrha');
    expect(bien!.ligne2).toBe('Studio RDC');
    expect(bien!.cpVille).toBe('75018 Paris');
  });

  // Saint-Michel (par côté)
  it('résout Saint-Michel côté rue', () => {
    const bien = resoudreBien('7 passage Saint-Michel, studio côté rue, 75017 Paris');
    expect(bien).not.toBeNull();
    expect(bien!.ligne1).toBe('7 passage Saint-Michel');
    expect(bien!.ligne2).toBe('Studio sur rue');
    expect(bien!.cpVille).toBe('75017 Paris');
  });

  it('résout Saint-Michel côté cour', () => {
    const bien = resoudreBien('7 passage Saint-Michel, studio côté cour, 75017 Paris');
    expect(bien).not.toBeNull();
    expect(bien!.ligne2).toBe('Studio sur cour');
  });

  it('résout Saint-Michel sans côté → défaut', () => {
    const bien = resoudreBien('7 passage Saint-Michel, 75017 Paris');
    expect(bien).not.toBeNull();
    expect(bien!.ligne2).toBe('Studio rez-de-chaussée');
  });

  // Insensible à la casse
  it('résout en insensible à la casse', () => {
    const bien = resoudreBien('MYRHA');
    expect(bien).not.toBeNull();
    expect(bien!.ligne1).toBe('74 rue Myrha');
  });

  // Adresse inconnue
  it('retourne null pour une adresse inconnue', () => {
    const bien = resoudreBien('123 rue Imaginaire, 75000 Paris');
    expect(bien).toBeNull();
  });

  it('retourne null pour une chaîne vide', () => {
    const bien = resoudreBien('');
    expect(bien).toBeNull();
  });
});
