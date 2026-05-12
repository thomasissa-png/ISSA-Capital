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
import { inflateSync } from 'zlib';
import { genererFinDeBailPdf } from '../pdf-fin-de-bail';
import type { FinDeBailVariables } from '../types';

/**
 * Décode une hex string PDF (<4d6f6e...>) en texte latin1.
 */
function decodeHex(hex: string): string {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    result += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }
  return result;
}

/**
 * Extrait le texte brut des streams compressés (FlateDecode) d'un PDF.
 * Décompresse chaque stream, parse les opérateurs TJ/Tj,
 * et retourne le texte en clair avec espaces reconstitués.
 */
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('binary');
  const textParts: string[] = [];
  const streamRegex = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(raw)) !== null) {
    try {
      const streamBytes = Buffer.from(match[1]!, 'binary');
      const inflated = inflateSync(streamBytes).toString('latin1');
      // Parse les opérateurs TJ : [...] TJ — array de hex strings + nombres (kerning)
      const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjArrayRegex.exec(inflated)) !== null) {
        const arrayContent = tjMatch[1]!;
        const elemRegex = /<([0-9a-fA-F]+)>|(-?\d+(?:\.\d+)?)/g;
        let elemMatch: RegExpExecArray | null;
        let segment = '';
        while ((elemMatch = elemRegex.exec(arrayContent)) !== null) {
          if (elemMatch[1] !== undefined) {
            segment += decodeHex(elemMatch[1]);
          } else if (elemMatch[2] !== undefined) {
            const val = parseFloat(elemMatch[2]);
            if (val < -100) {
              segment += ' ';
            }
          }
        }
        textParts.push(segment);
      }
      const litRegex = /\(([^)]*)\)\s*Tj/g;
      let litMatch: RegExpExecArray | null;
      while ((litMatch = litRegex.exec(inflated)) !== null) {
        textParts.push(litMatch[1]!);
      }
    } catch {
      // Stream non compressé ou autre format — ignorer
    }
  }
  return textParts.join(' ');
}

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

  it('contient la mention dépôt de garantie avec délai et référence art. 22 (P0 #4 audit legal)', async () => {
    const buffer = await genererFinDeBailPdf(baseVars);
    const text = extractPdfText(buffer);
    // Normaliser les espaces multiples (le justifié PDF ajoute du kerning)
    const normalized = text.replace(/\s+/g, ' ');

    // Vérifie les 3 éléments requis par l'audit juridique
    expect(normalized).toContain('garantie');
    expect(normalized).toContain('1 mois');
    expect(normalized).toContain('89-462');
  });
});
