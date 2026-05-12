/**
 * Tests pour le workflow fin de bail — machine d'états.
 *
 * Couvre :
 * - finDeBailWorkflow.start (liste locataires)
 * - Sélection locataire (réutilise parseLocataireSelection)
 * - Étape collecting_date_fin
 * - Étape confirming_recap
 * - Annulation et callbacks
 * - construireVariablesFinDeBail
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { finDeBailWorkflow, construireVariablesFinDeBail } from '../../workflows/fin-de-bail';

// ============================================================
// Mock des dépendances Drive
// ============================================================

vi.mock('../../rent/locataires', () => ({
  rechercherLocataire: vi.fn().mockResolvedValue({
    locataire: null,
    candidats: [],
    totaux: { actuels: 0, candidats: 0 },
  }),
  listerLocatairesActuels: vi.fn().mockResolvedValue([
    'Kenan Beguigneau',
    'Hella Taoutaou',
  ]),
  loadAllFiches: vi.fn().mockResolvedValue({
    fiches: [
      {
        nomFichier: 'Kenan Beguigneau',
        nomOfficiel: null,
        locataire: {
          nomFichier: 'Kenan Beguigneau',
          nomAffiche: 'Kenan Beguigneau',
          civilite: 'Monsieur',
          email: null,
          adresseBien: '2 bis boulevard de la Seine, Studio 7, 92000 Nanterre',
          montantLoyer: 590,
          montantCharges: 100,
          dateEntreeBail: null,
          dateFinBail: new Date(2026, 4, 31), // 31 mai 2026
          moyenPaiement: 'Virement bancaire',
        },
        source: 'actuels',
      },
      {
        nomFichier: 'Hella Taoutaou',
        nomOfficiel: null,
        locataire: {
          nomFichier: 'Hella Taoutaou',
          nomAffiche: 'Hella Taoutaou',
          civilite: 'Madame',
          email: null,
          adresseBien: '2 bis boulevard de la Seine, Studio 5, 92000 Nanterre',
          montantLoyer: 550,
          montantCharges: 80,
          dateEntreeBail: null,
          dateFinBail: null,
          moyenPaiement: 'Virement bancaire',
        },
        source: 'actuels',
      },
    ],
    totaux: { actuels: 2, candidats: 0 },
    loadedAt: Date.now(),
  }),
}));

vi.mock('../../rent/bail-config', () => ({
  chargerBailleurBail: vi.fn().mockReturnValue({
    nom_complet: 'Jean-Pierre ISSA',
    nom_avec_capitales: 'Jean-Pierre ISSA',
    date_naissance: '1960-03-15',
    lieu_naissance: 'Beyrouth',
    nationalite: 'Française',
    adresse: '123 rue du Test',
    cp_ville: '92000 Nanterre',
    signature_image: 'signature.png',
    signature_largeur_mm: 40,
  }),
  chargerDefaultsBail: vi.fn().mockReturnValue({
    depot_garantie: 590,
    delai_restitution_depot: '1 mois',
    jour_paiement_loyer: 5,
    duree_bail: '1 an renouvelable',
    preavis_locataire: '1 mois',
    preavis_bailleur: '3 mois',
    lieu_signature: 'Nanterre',
    type_bail: 'meublé',
  }),
}));

vi.mock('../../rent/biens', () => ({
  resoudreBien: vi.fn().mockReturnValue({
    ligne1: '2 bis boulevard de la Seine',
    ligne2: 'Studio 7',
    cpVille: '92000 Nanterre',
  }),
}));

vi.mock('../../rent/signature', () => ({
  chargerSignatureBase64: vi.fn().mockReturnValue(null),
}));

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn().mockResolvedValue(null),
  getOrCreateSubfolder: vi.fn().mockResolvedValue(null),
}));

// ============================================================
// Tests : finDeBailWorkflow.start
// ============================================================

describe('finDeBailWorkflow.start', () => {
  it('retourne une liste numérotée de locataires', async () => {
    const result = await finDeBailWorkflow.start(123);
    expect(result.newState).not.toBeNull();
    expect(result.newState!.type).toBe('findebail');
    expect(result.newState!.step).toBe('selecting_locataire');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.text).toContain('Kenan Beguigneau');
    expect(result.messages[0]!.text).toContain('Hella Taoutaou');
    expect(result.messages[0]!.text).toContain('Fin de bail');
  });
});

// ============================================================
// Tests : sélection locataire → date fin
// ============================================================

describe('finDeBailWorkflow.handleMessage — selecting_locataire', () => {
  it('sélectionne un locataire par numéro et passe à collecting_date_fin', async () => {
    const startResult = await finDeBailWorkflow.start(123);
    const state = startResult.newState!;

    const result = await finDeBailWorkflow.handleMessage(123, state, '1');
    expect(result.newState).not.toBeNull();
    expect(result.newState!.step).toBe('collecting_date_fin');
    expect(result.messages[0]!.text).toContain('Kenan Beguigneau');
    expect(result.messages[0]!.text).toContain('Date de fin du bail');
  });

  it('affiche la date de fin enregistrée si présente', async () => {
    const startResult = await finDeBailWorkflow.start(123);
    const state = startResult.newState!;

    const result = await finDeBailWorkflow.handleMessage(123, state, '1');
    // Kenan a dateFinBail = 31/05/2026
    expect(result.messages[0]!.text).toContain('Date de fin enregistrée');
    expect(result.messages[0]!.text).toContain('31/05/2026');
  });

  it('ne propose pas de date par défaut si dateFinBail est null', async () => {
    const startResult = await finDeBailWorkflow.start(123);
    const state = startResult.newState!;

    const result = await finDeBailWorkflow.handleMessage(123, state, '2');
    // Hella n'a pas de dateFinBail
    expect(result.messages[0]!.text).not.toContain('Date de fin enregistrée');
  });

  it('refuse "tous" pour fin de bail (un seul locataire)', async () => {
    const startResult = await finDeBailWorkflow.start(123);
    const state = startResult.newState!;

    const result = await finDeBailWorkflow.handleMessage(123, state, 'tous');
    expect(result.newState!.step).toBe('selecting_locataire');
    expect(result.messages[0]!.text).toContain('un seul locataire');
  });
});

// ============================================================
// Tests : collecting_date_fin → confirming_recap
// ============================================================

describe('finDeBailWorkflow.handleMessage — collecting_date_fin', () => {
  async function getDateFinState() {
    const startResult = await finDeBailWorkflow.start(123);
    return await finDeBailWorkflow.handleMessage(123, startResult.newState!, '1');
  }

  it('parse une date ISO et passe au récap', async () => {
    const dateState = await getDateFinState();
    const result = await finDeBailWorkflow.handleMessage(123, dateState.newState!, '2026-05-31');
    expect(result.newState!.step).toBe('confirming_recap');
    expect(result.messages[0]!.text).toContain('31/05/2026');
  });

  it('parse une date FR et passe au récap', async () => {
    const dateState = await getDateFinState();
    const result = await finDeBailWorkflow.handleMessage(123, dateState.newState!, '31/05/2026');
    expect(result.newState!.step).toBe('confirming_recap');
  });

  it('parse une date FR texte et passe au récap', async () => {
    const dateState = await getDateFinState();
    const result = await finDeBailWorkflow.handleMessage(123, dateState.newState!, '31 mai 2026');
    expect(result.newState!.step).toBe('confirming_recap');
  });

  it('accepte "ok" si dateFinBail existe', async () => {
    const dateState = await getDateFinState();
    const result = await finDeBailWorkflow.handleMessage(123, dateState.newState!, 'ok');
    expect(result.newState!.step).toBe('confirming_recap');
  });

  it('rejette un format invalide', async () => {
    const dateState = await getDateFinState();
    const result = await finDeBailWorkflow.handleMessage(123, dateState.newState!, 'demain');
    expect(result.newState!.step).toBe('collecting_date_fin');
    expect(result.messages[0]!.text).toContain('Date non reconnue');
  });
});

// ============================================================
// Tests : confirming_recap
// ============================================================

describe('finDeBailWorkflow.handleMessage — confirming_recap', () => {
  async function getRecapState() {
    const startResult = await finDeBailWorkflow.start(123);
    const selResult = await finDeBailWorkflow.handleMessage(123, startResult.newState!, '1');
    return await finDeBailWorkflow.handleMessage(123, selResult.newState!, '2026-05-31');
  }

  it('affiche un récap avec locataire, bien et date', async () => {
    const recapResult = await getRecapState();
    const text = recapResult.messages[0]!.text;
    expect(text).toContain('Kenan Beguigneau');
    expect(text).toContain('31/05/2026');
    expect(text).toContain('Récapitulatif fin de bail');
  });

  it('"ok" passe en generating', async () => {
    const recapResult = await getRecapState();
    const result = await finDeBailWorkflow.handleMessage(123, recapResult.newState!, 'ok');
    expect(result.newState!.step).toBe('generating');
  });

  it('"annuler" termine le workflow', async () => {
    const recapResult = await getRecapState();
    const result = await finDeBailWorkflow.handleMessage(123, recapResult.newState!, 'annuler');
    expect(result.newState).toBeNull();
    expect(result.messages[0]!.text).toContain('annulée');
  });

  it('texte non reconnu reste sur confirming_recap', async () => {
    const recapResult = await getRecapState();
    const result = await finDeBailWorkflow.handleMessage(123, recapResult.newState!, 'peut-être');
    expect(result.newState!.step).toBe('confirming_recap');
    expect(result.messages[0]!.text).toContain('"ok"');
  });
});

// ============================================================
// Tests : callbacks
// ============================================================

describe('finDeBailWorkflow.handleCallback', () => {
  async function getRecapState() {
    const startResult = await finDeBailWorkflow.start(123);
    const selResult = await finDeBailWorkflow.handleMessage(123, startResult.newState!, '1');
    return await finDeBailWorkflow.handleMessage(123, selResult.newState!, '2026-05-31');
  }

  it('fdb_cancel annule le workflow', async () => {
    const recapResult = await getRecapState();
    const result = await finDeBailWorkflow.handleCallback(123, recapResult.newState!, 'fdb_cancel');
    expect(result.newState).toBeNull();
    expect(result.messages[0]!.text).toContain('annulée');
  });

  it('fdb_confirm passe en generating', async () => {
    const recapResult = await getRecapState();
    const result = await finDeBailWorkflow.handleCallback(123, recapResult.newState!, 'fdb_confirm');
    expect(result.newState!.step).toBe('generating');
  });
});

// ============================================================
// Tests : cancel
// ============================================================

describe('finDeBailWorkflow.cancel', () => {
  it('retourne newState null et message d\'annulation', async () => {
    const startResult = await finDeBailWorkflow.start(123);
    const result = await finDeBailWorkflow.cancel(123, startResult.newState!);
    expect(result.newState).toBeNull();
    expect(result.messages[0]!.text).toContain('annulée');
  });
});

// ============================================================
// Tests : construireVariablesFinDeBail
// ============================================================

describe('construireVariablesFinDeBail', () => {
  const mockLocataire = {
    nomFichier: 'Kenan Beguigneau',
    nomAffiche: 'Kenan Beguigneau',
    civilite: 'Monsieur',
    email: null,
    adresseBien: '2 bis boulevard de la Seine, Studio 7, 92000 Nanterre',
    montantLoyer: 590,
    montantCharges: 100,
    dateEntreeBail: null,
    dateFinBail: null,
    moyenPaiement: 'Virement bancaire',
  };

  it('construit les variables avec un bien résolu', () => {
    const result = construireVariablesFinDeBail(mockLocataire, new Date(2026, 4, 31));
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.bailleurNom).toBe('Jean-Pierre ISSA');
      expect(result.locataireNom).toBe('Monsieur Kenan Beguigneau');
      expect(result.adresseBien).toContain('2 bis boulevard de la Seine');
      expect(result.adresseBien).toContain('92000 Nanterre');
      expect(result.lieuSignature).toBe('Nanterre');
    }
  });

  it('retourne une erreur si le bien est introuvable', async () => {
    const biensModule = await import('../../rent/biens');
    const resoudreBienMock = vi.mocked(biensModule.resoudreBien);
    resoudreBienMock.mockReturnValueOnce(null);

    const result = construireVariablesFinDeBail(
      { ...mockLocataire, adresseBien: 'adresse inexistante' },
      new Date(2026, 4, 31),
    );
    expect('error' in result).toBe(true);
  });
});

// ============================================================
// Tests : handlePhoto / handleVoice
// ============================================================

describe('finDeBailWorkflow non-text handlers', () => {
  it('handlePhoto retourne un message informatif', async () => {
    const startResult = await finDeBailWorkflow.start(123);
    const result = await finDeBailWorkflow.handlePhoto(123, startResult.newState!, '', '');
    expect(result.messages[0]!.text).toContain('photos');
  });

  it('handleVoice retourne un message informatif', async () => {
    const startResult = await finDeBailWorkflow.start(123);
    const result = await finDeBailWorkflow.handleVoice(123, startResult.newState!, '', '');
    expect(result.messages[0]!.text).toContain('vocaux');
  });
});
