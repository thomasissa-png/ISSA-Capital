/**
 * Tests — locataires.ts (parsing des fiches locataires).
 *
 * Teste parseFicheLocataire (parsing local) — pas les appels Drive.
 */

import { describe, it, expect } from 'vitest';
import { parseFicheLocataire } from '../locataires';

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
