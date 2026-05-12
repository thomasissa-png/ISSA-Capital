/**
 * Tests — locataires.ts (parsing + recherche futée).
 *
 * Teste :
 * 1. parseFicheLocataire (parsing local frontmatter)
 * 2. normalizeForSearch (normalisation accents/casse)
 * 3. levenshtein (distance d'édition)
 * 4. matchFiches (algorithme de matching fuzzy — pas d'appel Drive)
 */

import { describe, it, expect } from 'vitest';
import {
  parseFicheLocataire,
  normalizeForSearch,
  levenshtein,
  matchFiches,
} from '../locataires';

// ============================================================
// Fixtures — fiches locataires simulées (structure CachedFiche)
// ============================================================

function makeFiche(
  nomFichier: string,
  nomOfficiel: string | null,
  source: 'actuels' | 'candidats' = 'actuels',
) {
  return {
    nomFichier,
    nomOfficiel,
    locataire: {
      nomFichier,
      nomAffiche: nomOfficiel ?? nomFichier,
      civilite: null,
      email: null,
      adresseBien: '54 rue Henri Barbusse',
      montantLoyer: 590,
      montantCharges: 100,
      dateEntreeBail: null,
      dateFinBail: null,
      moyenPaiement: 'Virement bancaire',
    },
    source,
  };
}

/** Les 12 fiches réelles du vault Thomas */
const FICHES_REELLES = [
  makeFiche('Hella Taoutaou', 'Hella Atika Taoutaou'),
  makeFiche('Jhon Michael Completo', null),
  makeFiche('Kenan Beguigneau', 'Kenan Beguigneau'),
  makeFiche('Laurene Leguay', null),
  makeFiche('Leo Fanorenantsoa', null),
  makeFiche('Lia Taisnime', null),
  makeFiche('Lucas Geoffroy', null),
  makeFiche('Milo Rouille', null),
  makeFiche('Nzioka Mutheu', null),
  makeFiche('Pauline Farssi', null),
  makeFiche('Sacha Tanguy', null),
  makeFiche('Timilas Mehmel', null),
];

// ============================================================
// parseFicheLocataire
// ============================================================

