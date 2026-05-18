/**
 * Tests d'integration exhaustifs -- Secretariat ISSA Capital.
 *
 * Couvre : PDF par entite, CR renderer par entite, contacts,
 * reference counter, conversation store, backup/restore.
 *
 * Chaque test DOIT passer -- si un test echoue, le code source est a corriger.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CRDraft, Entite } from '../types';

// Mock vault-contacts pour éviter les appels Drive en test
vi.mock('../vault-contacts', () => ({
  getVaultContacts: vi.fn().mockResolvedValue([]),
}));

// Chemins des fichiers de persistence (mêmes que dans les modules sources)
const DATA_DIR = existsSync('/home/runner') ? '/home/runner/issa-data' : '/tmp/issa-secretariat';
const COUNTER_FILE = resolve(DATA_DIR, 'cr-counter.json');
const CONVERSATIONS_FILE = resolve(DATA_DIR, 'conversations.json');

/** Supprime un fichier s'il existe (nettoyage inter-tests). */
function removeIfExists(filePath: string): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch { /* best effort */ }
}

// ============================================================
// Fixture partagee -- CR complet utilisable par tous les tests
// ============================================================

function thomasSociete(entite: Entite): string {
  switch (entite) {
    case 'IC': return 'ISSA Capital SAS';
    case 'GO': return 'Gradient One';
    case 'VI': return 'Versi Immobilier';
    case 'VV': return 'Versi Invest';
  }
}

function makeCr(entite: Entite): CRDraft {
  return {
    reference_placeholder: '[REF_TO_BE_GENERATED]',
    entite,
    type_reunion: 'dejeuner',
    date_reunion: '2026-04-10',
    lieu: 'Le Comptoir, 42 rue de Rivoli, 75001 Paris',
    participants: [
      {
        prenom: 'Thomas',
        nom: 'Issa',
        titre: 'Président',
        societe: thomasSociete(entite),
        qualite_relation: 'Signataire',
      },
      {
        prenom: 'Carl',
        nom: 'Standertskjold-Nordenstam',
        titre: 'Co-fondateur',
        societe: 'Gradient One',
        qualite_relation: 'Co-fondateur',
      },
    ],
    objet: "Revue stratégique du portefeuille de participations et validation budgétaire",
    montant_ttc_eur: 145.50,
    etablissement_nom: 'Le Comptoir',
    section_1_objet_art_39_1:
      "Cette réunion s'inscrit dans le cadre de la gestion courante de l'entité conformément à l'Art. 39-1 du CGI. Les frais engagés sont directement liés à l'objet social.",
    section_2_points_abordes:
      "Les échanges ont porté sur la stratégie d'investissement du premier semestre 2026, l'analyse des performances du portefeuille existant et les opportunités de diversification identifiées.",
    section_3_decisions:
      "Il a été décidé de poursuivre l'analyse du dossier Rivoli et de mandater Martin Yhuel pour la rédaction du protocole.",
    section_4_suites_a_donner:
      'Transmission du protocole — Responsable : Thomas Issa — Échéance : 15 avril 2026',
    annexes_photographiques: null,
  };
}

const DATE_ETAB = '2026-04-10T14:30:00Z';
const ENTITES: Entite[] = ['IC', 'GO', 'VI', 'VV'];

// ============================================================
// 1. Tests PDF par entité (4 tests)
// ============================================================

describe('PDF Generator — toutes entités', () => {
  it.each(ENTITES)('génère un PDF valide pour entité %s', async (entite) => {
    const { generateCrPdf } = await import('../pdf-generator');
    const cr = makeCr(entite);
    const reference = `${entite}-CR-2026-0001`;

    const buf = await generateCrPdf({ cr, reference, dateEtablissement: DATE_ETAB });

    // Le PDF commence par %PDF-
    expect(buf.slice(0, 5).toString()).toBe('%PDF-');

    // La taille est > 1000 bytes
    expect(buf.length).toBeGreaterThan(1000);

    // Pas de "undefined" visible dans le contenu (décodé en latin1 pour lire le texte brut du PDF)
    const latin1 = buf.toString('latin1');
    expect(latin1).not.toContain('undefined');

    // Pas de "null" comme texte visible — PDFKit écrit le texte entre ()
    // On vérifie que "(null)" n'apparaît pas comme texte rendu
    expect(latin1).not.toContain('(null)');
  });
});

