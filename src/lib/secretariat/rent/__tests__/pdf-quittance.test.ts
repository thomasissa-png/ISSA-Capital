/**
 * Tests — pdf-quittance.ts (génération PDF quittance de loyer).
 *
 * Vérifie que le PDF est généré sans crash et contient un header PDF valide.
 */

import { describe, it, expect } from 'vitest';
import { genererQuittancePdf } from '../pdf-quittance';
import type { QuittanceVariables } from '../types';

function makeVariables(overrides: Partial<QuittanceVariables> = {}): QuittanceVariables {
  return {
    bailleurNom: 'Thomas Issa',
    bailleurTelephone: '06 64 85 06 31',
    bailleurAdresse: '54 rue Henri Barbusse',
    bailleurCpVille: '92000 Nanterre',
    signaturePngBase64: null,
    signatureLargeurMm: 40,
    locataireNom: 'Monsieur Kenan Beguigneau',
    bienAdresseLigne1: '2 bis boulevard de la Seine',
    bienAdresseLigne2: 'Studio 7, 6e étage',
    bienCpVille: '92000 Nanterre',
    periodeMoisAnnee: 'Mai 2026',
    periodeDebut: '01/05/2026',
    periodeFin: '31/05/2026',
    loyer: 590,
    charges: 100,
    total: 690,
    totalLettres: 'six cent quatre-vingt-dix euros',
    datePaiement: '02/05/2026',
    moyenPaiement: 'Virement bancaire',
    lieuEmission: 'Nanterre',
    dateEmission: '03/06/2026',
    numeroQuittance: 'QL-2026-05-KBE',
    ...overrides,
  };
}

describe('genererQuittancePdf', () => {
  it('génère un PDF valide (header %PDF)', async () => {
    const vars = makeVariables();
    const buffer = await genererQuittancePdf(vars);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Vérifier le magic number PDF
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('génère un PDF sans signature', async () => {
    const vars = makeVariables({ signaturePngBase64: null });
    const buffer = await genererQuittancePdf(vars);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('génère un PDF avec montants entiers', async () => {
    const vars = makeVariables({
      loyer: 590,
      charges: 100,
      total: 690,
    });
    const buffer = await genererQuittancePdf(vars);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('génère un PDF avec charges à 0', async () => {
    const vars = makeVariables({
      charges: 0,
      total: 590,
      totalLettres: 'cinq cent quatre-vingt-dix euros',
    });
    const buffer = await genererQuittancePdf(vars);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('génère un PDF pour chaque bien du parc', async () => {
    const biens = [
      { ligne1: '54 rue Henri Barbusse', ligne2: 'Studio RDC', cpVille: '92000 Nanterre' },
      { ligne1: '2 bis boulevard de la Seine', ligne2: 'Studio 7, 6e étage', cpVille: '92000 Nanterre' },
      { ligne1: '74 rue Myrha', ligne2: 'Studio RDC', cpVille: '75018 Paris' },
      { ligne1: '7 passage Saint-Michel', ligne2: 'Studio sur rue', cpVille: '75017 Paris' },
    ];

    for (const bien of biens) {
      const vars = makeVariables({
        bienAdresseLigne1: bien.ligne1,
        bienAdresseLigne2: bien.ligne2,
        bienCpVille: bien.cpVille,
      });
      const buffer = await genererQuittancePdf(vars);
      expect(buffer.length).toBeGreaterThan(1000);
    }
  });

  it('gère les caractères UTF-8 (accents, cédilles)', async () => {
    const vars = makeVariables({
      locataireNom: 'Madame Héloïse François-Müller',
      bienAdresseLigne1: '74 rue Myrha',
      bienAdresseLigne2: 'Studio rez-de-chaussée',
    });
    const buffer = await genererQuittancePdf(vars);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('gère une longue adresse', async () => {
    const vars = makeVariables({
      bienAdresseLigne1: '123 boulevard du Général de Gaulle, Résidence Les Hauts de Seine',
      bienAdresseLigne2: 'Appartement 42, Bâtiment C, 3e étage gauche',
    });
    const buffer = await genererQuittancePdf(vars);
    expect(buffer.length).toBeGreaterThan(1000);
  });
});
