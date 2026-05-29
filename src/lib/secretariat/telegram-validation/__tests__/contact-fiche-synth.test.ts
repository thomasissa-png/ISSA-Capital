/**
 * Tests `contact-fiche-synth` — synthèse + rendu fiche enrichie (S23).
 *
 * Mocks : llm/client.callLLM. Aucun appel réseau réel.
 * renderEnrichedFiche est testé directement (fonction pure).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GatheredContactEmail } from '../../gmail-source/contact-emails-gatherer';
import {
  synthesizeContactFiche,
  renderEnrichedFiche,
  type ContactFicheData,
} from '../contact-fiche-synth';

// ============================================================
// Mock callLLM
// ============================================================

const mockCallLLM = vi.fn();

vi.mock('../../llm/client', () => ({
  callLLM: (...args: unknown[]) => mockCallLLM(...args),
}));

// ============================================================
// Fixtures
// ============================================================

function makeEmails(n: number): GatheredContactEmail[] {
  return Array.from({ length: n }, (_, i) => ({
    date: `2026-05-${String(20 - i).padStart(2, '0')}`,
    subject: `Sujet ${i + 1}`,
    excerpt: `Extrait ${i + 1}`,
    direction: i % 2 === 0 ? ('from' as const) : ('to' as const),
  }));
}

const baseInput = {
  senderEmail: 'francois@exemple.com',
  nameFrom: 'François Lambert',
  type: 'pro' as const,
  emailThreadRef: '(cf. thread Gmail msg-1)',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// synthesizeContactFiche
// ============================================================

describe('synthesizeContactFiche', () => {
  it('emails vides → null sans appel LLM', async () => {
    const res = await synthesizeContactFiche({ ...baseInput, emails: [] });
    expect(res).toBeNull();
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it('LLM renvoie un JSON valide → données extraites', async () => {
    mockCallLLM.mockResolvedValue({
      text: JSON.stringify({
        nomComplet: 'François Lambert',
        role: 'Directeur',
        societe: 'Lambert Capital',
        sujets: ['Club deal', 'Structuration'],
        telephone: '+33 6 12 34 56 78',
      }),
      networkRetries: 0,
    });

    const res = await synthesizeContactFiche({ ...baseInput, emails: makeEmails(3) });
    expect(res).not.toBeNull();
    expect(res!.role).toBe('Directeur');
    expect(res!.societe).toBe('Lambert Capital');
    expect(res!.sujets).toEqual(['Club deal', 'Structuration']);
    expect(res!.telephone).toBe('+33 6 12 34 56 78');

    // Routée sur la tâche contact-fiche.
    expect(mockCallLLM.mock.calls[0]![0].task).toBe('contact-fiche');
    expect(mockCallLLM.mock.calls[0]![0].responseFormat).toBe('json');
  });

  it('JSON dans un bloc markdown ```json``` → parsé', async () => {
    mockCallLLM.mockResolvedValue({
      text: '```json\n{ "societe": "ACME" }\n```',
      networkRetries: 0,
    });
    const res = await synthesizeContactFiche({ ...baseInput, emails: makeEmails(1) });
    expect(res!.societe).toBe('ACME');
  });

  it('bloc <think> DeepSeek + JSON → think ignoré, JSON parsé (bug stub S24)', async () => {
    mockCallLLM.mockResolvedValue({
      text: '<think>L\'expéditeur signe « François », société ACME visible.</think>\n{ "societe": "ACME", "role": "CEO" }',
      networkRetries: 0,
    });
    const res = await synthesizeContactFiche({ ...baseInput, emails: makeEmails(2) });
    expect(res!.societe).toBe('ACME');
    expect(res!.role).toBe('CEO');
  });

  it('virgules traînantes (erreur DeepSeek fréquente) → tolérées', async () => {
    mockCallLLM.mockResolvedValue({
      text: '{ "societe": "ACME", "sujets": ["earn-out", "séquestres",], }',
      networkRetries: 0,
    });
    const res = await synthesizeContactFiche({ ...baseInput, emails: makeEmails(2) });
    expect(res!.societe).toBe('ACME');
    expect(res!.sujets).toEqual(['earn-out', 'séquestres']);
  });

  it('champs vides/whitespace → omis (zéro invention)', async () => {
    mockCallLLM.mockResolvedValue({
      text: JSON.stringify({ role: '   ', societe: 'ACME', telephone: '' }),
      networkRetries: 0,
    });
    const res = await synthesizeContactFiche({ ...baseInput, emails: makeEmails(1) });
    expect(res!.societe).toBe('ACME');
    expect(res!.role).toBeUndefined();
    expect(res!.telephone).toBeUndefined();
  });

  it('JSON sans aucun champ exploitable → null (vaut le stub)', async () => {
    mockCallLLM.mockResolvedValue({ text: '{}', networkRetries: 0 });
    const res = await synthesizeContactFiche({ ...baseInput, emails: makeEmails(1) });
    expect(res).toBeNull();
  });

  it('texte non-JSON → null', async () => {
    mockCallLLM.mockResolvedValue({ text: 'désolé je ne peux pas', networkRetries: 0 });
    const res = await synthesizeContactFiche({ ...baseInput, emails: makeEmails(1) });
    expect(res).toBeNull();
  });

  it('callLLM throw → null (jamais d exception)', async () => {
    mockCallLLM.mockRejectedValue(new Error('DeepSeek 500'));
    const res = await synthesizeContactFiche({ ...baseInput, emails: makeEmails(2) });
    expect(res).toBeNull();
  });

  it('sujets non-array → ignoré', async () => {
    mockCallLLM.mockResolvedValue({
      text: JSON.stringify({ societe: 'ACME', sujets: 'pas un tableau' }),
      networkRetries: 0,
    });
    const res = await synthesizeContactFiche({ ...baseInput, emails: makeEmails(1) });
    expect(res!.societe).toBe('ACME');
    expect(res!.sujets).toBeUndefined();
  });
});

// ============================================================
// renderEnrichedFiche
// ============================================================

describe('renderEnrichedFiche', () => {
  const ctx = {
    senderEmail: 'francois@exemple.com',
    nameFrom: 'François Lambert',
    type: 'pro' as const,
    today: '2026-05-26',
    emailThreadRef: '(cf. thread Gmail msg-1)',
  };

  it('rend une fiche complète avec tous les champs connus', () => {
    const data: ContactFicheData = {
      nomComplet: 'François Lambert',
      role: 'Directeur',
      societe: 'Lambert Capital',
      sujets: ['Club deal'],
      telephone: '+33 6 00',
      autreEmail: 'f.lambert@pro.com',
      langue: 'français formel',
    };
    const { displayName, content } = renderEnrichedFiche(data, ctx, 4);

    expect(displayName).toBe('François Lambert');
    expect(content).toContain('categorie: pro');
    expect(content).toContain('societe: Lambert Capital');
    expect(content).toContain('role: Directeur');
    expect(content).toContain('telephone: +33 6 00');
    expect(content).toContain('email: francois@exemple.com');
    expect(content).toContain('# François Lambert');
    // S25 : sections de base aligned-template (Contact pro v3).
    expect(content).toContain('## Qui c\'est');
    expect(content).toContain('## Statut courant');
    expect(content).toContain('## Projets liés');
    expect(content).toContain('## Notes');
    expect(content).toContain('## Tonalité de communication');
    expect(content).toContain('## Historique');
    // Les infos extraites par LLM apparaissent dans le frontmatter (role,
    // societe, telephone, langue, email) et en bullets dans ## Notes pour
    // les champs sans clé frontmatter (autreEmail, sujets, nameNotes).
    expect(content).toContain('**Autre email** : f.lambert@pro.com');
    expect(content).toContain('**Sujets récurrents** : Club deal');
    expect(content).toContain('Fiche enrichie à partir de 4 emails');
  });

  it('priorité du nom : nomComplet > nameFrom > local-part', () => {
    const r1 = renderEnrichedFiche({ nomComplet: 'Jean Synth' }, ctx, 1);
    expect(r1.displayName).toBe('Jean Synth');

    const r2 = renderEnrichedFiche({ societe: 'X' }, ctx, 1);
    expect(r2.displayName).toBe('François Lambert'); // nameFrom

    const r3 = renderEnrichedFiche({ societe: 'X' }, { ...ctx, nameFrom: null }, 1);
    expect(r3.displayName).toBe('Francois'); // local-part de l'email
  });

  it('champs inconnus → frontmatter laissé vide (pas d invention)', () => {
    const { content } = renderEnrichedFiche({ societe: 'ACME' }, ctx, 1);
    expect(content).toContain('societe: ACME');
    expect(content).toContain('role: ');
    expect(content).toContain('telephone: ');
  });

  it('aucune info clé (sauf nom) → sections de base vides mais présentes (S25)', () => {
    const { content } = renderEnrichedFiche({ nomComplet: 'Jean' }, ctx, 2);
    // S25 : plus de placeholder texte "Aucune information clé" — les sections
    // de base sont juste vides (convention template Contact pro v3).
    expect(content).toContain('## Qui c\'est');
    expect(content).toContain('## Notes');
    expect(content).toContain('## Historique');
    // Frontmatter : email présent (depuis ctx), autres champs vides.
    expect(content).toContain('email: francois@exemple.com');
    expect(content).toContain('societe: ');
    expect(content).toContain('role: ');
  });

  it('singulier "email" quand un seul email scanné', () => {
    const { content } = renderEnrichedFiche({ societe: 'X' }, ctx, 1);
    expect(content).toContain("Fiche enrichie à partir de 1 email de l'expéditeur.");
    expect(content).not.toContain('1 emails');
  });

  it('valeur multi-lignes nettoyée (pas de retour ligne dans le YAML)', () => {
    const { content } = renderEnrichedFiche({ societe: 'ACME\nInc.' }, ctx, 1);
    expect(content).toContain('societe: ACME Inc.');
    // Le frontmatter ne doit pas contenir de saut de ligne parasite dans la valeur.
    expect(content).not.toContain('societe: ACME\nInc.');
  });
});
