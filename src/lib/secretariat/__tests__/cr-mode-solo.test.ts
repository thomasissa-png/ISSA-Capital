/**
 * Tests CR mode solo (S16 Q2).
 *
 * Décision Thomas S15 (mémo S16) :
 *   "On adapte. Même format que les autres, ce sont des comptes rendus.
 *    On continue également le naming classique. Même dossier que les autres
 *    compte rendu. Mêmes infos également, juste adapté à un mode solo."
 *
 * Périmètre couvert :
 *   - Zod CRDraftSchema accepte participants = [] (visite seul, activité perso)
 *   - Zod CRDraftSchema accepte participants = [Thomas Issa seul]
 *   - Renderer Telegram affiche "Présent" au lieu de "Participants" en mode solo
 *   - Renderer Telegram gère array vide (fallback "Thomas Issa, Président")
 *   - PDF generator s'exécute sans erreur en mode solo (array vide et Thomas seul)
 *   - Mode multi-participants existant reste vert (non-régression)
 */

import { describe, it, expect, vi } from 'vitest';
import type { CRDraft } from '../types';

// Mock vault-contacts pour éviter les appels Drive en test
vi.mock('../vault-contacts', () => ({
  getVaultContacts: vi.fn().mockResolvedValue([]),
}));

// ============================================================
// Fixtures
// ============================================================

/** CR de base partagé entre tous les tests (sections valides, à compléter par chaque test). */
function makeBaseCr(): Omit<CRDraft, 'participants'> {
  return {
    reference_placeholder: '[REF_TO_BE_GENERATED]',
    entite: 'VI',
    type_reunion: 'visite-immo',
    date_reunion: '2026-05-18',
    lieu: 'Résidence Les Muguets, 12 rue des Muguets, 75016 Paris',
    objet: "Visite technique préalable du bien Les Muguets en vue d'une acquisition Versi Immobilier",
    montant_ttc_eur: null,
    etablissement_nom: null,
    section_1_objet_art_39_1:
      "Cette visite s'inscrit dans la stratégie d'investissement résidentiel de Versi Immobilier conformément à l'Art. 39-1 du CGI. Le déplacement vise à évaluer l'opportunité d'acquisition.",
    section_2_points_abordes:
      "Il a été constaté l'état général du bien : appartement de 85 m², 3 pièces, exposition sud, travaux de rafraîchissement à prévoir (peintures, sols). Le bien présente un potentiel locatif estimé conforme aux benchmarks du secteur.",
    section_3_decisions:
      "Décision de mandater Maxime Lemoine pour une étude de faisabilité financière complète avant transmission d'une offre.",
    section_4_suites_a_donner:
      "Étude de faisabilité — Responsable : Maxime Lemoine — Échéance : 25 mai 2026",
    annexes_photographiques: null,
  };
}

// ============================================================
// 1. Zod schema — accepte mode solo
// ============================================================

describe('CRDraftSchema — mode solo (S16 Q2)', () => {
  it('accepte participants = [] (visite immo seul)', async () => {
    const { CRDraftSchema } = await import('../types');
    const cr: CRDraft = { ...makeBaseCr(), participants: [] };
    const result = CRDraftSchema.safeParse(cr);
    expect(result.success).toBe(true);
  });

  it('accepte participants = [Thomas Issa seul] (activité perso signée)', async () => {
    const { CRDraftSchema } = await import('../types');
    const cr: CRDraft = {
      ...makeBaseCr(),
      participants: [
        {
          prenom: 'Thomas',
          nom: 'Issa',
          titre: 'Associé',
          societe: 'Versi Immobilier',
          qualite_relation: 'Signataire',
        },
      ],
    };
    const result = CRDraftSchema.safeParse(cr);
    expect(result.success).toBe(true);
  });

  it('accepte participants = multi (non-régression mode classique)', async () => {
    const { CRDraftSchema } = await import('../types');
    const cr: CRDraft = {
      ...makeBaseCr(),
      participants: [
        {
          prenom: 'Thomas',
          nom: 'Issa',
          titre: 'Associé',
          societe: 'Versi Immobilier',
          qualite_relation: 'Signataire',
        },
        {
          prenom: 'Maxime',
          nom: 'Lemoine',
          titre: 'Associé',
          societe: 'Versi Immobilier',
          qualite_relation: 'Co-associé',
        },
      ],
    };
    const result = CRDraftSchema.safeParse(cr);
    expect(result.success).toBe(true);
  });
});