// ============================================================
// 2. Tests CR renderer par entité (4 tests)
// ============================================================

describe('CR Renderer — renderCrForTelegram par entité', () => {
  it.each<[Entite, boolean, string]>([
    ['IC', true, 'contact@issa-capital.com'],
    ['GO', false, 'contact@versi.fr'],
    ['VI', false, 'contact@versi.fr'],
    ['VV', false, 'contact@versi.fr'],
  ])(
    'entité %s — contient ISSA Capital = %s, email RGPD = %s',
    async (entite, shouldContainIssaCapital, expectedEmail) => {
      const { renderCrForTelegram, renderCrForCraft } = await import('../cr-renderer');
      const cr = makeCr(entite);
      const ref = `${entite}-CR-2026-0001`;
      const output = renderCrForTelegram(cr, ref);

      // Vérifier la présence/absence de "ISSA Capital" dans le rendu Telegram
      if (shouldContainIssaCapital) {
        expect(output).toContain('ISSA Capital');
      } else {
        expect(output).not.toContain('ISSA Capital');
      }

      // Vérifier l'email RGPD dans le rendu Craft (contient la mention RGPD)
      const craftOutput = renderCrForCraft(cr, ref, DATE_ETAB);
      expect(craftOutput).toContain(expectedEmail);
    },
  );
});

// ============================================================
// 3. Tests contacts (2 tests)
// ============================================================

describe('Contacts — formatContactsForPrompt', () => {
  it('contient les contacts du vault quand le mock en fournit', async () => {
    const vaultMod = await import('../vault-contacts');
    vi.mocked(vaultMod.getVaultContacts).mockResolvedValueOnce([
      {
        prenom: 'Carl',
        nom: 'Standertskjold-Nordenstam',
        titre: 'Co-fondateur',
        societe: 'Gradient One / Versi',
        entitesVisibles: ['GO', 'VI', 'VV'],
      },
      {
        prenom: 'Maxime',
        nom: 'Lemoine',
        titre: 'Co-fondateur',
        societe: 'Gradient One / Versi',
        entitesVisibles: ['GO', 'VI', 'VV'],
      },
    ]);
    const { formatContactsForPrompt } = await import('../contacts');
    const output = await formatContactsForPrompt();
    expect(output).toContain('Carl Standertskjold-Nordenstam');
    expect(output).toContain('Maxime Lemoine');
  });

  it('retourne le message par défaut si vault vide', async () => {
    const { formatContactsForPrompt } = await import('../contacts');
    const output = await formatContactsForPrompt();
    expect(output).toBe('(Aucun contact récurrent enregistré)');
  });
});

// ============================================================
// 4. Tests reference counter (4 tests)
// ============================================================

