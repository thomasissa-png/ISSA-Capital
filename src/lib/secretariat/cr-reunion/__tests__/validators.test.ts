/**
 * Tests des validateurs deterministes CR (§6 Workflow CR Reunion v3).
 *
 * Transforme la §6 en cas de tests reproductibles, isoles de tout I/O.
 */

import { describe, it, expect } from 'vitest';
import type { CRDraft } from '../../types';
import {
  isValidEntite,
  isValidType,
  checkRbac,
  checkEntiteCoherence,
  detectBannedFormulas,
  checkSection1Legal,
  validateCrPayload,
  isDuplicateCr,
} from '../validators';

// ============================================================
// Factory CR draft minimal valide (entite GO, type appel, sans repas, sans montant)
// ============================================================

function makeCr(overrides: Partial<CRDraft> = {}): CRDraft {
  const base: CRDraft = {
    reference_placeholder: '[REF_TO_BE_GENERATED]',
    entite: 'GO',
    type_reunion: 'appel',
    date_reunion: '2026-05-29',
    lieu: 'Visio',
    participants: [
      {
        prenom: 'Thomas',
        nom: 'Issa',
        titre: 'Associé Gradient One',
        societe: 'Gradient One',
        qualite_relation: 'Signataire',
      },
      {
        prenom: 'Alice',
        nom: 'Martin',
        titre: 'CEO',
        societe: 'Acme SAS',
        qualite_relation: 'Prospect',
      },
    ],
    objet: "Cadrage partenariat commercial Q3",
    montant_ttc_eur: null,
    etablissement_nom: null,
    section_1_objet_art_39_1:
      "Le présent CR a pour objet de documenter, conformément à l'Art. 39-1 du CGI, le cadrage du partenariat commercial entre Gradient One et Acme SAS pour le Q3.",
    section_2_points_abordes:
      "Les parties ont passé en revue le périmètre fonctionnel, le calendrier de déploiement et la structure tarifaire envisagée pour le partenariat.",
    section_3_decisions: "Il a été convenu de transmettre une proposition formelle sous 10 jours.",
    section_4_suites_a_donner: null,
    annexes_photographiques: null,
  };
  return { ...base, ...overrides };
}

// ============================================================
// isValidEntite / isValidType
// ============================================================

describe('isValidEntite', () => {
  it('accepte les 4 entites canoniques', () => {
    for (const e of ['IC', 'GO', 'VI', 'VV']) {
      expect(isValidEntite(e)).toBe(true);
    }
  });

  it('rejette les chaines hors enum', () => {
    expect(isValidEntite('XX')).toBe(false);
    expect(isValidEntite('ic')).toBe(false); // casse stricte
    expect(isValidEntite('')).toBe(false);
    expect(isValidEntite(undefined)).toBe(false);
    expect(isValidEntite(null)).toBe(false);
    expect(isValidEntite(42)).toBe(false);
  });
});

describe('isValidType', () => {
  it('accepte les 7 types canoniques', () => {
    const ok = ['dejeuner', 'diner', 'conseil', 'appel', 'interne', 'visite-immo', 'signature-contrat'];
    for (const t of ok) expect(isValidType(t)).toBe(true);
  });
  it('rejette les types inconnus', () => {
    expect(isValidType('petit-dejeuner')).toBe(false);
    expect(isValidType('DEJEUNER')).toBe(false);
    expect(isValidType('')).toBe(false);
  });
});

// ============================================================
// §6.5 RBAC
// ============================================================

describe('checkRbac (§6.5)', () => {
  it('Carl + IC = refus', () => {
    const r = checkRbac('carl', 'IC');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/ISSA Capital/i);
  });

  it('Maxime + IC = refus', () => {
    const r = checkRbac('Maxime', 'IC');
    expect(r.ok).toBe(false);
  });

  it('Carl + GO = OK', () => {
    expect(checkRbac('carl', 'GO').ok).toBe(true);
  });

  it('Thomas + IC = OK', () => {
    expect(checkRbac('thomas', 'IC').ok).toBe(true);
  });

  it('requester non fourni = OK (default Thomas)', () => {
    expect(checkRbac(undefined, 'IC').ok).toBe(true);
    expect(checkRbac(null, 'IC').ok).toBe(true);
    expect(checkRbac('', 'IC').ok).toBe(true);
  });

  it('insensible casse et espaces', () => {
    expect(checkRbac('  CARL ', 'IC').ok).toBe(false);
  });
});

// ============================================================
// §6.1 Coherence entite — red line « ISSA Capital »
// ============================================================

