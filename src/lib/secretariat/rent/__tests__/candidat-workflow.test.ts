/**
 * Tests pour le workflow candidat — machine d'états + génération fiche Markdown.
 *
 * Couvre :
 * - candidatWorkflow.start
 * - Collecte nom, contact, situation, garanties, bien, notes
 * - Récap et confirmation
 * - Annulation et callbacks
 * - buildCandidatMarkdown (génération fiche .md)
 */

import { describe, it, expect, vi } from 'vitest';
import { candidatWorkflow, buildCandidatMarkdown } from '../../workflows/candidat';

// ============================================================
// Mock des dépendances Drive
// ============================================================

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn().mockResolvedValue(null),
  getOrCreateSubfolder: vi.fn().mockResolvedValue(null),
}));

// ============================================================
// Tests : candidatWorkflow.start
// ============================================================

describe('candidatWorkflow.start', () => {
  it('démarre en collecting_nom avec message de bienvenue', async () => {
    const result = await candidatWorkflow.start(123);
    expect(result.newState).not.toBeNull();
    expect(result.newState!.type).toBe('candidat');
    expect(result.newState!.step).toBe('collecting_nom');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.text).toContain('Nom et prénom');
  });
});

// ============================================================
// Tests : collecte séquentielle des informations
// ============================================================

describe('candidatWorkflow.handleMessage — flow complet', () => {
  async function advanceTo(step: string) {
    const startResult = await candidatWorkflow.start(123);
    let state = startResult.newState!;

    // collecting_nom → collecting_contact
    if (step === 'collecting_nom') return { state, messages: startResult.messages };
    let result = await candidatWorkflow.handleMessage(123, state, 'Marie Dupont');
    state = result.newState!;
    if (step === 'collecting_contact') return { state, messages: result.messages };

    // collecting_contact → collecting_situation
    result = await candidatWorkflow.handleMessage(123, state, 'marie@test.com 06 12 34 56 78');
    state = result.newState!;
    if (step === 'collecting_situation') return { state, messages: result.messages };

    // collecting_situation → collecting_garanties
    result = await candidatWorkflow.handleMessage(123, state, 'CDI chez Decathlon');
    state = result.newState!;
    if (step === 'collecting_garanties') return { state, messages: result.messages };

    // collecting_garanties → collecting_bien
    result = await candidatWorkflow.handleMessage(123, state, 'Garant parent — revenus 4000€/mois');
    state = result.newState!;
    if (step === 'collecting_bien') return { state, messages: result.messages };

    // collecting_bien → collecting_notes
    result = await candidatWorkflow.handleMessage(123, state, 'Studio 7, 2 bis bd de la Seine');
    state = result.newState!;
    if (step === 'collecting_notes') return { state, messages: result.messages };

    // collecting_notes → confirming_recap
    result = await candidatWorkflow.handleMessage(123, state, 'Dossier solide, à rappeler');
    state = result.newState!;
    if (step === 'confirming_recap') return { state, messages: result.messages };

    return { state, messages: result.messages };
  }

  it('collecting_nom → extracte prénom et nom', async () => {
    const startResult = await candidatWorkflow.start(123);
    const result = await candidatWorkflow.handleMessage(123, startResult.newState!, 'Marie Dupont');
    expect(result.newState!.step).toBe('collecting_contact');
    expect(result.messages[0]!.text).toContain('Marie Dupont');
    expect(result.messages[0]!.text).toContain('Email');
  });

  it('collecting_nom → refuse un nom trop court', async () => {
    const startResult = await candidatWorkflow.start(123);
    const result = await candidatWorkflow.handleMessage(123, startResult.newState!, 'A');
    expect(result.newState!.step).toBe('collecting_nom');
    expect(result.messages[0]!.text).toContain('trop court');
  });

  it('collecting_contact → extracte email et téléphone', async () => {
    const { state } = await advanceTo('collecting_contact');
    const result = await candidatWorkflow.handleMessage(123, state, 'marie@test.com 06 12 34 56 78');
    expect(result.newState!.step).toBe('collecting_situation');
    const data = result.newState!.data as Record<string, unknown>;
    expect(data['email']).toBe('marie@test.com');
    expect(data['telephone']).toBeDefined();
  });

  it('collecting_contact → "skip" passe sans info', async () => {
    const { state } = await advanceTo('collecting_contact');
    const result = await candidatWorkflow.handleMessage(123, state, 'skip');
    expect(result.newState!.step).toBe('collecting_situation');
    const data = result.newState!.data as Record<string, unknown>;
    expect(data['email']).toBeUndefined();
    expect(data['telephone']).toBeUndefined();
  });

  it('collecting_situation → enregistre la situation', async () => {
    const { state } = await advanceTo('collecting_situation');
    const result = await candidatWorkflow.handleMessage(123, state, 'CDI chez Decathlon');
    expect(result.newState!.step).toBe('collecting_garanties');
    const data = result.newState!.data as Record<string, unknown>;
    expect(data['situationPro']).toBe('CDI chez Decathlon');
  });

  it('collecting_garanties → enregistre les garanties', async () => {
    const { state } = await advanceTo('collecting_garanties');
    const result = await candidatWorkflow.handleMessage(123, state, 'Visale');
    expect(result.newState!.step).toBe('collecting_bien');
    const data = result.newState!.data as Record<string, unknown>;
    expect(data['garanties']).toBe('Visale');
  });

  it('collecting_bien → enregistre le bien', async () => {
    const { state } = await advanceTo('collecting_bien');
    const result = await candidatWorkflow.handleMessage(123, state, 'Studio 7');
    expect(result.newState!.step).toBe('collecting_notes');
    const data = result.newState!.data as Record<string, unknown>;
    expect(data['bienVise']).toBe('Studio 7');
  });

  it('collecting_notes → passe au récap', async () => {
    const { state } = await advanceTo('collecting_notes');
    const result = await candidatWorkflow.handleMessage(123, state, 'Dossier solide');
    expect(result.newState!.step).toBe('confirming_recap');
    expect(result.messages[0]!.text).toContain('Récapitulatif');
    expect(result.messages[0]!.text).toContain('Marie Dupont');
  });

  it('collecting_notes → skip passe aussi au récap', async () => {
    const { state } = await advanceTo('collecting_notes');
    const result = await candidatWorkflow.handleMessage(123, state, 'skip');
    expect(result.newState!.step).toBe('confirming_recap');
  });
});

