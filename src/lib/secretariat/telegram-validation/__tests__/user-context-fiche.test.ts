/**
 * Tests intégration `userContext` dans les fiches (S24 soir).
 * Vérifie que le contexte fourni par Thomas (reply Telegram avant clic) :
 *  - est inséré en tête (section « Qui c'est »).
 *  - n'apparaît pas si `userContext` est null/vide.
 * Couvre les 2 rendus : enrichi (`renderEnrichedFiche`) et stub mocking.
 */

import { describe, it, expect } from 'vitest';
import { renderEnrichedFiche, type ContactFicheData } from '../contact-fiche-synth';

const DATA: ContactFicheData = {
  nomComplet: 'Martin Yhuel',
  role: 'Avocat',
  societe: 'PNM Avocats',
};

const CTX_BASE = {
  senderEmail: 'm.yhuel@pnmavocats.law',
  nameFrom: 'Martin Yhuel',
  type: 'pro' as const,
  today: '2026-05-28',
  emailThreadRef: '(cf. email Gmail msg-123)',
  sources: ['gmail'],
};

describe('renderEnrichedFiche — userContext (S24 soir)', () => {
  it('userContext fourni → section « Qui c\'est » insérée en tête (avant « Synthèse »)', () => {
    const { content } = renderEnrichedFiche(
      DATA,
      { ...CTX_BASE, userContext: 'Martin pilote la GAPD Sarani — premier interlo juridique.' },
      3,
    );
    expect(content).toContain('## Qui c\'est');
    expect(content).toContain('Martin pilote la GAPD Sarani');
    // Section « Qui c'est » avant « Synthèse »
    const idxQui = content.indexOf('## Qui c\'est');
    const idxSynth = content.indexOf('## Synthèse');
    expect(idxQui).toBeGreaterThan(0);
    expect(idxQui).toBeLessThan(idxSynth);
  });

  it('userContext null → pas de section « Qui c\'est »', () => {
    const { content } = renderEnrichedFiche(DATA, { ...CTX_BASE, userContext: null }, 3);
    expect(content).not.toContain('## Qui c\'est');
  });

  it('userContext vide / whitespace → pas de section « Qui c\'est »', () => {
    const { content } = renderEnrichedFiche(DATA, { ...CTX_BASE, userContext: '   ' }, 3);
    expect(content).not.toContain('## Qui c\'est');
  });

  it('userContext omis (rétro-compat) → pas de section « Qui c\'est »', () => {
    const { content } = renderEnrichedFiche(DATA, CTX_BASE, 3);
    expect(content).not.toContain('## Qui c\'est');
  });

  it('contexte multi-lignes préservé', () => {
    const ctx = 'Avocat Sarani.\nIntervient sur GAPD + séquestres.\nLui parler en formel.';
    const { content } = renderEnrichedFiche(DATA, { ...CTX_BASE, userContext: ctx }, 3);
    expect(content).toContain('GAPD + séquestres');
    expect(content).toContain('formel');
  });
});
