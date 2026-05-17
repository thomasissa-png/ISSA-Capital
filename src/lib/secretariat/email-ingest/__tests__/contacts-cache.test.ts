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
      .mockResolvedValueOnce([])  // Pro vide
      .mockResolvedValueOnce([]); // Amis vide

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
      .mockResolvedValueOnce([])  // Pro vide
      .mockResolvedValueOnce([]); // Amis vide

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

    // listMarkdownFiles appelé 3 fois au premier appel (locataires + pro + amis),
    // 0 fois au second (cache hit)
    expect(mockListMarkdownFiles).toHaveBeenCalledTimes(3);
  });

  it('recharge après invalidation du cache', async () => {
    mockListMarkdownFiles.mockResolvedValue([]);

    await loadKnownContacts();
    invalidateContactsCache();
    await loadKnownContacts();

    // 3 appels par loadKnownContacts × 2 = 6
    expect(mockListMarkdownFiles).toHaveBeenCalledTimes(6);
  });

  it('skip les fichiers sans email dans le frontmatter', async () => {
    mockListMarkdownFiles
      .mockResolvedValueOnce([
        { id: 'f1', name: 'Avec Email.md' },
        { id: 'f2', name: 'Sans Email.md' },
      ])
      .mockResolvedValueOnce([])  // Pro vide
      .mockResolvedValueOnce([]); // Amis vide

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

    // Amis : vide
    mockListMarkdownFiles.mockResolvedValueOnce([]);

    // Tous les fichiers ont un email (top 20 pro)
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

  it('charge les contacts amis comme type pro (Carl, Maxime cofondateurs)', async () => {
    // Locataires : vide
    mockListMarkdownFiles.mockResolvedValueOnce([]);
    // Pro : vide
    mockListMarkdownFiles.mockResolvedValueOnce([]);
    // Amis : 2 fichiers (Carl, Maxime)
    mockListMarkdownFiles.mockResolvedValueOnce([
      { id: 'carl-id', name: 'Carl Standertskjold-Nordenstam.md' },
      { id: 'maxime-id', name: 'Maxime Lemoine.md' },
    ]);

    // Carl
    mockReadFileById.mockResolvedValueOnce({ success: true, content: 'carl-content' });
    mockParseObsidianFile.mockReturnValueOnce({
      frontmatter: { fields: { nom: 'Standertskjold-Nordenstam', prenom: 'Carl', email: 'c.standertskjold@gmail.com' }, lists: {}, raw: '', startIndex: 0, endIndex: 0 },
      body: '',
      fullContent: '',
    });
    mockExtractEmails.mockReturnValueOnce(['c.standertskjold@gmail.com']);

    // Maxime
    mockReadFileById.mockResolvedValueOnce({ success: true, content: 'maxime-content' });
    mockParseObsidianFile.mockReturnValueOnce({
      frontmatter: { fields: { nom: 'Lemoine', prenom: 'Maxime', email: 'maxime.lemoine@edhec.com' }, lists: {}, raw: '', startIndex: 0, endIndex: 0 },
      body: '',
      fullContent: '',
    });
    mockExtractEmails.mockReturnValueOnce(['maxime.lemoine@edhec.com']);

    const result = await loadKnownContacts();

    expect(result).toHaveLength(2);
    // Amis sont chargés comme type 'pro'
    expect(result[0]!.type).toBe('pro');
    expect(result[0]!.name).toBe('Carl Standertskjold-Nordenstam');
    expect(result[0]!.email).toBe('c.standertskjold@gmail.com');
    expect(result[1]!.type).toBe('pro');
    expect(result[1]!.name).toBe('Maxime Lemoine');
    expect(result[1]!.email).toBe('maxime.lemoine@edhec.com');
  });

  it('limite les contacts amis à 15 fichiers', async () => {
    // Locataires : vide
    mockListMarkdownFiles.mockResolvedValueOnce([]);
    // Pro : vide
    mockListMarkdownFiles.mockResolvedValueOnce([]);
    // Amis : 20 fichiers
    const amisFiles = Array.from({ length: 20 }, (_, i) => ({
      id: `ami_${i}`,
      name: `Ami ${i}.md`,
    }));
    mockListMarkdownFiles.mockResolvedValueOnce(amisFiles);

    // Top 15 amis ont un email
    for (let i = 0; i < 15; i++) {
      mockReadFileById.mockResolvedValueOnce({ success: true, content: `ami-content-${i}` });
      mockParseObsidianFile.mockReturnValueOnce({
        frontmatter: { fields: { nom: `Ami ${i}`, email: `ami${i}@test.fr` }, lists: {}, raw: '', startIndex: 0, endIndex: 0 },
        body: '',
        fullContent: '',
      });
      mockExtractEmails.mockReturnValueOnce([`ami${i}@test.fr`]);
    }

    const result = await loadKnownContacts();

    // Seuls les 15 premiers amis sont chargés
    expect(result).toHaveLength(15);
    expect(mockReadFileById).toHaveBeenCalledTimes(15);
  });

  it('fusionne locataires + pro + amis dans un seul tableau', async () => {
    // 1 locataire
    mockListMarkdownFiles.mockResolvedValueOnce([{ id: 'loc1', name: 'Locataire 1.md' }]);
    // 1 pro
    mockListMarkdownFiles.mockResolvedValueOnce([{ id: 'pro1', name: 'Pro 1.md' }]);
    // 1 ami
    mockListMarkdownFiles.mockResolvedValueOnce([{ id: 'ami1', name: 'Ami 1.md' }]);

    // Locataire
    mockReadFileById.mockResolvedValueOnce({ success: true, content: 'loc' });
    mockParseObsidianFile.mockReturnValueOnce({
      frontmatter: { fields: { email: 'loc@test.fr' }, lists: {}, raw: '', startIndex: 0, endIndex: 0 },
      body: '',
      fullContent: '',
    });
    mockExtractEmails.mockReturnValueOnce(['loc@test.fr']);

    // Pro
    mockReadFileById.mockResolvedValueOnce({ success: true, content: 'pro' });
    mockParseObsidianFile.mockReturnValueOnce({
      frontmatter: { fields: { email: 'pro@test.fr' }, lists: {}, raw: '', startIndex: 0, endIndex: 0 },
      body: '',
      fullContent: '',
    });
    mockExtractEmails.mockReturnValueOnce(['pro@test.fr']);

    // Ami
    mockReadFileById.mockResolvedValueOnce({ success: true, content: 'ami' });
    mockParseObsidianFile.mockReturnValueOnce({
      frontmatter: { fields: { email: 'ami@test.fr' }, lists: {}, raw: '', startIndex: 0, endIndex: 0 },
      body: '',
      fullContent: '',
    });
    mockExtractEmails.mockReturnValueOnce(['ami@test.fr']);

    const result = await loadKnownContacts();

    expect(result).toHaveLength(3);
    expect(result.find(c => c.type === 'locataire')).toBeDefined();
    expect(result.filter(c => c.type === 'pro')).toHaveLength(2); // pro + ami (traité comme pro)
  });

  it('log warn avec le bon comptage locataires/pros/amis scannés', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockListMarkdownFiles
      .mockResolvedValueOnce([{ id: 'loc1', name: 'Loc.md' }])   // 1 locataire
      .mockResolvedValueOnce([{ id: 'pro1', name: 'Pro.md' }])   // 1 pro
      .mockResolvedValueOnce([{ id: 'ami1', name: 'Ami.md' }]);  // 1 ami

    // Tous sans email (skip)
    for (let i = 0; i < 3; i++) {
      mockReadFileById.mockResolvedValueOnce({ success: true, content: 'x' });
      mockParseObsidianFile.mockReturnValueOnce({
        frontmatter: { fields: {}, lists: {}, raw: '', startIndex: 0, endIndex: 0 },
        body: '',
        fullContent: '',
      });
      mockExtractEmails.mockReturnValueOnce([]);
    }

    await loadKnownContacts();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('1 locataires'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('1 pros'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('1 amis'),
    );

    warnSpy.mockRestore();
  });
});