// ============================================================
// Tests : confirming_recap
// ============================================================

describe('candidatWorkflow.handleMessage — confirming_recap', () => {
  async function getRecapState() {
    const start = await candidatWorkflow.start(123);
    let state = start.newState!;
    state = (await candidatWorkflow.handleMessage(123, state, 'Marie Dupont')).newState!;
    state = (await candidatWorkflow.handleMessage(123, state, 'skip')).newState!;
    state = (await candidatWorkflow.handleMessage(123, state, 'CDI')).newState!;
    state = (await candidatWorkflow.handleMessage(123, state, 'skip')).newState!;
    state = (await candidatWorkflow.handleMessage(123, state, 'skip')).newState!;
    const result = await candidatWorkflow.handleMessage(123, state, 'skip');
    return result;
  }

  it('récap contient le nom du candidat', async () => {
    const result = await getRecapState();
    expect(result.messages[0]!.text).toContain('Marie Dupont');
    expect(result.newState!.step).toBe('confirming_recap');
  });

  it('"ok" passe en creating_fiche', async () => {
    const recap = await getRecapState();
    const result = await candidatWorkflow.handleMessage(123, recap.newState!, 'ok');
    expect(result.newState!.step).toBe('creating_fiche');
  });

  it('"annuler" termine le workflow', async () => {
    const recap = await getRecapState();
    const result = await candidatWorkflow.handleMessage(123, recap.newState!, 'annuler');
    expect(result.newState).toBeNull();
    expect(result.messages[0]!.text).toContain('annulée');
  });

  it('texte non reconnu reste sur confirming_recap', async () => {
    const recap = await getRecapState();
    const result = await candidatWorkflow.handleMessage(123, recap.newState!, 'hmm');
    expect(result.newState!.step).toBe('confirming_recap');
    expect(result.messages[0]!.text).toContain('"ok"');
  });
});

