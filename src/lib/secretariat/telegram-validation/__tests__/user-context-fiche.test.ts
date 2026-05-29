/**
 * Tests intégration `userContext` dans les fiches (S24 soir + S25).
 *
 * S25 (2026-05-29) : rendu aligné sur les templates `Contact pro.md` /
 * `Contact relationnel.md` du vault. Les sections de base (`## Qui c'est`,
 * `## Statut courant`, etc.) sont TOUJOURS présentes même vides, conformément
 * aux templates. Ces tests vérifient que :
 *  - le userContext est inséré DANS la section « Qui c'est » (qui existe
 *    désormais quel que soit l'état de userContext)
 *  - les autres sections de base sont présentes
 *  - le contenu multi-lignes du userContext est préservé
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

describe('renderEnrichedFiche — userContext (S24 soir + S25)', () => {
  it('userContext fourni → texte inséré dans la section « Qui c\'est »', async () => {
    const { content } = await renderEnrichedFiche(
      DATA,
      { ...CTX_BASE, userContext: 'Martin pilote la GAPD Sarani — premier interlo juridique.' },
      3,
    );
    expect(content).toContain('## Qui c\'est');
    expect(content).toContain('Martin pilote la GAPD Sarani');
    // S25 : section « Qui c'est » placée AVANT « Statut courant » (template Pro v3).
    const idxQui = content.indexOf('## Qui c\'est');
    const idxStatut = content.indexOf('## Statut courant');
    expect(idxQui).toBeGreaterThan(0);
    expect(idxStatut).toBeGreaterThan(idxQui);
  });

  it('userContext null → section « Qui c\'est » présente mais vide (template)', async () => {
    const { content } = await renderEnrichedFiche(DATA, { ...CTX_BASE, userContext: null }, 3);
    // S25 : section TOUJOURS présente (convention template). Vérifier qu'aucun
    // userContext n'a fuité dans le contenu.
    expect(content).toContain('## Qui c\'est');
    expect(content).not.toContain('Martin pilote');
  });

  it('userContext vide / whitespace → section « Qui c\'est » vide', async () => {
    const { content } = await renderEnrichedFiche(DATA, { ...CTX_BASE, userContext: '   ' }, 3);
    expect(content).toContain('## Qui c\'est');
    // Pas de contenu textuel non-trivial après « Qui c'est » avant la section suivante.
    const between = content
      .split('## Qui c\'est')[1]
      ?.split('## Statut courant')[0]
      ?.trim() ?? '';
    expect(between.length).toBe(0);
  });

  it('userContext omis (rétro-compat) → section « Qui c\'est » présente mais vide', async () => {
    const { content } = await renderEnrichedFiche(DATA, CTX_BASE, 3);
    expect(content).toContain('## Qui c\'est');
    expect(content).toContain('## Statut courant');
  });

  it('contexte multi-lignes préservé', async () => {
    const ctx = 'Avocat Sarani.\nIntervient sur GAPD + séquestres.\nLui parler en formel.';
    const { content } = await renderEnrichedFiche(DATA, { ...CTX_BASE, userContext: ctx }, 3);
    expect(content).toContain('GAPD + séquestres');
    expect(content).toContain('formel');
  });

  it('S25 : toutes les sections de base du template Contact pro sont présentes', async () => {
    const { content } = await renderEnrichedFiche(DATA, CTX_BASE, 3);
    // Convention template : sections de base TOUJOURS présentes (même vides).
    expect(content).toContain('## Qui c\'est');
    expect(content).toContain('## Statut courant');
    expect(content).toContain('## Projets liés');
    expect(content).toContain('## Notes');
    expect(content).toContain('## Tonalité de communication');
    expect(content).toContain('## Historique');
  });

  it('S25 : frontmatter aligné Contact pro.md v3', async () => {
    const { content } = await renderEnrichedFiche(DATA, CTX_BASE, 3);
    expect(content).toContain('type: contact');
    expect(content).toContain('categorie: pro');
    expect(content).toContain('sous_categorie:');
    expect(content).toContain('langue: fr');
    expect(content).toContain('canal_préféré:');
    expect(content).toContain('fréquence_échanges:');
    expect(content).toContain('entites_visibles: []');
    expect(content).toContain('rencontre_via: Email');
  });
});