// ============================================================
// 2. Renderer Telegram — libellé adapté
// ============================================================

describe('renderCrForTelegram — mode solo (S16 Q2)', () => {
  it('affiche "Présent" et le fallback Thomas Issa quand participants = []', async () => {
    const { renderCrForTelegram } = await import('../cr-renderer');
    const cr: CRDraft = { ...makeBaseCr(), participants: [] };
    const output = renderCrForTelegram(cr, 'VI-CR-2026-0042');

    expect(output).toContain('*Présent*');
    expect(output).not.toContain('*Participants*');
    expect(output).toContain('Thomas Issa');
    expect(output).toContain('mode solo');
  });

  it('affiche "Présent" quand seul Thomas Issa est dans participants', async () => {
    const { renderCrForTelegram } = await import('../cr-renderer');
    const cr: CRDraft = {
      ...makeBaseCr(),
      participants: [
        {
          prenom: 'Thomas',
          nom: 'Issa',
          titre: 'Associé',
          societe: 'Versi Immobilier',
          qualite_relation: 'Signataire',
        },
      ],
    };
    const output = renderCrForTelegram(cr, 'VI-CR-2026-0043');

    expect(output).toContain('*Présent*');
    expect(output).not.toContain('*Participants*');
    expect(output).toContain('Thomas Issa');
  });

  it('garde "Participants" pluriel quand au moins un tiers est présent (non-régression)', async () => {
    const { renderCrForTelegram } = await import('../cr-renderer');
    const cr: CRDraft = {
      ...makeBaseCr(),
      participants: [
        {
          prenom: 'Thomas',
          nom: 'Issa',
          titre: 'Associé',
          societe: 'Versi Immobilier',
          qualite_relation: 'Signataire',
        },
        {
          prenom: 'Maxime',
          nom: 'Lemoine',
          titre: 'Associé',
          societe: 'Versi Immobilier',
          qualite_relation: 'Co-associé',
        },
      ],
    };
    const output = renderCrForTelegram(cr, 'VI-CR-2026-0044');

    expect(output).toContain('*Participants*');
    expect(output).not.toContain('*Présent*');
    expect(output).toContain('Maxime Lemoine');
  });
});

// ============================================================
// 3. PDF generator — n'explose pas en mode solo
// ============================================================

describe('generateCrPdf — mode solo (S16 Q2)', () => {
  it('génère un PDF valide quand participants = []', async () => {
    const { generateCrPdf } = await import('../pdf-generator');
    const cr: CRDraft = { ...makeBaseCr(), participants: [] };

    const buf = await generateCrPdf({
      cr,
      reference: 'VI-CR-2026-0042',
      dateEtablissement: '2026-05-18T10:00:00Z',
    });

    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
    const latin1 = buf.toString('latin1');
    expect(latin1).not.toContain('undefined');
    expect(latin1).not.toContain('(null)');
  });

  it('génère un PDF valide quand participants = [Thomas Issa seul]', async () => {
    const { generateCrPdf } = await import('../pdf-generator');
    const cr: CRDraft = {
      ...makeBaseCr(),
      participants: [
        {
          prenom: 'Thomas',
          nom: 'Issa',
          titre: 'Associé',
          societe: 'Versi Immobilier',
          qualite_relation: 'Signataire',
        },
      ],
    };

    const buf = await generateCrPdf({
      cr,
      reference: 'VI-CR-2026-0043',
      dateEtablissement: '2026-05-18T10:00:00Z',
    });

    expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(1000);
  });
});
