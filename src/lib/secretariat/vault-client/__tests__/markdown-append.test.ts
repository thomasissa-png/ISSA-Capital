/**
 * Tests markdown-append — insertion de sections H3 en chrono inverse.
 *
 * Critère : le frontmatter doit rester intact, les sections existantes
 * ne doivent pas bouger, la nouvelle section est insérée AVANT les existantes.
 */
import { describe, it, expect } from 'vitest';
import {
  appendToSection,
  hasSection,
  extractSection,
  insertH2SectionBefore,
} from '../markdown-append';
import { parseObsidianFile } from '../frontmatter';

// ============================================================
// Fixtures
// ============================================================

const FIXTURE_WITH_HISTORIQUE = `---
civilite: Monsieur
nom_officiel: Kenan Beguigneau
email: kbeguigneau@gmail.com
date_dernière_interaction: 2026-05-06
---

# Kenan Beguigneau

## Qui c'est

Locataire du Studio 7.

## Historique

### 2026-05-06 — Confirmation virement
Kenan confirme le virement du loyer de mai 2026.

### 2026-04-03 — Entrée dans les lieux
Signature du bail et remise des clés.

## Notes

Paiement par virement bancaire.
`;

const FIXTURE_WITHOUT_HISTORIQUE = `---
type: contact
société: PNM Avocats
rôle: Avocat Associé
---

# Martin Yhuel

## Qui c'est

Avocat de la famille Issa.

## Notes

Accès toutes entités.
`;

const FIXTURE_EMPTY_HISTORIQUE = `---
type: contact
email: test@example.com
---

# Test Contact

## Historique

## Notes

Quelques notes.
`;

// ============================================================
// Tests : appendToSection
// ============================================================

describe('appendToSection', () => {
  it('insère une nouvelle section H3 AVANT les existantes (chrono inverse)', () => {
    const result = appendToSection(FIXTURE_WITH_HISTORIQUE, 'Historique', {
      title: '2026-05-13 — Demande quittance mai',
      content: 'Kenan demande la quittance de mai 2026.',
    });

    // La nouvelle section doit être AVANT les anciennes
    const idx2026_05_13 = result.indexOf('### 2026-05-13 — Demande quittance mai');
    const idx2026_05_06 = result.indexOf('### 2026-05-06 — Confirmation virement');
    const idx2026_04_03 = result.indexOf('### 2026-04-03 — Entrée dans les lieux');

    expect(idx2026_05_13).toBeGreaterThan(-1);
    expect(idx2026_05_06).toBeGreaterThan(idx2026_05_13);
    expect(idx2026_04_03).toBeGreaterThan(idx2026_05_06);
  });

  it('préserve le frontmatter intact lors de l\'append', () => {
    const result = appendToSection(FIXTURE_WITH_HISTORIQUE, 'Historique', {
      title: '2026-05-13 — Test',
      content: 'Test content.',
    });

    const parsed = parseObsidianFile(result);
    expect(parsed.frontmatter!.fields['civilite']).toBe('Monsieur');
    expect(parsed.frontmatter!.fields['nom_officiel']).toBe('Kenan Beguigneau');
    expect(parsed.frontmatter!.fields['email']).toBe('kbeguigneau@gmail.com');
  });

  it('préserve les sections H2 non ciblées (Notes)', () => {
    const result = appendToSection(FIXTURE_WITH_HISTORIQUE, 'Historique', {
      title: '2026-05-13 — Test',
      content: 'Test.',
    });

    expect(result).toContain('## Notes');
    expect(result).toContain('Paiement par virement bancaire.');
  });

  it('crée la section H2 si elle n\'existe pas', () => {
    const result = appendToSection(FIXTURE_WITHOUT_HISTORIQUE, 'Historique', {
      title: '2026-05-13 — Premier contact',
      content: 'Premier échange email.',
    });

    expect(result).toContain('## Historique');
    expect(result).toContain('### 2026-05-13 — Premier contact');
    expect(result).toContain('Premier échange email.');
  });

  it('insère dans une section H2 vide', () => {
    const result = appendToSection(FIXTURE_EMPTY_HISTORIQUE, 'Historique', {
      title: '2026-05-13 — Test',
      content: 'Contenu test.',
    });

    expect(result).toContain('### 2026-05-13 — Test');
    expect(result).toContain('Contenu test.');
    // La section Notes doit toujours être là
    expect(result).toContain('## Notes');
    expect(result).toContain('Quelques notes.');
  });

  it('gère plusieurs appends successifs en chrono inverse', () => {
    let content = FIXTURE_WITH_HISTORIQUE;

    content = appendToSection(content, 'Historique', {
      title: '2026-05-10 — Relance virement',
      content: 'Relance envoyée.',
    });

    content = appendToSection(content, 'Historique', {
      title: '2026-05-13 — Demande quittance',
      content: 'Quittance demandée.',
    });

    // L'ordre doit être : 2026-05-13, 2026-05-10, 2026-05-06, 2026-04-03
    const idx13 = content.indexOf('### 2026-05-13');
    const idx10 = content.indexOf('### 2026-05-10');
    const idx06 = content.indexOf('### 2026-05-06');
    const idx03 = content.indexOf('### 2026-04-03');

    expect(idx13).toBeLessThan(idx10);
    expect(idx10).toBeLessThan(idx06);
    expect(idx06).toBeLessThan(idx03);
  });

  it('préserve le contenu des sections H3 existantes', () => {
    const result = appendToSection(FIXTURE_WITH_HISTORIQUE, 'Historique', {
      title: '2026-05-13 — Nouveau',
      content: 'Nouveau contenu.',
    });

    expect(result).toContain('Kenan confirme le virement du loyer de mai 2026.');
    expect(result).toContain('Signature du bail et remise des clés.');
  });

  it('gère les caractères UTF-8 dans le titre et contenu', () => {
    const result = appendToSection(FIXTURE_WITH_HISTORIQUE, 'Historique', {
      title: '2026-05-13 — Réponse à la réclamation',
      content: 'Réponse envoyée concernant le problème de chauffage. Échange cordial.',
    });

    expect(result).toContain('### 2026-05-13 — Réponse à la réclamation');
    expect(result).toContain('Échange cordial.');
  });
});

