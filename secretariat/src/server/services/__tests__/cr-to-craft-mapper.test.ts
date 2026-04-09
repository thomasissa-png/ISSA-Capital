/**
 * Tests unitaires — cr-to-craft-mapper (Phase 4).
 *
 * Le mapper est une fonction pure — pas de mock nécessaire, tous les tests
 * sont déterministes. On vérifie :
 *  - Helpers de formatage (entité, type, date, participants, slug, filename)
 *  - Rendu markdown avec et sans Section 4
 *  - SHA-256 calculé et reproductible
 *  - Titre respecte la convention @moi
 *  - Frontmatter CONFIDENTIEL, header, footer DGFiP présents
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import type { CRDraft } from '../anthropic.types';
import {
  buildCraftFilename,
  dateFormatFr,
  dateTimeFormatFr,
  entiteNomComplet,
  formatParticipants,
  mapCrToCraftPayload,
  participantSlug,
  renderCrMarkdown,
  typeReunionLibelle,
  typeReunionSlug,
} from '../cr-to-craft-mapper';

// ------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------

const FULL_CR: CRDraft = {
  reference_placeholder: '[REF_TO_BE_GENERATED]',
  entite: 'IC',
  type_reunion: 'dejeuner',
  date_reunion: '2026-04-08',
  lieu: 'Restaurant Le Voltaire, Paris 1er',
  participants: [
    {
      prenom: 'Karim',
      nom: 'Benmoussa',
      titre: 'Directeur Général',
      societe: 'Capital Partners',
      qualite_relation: 'Partenaire stratégique',
    },
    {
      prenom: 'Jean-Pierre',
      nom: 'Dubois',
      titre: 'Conseiller',
      societe: 'Cabinet Dubois & Associés',
      qualite_relation: 'Conseil juridique',
    },
  ],
  objet: "Discussion stratégique sur le positionnement d'ISSA Capital pour 2026",
  montant_ttc_eur: 285,
  etablissement_nom: 'Le Voltaire',
  section_1_objet_art_39_1:
    "La présente réunion, tenue le 8 avril 2026 au restaurant Le Voltaire à Paris 1er, avait pour objet la discussion stratégique sur le positionnement d'ISSA Capital pour l'exercice 2026. Elle s'inscrit dans le cadre des activités d'ISSA Capital SAS au sens de l'Art. 39-1 du CGI. La dépense y afférente s'est élevée à 285 € TTC (facture en annexe).",
  section_2_points_abordes:
    "Les échanges ont porté sur : (i) la revue des participations actuelles, (ii) l'identification de nouvelles opportunités d'investissement pour 2026, (iii) le calendrier des due diligences à mener au Q2.",
  section_3_decisions:
    "Il a été convenu que Capital Partners produirait une note d'opportunité sur le secteur de l'immobilier commercial d'ici le 30 avril 2026. ISSA Capital examinera cette note lors de la prochaine réunion trimestrielle.",
  section_4_suites_a_donner:
    "- Karim Benmoussa : envoi note d'opportunité avant le 30 avril 2026\n- Thomas Issa : inscription du sujet à l'ordre du jour du conseil Q2",
};

const CR_WITHOUT_SECTION_4: CRDraft = {
  ...FULL_CR,
  entite: 'VI',
  type_reunion: 'visite-immo',
  lieu: '6 rue de Tournon, Paris 6e',
  participants: [
    {
      prenom: 'Sophie',
      nom: 'Laurent',
      titre: 'Agent immobilier',
      societe: 'Daniel Féau',
      qualite_relation: 'Conseil en acquisition',
    },
  ],
  section_4_suites_a_donner: null,
};

// ------------------------------------------------------------
// Helpers de formatage
// ------------------------------------------------------------

describe('entiteNomComplet', () => {
  it('mappe chaque code vers son nom légal complet', () => {
    expect(entiteNomComplet('IC')).toBe('ISSA Capital SAS');
    expect(entiteNomComplet('GO')).toBe('Gradient One');
    expect(entiteNomComplet('VI')).toBe('Versi Immobilier');
    expect(entiteNomComplet('VV')).toBe('Versi Invest');
  });
});

describe('typeReunionLibelle', () => {
  it('mappe chaque type vers son libellé français', () => {
    expect(typeReunionLibelle('dejeuner')).toBe("Déjeuner d'affaires");
    expect(typeReunionLibelle('diner')).toBe("Dîner d'affaires");
    expect(typeReunionLibelle('conseil')).toBe('Réunion de conseil');
    expect(typeReunionLibelle('visite-immo')).toBe('Visite immobilière');
  });
});

describe('typeReunionSlug', () => {
  it('retourne le code kebab-case tel quel', () => {
    expect(typeReunionSlug('dejeuner')).toBe('dejeuner');
    expect(typeReunionSlug('visite-immo')).toBe('visite-immo');
    expect(typeReunionSlug('signature-contrat')).toBe('signature-contrat');
  });
});

describe('dateFormatFr', () => {
  it('formate une date ISO en français long', () => {
    expect(dateFormatFr('2026-04-08')).toBe('8 avril 2026');
    expect(dateFormatFr('2026-12-31')).toBe('31 décembre 2026');
    expect(dateFormatFr('2026-01-01')).toBe('1 janvier 2026');
  });

  it('retourne la chaîne brute si format invalide', () => {
    expect(dateFormatFr('invalid')).toBe('invalid');
  });
});

describe('dateTimeFormatFr', () => {
  it('formate un timestamp ISO complet en français UTC', () => {
    const out = dateTimeFormatFr('2026-04-08T14:32:10Z');
    expect(out).toContain('8 avril 2026');
    expect(out).toContain('14:32');
    expect(out).toContain('UTC');
  });
});

describe('formatParticipants', () => {
  it('formate une liste au format légal (un par ligne)', () => {
    const out = formatParticipants(FULL_CR.participants);
    expect(out).toBe(
      '- Karim Benmoussa, Directeur Général, Capital Partners (Partenaire stratégique)\n' +
        '- Jean-Pierre Dubois, Conseiller, Cabinet Dubois & Associés (Conseil juridique)',
    );
  });
});

describe('participantSlug', () => {
  it('retire les accents et passe en kebab-case', () => {
    expect(
      participantSlug({
        prenom: 'Jérôme',
        nom: 'Méndèz',
        titre: '',
        societe: '',
        qualite_relation: '',
      }),
    ).toBe('jerome-mendez');
  });

  it('combine prénom composé + nom', () => {
    expect(
      participantSlug({
        prenom: 'Jean-Pierre',
        nom: "O'Connor",
        titre: '',
        societe: '',
        qualite_relation: '',
      }),
    ).toBe('jean-pierre-o-connor');
  });
});

describe('buildCraftFilename', () => {
  it('respecte le format YYYY-MM-DD-type-entite-slug.md', () => {
    expect(buildCraftFilename(FULL_CR)).toBe(
      '2026-04-08-dejeuner-IC-karim-benmoussa.md',
    );
  });

  it('gère les types composés (visite-immo)', () => {
    expect(buildCraftFilename(CR_WITHOUT_SECTION_4)).toBe(
      '2026-04-08-visite-immo-VI-sophie-laurent.md',
    );
  });
});

// ------------------------------------------------------------
// Rendu markdown
// ------------------------------------------------------------

describe('renderCrMarkdown', () => {
  it('inclut le frontmatter CONFIDENTIEL, header, sections 1-4, footer DGFiP', () => {
    const md = renderCrMarkdown({
      cr: FULL_CR,
      reference: 'IC-CR-2026-0042',
      dateEtablissement: '2026-04-08T14:32:00Z',
    });

    // Frontmatter
    expect(md).toMatch(/^---\nclassification: CONFIDENTIEL\n---/);

    // Header
    expect(md).toContain('# COMPTE RENDU DE RÉUNION PROFESSIONNELLE');
    expect(md).toContain('**Référence** : IC-CR-2026-0042');
    expect(md).toContain('**Entité** : ISSA Capital SAS');
    expect(md).toContain('**Date de la réunion** : 8 avril 2026');
    expect(md).toContain("**Type** : Déjeuner d'affaires");
    expect(md).toContain('**Lieu** : Restaurant Le Voltaire, Paris 1er');
    expect(md).toContain('**Classification** : CONFIDENTIEL');

    // Participants
    expect(md).toContain(
      '- Karim Benmoussa, Directeur Général, Capital Partners (Partenaire stratégique)',
    );
    expect(md).toContain('- Jean-Pierre Dubois, Conseiller, Cabinet Dubois & Associés');

    // Sections 1-4
    expect(md).toContain("## 1. Objet et lien avec l'intérêt social");
    expect(md).toContain('Art. 39-1 du CGI');
    expect(md).toContain('## 2. Points abordés');
    expect(md).toContain('## 3. Décisions et conclusions');
    expect(md).toContain('## 4. Suites à donner');
    expect(md).toContain("- Karim Benmoussa : envoi note d'opportunité");

    // Footer DGFiP
    expect(md).toContain(
      'En foi de quoi, le présent compte rendu a été établi et certifié exact par Thomas Issa',
    );
    expect(md).toContain('**Horodaté le** :');
    expect(md).toContain('**Token RFC 3161** :');
    expect(md).toContain('Conservation : 10 ans');
    expect(md).toContain('Art. 39-1 CGI');
    expect(md).toContain('dpo@issa-capital.com');
  });

  it('OMET la Section 4 entièrement si section_4_suites_a_donner est null', () => {
    const md = renderCrMarkdown({
      cr: CR_WITHOUT_SECTION_4,
      reference: 'VI-CR-2026-0001',
      dateEtablissement: '2026-04-08T10:00:00Z',
    });

    expect(md).not.toContain('## 4. Suites à donner');
    // Mais les 3 premières sections sont présentes
    expect(md).toContain('## 1.');
    expect(md).toContain('## 2.');
    expect(md).toContain('## 3.');
    // Footer toujours présent
    expect(md).toContain('**Horodaté le** :');
  });

  it('utilise le bon nom d\'entité dans le footer selon le code CR', () => {
    const md = renderCrMarkdown({
      cr: CR_WITHOUT_SECTION_4, // entite = 'VI'
      reference: 'VI-CR-2026-0001',
      dateEtablissement: '2026-04-08T10:00:00Z',
    });
    expect(md).toContain('Président — Versi Immobilier');
  });
});

// ------------------------------------------------------------
// Mapping principal
// ------------------------------------------------------------

describe('mapCrToCraftPayload', () => {
  const baseInput = {
    cr: FULL_CR,
    draftId: 'draft-uuid-123',
    reference: 'IC-CR-2026-0042',
    dateEtablissement: '2026-04-08T14:32:00Z',
    userPhone: '+33612345678',
  };

  it('retourne un payload avec markdown, position, internalTitle, internalMetadata', () => {
    const payload = mapCrToCraftPayload(baseInput);

    expect(payload.markdown).toContain('# COMPTE RENDU');
    expect(payload.position).toEqual({ position: 'end' });
    expect(payload.internalTitle).toBe('2026-04-08-dejeuner-IC-karim-benmoussa.md');
    expect(payload.internalMetadata.draftId).toBe('draft-uuid-123');
    expect(payload.internalMetadata.reference).toBe('IC-CR-2026-0042');
    expect(payload.internalMetadata.entite).toBe('IC');
    expect(payload.internalMetadata.typeReunion).toBe('dejeuner');
    expect(payload.internalMetadata.dateReunion).toBe('2026-04-08');
    expect(payload.internalMetadata.userPhone).toBe('+33612345678');
  });

  it('calcule un SHA-256 reproductible du markdown', () => {
    const payload1 = mapCrToCraftPayload(baseInput);
    const payload2 = mapCrToCraftPayload(baseInput);

    expect(payload1.internalMetadata.markdownSha256).toBe(
      payload2.internalMetadata.markdownSha256,
    );
    expect(payload1.internalMetadata.markdownSha256).toHaveLength(64);
    expect(payload1.internalMetadata.markdownSha256).toMatch(/^[a-f0-9]{64}$/);

    // Le hash correspond effectivement au markdown
    const expectedHash = createHash('sha256')
      .update(payload1.markdown, 'utf8')
      .digest('hex');
    expect(payload1.internalMetadata.markdownSha256).toBe(expectedHash);
  });

  it('produit un payload valide même sans Section 4', () => {
    const payload = mapCrToCraftPayload({
      ...baseInput,
      cr: CR_WITHOUT_SECTION_4,
      reference: 'VI-CR-2026-0001',
    });

    expect(payload.markdown).not.toContain('## 4. Suites à donner');
    expect(payload.internalTitle).toBe('2026-04-08-visite-immo-VI-sophie-laurent.md');
    expect(payload.internalMetadata.entite).toBe('VI');
  });
});
