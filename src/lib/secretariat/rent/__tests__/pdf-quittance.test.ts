/**
 * Tests — pdf-quittance.ts (génération PDF quittance de loyer).
 *
 * Vérifie que le PDF est généré sans crash et contient un header PDF valide.
 */

import { describe, it, expect } from 'vitest';
import { inflateSync } from 'zlib';
import { genererQuittancePdf } from '../pdf-quittance';
import type { QuittanceVariables } from '../types';

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
      // Les nombres négatifs > 100 en valeur absolue représentent un espace inter-mots
      const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjArrayRegex.exec(inflated)) !== null) {
        const arrayContent = tjMatch[1]!;
        // Extraire les éléments : hex strings <...> et nombres
        const elemRegex = /<([0-9a-fA-F]+)>|(-?\d+(?:\.\d+)?)/g;
        let elemMatch: RegExpExecArray | null;
        let segment = '';
        while ((elemMatch = elemRegex.exec(arrayContent)) !== null) {
          if (elemMatch[1] !== undefined) {
            // Hex string
            segment += decodeHex(elemMatch[1]);
          } else if (elemMatch[2] !== undefined) {
            // Nombre : les valeurs < -100 indiquent un espace inter-mots
            const val = parseFloat(elemMatch[2]);
            if (val < -100) {
              segment += ' ';
            }
          }
        }
        textParts.push(segment);
      }
      // Aussi extraire les literal strings (...) Tj (texte non-array)
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

  it('contient la civilité du locataire dans le texte juridique (P0 #1 audit legal)', async () => {
    // Le builder upstream (workflows/quittance.ts) peuple locataireNom avec
    // la civilité via locataireNomAvecCivilite(loc). Ce test vérifie que le
    // PDF résultant contient bien la civilité dans le texte juridique central.
    const vars = makeVariables({ locataireNom: 'Monsieur Kenan Beguigneau' });
    const buffer = await genererQuittancePdf(vars);
    const text = extractPdfText(buffer);
    // Le texte juridique doit contenir "Monsieur" et le nom complet
    expect(text).toContain('Monsieur');
    expect(text).toContain('Kenan Beguigneau');
  });
});