// ============================================================
// Tests : hasSection
// ============================================================

describe('hasSection', () => {
  it('retourne true si la section H2 existe', () => {
    expect(hasSection(FIXTURE_WITH_HISTORIQUE, 'Historique')).toBe(true);
    expect(hasSection(FIXTURE_WITH_HISTORIQUE, 'Notes')).toBe(true);
    expect(hasSection(FIXTURE_WITH_HISTORIQUE, 'Qui c\'est')).toBe(true);
  });

  it('retourne false si la section H2 n\'existe pas', () => {
    expect(hasSection(FIXTURE_WITH_HISTORIQUE, 'Inexistant')).toBe(false);
  });
});

// ============================================================
// Tests : extractSection
// ============================================================

describe('extractSection', () => {
  it('extrait le contenu d\'une section H2', () => {
    const content = extractSection(FIXTURE_WITH_HISTORIQUE, 'Historique');
    expect(content).toContain('### 2026-05-06 — Confirmation virement');
    expect(content).toContain('### 2026-04-03 — Entrée dans les lieux');
    // Ne doit PAS contenir la section Notes
    expect(content).not.toContain('Paiement par virement bancaire.');
  });

  it('retourne null si la section n\'existe pas', () => {
    const content = extractSection(FIXTURE_WITH_HISTORIQUE, 'Inexistant');
    expect(content).toBeNull();
  });

  it('extrait la dernière section (Notes)', () => {
    const content = extractSection(FIXTURE_WITH_HISTORIQUE, 'Notes');
    expect(content).toContain('Paiement par virement bancaire.');
    expect(content).not.toContain('### 2026-05-06');
  });
});

// ============================================================
// S25.1 — insertH2SectionBefore (alignement templates vault)
// ============================================================

describe('insertH2SectionBefore', () => {
  const FIXTURE_FICHE_CONTACT = `---
type: contact
categorie: pro
societe: ACME
---

# Marc Gernot

## Qui c'est

Notaire rencontré via Maxime.

## Synthèse

- **Rôle** : Notaire
- **Société** : ACME

## Historique

### 2026-05-28 — Fiche créée
Première interaction.
`;

  it('insère une nouvelle section H2 juste avant l\'ancrage si absente', () => {
    const result = insertH2SectionBefore(
      FIXTURE_FICHE_CONTACT,
      'Statut courant',
      'Synthèse',
      '_À renseigner._',
    );
    expect(result).toContain('## Statut courant');
    // Ordre : Qui c'est → Statut courant → Synthèse
    const idxQui = result.indexOf("## Qui c'est");
    const idxStatut = result.indexOf('## Statut courant');
    const idxSynth = result.indexOf('## Synthèse');
    expect(idxQui).toBeGreaterThan(-1);
    expect(idxStatut).toBeGreaterThan(idxQui);
    expect(idxSynth).toBeGreaterThan(idxStatut);
    // Body de la nouvelle section présent
    expect(result).toContain('_À renseigner._');
  });

  it('idempotence : no-op si la section existe déjà (même avec contenu)', () => {
    const ficheAvecStatut = `---
type: contact
---

# X

## Qui c'est

Foo.

## Statut courant

Thomas a écrit ici son propre contenu.
Plusieurs lignes.

## Synthèse

Bar.
`;
    const result = insertH2SectionBefore(
      ficheAvecStatut,
      'Statut courant',
      'Synthèse',
      '_À renseigner._',
    );
    expect(result).toBe(ficheAvecStatut);
    expect(result).toContain('Thomas a écrit ici son propre contenu.');
    expect(result).not.toContain('_À renseigner._');
  });

  it('fail-safe : ne fait rien si l\'ancrage est absent', () => {
    const ficheSansAncre = `---
type: contact
---

# X

## Qui c'est

Foo.

## Historique

Bar.
`;
    const result = insertH2SectionBefore(
      ficheSansAncre,
      'Statut courant',
      'Synthèse',
      '_À renseigner._',
    );
    // Pas de Synthèse → ne fait rien (ne pollue pas la fiche).
    expect(result).toBe(ficheSansAncre);
    expect(result).not.toContain('## Statut courant');
  });

  it('frontmatter et autres sections intacts', () => {
    const before = FIXTURE_FICHE_CONTACT;
    const result = insertH2SectionBefore(
      before,
      'Statut courant',
      'Synthèse',
      '_À renseigner._',
    );
    // Frontmatter inchangé
    expect(result).toContain('type: contact');
    expect(result).toContain('categorie: pro');
    expect(result).toContain('societe: ACME');
    // Section Qui c'est intacte
    expect(result).toContain('Notaire rencontré via Maxime.');
    // Section Synthèse intacte
    expect(result).toContain('- **Rôle** : Notaire');
    // Section Historique intacte
    expect(result).toContain('### 2026-05-28 — Fiche créée');
  });
});
