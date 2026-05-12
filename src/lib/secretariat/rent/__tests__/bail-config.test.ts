/**
 * Tests pour bail-config.ts — configuration bail meublé.
 *
 * Couvre :
 * - Chargement de la config bailleur bail
 * - Chargement des defaults
 * - Résolution du bien bail (statique, template, par côté)
 * - Chargement inventaire
 * - Vérification fiche locataire
 * - Construction variables bail
 */

import { describe, it, expect } from 'vitest';
import {
  chargerBailleurBail,
  chargerDefaultsBail,
  resoudreBienBail,
  chargerInventaire,
  verifierFicheBail,
  construireVariablesBail,
} from '../bail-config';
import type { Locataire } from '../types';

// ============================================================
// Helpers
// ============================================================

function makeLocataire(overrides: Partial<Locataire> = {}): Locataire {
  return {
    nomFichier: 'Kenan Beguigneau',
    nomAffiche: 'Kenan Beguigneau',
    civilite: 'Monsieur',
    email: null,
    adresseBien: '2 bis boulevard de la Seine, Studio 7, 92000 Nanterre',
    montantLoyer: 590,
    montantCharges: 100,
    dateEntreeBail: new Date('2024-05-23'),
    dateFinBail: null,
    moyenPaiement: 'Virement bancaire',
    dateNaissance: new Date('1995-03-15'),
    lieuNaissance: 'Paris',
    nationalite: 'Française',
    surfaceM2: null,
    depotGarantie: null,
    jourPaiement: null,
    ...overrides,
  };
}

// ============================================================
// Tests : chargerBailleurBail
// ============================================================

describe('chargerBailleurBail', () => {
  it('retourne les données complètes du bailleur', () => {
    const b = chargerBailleurBail();
    expect(b.nom_complet).toBe('Thomas Issa');
    expect(b.nom_avec_capitales).toBe('Thomas ISSA');
    expect(b.date_naissance).toBe('1986-10-09');
    expect(b.lieu_naissance).toBe('Paris 13');
    expect(b.nationalite).toBe('Française');
    expect(b.adresse).toBe('54 rue Henri Barbusse');
    expect(b.cp_ville).toBe('92000 Nanterre');
    expect(b.signature_largeur_mm).toBe(40);
  });
});

// ============================================================
// Tests : chargerDefaultsBail
// ============================================================

describe('chargerDefaultsBail', () => {
  it('retourne les valeurs par défaut', () => {
    const d = chargerDefaultsBail();
    expect(d.depot_garantie).toBe(1000);
    expect(d.delai_restitution_depot).toBe('1 mois');
    expect(d.jour_paiement_loyer).toBe(1);
    expect(d.duree_bail).toBe('un an');
    expect(d.preavis_locataire).toBe('un mois');
    expect(d.preavis_bailleur).toBe('3 mois');
    expect(d.lieu_signature).toBe('Nanterre');
    expect(d.type_bail).toBe('CONTRAT DE LOCATION MEUBLEE');
  });
});

// ============================================================
// Tests : resoudreBienBail
// ============================================================

