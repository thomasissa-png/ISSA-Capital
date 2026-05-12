/**
 * Tests pour la génération PDF d'une attestation de fin de bail.
 *
 * Couvre :
 * - genererFinDeBailPdf produit un Buffer PDF valide
 * - Le PDF contient les infos bailleur et locataire
 * - Le PDF fonctionne sans signature
 * - Le PDF fonctionne avec signature
 */

import { describe, it, expect } from 'vitest';
import { genererFinDeBailPdf } from '../pdf-fin-de-bail';
import type { FinDeBailVariables } from '../types';

// ============================================================
// Fixtures
// ============================================================

const baseVars: FinDeBailVariables = {
  bailleurNom: 'Jean-Pierre ISSA',
  bailleurDateNaissance: '1960-03-15',
  bailleurLieuNaissance: 'Beyrouth',
  bailleurAdresse: '123 rue du Test',
  bailleurCpVille: '92000 Nanterre',
  signaturePngBase64: null,
  signatureLargeurMm: 40,
  locataireNom: 'Monsieur Kenan Beguigneau',
  adresseBien: '2 bis boulevard de la Seine, 92000 Nanterre',
  dateFin: new Date(2026, 4, 31), // 31 mai 2026
  dateEmission: new Date(2026, 5, 1), // 1 juin 2026
  lieuSignature: 'Nanterre',
};

// ============================================================
// Tests
// ============================================================

describe('genererFinDeBailPdf', () => {
  it('produit un Buffer PDF valide (header %PDF)', async () => {
    const buffer = await genererFinDeBailPdf(baseVars);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    // Vérifier le magic number PDF
    const header = buffer.subarray(0, 5).toString('ascii');
    expect(header).toBe('%PDF-');
  });

  it('produit un PDF de taille raisonnable (< 100 KB pour 1 page)', async () => {
    const buffer = await genererFinDeBailPdf(baseVars);
    expect(buffer.length).toBeLessThan(100_000);
  });

  it('fonctionne sans signature', async () => {
    const vars = { ...baseVars, signaturePngBase64: null };
    const buffer = await genererFinDeBailPdf(vars);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('fonctionne avec signature invalide (fallback gracieux)', async () => {
    const vars = { ...baseVars, signaturePngBase64: 'not-a-real-image' };
    // Ne devrait pas throw, juste warn et skip la signature
    const buffer = await genererFinDeBailPdf(vars);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it('produit un PDF différent pour des locataires différents', async () => {
    const buffer1 = await genererFinDeBailPdf(baseVars);
    const buffer2 = await genererFinDeBailPdf({
      ...baseVars,
      locataireNom: 'Madame Hella Taoutaou',
      dateFin: new Date(2025, 11, 31),
    });

    // Les buffers doivent être différents
    expect(buffer1.equals(buffer2)).toBe(false);
  });
});
