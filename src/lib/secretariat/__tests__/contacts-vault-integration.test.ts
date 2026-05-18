/**
 * Tests contacts.ts — intégration vault + dynamic, déduplication.
 *
 * Jalon S15.5F + post-suppression BASE_CONTACTS hardcodé :
 * source de vérité unique = vault Drive, fallback dynamic uniquement.
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
// Reset globalThis entre chaque test
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

describe('getAllContacts — fusion vault + dynamic', () => {
  it('retourne vide si vault vide et aucun dynamic', async () => {
    mockGetVaultContacts.mockResolvedValue([]);
    const all = await getAllContacts();
    expect(all).toEqual([]);
  });

  it('retourne uniquement les contacts du vault si pas de dynamic', async () => {
    mockGetVaultContacts.mockResolvedValue([
      {
        prenom: 'Carl',
        nom: 'Standertskjold-Nordenstam',
        titre: 'Co-fondateur',
        societe: 'Gradient One / Versi',
        entitesVisibles: ['GO', 'VI', 'VV'],
        notes: 'Co-actionnaire Gradient One',
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
    expect(all).toHaveLength(2);
    expect(all.some((c) => c.nom === 'Standertskjold-Nordenstam')).toBe(true);
    expect(all.some((c) => c.nom === 'Pittet')).toBe(true);
  });

  it('vault prime sur dynamic en cas de doublon (case-insensitive)', async () => {
    mockGetVaultContacts.mockResolvedValue([
      {
        prenom: 'carl',
        nom: 'standertskjold-nordenstam',
        titre: 'Co-fondateur vault',
        societe: 'Gradient One',
        entitesVisibles: [],
      },
    ]);

    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = [
      {
        prenom: 'Carl',
        nom: 'Standertskjold-Nordenstam',
        titre: 'Ancienne version dynamic',
        societe: 'Gradient One',
        entitesVisibles: [],
      },
    ];

    const all = await getAllContacts();
    const carl = all.find(
      (c) => c.nom.toLowerCase() === 'standertskjold-nordenstam',
    );
    expect(carl).toBeDefined();
    expect(carl!.titre).toBe('Co-fondateur vault');
    expect(all).toHaveLength(1);
  });

  it('si vault throw → fallback dynamic uniquement (pas de crash)', async () => {
    mockGetVaultContacts.mockRejectedValue(new Error('Drive en panne'));

    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = [
      {
        prenom: 'Untel',
        nom: 'Dynamic',
        titre: 'X',
        societe: 'Y',
        entitesVisibles: [],
      },
    ];

    const all = await getAllContacts();
    expect(all).toHaveLength(1);
    expect(all[0]!.nom).toBe('Dynamic');
  });

  it('si vault throw et aucun dynamic → tableau vide (pas de crash)', async () => {
    mockGetVaultContacts.mockRejectedValue(new Error('Drive en panne'));
    const all = await getAllContacts();
    expect(all).toEqual([]);
  });
});

describe('formatContactsForPrompt — format compatible', () => {
  it('retourne le format attendu avec contacts du vault', async () => {
    mockGetVaultContacts.mockResolvedValue([
      {
        prenom: 'Grégory',
        nom: 'Pittet',
        titre: 'Manager',
        societe: 'Sony',
        entitesVisibles: ['IC'],
        notes: 'Ami Sony',
      },
    ]);

    const output = await formatContactsForPrompt();
    expect(output).toContain('Grégory Pittet');
    expect(output).toContain('Sony');
    expect(output).toMatch(/^- .+ — .+, .+ \(entités visibles : \[.*\]\)/m);
  });

  it('retourne le message par défaut si aucun contact', async () => {
    mockGetVaultContacts.mockResolvedValue([]);
    const output = await formatContactsForPrompt();
    expect(output).toBe('(Aucun contact récurrent enregistré)');
  });
});