describe('resoudreBienBail', () => {
  it('résout un bien avec complément statique (barbusse)', () => {
    const loc = makeLocataire({ adresseBien: '54 rue Henri Barbusse, 92000 Nanterre' });
    const bien = resoudreBienBail(loc);
    expect(bien).not.toBeNull();
    expect(bien!.id).toBe('barbusse-studio');
    expect(bien!.complement).toBe('RDC sur cour');
    expect(bien!.surfaceM2).toBe(14);
    expect(bien!.pieces).toContain('cuisine');
    expect(bien!.chargesIncluses).toContain('électricité');
    expect(bien!.inventaireType).toBe('studio-meuble-standard');
  });

  it('résout un bien avec template (bd-seine studio 7)', () => {
    const loc = makeLocataire({ adresseBien: '2 bis boulevard de la Seine, Studio 7, 92000 Nanterre' });
    const bien = resoudreBienBail(loc);
    expect(bien).not.toBeNull();
    expect(bien!.id).toBe('bd-seine-nanterre');
    expect(bien!.complement).toBe('Appartement 7, 6e étage');
    expect(bien!.surfaceM2).toBe(13);
  });

  it('résout un bien par côté (saint-michel rue)', () => {
    const loc = makeLocataire({ adresseBien: '7 passage Saint-Michel, studio côté rue, 75017 Paris' });
    const bien = resoudreBienBail(loc);
    expect(bien).not.toBeNull();
    expect(bien!.id).toBe('saint-michel-rue');
    expect(bien!.complement).toBe('RDC sur rue');
  });

  it('résout un bien par côté (saint-michel cour)', () => {
    const loc = makeLocataire({ adresseBien: '7 passage Saint-Michel côté cour, 75017 Paris' });
    const bien = resoudreBienBail(loc);
    expect(bien).not.toBeNull();
    expect(bien!.complement).toBe('RDC sur cour');
  });

  it('résout un bien par côté (saint-michel défaut)', () => {
    const loc = makeLocataire({ adresseBien: '7 passage Saint-Michel, 75017 Paris' });
    const bien = resoudreBienBail(loc);
    expect(bien).not.toBeNull();
    expect(bien!.complement).toBe('RDC');
  });

  it('retourne null pour adresse inconnue', () => {
    const loc = makeLocataire({ adresseBien: '99 avenue des Champs-Élysées' });
    const bien = resoudreBienBail(loc);
    expect(bien).toBeNull();
  });

  it('résout Myrha correctement', () => {
    const loc = makeLocataire({ adresseBien: '74 rue Myrha, 75018 Paris' });
    const bien = resoudreBienBail(loc);
    expect(bien).not.toBeNull();
    expect(bien!.id).toBe('myrha-paris');
    expect(bien!.surfaceM2).toBe(20);
    expect(bien!.complement).toBe('RDC');
  });
});

// ============================================================
// Tests : chargerInventaire
// ============================================================

describe('chargerInventaire', () => {
  it('charge studio-meuble-standard', () => {
    const inv = chargerInventaire('studio-meuble-standard');
    expect(inv).not.toBeNull();
    expect(inv!['electromenager']).toContain('1 four à micro-ondes');
    expect(inv!['vaisselle']).toContain('6 assiettes normales');
    expect(inv!['linge']).toContain('1 couette');
    expect(inv!['divers']).toContain('1 poubelle');
  });

  it('retourne null pour type inconnu', () => {
    const inv = chargerInventaire('type-inexistant');
    expect(inv).toBeNull();
  });
});

// ============================================================
// Tests : verifierFicheBail
// ============================================================

describe('verifierFicheBail', () => {
  it('retourne aucune issue pour fiche complète', () => {
    const loc = makeLocataire();
    const issues = verifierFicheBail(loc);
    expect(issues).toEqual([]);
  });

  it('signale civilite manquante', () => {
    const loc = makeLocataire({ civilite: null });
    const issues = verifierFicheBail(loc);
    expect(issues).toContain('civilite (Monsieur/Madame/Mademoiselle)');
  });

  it('signale date_naissance manquante', () => {
    const loc = makeLocataire({ dateNaissance: null });
    const issues = verifierFicheBail(loc);
    expect(issues).toContain('date_naissance (YYYY-MM-DD)');
  });

  it('signale lieu_naissance manquant', () => {
    const loc = makeLocataire({ lieuNaissance: null });
    const issues = verifierFicheBail(loc);
    expect(issues).toContain('lieu_naissance');
  });

  it('signale nationalite manquante', () => {
    const loc = makeLocataire({ nationalite: null });
    const issues = verifierFicheBail(loc);
    expect(issues).toContain('nationalite');
  });

  it('signale montant_loyer invalide', () => {
    const loc = makeLocataire({ montantLoyer: 0 });
    const issues = verifierFicheBail(loc);
    expect(issues).toContain('montant_loyer');
  });

  it('signale adresse_bien manquante', () => {
    // Pour tester, on force via cast car normalement montant_loyer > 0 est requis aussi
    const loc = makeLocataire({ adresseBien: '' as unknown as string, montantLoyer: 500 });
    const issues = verifierFicheBail(loc);
    expect(issues).toContain('adresse_bien');
  });

  it('signale plusieurs champs manquants', () => {
    const loc = makeLocataire({ civilite: null, dateNaissance: null, lieuNaissance: null });
    const issues = verifierFicheBail(loc);
    expect(issues.length).toBe(3);
  });
});