describe('Reference Counter', () => {
  const COUNTER_GLOBAL_KEY = '__issa_cr_counter__';

  beforeEach(() => {
    // Reset le compteur global ET le fichier disque pour isoler chaque test
    (globalThis as Record<string, unknown>)[COUNTER_GLOBAL_KEY] = {};
    removeIfExists(COUNTER_FILE);
  });

  it('getNextReference("IC") retourne IC-CR-{année}-0001', async () => {
    const { getNextReference } = await import('../reference-counter');
    const year = new Date().getFullYear();
    const ref = getNextReference('IC');
    expect(ref).toBe(`IC-CR-${year}-0001`);
  });

  it('getNextReference("GO") retourne GO-CR-{année}-0001', async () => {
    const { getNextReference } = await import('../reference-counter');
    const year = new Date().getFullYear();
    const ref = getNextReference('GO');
    expect(ref).toBe(`GO-CR-${year}-0001`);
  });

  it('appeler 2x incrémente le compteur (0001 puis 0002)', async () => {
    const { getNextReference } = await import('../reference-counter');
    const year = new Date().getFullYear();
    const ref1 = getNextReference('IC');
    const ref2 = getNextReference('IC');
    expect(ref1).toBe(`IC-CR-${year}-0001`);
    expect(ref2).toBe(`IC-CR-${year}-0002`);
  });

  it('les compteurs sont indépendants par entité', async () => {
    const { getNextReference } = await import('../reference-counter');
    const year = new Date().getFullYear();
    const refIC = getNextReference('IC');
    const refGO = getNextReference('GO');
    const refIC2 = getNextReference('IC');

    expect(refIC).toBe(`IC-CR-${year}-0001`);
    expect(refGO).toBe(`GO-CR-${year}-0001`);
    expect(refIC2).toBe(`IC-CR-${year}-0002`);
  });
});

// ============================================================
// 5. Tests conversation store (3 tests)
// ============================================================

describe('Conversation Store', () => {
  const STORE_GLOBAL_KEY = '__issa_conversation_store__';
  const TEST_CHAT_ID = 999999;

  beforeEach(() => {
    // Reset le store global ET le fichier disque pour isoler chaque test
    (globalThis as Record<string, unknown>)[STORE_GLOBAL_KEY] = {};
    removeIfExists(CONVERSATIONS_FILE);
  });

  it('setPendingDraft puis getPendingDraft retourne le draft', async () => {
    const { setPendingDraft, getPendingDraft } = await import('../conversation-store');
    const cr = makeCr('IC');
    const previewText = 'Aperçu du CR pour test';

    setPendingDraft(TEST_CHAT_ID, cr, previewText);
    const draft = getPendingDraft(TEST_CHAT_ID);

    expect(draft).not.toBeNull();
    expect(draft!.cr.entite).toBe('IC');
    expect(draft!.previewText).toBe(previewText);
  });

  it('clearPendingDraft puis getPendingDraft retourne null', async () => {
    const { setPendingDraft, getPendingDraft, clearPendingDraft } = await import('../conversation-store');
    const cr = makeCr('GO');

    setPendingDraft(TEST_CHAT_ID, cr, 'Aperçu GO');
    clearPendingDraft(TEST_CHAT_ID);
    const draft = getPendingDraft(TEST_CHAT_ID);

    expect(draft).toBeNull();
  });

  it('addPhoto puis getPhotos retourne la photo', async () => {
    const { addPhoto, getPhotos } = await import('../conversation-store');

    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const mimeType = 'image/png';
    const caption = 'Photo de test';

    const added = addPhoto(TEST_CHAT_ID, base64, mimeType, caption);
    expect(added).toBe(true);

    const photos = getPhotos(TEST_CHAT_ID);
    expect(photos).toHaveLength(1);
    expect(photos[0]!.base64).toBe(base64);
    expect(photos[0]!.mimeType).toBe(mimeType);
    expect(photos[0]!.caption).toBe(caption);
  });
});

// ============================================================
// 6. Test backup/restore (graceful sans credentials)
// ============================================================

describe('Drive Backup — graceful sans credentials', () => {
  it('backupToGoogleDrive ne crashe pas sans credentials', async () => {
    const { backupToGoogleDrive } = await import('../drive-backup');
    // Sans GOOGLE_SERVICE_ACCOUNT_JSON, doit retourner sans erreur
    await expect(backupToGoogleDrive()).resolves.toBeUndefined();
  });

  it('restoreFromGoogleDrive ne crashe pas sans credentials', async () => {
    const { restoreFromGoogleDrive } = await import('../drive-backup');
    // Sans GOOGLE_SERVICE_ACCOUNT_JSON, doit retourner false sans erreur
    const result = await restoreFromGoogleDrive();
    expect(result).toBe(false);
  });
});
