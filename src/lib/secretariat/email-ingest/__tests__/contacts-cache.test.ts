/**
 * Tests unitaires — cache contacts email-ingest.
 *
 * Mocks : drive-resolver (listMarkdownFiles), obsidian-file (readFileById),
 * frontmatter (parseObsidianFile, extractEmails), drive-upload (getAccessToken).
 *
 * Vérifie : cache hit/miss, TTL, échec listing → tableau vide,
 * extraction nom depuis frontmatter, fallback nom fichier.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mocks
// ============================================================

const mockGetAccessToken = vi.fn().mockResolvedValue('mock-token');
const mockListMarkdownFiles = vi.fn().mockResolvedValue([]);
const mockReadFileById = vi.fn().mockResolvedValue({ success: false });
const mockParseObsidianFile = vi.fn().mockReturnValue({
  frontmatter: null,
  body: '',
  fullContent: '',
});
const mockExtractEmails = vi.fn().mockReturnValue([]);

vi.mock('../../drive-upload', () => ({
  getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  listMarkdownFiles: (...args: unknown[]) => mockListMarkdownFiles(...args),
}));

vi.mock('../../vault-client/obsidian-file', () => ({
  readFileById: (...args: unknown[]) => mockReadFileById(...args),
}));

vi.mock('../../vault-client/frontmatter', () => ({
  parseObsidianFile: (...args: unknown[]) => mockParseObsidianFile(...args),
  extractEmails: (...args: unknown[]) => mockExtractEmails(...args),
}));

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import { loadKnownContacts, invalidateContactsCache } from '../contacts-cache';

// ============================================================
// Setup / Teardown
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  invalidateContactsCache();
});

afterEach(() => {
  invalidateContactsCache();
});

// ============================================================
// Tests
// ============================================================

describe('loadKnownContacts', () => {
  it('retourne un tableau vide si pas de token OAuth', async () => {
    mockGetAccessToken.mockResolvedValueOnce(null);

    const result = await loadKnownContacts();

    expect(result).toEqual([]);
  });

  it('retourne un tableau vide si le listing Drive échoue (erreur)', async () => {
    mockListMarkdownFiles.mockRejectedValueOnce(new Error('Drive API error'));

    const result = await loadKnownContacts();

    expect(result).toEqual([]);
  });

  it('retourne un tableau vide si aucun fichier .md trouvé', async () => {
    mockListMarkdownFiles.mockResolvedValue([]);

    const result = await loadKnownContacts();

    expect(result).toEqual([]);
  });

  it('extrait un locataire avec nom depuis le frontmatter', async () => {
    // Locataires actuels : 1 fichier
    mockListMarkdownFiles
      .mockResolvedValueOnce([{ id: 'file1', name: 'Martin Dupont.md' }])
      .mockResolvedValueOnce([]); // Pro vide

    mockReadFileById.mockResolvedValueOnce({
      success: true,
      content: '---\nnom: "Dupont"\nprenom: "Martin"\nemail: "martin@example.com"\n---\n',
    });

    mockParseObsidianFile.mockReturnValueOnce({
      frontmatter: {
        fields: { nom: 'Dupont', prenom: 'Martin', email: 'martin@example.com' },
        lists: {},
        raw: '',
        startIndex: 0,
        endIndex: 0,
      },
      body: '',
      fullContent: '',
    });

    mockExtractEmails.mockReturnValueOnce(['martin@example.com']);

    const result = await loadKnownContacts();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'Martin Dupont',
      email: 'martin@example.com',
      type: 'locataire',
    });
  });

  it('utilise le nom de fichier si pas de frontmatter nom/prenom', async () => {
    mockListMarkdownFiles
      .mockResolvedValueOnce([{ id: 'file1', name: 'Sophie Bernard.md' }])
      .mockResolvedValueOnce([]);

    mockReadFileById.mockResolvedValueOnce({
      success: true,
      content: '---\nemail: "sophie@test.fr"\n---\n',
    });

    mockParseObsidianFile.mockReturnValueOnce({
      frontmatter: {
        fields: { email: 'sophie@test.fr' },
        lists: {},
        raw: '',
        startIndex: 0,
        endIndex: 0,
      },
      body: '',
      fullContent: '',
    });

    mockExtractEmails.mockReturnValueOnce(['sophie@test.fr']);

    const result = await loadKnownContacts();

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Sophie Bernard');
    expect(result[0]!.type).toBe('locataire');
  });

  it('utilise le cache au second appel (pas de re-listing Drive)', async () => {
    mockListMarkdownFiles.mockResolvedValue([]);

    await loadKnownContacts();
    await loadKnownContacts();

    // listMarkdownFiles appelé 2 fois au premier appel (locataires + pro),
    // 0 fois au second (cache hit)
    expect(mockListMarkdownFiles).toHaveBeenCalledTimes(2);
  });

  it('recharge après invalidation du cache', async () => {
    mockListMarkdownFiles.mockResolvedValue([]);

    await loadKnownContacts();
    invalidateContactsCache();
    await loadKnownContacts();

    // 2 appels par loadKnownContacts × 2 = 4
    expect(mockListMarkdownFiles).toHaveBeenCalledTimes(4);
  });

  it('skip les fichiers sans email dans le frontmatter', async () => {
    mockListMarkdownFiles
      .mockResolvedValueOnce([
        { id: 'f1', name: 'Avec Email.md' },
        { id: 'f2', name: 'Sans Email.md' },
      ])
      .mockResolvedValueOnce([]);

    // Fichier 1 : avec email
    mockReadFileById
      .mockResolvedValueOnce({ success: true, content: 'content1' })
      .mockResolvedValueOnce({ success: true, content: 'content2' });

    mockParseObsidianFile
      .mockReturnValueOnce({
        frontmatter: { fields: { nom: 'Avec', email: 'avec@test.fr' }, lists: {}, raw: '', startIndex: 0, endIndex: 0 },
        body: '',
        fullContent: '',
      })
      .mockReturnValueOnce({
        frontmatter: { fields: { nom: 'Sans' }, lists: {}, raw: '', startIndex: 0, endIndex: 0 },
        body: '',
        fullContent: '',
      });

    mockExtractEmails
      .mockReturnValueOnce(['avec@test.fr'])
      .mockReturnValueOnce([]);

    const result = await loadKnownContacts();

    expect(result).toHaveLength(1);
    expect(result[0]!.email).toBe('avec@test.fr');
  });

  it('limite les contacts pro à 20 fichiers', async () => {
    // Locataires : vide
    mockListMarkdownFiles.mockResolvedValueOnce([]);

    // Pro : 25 fichiers
    const proFiles = Array.from({ length: 25 }, (_, i) => ({
      id: `pro_${i}`,
      name: `Pro ${i}.md`,
    }));
    mockListMarkdownFiles.mockResolvedValueOnce(proFiles);

    // Tous les fichiers ont un email
    for (let i = 0; i < 20; i++) {
      mockReadFileById.mockResolvedValueOnce({ success: true, content: `content_${i}` });
      mockParseObsidianFile.mockReturnValueOnce({
        frontmatter: { fields: { nom: `Pro ${i}`, email: `pro${i}@test.fr` }, lists: {}, raw: '', startIndex: 0, endIndex: 0 },
        body: '',
        fullContent: '',
      });
      mockExtractEmails.mockReturnValueOnce([`pro${i}@test.fr`]);
    }

    const result = await loadKnownContacts();

    // Seuls les 20 premiers pros sont chargés
    expect(result).toHaveLength(20);
    // readFileById ne doit pas avoir été appelé pour les fichiers 20-24
    expect(mockReadFileById).toHaveBeenCalledTimes(20);
  });
});