describe('parseFicheLocataire', () => {
  it('parse un frontmatter complet', () => {
    const content = `---
civilite: Monsieur
nom_officiel: Kenan Beguigneau
email: kenan@example.com
adresse_bien: 2 bis boulevard de la Seine, Studio 7, 92000 Nanterre
montant_loyer: 590
montant_charges: 100
date_entree_bail: 2024-05-23
---

Notes sur le locataire.
`;

    const loc = parseFicheLocataire(content, 'Kenan Beguigneau.md');
    expect(loc).not.toBeNull();
    expect(loc!.nomFichier).toBe('Kenan Beguigneau');
    expect(loc!.nomAffiche).toBe('Kenan Beguigneau');
    expect(loc!.civilite).toBe('Monsieur');
    expect(loc!.email).toBe('kenan@example.com');
    expect(loc!.adresseBien).toBe('2 bis boulevard de la Seine, Studio 7, 92000 Nanterre');
    expect(loc!.montantLoyer).toBe(590);
    expect(loc!.montantCharges).toBe(100);
    expect(loc!.moyenPaiement).toBe('Virement bancaire');
  });

  it('utilise nom_officiel quand présent', () => {
    const content = `---
nom_officiel: Hella Atika Taoutaou
adresse_bien: 54 rue Henri Barbusse
montant_loyer: 590
---
`;

    const loc = parseFicheLocataire(content, 'Hella Taoutaou.md');
    expect(loc).not.toBeNull();
    expect(loc!.nomFichier).toBe('Hella Taoutaou');
    expect(loc!.nomAffiche).toBe('Hella Atika Taoutaou');
  });

  it('fallback sur nomFichier si nom_officiel absent', () => {
    const content = `---
adresse_bien: 74 rue Myrha
montant_loyer: 500
---
`;

    const loc = parseFicheLocataire(content, 'Jean Dupont.md');
    expect(loc).not.toBeNull();
    expect(loc!.nomAffiche).toBe('Jean Dupont');
  });

  it('retourne null si montant_loyer manquant', () => {
    const content = `---
adresse_bien: 54 rue Henri Barbusse
---
`;

    const loc = parseFicheLocataire(content, 'Test.md');
    expect(loc).toBeNull();
  });

  it('retourne null si adresse_bien manquant', () => {
    const content = `---
montant_loyer: 590
---
`;

    const loc = parseFicheLocataire(content, 'Test.md');
    expect(loc).toBeNull();
  });

  it('retourne null si pas de frontmatter', () => {
    const content = 'Juste du texte sans frontmatter.';
    const loc = parseFicheLocataire(content, 'Test.md');
    expect(loc).toBeNull();
  });

  it('gère montant_charges à 0 par défaut', () => {
    const content = `---
adresse_bien: 74 rue Myrha
montant_loyer: 500
---
`;

    const loc = parseFicheLocataire(content, 'Test.md');
    expect(loc).not.toBeNull();
    expect(loc!.montantCharges).toBe(0);
  });

  it('gère les guillemets autour des valeurs', () => {
    const content = `---
civilite: "Madame"
nom_officiel: "Marie Dupont"
adresse_bien: "74 rue Myrha, 75018 Paris"
montant_loyer: 500
montant_charges: 80
---
`;

    const loc = parseFicheLocataire(content, 'Marie Dupont.md');
    expect(loc).not.toBeNull();
    expect(loc!.civilite).toBe('Madame');
    expect(loc!.nomAffiche).toBe('Marie Dupont');
    expect(loc!.adresseBien).toBe('74 rue Myrha, 75018 Paris');
  });

  it('gère les valeurs null/vide correctement', () => {
    const content = `---
civilite: null
email: ~
adresse_bien: 54 rue Henri Barbusse
montant_loyer: 590
---
`;

    const loc = parseFicheLocataire(content, 'Test.md');
    expect(loc).not.toBeNull();
    expect(loc!.civilite).toBeNull();
    expect(loc!.email).toBeNull();
  });
});

// ============================================================
// normalizeForSearch
// ============================================================

describe('normalizeForSearch', () => {
  it('convertit en lowercase', () => {
    expect(normalizeForSearch('HELLA')).toBe('hella');
  });

  it('supprime les accents', () => {
    expect(normalizeForSearch('Héllà')).toBe('hella');
  });

  it('supprime les accents complexes (cédilles, trémas)', () => {
    expect(normalizeForSearch('François Noël')).toBe('francois noel');
  });

  it('normalise les espaces multiples', () => {
    expect(normalizeForSearch('  Hella   Taoutaou  ')).toBe('hella taoutaou');
  });

  it('gère une chaîne vide', () => {
    expect(normalizeForSearch('')).toBe('');
  });

  it('gère les caractères spéciaux sans accent', () => {
    expect(normalizeForSearch("Kenan-O'Brien")).toBe("kenan-o'brien");
  });
});

// ============================================================
// levenshtein
// ============================================================