// ============================================================
// Tests : callbacks
// ============================================================

describe('candidatWorkflow.handleCallback', () => {
  it('cand_cancel annule le workflow', async () => {
    const start = await candidatWorkflow.start(123);
    const result = await candidatWorkflow.handleCallback(123, start.newState!, 'cand_cancel');
    expect(result.newState).toBeNull();
    expect(result.messages[0]!.text).toContain('annulée');
  });
});

// ============================================================
// Tests : cancel
// ============================================================

describe('candidatWorkflow.cancel', () => {
  it('retourne newState null et message d\'annulation', async () => {
    const start = await candidatWorkflow.start(123);
    const result = await candidatWorkflow.cancel(123, start.newState!);
    expect(result.newState).toBeNull();
    expect(result.messages[0]!.text).toContain('annulée');
  });
});

// ============================================================
// Tests : handlePhoto / handleVoice
// ============================================================

describe('candidatWorkflow non-text handlers', () => {
  it('handlePhoto retourne un message informatif', async () => {
    const start = await candidatWorkflow.start(123);
    const result = await candidatWorkflow.handlePhoto(123, start.newState!, '', '');
    expect(result.messages[0]!.text).toContain('photos');
  });

  it('handleVoice retourne un message informatif', async () => {
    const start = await candidatWorkflow.start(123);
    const result = await candidatWorkflow.handleVoice(123, start.newState!, '', '');
    expect(result.messages[0]!.text).toContain('vocaux');
  });
});

// ============================================================
// Tests : buildCandidatMarkdown
// ============================================================

describe('buildCandidatMarkdown', () => {
  it('génère un frontmatter YAML valide', () => {
    const md = buildCandidatMarkdown({
      prenom: 'Marie',
      nom: 'Dupont',
      email: 'marie@test.com',
      telephone: '0612345678',
      situationPro: 'CDI chez Decathlon',
      garanties: 'Garant parent',
      bienVise: 'Studio 7, Nanterre',
      notes: 'Dossier solide',
    });

    expect(md).toContain('---');
    expect(md).toContain('prenom: "Marie"');
    expect(md).toContain('nom: "Dupont"');
    expect(md).toContain('email: "marie@test.com"');
    expect(md).toContain('telephone: "0612345678"');
    expect(md).toContain('situation_pro: "CDI chez Decathlon"');
    expect(md).toContain('garanties: "Garant parent"');
    expect(md).toContain('bien_vise: "Studio 7, Nanterre"');
    expect(md).toContain('statut: candidat');
    expect(md).toContain('# Marie Dupont');
  });

  it('gère les champs optionnels vides', () => {
    const md = buildCandidatMarkdown({
      prenom: 'Jean',
      nom: 'Test',
    });

    expect(md).toContain('prenom: "Jean"');
    expect(md).toContain('nom: "Test"');
    expect(md).toContain('email: ""');
    expect(md).toContain('telephone: ""');
    expect(md).not.toContain('## Situation professionnelle');
    expect(md).not.toContain('## Notes');
  });

  it('inclut les sections de contenu si remplies', () => {
    const md = buildCandidatMarkdown({
      prenom: 'Marie',
      nom: 'Dupont',
      situationPro: 'CDI',
      garanties: 'Visale',
      bienVise: 'Studio 7',
      notes: 'À rappeler',
    });

    expect(md).toContain('## Situation professionnelle');
    expect(md).toContain('CDI');
    expect(md).toContain('## Garanties');
    expect(md).toContain('Visale');
    expect(md).toContain('## Bien visé');
    expect(md).toContain('Studio 7');
    expect(md).toContain('## Notes');
    expect(md).toContain('À rappeler');
  });

  it('inclut la date de candidature au format YYYY-MM-DD', () => {
    const md = buildCandidatMarkdown({ prenom: 'Test', nom: 'User' });
    // Should match format YYYY-MM-DD
    expect(md).toMatch(/date_candidature: \d{4}-\d{2}-\d{2}/);
  });
});