describe('checkEntiteCoherence (§6.1)', () => {
  it('CR IC : aucune violation meme avec mention ISSA Capital', () => {
    const cr = makeCr({
      entite: 'IC',
      section_1_objet_art_39_1:
        "CR pour ISSA Capital, conformément à l'Art. 39-1 du CGI, montant à voir sur Tiime.",
    });
    expect(checkEntiteCoherence(cr)).toEqual([]);
  });

  it('CR GO avec ISSA Capital en section 1 = violation', () => {
    const cr = makeCr({
      entite: 'GO',
      section_1_objet_art_39_1:
        "Réunion d'investissement ISSA Capital, conformément à l'Art. 39-1 du CGI.",
    });
    const v = checkEntiteCoherence(cr);
    expect(v.length).toBeGreaterThan(0);
    expect(v.some((x) => /Section 1/i.test(x))).toBe(true);
  });

  it('CR VI avec participant societe « ISSA Capital » = violation', () => {
    const cr = makeCr({
      entite: 'VI',
      participants: [
        {
          prenom: 'Thomas',
          nom: 'Issa',
          titre: 'Associé Versi Immobilier',
          societe: 'ISSA Capital',
          qualite_relation: 'Signataire',
        },
      ],
    });
    const v = checkEntiteCoherence(cr);
    expect(v.some((x) => /Participant/i.test(x))).toBe(true);
  });

  it('CR GO avec titre participant mentionnant Issa Capital (casse libre) = violation', () => {
    const cr = makeCr({
      entite: 'GO',
      participants: [
        {
          prenom: 'Pierre',
          nom: 'Durand',
          titre: 'Conseiller issa  capital',
          societe: 'Cabinet X',
          qualite_relation: 'Conseil',
        },
      ],
    });
    const v = checkEntiteCoherence(cr);
    expect(v.length).toBeGreaterThan(0);
  });

  it('CR VV propre = pas de violation', () => {
    const cr = makeCr({ entite: 'VV' });
    expect(checkEntiteCoherence(cr)).toEqual([]);
  });
});

// ============================================================
// §6.4 Formules bannies
// ============================================================

describe('detectBannedFormulas (§6.4)', () => {
  it('detecte « globalement » et « à peu près »', () => {
    const out = detectBannedFormulas('On a globalement validé le plan, à peu près 50k.');
    expect(out).toContain('globalement');
    expect(out).toContain('à peu près');
  });

  it('detecte « environ », « etc », « on verra », « à voir », « en gros »', () => {
    const out = detectBannedFormulas(
      'Environ 100 unités, etc. On verra plus tard, à voir, en gros c\'est OK.',
    );
    expect(out).toContain('environ');
    expect(out).toContain('etc.');
    expect(out).toContain('on verra');
    expect(out).toContain('à voir');
    expect(out).toContain('en gros');
  });

  it('detecte « on a parlé de », « il faudrait peut-être », « vu ensemble », « c\'est noté », « super »', () => {
    const out = detectBannedFormulas(
      "On a parlé de stratégie, il faudrait peut-être ajuster. Vu ensemble la semaine passée. C'est noté. Super réunion.",
    );
    expect(out).toContain('on a parlé de');
    expect(out).toContain('il faudrait peut-être');
    expect(out).toContain('vu ensemble');
    expect(out).toContain("c'est noté");
    expect(out).toContain('super (qualificatif émotionnel)');
  });

  it('texte propre = aucune detection', () => {
    expect(
      detectBannedFormulas(
        "Il a été convenu que les parties signeraient l'accord avant le 30 juin.",
      ),
    ).toEqual([]);
  });

  it('input vide/null = []', () => {
    expect(detectBannedFormulas('')).toEqual([]);
    expect(detectBannedFormulas(null)).toEqual([]);
    expect(detectBannedFormulas(undefined)).toEqual([]);
  });
});

// ============================================================
// §3.3 Section 1 legale
// ============================================================