describe('levenshtein', () => {
  it('retourne 0 pour des chaînes identiques', () => {
    expect(levenshtein('hella', 'hella')).toBe(0);
  });

  it('retourne la longueur si une chaîne est vide', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('retourne 0 pour deux chaînes vides', () => {
    expect(levenshtein('', '')).toBe(0);
  });

  it('calcule distance 1 (substitution)', () => {
    expect(levenshtein('hela', 'hella')).toBe(1);
  });

  it('calcule distance 1 (insertion)', () => {
    expect(levenshtein('hell', 'hella')).toBe(1);
  });

  it('calcule distance 1 (suppression)', () => {
    expect(levenshtein('hellaa', 'hella')).toBe(1);
  });

  it('calcule distance 2', () => {
    expect(levenshtein('hla', 'hella')).toBe(2);
  });

  it('calcule distance élevée pour des noms très différents', () => {
    expect(levenshtein('xyz', 'hella')).toBeGreaterThan(2);
  });
});

// ============================================================
// matchFiches — recherche futée
// ============================================================

describe('matchFiches', () => {
  // --- Cas demandés dans le brief ---

  it('rechercherLocataire("Hella") → match unique sur "Hella Taoutaou" (startsWith)', () => {
    const matches = matchFiches('Hella', FICHES_REELLES);
    expect(matches.length).toBe(1);
    expect(matches[0]!.nomFichier).toBe('Hella Taoutaou');
    expect(matches[0]!.matchType).toBe('startsWith');
    expect(matches[0]!.score).toBe(1);
  });

  it('rechercherLocataire("hella") → idem (normalisation case)', () => {
    const matches = matchFiches('hella', FICHES_REELLES);
    expect(matches.length).toBe(1);
    expect(matches[0]!.nomFichier).toBe('Hella Taoutaou');
  });

  it('rechercherLocataire("Hélla") → idem (normalisation accents)', () => {
    const matches = matchFiches('Hélla', FICHES_REELLES);
    expect(matches.length).toBe(1);
    expect(matches[0]!.nomFichier).toBe('Hella Taoutaou');
  });

  it('rechercherLocataire("Hela") → match Levenshtein distance 1 → unique', () => {
    const matches = matchFiches('Hela', FICHES_REELLES);
    // "Hela" est distance 1 de "Hella" (prénom) → devrait matcher
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Hella Taoutaou');
    expect(matches[0]!.matchType).toBe('levenshtein');
    expect(matches[0]!.score).toBeLessThanOrEqual(2);
  });

  it('rechercherLocataire("Hella Atika Taoutaou") → match sur nom_officiel → unique', () => {
    const matches = matchFiches('Hella Atika Taoutaou', FICHES_REELLES);
    expect(matches.length).toBe(1);
    expect(matches[0]!.nomFichier).toBe('Hella Taoutaou');
    expect(matches[0]!.nomAffiche).toBe('Hella Atika Taoutaou');
    expect(matches[0]!.score).toBe(0);
    expect(matches[0]!.matchType).toBe('nomOfficiel');
  });

  it('rechercherLocataire("Taoutaou") → match sur nom de famille', () => {
    const matches = matchFiches('Taoutaou', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Hella Taoutaou');
  });

  it('rechercherLocataire("Pa") → ambigu (Pauline + potentiellement autres)', () => {
    const matches = matchFiches('Pa', FICHES_REELLES);
    // "Pa" startsWith prénom "pauline" → match Pauline
    // Peut aussi matcher d'autres via Levenshtein
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const noms = matches.map((m) => m.nomFichier);
    expect(noms).toContain('Pauline Farssi');
  });

  it('rechercherLocataire("Inconnu") → zéro résultat', () => {
    const matches = matchFiches('Inconnu', FICHES_REELLES);
    expect(matches.length).toBe(0);
  });

  it('rechercherLocataire("Leo") → unique match "Leo Fanorenantsoa"', () => {
    const matches = matchFiches('Leo', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Leo Fanorenantsoa');
  });

  it('rechercherLocataire("") → zéro résultat sans crash', () => {
    const matches = matchFiches('', FICHES_REELLES);
    expect(matches.length).toBe(0);
  });

  // --- Tests additionnels sur la logique de matching ---

  it('match exact sur nom de fichier complet (score 0)', () => {
    const matches = matchFiches('Kenan Beguigneau', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Kenan Beguigneau');
    expect(matches[0]!.score).toBe(0);
    expect(matches[0]!.matchType).toBe('exact');
  });

  it('match exact insensible à la casse (score 0)', () => {
    const matches = matchFiches('kenan beguigneau', FICHES_REELLES);
    expect(matches[0]!.nomFichier).toBe('Kenan Beguigneau');
    expect(matches[0]!.score).toBe(0);
  });

  it('startsWith sur prénom seul (score 1)', () => {
    const matches = matchFiches('Luc', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Lucas Geoffroy');
    expect(matches[0]!.score).toBe(1);
    expect(matches[0]!.matchType).toBe('startsWith');
  });

  it('contains sur nom de famille (score 2)', () => {
    const matches = matchFiches('Geoffroy', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Lucas Geoffroy');
  });

  it('Levenshtein typo simple : "Kenan Beguigneauu" → distance 1', () => {
    const matches = matchFiches('Kenan Beguigneauu', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Kenan Beguigneau');
    expect(matches[0]!.matchType).toBe('levenshtein');
  });

  it('ne retourne pas plus de 5 candidats', () => {
    // "L" startsWith le prénom de Leo, Lia, Lucas, Laurene → 4 candidats max ici
    const matches = matchFiches('L', FICHES_REELLES);
    expect(matches.length).toBeLessThanOrEqual(5);
  });

  it('respecte le tri par score croissant', () => {
    const matches = matchFiches('Milo', FICHES_REELLES);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i]!.score).toBeGreaterThanOrEqual(matches[i - 1]!.score);
    }
  });

  it('gère les espaces superflus dans la query', () => {
    const matches = matchFiches('  Hella  ', FICHES_REELLES);
    expect(matches.length).toBe(1);
    expect(matches[0]!.nomFichier).toBe('Hella Taoutaou');
  });

  it('source est "actuels" pour les fiches du dossier actuels', () => {
    const matches = matchFiches('Hella', FICHES_REELLES);
    expect(matches[0]!.source).toBe('actuels');
  });

  it('source est "candidats" pour les fiches du dossier candidats', () => {
    const fichesAvecCandidat = [
      ...FICHES_REELLES,
      makeFiche('Jean Test', null, 'candidats'),
    ];
    const matches = matchFiches('Jean Test', fichesAvecCandidat);
    expect(matches[0]!.source).toBe('candidats');
  });

  it('match "Jhon" correctement (prénom startsWith)', () => {
    const matches = matchFiches('Jhon', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Jhon Michael Completo');
  });

  it('match "Completo" via contains (nom de famille)', () => {
    const matches = matchFiches('Completo', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Jhon Michael Completo');
  });

  it('match "Nzioka" exactement (prénom startsWith)', () => {
    const matches = matchFiches('Nzioka', FICHES_REELLES);
    expect(matches.length).toBe(1);
    expect(matches[0]!.nomFichier).toBe('Nzioka Mutheu');
  });

  it('ne duplique pas un même fichier dans les résultats', () => {
    // "Hella Taoutaou" pourrait matcher sur startsWith ET contains — ne devrait apparaître qu'une fois
    const matches = matchFiches('Hella', FICHES_REELLES);
    const noms = matches.map((m) => m.nomFichier);
    const unique = new Set(noms);
    expect(unique.size).toBe(noms.length);
  });

  it('match Sacha par prénom exact (score 1, startsWith prénom)', () => {
    const matches = matchFiches('Sacha', FICHES_REELLES);
    expect(matches.length).toBe(1);
    expect(matches[0]!.nomFichier).toBe('Sacha Tanguy');
  });

  it('match Timilas par prénom (startsWith)', () => {
    const matches = matchFiches('Tim', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Timilas Mehmel');
  });

  it('match "Léo" avec accent → normalise vers "leo" (startsWith)', () => {
    const matches = matchFiches('Léo', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Leo Fanorenantsoa');
  });

  it('match "Laurène" avec accent grave → normalise (startsWith)', () => {
    const matches = matchFiches('Laurène', FICHES_REELLES);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0]!.nomFichier).toBe('Laurene Leguay');
  });
});