// ============================================================
// Tests : construireVariablesBail
// ============================================================

describe('construireVariablesBail', () => {
  it('construit les variables pour un locataire complet', () => {
    const loc = makeLocataire();
    const dateDebut = new Date('2026-05-15');
    const result = construireVariablesBail(loc, dateDebut);

    expect('error' in result).toBe(false);
    if ('error' in result) return;

    expect(result.bailleurNom).toBe('Thomas Issa');
    expect(result.bailleurNomCapitales).toBe('Thomas ISSA');
    expect(result.locataireNom).toBe('Kenan Beguigneau');
    expect(result.locataireCiviliteAbregee).toBe('M.');
    expect(result.locataireEstFeminin).toBe(false);
    expect(result.bienSurfaceM2).toBe(13); // bail-config value
    expect(result.loyer).toBe(590);
    expect(result.charges).toBe(100);
    expect(result.depotGarantie).toBe(1000); // default
    expect(result.jourPaiement).toBe(1); // default
    expect(result.dureeBail).toBe('un an');
    expect(result.inventaire).not.toBeNull();
  });

  it('retourne erreur pour adresse inconnue', () => {
    const loc = makeLocataire({ adresseBien: 'adresse-inexistante' });
    const result = construireVariablesBail(loc, new Date('2026-05-15'));
    expect('error' in result).toBe(true);
  });

  it('utilise la surface de la fiche si présente', () => {
    const loc = makeLocataire({ surfaceM2: 18 });
    const result = construireVariablesBail(loc, new Date('2026-05-15'));
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.bienSurfaceM2).toBe(18);
  });

  it('utilise le dépôt de la fiche si présent', () => {
    const loc = makeLocataire({ depotGarantie: 1500 });
    const result = construireVariablesBail(loc, new Date('2026-05-15'));
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.depotGarantie).toBe(1500);
  });

  it('utilise le jour de paiement de la fiche si présent', () => {
    const loc = makeLocataire({ jourPaiement: 5 });
    const result = construireVariablesBail(loc, new Date('2026-05-15'));
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.jourPaiement).toBe(5);
  });

  it('applique les overrides loyer/charges/dépôt', () => {
    const loc = makeLocataire();
    const result = construireVariablesBail(loc, new Date('2026-05-15'), undefined, {
      loyer: 700,
      charges: 150,
      depot: 2000,
    });
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.loyer).toBe(700);
    expect(result.charges).toBe(150);
    expect(result.depotGarantie).toBe(2000);
  });

  it('date de signature = veille par défaut', () => {
    const loc = makeLocataire();
    const dateDebut = new Date('2026-05-15');
    const result = construireVariablesBail(loc, dateDebut);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.dateSignature.getDate()).toBe(14);
    expect(result.dateSignature.getMonth()).toBe(4); // mai = 4 (0-indexed)
  });

  it('accepte une date de signature explicite', () => {
    const loc = makeLocataire();
    const dateDebut = new Date('2026-05-15');
    const dateSig = new Date('2026-05-10');
    const result = construireVariablesBail(loc, dateDebut, dateSig);
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.dateSignature.getDate()).toBe(10);
  });

  it('accorde au féminin pour Madame', () => {
    const loc = makeLocataire({ civilite: 'Madame' });
    const result = construireVariablesBail(loc, new Date('2026-05-15'));
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.locataireEstFeminin).toBe(true);
    expect(result.locataireCiviliteAbregee).toBe('Mme');
  });
});