describe('checkSection1Legal (§3.3)', () => {
  it('Section 1 sans « Art. 39-1 » = violation', () => {
    const cr = makeCr({
      section_1_objet_art_39_1:
        "Le CR documente la réunion de cadrage entre Gradient One et Acme SAS, ses enjeux et son périmètre.",
    });
    const v = checkSection1Legal(cr);
    expect(v.some((x) => /39-1/i.test(x))).toBe(true);
  });

  it('Section 1 avec « article 39-1 » (variante) = pas de violation Art.', () => {
    const cr = makeCr({
      section_1_objet_art_39_1:
        "Le CR documente, conformément à l'article 39-1 du CGI, la réunion de cadrage entre Gradient One et Acme SAS.",
    });
    const v = checkSection1Legal(cr);
    expect(v.some((x) => /39-1/i.test(x))).toBe(false);
  });

  it('Dejeuner sans justification format repas = violation', () => {
    const cr = makeCr({
      type_reunion: 'dejeuner',
      section_1_objet_art_39_1:
        "Conformément à l'Art. 39-1 du CGI, échange commercial entre Gradient One et Acme SAS sur le partenariat Q3.",
    });
    const v = checkSection1Legal(cr);
    expect(v.some((x) => /format repas/i.test(x))).toBe(true);
  });

  it('Dejeuner avec justification (« ce format ») = pas de violation repas', () => {
    const cr = makeCr({
      type_reunion: 'dejeuner',
      section_1_objet_art_39_1:
        "Conformément à l'Art. 39-1 du CGI, ce format de repas a été retenu pour permettre un échange informel approfondi sur le partenariat Q3.",
    });
    const v = checkSection1Legal(cr);
    expect(v.some((x) => /format repas/i.test(x))).toBe(false);
  });

  it('Diner avec « compte tenu » = pas de violation repas', () => {
    const cr = makeCr({
      type_reunion: 'diner',
      section_1_objet_art_39_1:
        "Conformément à l'Art. 39-1 du CGI, compte tenu de l'agenda chargé des parties, un dîner de travail a été organisé.",
    });
    const v = checkSection1Legal(cr);
    expect(v.some((x) => /format repas/i.test(x))).toBe(false);
  });

  it('Montant non null + section 1 sans montant ni Tiime = violation', () => {
    const cr = makeCr({
      type_reunion: 'dejeuner',
      montant_ttc_eur: 120.5,
      section_1_objet_art_39_1:
        "Conformément à l'Art. 39-1 du CGI, ce format de repas a été retenu pour l'échange commercial.",
    });
    const v = checkSection1Legal(cr);
    expect(v.some((x) => /montant TTC|Tiime/i.test(x))).toBe(true);
  });

  it('Montant non null + renvoi Tiime = pas de violation', () => {
    const cr = makeCr({
      type_reunion: 'dejeuner',
      montant_ttc_eur: 120.5,
      section_1_objet_art_39_1:
        "Conformément à l'Art. 39-1 du CGI, ce format de repas a été retenu. Justificatif disponible sur Tiime.",
    });
    const v = checkSection1Legal(cr);
    expect(v).toEqual([]);
  });

  it('Montant non null + montant cite en € = pas de violation', () => {
    const cr = makeCr({
      type_reunion: 'dejeuner',
      montant_ttc_eur: 120.5,
      section_1_objet_art_39_1:
        "Conformément à l'Art. 39-1 du CGI, ce format de repas a été retenu (120,50 € TTC).",
    });
    const v = checkSection1Legal(cr);
    expect(v).toEqual([]);
  });
});

// ============================================================
// validateCrPayload (agregation)
// ============================================================

describe('validateCrPayload', () => {
  it('CR GO propre = ok', () => {
    const r = validateCrPayload(makeCr());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('entite invalide = error early', () => {
    const cr = makeCr({ entite: 'XX' as unknown as 'GO' });
    const r = validateCrPayload(cr);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /Entité invalide/i.test(e))).toBe(true);
  });

  it('Carl + IC = refus RBAC', () => {
    const cr = makeCr({ entite: 'IC' });
    const r = validateCrPayload(cr, { requester: 'carl' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /carl/i.test(e))).toBe(true);
  });

  it('Formules bannies = warning (pas error)', () => {
    const cr = makeCr({
      section_3_decisions: "Il a été convenu que globalement les parties valident.",
    });
    const r = validateCrPayload(cr);
    expect(r.warnings).toContain('globalement');
    // ok depend des autres validations — ici tout est OK par ailleurs
    expect(r.ok).toBe(true);
  });

  it('Cumul errors (GO + ISSA Capital + section 1 sans Art. 39-1)', () => {
    const cr = makeCr({
      entite: 'GO',
      section_1_objet_art_39_1:
        "Réunion ISSA Capital sur le cadrage du partenariat Q3, voir plus loin dans le doc.",
    });
    const r = validateCrPayload(cr);
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// isDuplicateCr
// ============================================================

describe('isDuplicateCr', () => {
  const base = { entite: 'GO' as const, objet: 'Cadrage partenariat Q3', date: '2026-05-29' };

  it('memes entite/date/objet normalises = doublon', () => {
    expect(
      isDuplicateCr(base, [
        { entite: 'GO', objet: '  CADRAGE   partenariat  Q3 ', date: '2026-05-29' },
      ]),
    ).toBe(true);
  });

  it('entite differente = pas doublon', () => {
    expect(
      isDuplicateCr(base, [{ entite: 'VI', objet: 'Cadrage partenariat Q3', date: '2026-05-29' }]),
    ).toBe(false);
  });

  it('date differente = pas doublon', () => {
    expect(
      isDuplicateCr(base, [{ entite: 'GO', objet: 'Cadrage partenariat Q3', date: '2026-05-30' }]),
    ).toBe(false);
  });

  it('objet vraiment different = pas doublon', () => {
    expect(
      isDuplicateCr(base, [{ entite: 'GO', objet: 'Revue financière mensuelle', date: '2026-05-29' }]),
    ).toBe(false);
  });

  it('liste existing vide = pas doublon', () => {
    expect(isDuplicateCr(base, [])).toBe(false);
  });
});
