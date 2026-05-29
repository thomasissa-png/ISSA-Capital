import { describe, it, expect } from 'vitest';
import {
  migrateFicheContent,
  detectFicheType,
  missingSections,
} from '../migrate-contact-fiches-core';

describe('detectFicheType', () => {
  it('priorise le champ categorie du frontmatter', () => {
    expect(detectFicheType('07. Contacts/04. Autres', 'pro')).toBe('pro');
    expect(detectFicheType('07. Contacts/03. Pro', 'famille')).toBe('relational');
    expect(detectFicheType('07. Contacts/03. Pro', 'ami')).toBe('relational');
    expect(detectFicheType('07. Contacts/03. Pro', 'autre')).toBe('relational');
  });

  it('skippe les locataires', () => {
    expect(detectFicheType('07. Contacts/05. Locataires/Actuels', undefined)).toBeNull();
    expect(detectFicheType('07. Contacts/03. Pro', 'locataire')).toBeNull();
  });

  it('fallback sur le dossier réel quand categorie absente', () => {
    expect(detectFicheType('07. Contacts/03. Pro', undefined)).toBe('pro');
    expect(detectFicheType('07. Contacts/01. Famille', undefined)).toBe('relational');
    expect(detectFicheType('07. Contacts/02. Amis', undefined)).toBe('relational');
    expect(detectFicheType('07. Contacts/04. Autres', undefined)).toBe('relational');
  });
});

describe('missingSections — pas de faux positif H3', () => {
  it('ne considère pas "### Notes" comme la section H2 "## Notes"', () => {
    const content = "## Qui c'est\n\n## Historique\n\n### Notes prises en réunion\nblabla\n";
    const missing = missingSections(content, ['## Notes']);
    expect(missing).toEqual(['## Notes']);
  });
  it('détecte une H2 présente en fin de fichier sans newline final', () => {
    const content = "## Qui c'est\n\n## Notes";
    expect(missingSections(content, ['## Notes'])).toEqual([]);
  });
});

const FICHE_PRO_MINIMALE = `---
type: contact
categorie: pro
societe: PNM Avocats
role: Avocat
email: m@pnm.law
---
# Martin Yhuel

## Qui c'est
Avocat rencontré via Sarani.

## Historique

### 2026-05-13 — Email
Premier contact.
`;

describe('migrateFicheContent — fiche pro', () => {
  it('ajoute les champs frontmatter manquants sans toucher aux existants', () => {
    const { migrated, added } = migrateFicheContent(FICHE_PRO_MINIMALE, 'pro');
    // Champs existants préservés
    expect(migrated).toContain('societe: PNM Avocats');
    expect(migrated).toContain('email: m@pnm.law');
    // Champs ajoutés
    expect(migrated).toContain('langue: fr');
    expect(migrated).toContain('entites_visibles: []');
    expect(migrated).toContain('canal_préféré:');
    expect(migrated).toContain('fréquence_échanges:');
    expect(added).toContain('frontmatter:canal_préféré');
    expect(added).toContain('frontmatter:entites_visibles');
  });

  it('ajoute tags dérivé de categorie', () => {
    const { migrated } = migrateFicheContent(FICHE_PRO_MINIMALE, 'pro');
    expect(migrated).toMatch(/tags:\n {2}- pro/);
  });

  it('insère les sections manquantes AVANT ## Historique dans le bon ordre', () => {
    const { migrated } = migrateFicheContent(FICHE_PRO_MINIMALE, 'pro');
    const idxQui = migrated.indexOf("## Qui c'est");
    const idxStatut = migrated.indexOf('## Statut courant');
    const idxProjets = migrated.indexOf('## Projets liés');
    const idxNotes = migrated.indexOf('## Notes');
    const idxTon = migrated.indexOf('## Tonalité de communication');
    const idxHist = migrated.indexOf('## Historique');
    expect(idxQui).toBeLessThan(idxStatut);
    expect(idxStatut).toBeLessThan(idxProjets);
    expect(idxProjets).toBeLessThan(idxNotes);
    expect(idxNotes).toBeLessThan(idxTon);
    expect(idxTon).toBeLessThan(idxHist);
  });

  it("préserve le contenu du body existant (Qui c'est + Historique)", () => {
    const { migrated } = migrateFicheContent(FICHE_PRO_MINIMALE, 'pro');
    expect(migrated).toContain('Avocat rencontré via Sarani.');
    expect(migrated).toContain('### 2026-05-13 — Email');
    expect(migrated).toContain('Premier contact.');
  });

  it('est IDEMPOTENT : 2e passe = aucun changement', () => {
    const pass1 = migrateFicheContent(FICHE_PRO_MINIMALE, 'pro').migrated;
    const pass2 = migrateFicheContent(pass1, 'pro');
    expect(pass2.added).toEqual([]);
    expect(pass2.migrated).toBe(pass1);
  });
});

const FICHE_RELATIONNELLE = `---
type: contact
categorie: famille
telephone: "+33 6 00 00 00 00"
---
# Sonia Issa

## Qui c'est
Sœur.

## Historique
`;

describe('migrateFicheContent — fiche relationnelle', () => {
  it('ajoute les sections relationnelles (Famille / Liens) pas entites_visibles', () => {
    const { migrated } = migrateFicheContent(FICHE_RELATIONNELLE, 'relational');
    expect(migrated).toContain('## Famille / Liens');
    expect(migrated).toContain('## Tonalité de communication');
    expect(migrated).not.toContain('entites_visibles');
    expect(migrated).not.toContain('## Statut courant');
  });

  it('est IDEMPOTENT', () => {
    const pass1 = migrateFicheContent(FICHE_RELATIONNELLE, 'relational').migrated;
    const pass2 = migrateFicheContent(pass1, 'relational');
    expect(pass2.added).toEqual([]);
    expect(pass2.migrated).toBe(pass1);
  });
});

describe('migrateFicheContent — fiche déjà conforme', () => {
  const CONFORME = `---
type: contact
categorie: pro
sous_categorie:
societe: X
role: Y
email: a@b.c
telephone:
langue: fr
rencontre_via:
date_premier_contact:
date_derniere_interaction:
canal_préféré:
fréquence_échanges:
entites_visibles: []
classification:
tags:
  - pro
---
# X

## Qui c'est
.

## Statut courant

## Projets liés

## Notes

## Tonalité de communication

- Canal préféré :

## Historique
`;
  it('ne modifie rien', () => {
    const { migrated, added } = migrateFicheContent(CONFORME, 'pro');
    expect(added).toEqual([]);
    expect(migrated).toBe(CONFORME);
  });
});
