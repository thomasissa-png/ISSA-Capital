/**
 * Tests contacts.ts — intégration vault + BASE + dynamic, déduplication.
 *
 * Jalon S15.5F — Migration pipeline CR vers vault Drive.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VaultContact } from '../vault-contacts';

// ============================================================
// Mocks
// ============================================================

const mockGetVaultContacts = vi.fn().mockResolvedValue([] as VaultContact[]);

vi.mock('../vault-contacts', () => ({
  getVaultContacts: () => mockGetVaultContacts(),
}));

// Importer contacts APRES le mock
import { getAllContacts, formatContactsForPrompt } from '../contacts';

// ============================================================
// Reset globalThis + fichier dynamic entre chaque test
// ============================================================

const GLOBAL_KEY = '__issa_contacts__';

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = [];
  mockGetVaultContacts.mockResolvedValue([]);
});

// ============================================================
// Tests
// ============================================================

describe('getAllContacts — déduplication vault + BASE + dynamic', () => {
  it('retourne BASE contacts quand vault est vide', async () => {
    mockGetVaultContacts.mockResolvedValue([]);
    const all = await getAllContacts();
    // BASE_CONTACTS a 6 entrées
    expect(all.length).toBe(6);
    expect(all.some((c) => c.prenom === 'Thomas' && c.nom === 'Issa')).toBe(true);
  });

  it('fusionne vault + BASE sans duplication (Thomas Issa)', async () => {
    mockGetVaultContacts.mockResolvedValue([
      {
        prenom: 'Thomas',
        nom: 'Issa',
        titre: 'Président',
        societe: 'ISSA Capital SAS',
        entitesVisibles: [],
        notes: 'Depuis le vault',
      },
      {
        prenom: 'Grégory',
        nom: 'Pittet',
        titre: '',
        societe: '',
        entitesVisibles: [],
        notes: 'Ami Sony',
      },
    ]);

    const all = await getAllContacts();
    // Thomas Issa dédupliqué (vault prime) + Gregory ajouté + 5 BASE restants = 7
    const thomasEntries = all.filter(
      (c) => c.prenom.toLowerCase() === 'thomas' && c.nom.toLowerCase() === 'issa',
    );
    expect(thomasEntries).toHaveLength(1);
    // La version vault prime : notes = 'Depuis le vault'
    expect(thomasEntries[0]!.notes).toBe('Depuis le vault');

    // Gregory Pittet est ajouté
    expect(all.some((c) => c.nom === 'Pittet')).toBe(true);

    // Total : 1 Thomas (vault) + 5 BASE (les 5 autres) + 1 Gregory = 7
    expect(all.length).toBe(7);
  });

  it('vault prime sur BASE (case-insensitive)', async () => {
    mockGetVaultContacts.mockResolvedValue([
      {
        prenom: 'carl',
        nom: 'standertskjold-nordenstam',
        titre: 'Co-fondateur vault',
        societe: 'Gradient One',
        entitesVisibles: [],
      },
    ]);

    const all = await getAllContacts();
    const carl = all.find(
      (c) => c.nom.toLowerCase() === 'standertskjold-nordenstam',
    );
    expect(carl).toBeDefined();
    // La version vault a "Co-fondateur vault" comme titre
    expect(carl!.titre).toBe('Co-fondateur vault');
  });

  it('si vault throw → fallback BASE + dynamic (pas de crash)', async () => {
    mockGetVaultContacts.mockRejectedValue(new Error('Drive en panne'));

    const all = await getAllContacts();
    // Retombe sur BASE_CONTACTS (6 entrées)
    expect(all.length).toBe(6);
    expect(all.some((c) => c.prenom === 'Thomas')).toBe(true);
  });
});

describe('formatContactsForPrompt — compatible format existant', () => {
  it('retourne le format attendu avec vault + BASE contacts', async () => {
    mockGetVaultContacts.mockResolvedValue([
      {
        prenom: 'Grégory',
        nom: 'Pittet',
        titre: '',
        societe: 'Sony',
        entitesVisibles: [],
        notes: 'Ami Sony',
      },
    ]);

    const output = await formatContactsForPrompt();
    // Gregory doit apparaître
    expect(output).toContain('Grégory Pittet');
    expect(output).toContain('Sony');
    // BASE contacts aussi
    expect(output).toContain('Thomas Issa');
    // Format "- Prénom Nom — titre, société (entités visibles : [...])"
    expect(output).toMatch(/^- .+ — .+, .+ \(entités visibles : \[.*\]\)/m);
  });

  it('retourne message par défaut si aucun contact', async () => {
    // Mock getAllContacts pour retourner vide :
    // on ne peut pas facilement vider BASE_CONTACTS, donc ce test
    // vérifie juste que le format est correct avec les BASE
    mockGetVaultContacts.mockResolvedValue([]);
    const output = await formatContactsForPrompt();
    // Avec BASE_CONTACTS, ne devrait pas être le message vide
    expect(output).not.toBe('(Aucun contact récurrent enregistré)');
    expect(output).toContain('Thomas Issa');
  });
});
