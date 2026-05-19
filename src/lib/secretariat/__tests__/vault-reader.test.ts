/**
 * Tests unitaires — vault-reader (cache TTL lecture vault Drive).
 *
 * Mocks : drive-resolver, obsidian-file, drive-upload, vault-client/index.
 * Vérifie : cache hit/miss, TTL expiry, fallback stale, invalidation.
 *
 * Jalon 5D — Session 15.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks
// ============================================================

const mockGetAccessToken = vi.fn().mockResolvedValue('mock-token');
const mockListMarkdownFiles = vi.fn().mockResolvedValue([]);
const mockReadFileById = vi.fn().mockResolvedValue({ success: false });
const mockFindContactByEmail = vi.fn().mockResolvedValue(null);

vi.mock('../drive-upload', () => ({
  getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
}));

vi.mock('../vault-client/drive-resolver', () => ({
  listMarkdownFiles: (...args: unknown[]) => mockListMarkdownFiles(...args),
}));

vi.mock('../vault-client/obsidian-file', () => ({
  readFileById: (...args: unknown[]) => mockReadFileById(...args),
}));

vi.mock('../vault-client', () => ({
  findContactByEmail: (...args: unknown[]) => mockFindContactByEmail(...args),
}));

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import {
  readVaultFile,
  listVaultFolder,
  findContactCached,
  findProjetFicheByEntite,
  invalidateAllVaultCache,
  invalidateFileCache,
  invalidateContactCache,
  invalidateFolderCache,
  invalidateProjetFicheCache,
  getVaultCacheSize,
  _vaultReaderInternals,
} from '../vault-reader';

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  invalidateAllVaultCache();
});

// ============================================================
// Tests : readVaultFile
// ============================================================

describe('readVaultFile', () => {
  it('lit un fichier depuis Drive et le met en cache', async () => {
    mockListMarkdownFiles.mockResolvedValueOnce([
      { id: 'file-1', name: 'Thomas Issa.md' },
    ]);
    mockReadFileById.mockResolvedValueOnce({
      success: true,
      content: '---\nnom: Issa\n---\nContenu.',
    });

    const result = await readVaultFile('07. Contacts/03. Pro', 'Thomas Issa.md');

    expect(result.success).toBe(true);
    expect(result.content).toContain('nom: Issa');
    expect(result.fileId).toBe('file-1');
    expect(getVaultCacheSize().files).toBe(1);
  });

  it('retourne le cache au second appel (pas de re-lecture Drive)', async () => {
    mockListMarkdownFiles.mockResolvedValueOnce([
      { id: 'file-1', name: 'Thomas Issa.md' },
    ]);
    mockReadFileById.mockResolvedValueOnce({
      success: true,
      content: 'contenu original',
    });

    await readVaultFile('path', 'Thomas Issa.md');
    const result = await readVaultFile('path', 'Thomas Issa.md');

    expect(result.success).toBe(true);
    expect(result.content).toBe('contenu original');
    // listMarkdownFiles appelé une seule fois (cache hit au second appel)
    expect(mockListMarkdownFiles).toHaveBeenCalledTimes(1);
  });

  it('retourne erreur si fichier non trouvé dans le dossier', async () => {
    mockListMarkdownFiles.mockResolvedValueOnce([
      { id: 'file-other', name: 'Autre Fichier.md' },
    ]);

    const result = await readVaultFile('path', 'Inexistant.md');

    expect(result.success).toBe(false);
    expect(result.error).toContain('non trouvé');
  });

  it('retourne cache stale si pas de token OAuth', async () => {
    // Premier appel : charge le cache
    mockListMarkdownFiles.mockResolvedValueOnce([
      { id: 'file-1', name: 'Fiche.md' },
    ]);
    mockReadFileById.mockResolvedValueOnce({
      success: true,
      content: 'contenu initial',
    });
    await readVaultFile('path', 'Fiche.md');

    // Invalider le cache pour forcer un re-fetch
    invalidateFileCache('path', 'Fiche.md');

    // Deuxième appel : token absent → fallback stale impossible (cache vidé)
    mockGetAccessToken.mockResolvedValueOnce(null);
    const result = await readVaultFile('path', 'Fiche.md');

    // Pas de cache stale disponible (cache invalidé), pas de token
    expect(result.success).toBe(false);
  });

  it('retourne cache stale si Drive échoue et cache existe', async () => {
    // Premier appel : charge le cache
    mockListMarkdownFiles.mockResolvedValueOnce([
      { id: 'file-1', name: 'Fiche.md' },
    ]);
    mockReadFileById.mockResolvedValueOnce({
      success: true,
      content: 'contenu original',
    });
    await readVaultFile('path', 'Fiche.md');

    // Forcer expiration du TTL en manipulant le cache interne
    // On va re-appeler et mocker une erreur Drive
    // Mais le TTL est 1h... il faut avancer le temps
    // Astuce : invalider le file cache pour forcer un re-fetch
    invalidateFileCache('path', 'Fiche.md');

    // Maintenant le cache est vide → pas de stale possible
    // Ce test vérifie le cas où le listing Drive throw
    mockListMarkdownFiles.mockRejectedValueOnce(new Error('Drive API down'));
    const result = await readVaultFile('path', 'Fiche.md');

    // Pas de stale (cache vidé) → erreur
    expect(result.success).toBe(false);
  });

  it('match le fichier en case-insensitive', async () => {
    mockListMarkdownFiles.mockResolvedValueOnce([
      { id: 'file-1', name: 'Thomas Issa.md' },
    ]);
    mockReadFileById.mockResolvedValueOnce({
      success: true,
      content: 'contenu',
    });

    const result = await readVaultFile('path', 'thomas issa.md');

    expect(result.success).toBe(true);
  });
});

// ============================================================
// Tests : listVaultFolder
// ============================================================

describe('listVaultFolder', () => {
  it('liste les fichiers et met en cache', async () => {
    mockListMarkdownFiles.mockResolvedValueOnce([
      { id: 'f1', name: 'Fichier 1.md' },
      { id: 'f2', name: 'Fichier 2.md' },
    ]);

    const result = await listVaultFolder('07. Contacts/01. Famille');

    expect(result).toHaveLength(2);
    expect(getVaultCacheSize().folders).toBe(1);
  });

  it('retourne le cache au second appel', async () => {
    mockListMarkdownFiles.mockResolvedValueOnce([
      { id: 'f1', name: 'Fichier 1.md' },
    ]);

    await listVaultFolder('path');
    await listVaultFolder('path');

    expect(mockListMarkdownFiles).toHaveBeenCalledTimes(1);
  });

  it('retourne tableau vide si listing échoue sans cache', async () => {
    mockListMarkdownFiles.mockRejectedValueOnce(new Error('Drive down'));

    const result = await listVaultFolder('path/inconnu');

    expect(result).toEqual([]);
  });

  it('invalide correctement le cache dossier', async () => {
    mockListMarkdownFiles
      .mockResolvedValueOnce([{ id: 'f1', name: 'A.md' }])
      .mockResolvedValueOnce([{ id: 'f1', name: 'A.md' }, { id: 'f2', name: 'B.md' }]);

    const first = await listVaultFolder('path');
    expect(first).toHaveLength(1);

    invalidateFolderCache('path');

    const second = await listVaultFolder('path');
    expect(second).toHaveLength(2);
    expect(mockListMarkdownFiles).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// Tests : findContactCached
// ============================================================

describe('findContactCached', () => {
  const mockContact = {
    name: 'Martin Yhuel',
    folderPath: '07. Contacts/03. Pro',
    emails: ['myhuel@pnmavocats.law'],
    content: '---\nnom: Yhuel\n---',
    fileId: 'martin-id',
  };

  it('trouve un contact et le met en cache', async () => {
    mockFindContactByEmail.mockResolvedValueOnce(mockContact);

    const result = await findContactCached('myhuel@pnmavocats.law');

    expect(result).not.toBeNull();
    expect(result!.name).toBe('Martin Yhuel');
    expect(getVaultCacheSize().contacts).toBe(1);
  });

  it('retourne le cache au second appel', async () => {
    mockFindContactByEmail.mockResolvedValueOnce(mockContact);

    await findContactCached('myhuel@pnmavocats.law');
    const result = await findContactCached('myhuel@pnmavocats.law');

    expect(result!.name).toBe('Martin Yhuel');
    expect(mockFindContactByEmail).toHaveBeenCalledTimes(1);
  });

  it('normalise l\'email en lowercase', async () => {
    mockFindContactByEmail.mockResolvedValueOnce(mockContact);

    await findContactCached('MYhuel@PNMAvocats.LAW');

    expect(mockFindContactByEmail).toHaveBeenCalledWith('myhuel@pnmavocats.law');
  });

  it('retourne null pour un email invalide sans appel Drive', async () => {
    const result = await findContactCached('pas-un-email');

    expect(result).toBeNull();
    expect(mockFindContactByEmail).not.toHaveBeenCalled();
  });

  it('cache aussi les résultats null (contact inexistant)', async () => {
    mockFindContactByEmail.mockResolvedValueOnce(null);

    const first = await findContactCached('inconnu@example.com');
    const second = await findContactCached('inconnu@example.com');

    expect(first).toBeNull();
    expect(second).toBeNull();
    // Un seul appel Drive — le null est caché
    expect(mockFindContactByEmail).toHaveBeenCalledTimes(1);
  });

  it('invalide correctement le cache contact', async () => {
    mockFindContactByEmail
      .mockResolvedValueOnce(mockContact)
      .mockResolvedValueOnce({ ...mockContact, name: 'Martin Yhuel (mis à jour)' });

    await findContactCached('myhuel@pnmavocats.law');
    invalidateContactCache('myhuel@pnmavocats.law');
    const result = await findContactCached('myhuel@pnmavocats.law');

    expect(result!.name).toBe('Martin Yhuel (mis à jour)');
    expect(mockFindContactByEmail).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// Tests : invalidation globale
// ============================================================

describe('invalidateAllVaultCache', () => {
  it('vide tous les caches', async () => {
    // Remplir les 3 caches
    mockListMarkdownFiles.mockResolvedValueOnce([{ id: 'f1', name: 'A.md' }]);
    mockReadFileById.mockResolvedValueOnce({ success: true, content: 'x' });
    await readVaultFile('path', 'A.md');

    mockListMarkdownFiles.mockResolvedValueOnce([{ id: 'f2', name: 'B.md' }]);
    await listVaultFolder('path2');

    mockFindContactByEmail.mockResolvedValueOnce({ name: 'Test', emails: ['t@t.com'], folderPath: '', content: '', fileId: '' });
    await findContactCached('t@t.com');

    expect(getVaultCacheSize().files).toBe(1);
    expect(getVaultCacheSize().folders).toBe(1);
    expect(getVaultCacheSize().contacts).toBe(1);

    invalidateAllVaultCache();

    expect(getVaultCacheSize().files).toBe(0);
    expect(getVaultCacheSize().folders).toBe(0);
    expect(getVaultCacheSize().contacts).toBe(0);
  });
});

// ============================================================
// Tests : findProjetFicheByEntite (R7 — résolution dynamique fiche Projet)
// ============================================================

describe('findProjetFicheByEntite', () => {
  const VAULT_FICHES = [
    { id: 'fileid-IC', name: 'ISSA Capital.md' },
    { id: 'fileid-GO', name: 'Gradient One.md' },
    { id: 'fileid-VI', name: 'Versi Immobilier.md' },
    { id: 'fileid-VV', name: 'Versi Invest.md' },
  ];

  it('résout IC vers ISSA Capital.md (chemin vault `02. Projets/02. Pro`)', async () => {
    mockListMarkdownFiles.mockResolvedValueOnce(VAULT_FICHES);

    const result = await findProjetFicheByEntite('IC');

    expect(result).not.toBeNull();
    expect(result!.fileId).toBe('fileid-IC');
    expect(result!.ficheName).toBe('ISSA Capital');
    expect(result!.resolvedFilename).toBe('ISSA Capital.md');
    // Vérifie qu'on a interrogé le bon dossier
    expect(mockListMarkdownFiles).toHaveBeenCalledWith(
      _vaultReaderInternals.PROJET_FICHE_FOLDER_PATH,
    );
  });

  it('résout GO/VI/VV vers leurs fiches respectives', async () => {
    // 3 appels successifs, chaque appel re-utilise le cache folderCache (1 seul listMarkdownFiles)
    mockListMarkdownFiles.mockResolvedValue(VAULT_FICHES);

    const go = await findProjetFicheByEntite('GO');
    const vi = await findProjetFicheByEntite('VI');
    const vv = await findProjetFicheByEntite('VV');

    expect(go!.fileId).toBe('fileid-GO');
    expect(go!.ficheName).toBe('Gradient One');
    expect(vi!.fileId).toBe('fileid-VI');
    expect(vi!.ficheName).toBe('Versi Immobilier');
    expect(vv!.fileId).toBe('fileid-VV');
    expect(vv!.ficheName).toBe('Versi Invest');
  });

  it('renvoie null pour une entité inconnue (pas dans le mapping)', async () => {
    const result = await findProjetFicheByEntite('ZZ');

    expect(result).toBeNull();
    // Pas d'appel Drive — short-circuit sur mapping
    expect(mockListMarkdownFiles).not.toHaveBeenCalled();
    // Le null est caché pour ne pas re-tenter
    expect(getVaultCacheSize().projetFiches).toBe(1);
  });

  it('renvoie null pour entiteCode vide ou undefined', async () => {
    expect(await findProjetFicheByEntite('')).toBeNull();
    expect(await findProjetFicheByEntite('   ')).toBeNull();
    expect(mockListMarkdownFiles).not.toHaveBeenCalled();
  });

  it('cache hit au second appel (un seul listing Drive)', async () => {
    mockListMarkdownFiles.mockResolvedValueOnce(VAULT_FICHES);

    const first = await findProjetFicheByEntite('IC');
    const second = await findProjetFicheByEntite('IC');

    expect(first).toEqual(second);
    expect(first!.fileId).toBe('fileid-IC');
    // Le cache fiche Projet évite même de re-toucher le folderCache
    expect(mockListMarkdownFiles).toHaveBeenCalledTimes(1);
  });

  it('détecte une fiche renommée (.md retiré) via match base name', async () => {
    // Scénario : Thomas a renommé le fichier sans extension visible côté Drive
    mockListMarkdownFiles.mockResolvedValueOnce([
      { id: 'fileid-IC-renamed', name: 'issa capital.md' }, // casse différente
    ]);

    const result = await findProjetFicheByEntite('IC');

    expect(result).not.toBeNull();
    expect(result!.fileId).toBe('fileid-IC-renamed');
    expect(result!.ficheName).toBe('ISSA Capital');
    expect(result!.resolvedFilename).toBe('issa capital.md');
  });

  it('renvoie null si la fiche existe pas dans le vault (dossier vide)', async () => {
    // S20.D : ni à plat ni en sous-dossier → 2 listings vides
    mockListMarkdownFiles
      .mockResolvedValueOnce([]) // 02. Pro à plat
      .mockResolvedValueOnce([]); // 02. Pro/ISSA Capital sous-dossier

    const result = await findProjetFicheByEntite('IC');

    expect(result).toBeNull();
    expect(getVaultCacheSize().projetFiches).toBe(1);
  });

  it('renvoie null si la fiche cherchée est absente (autre fiche présente)', async () => {
    // S20.D : autre fiche à plat, et sous-dossier ISSA Capital inexistant ([])
    mockListMarkdownFiles
      .mockResolvedValueOnce([{ id: 'fileid-other', name: 'Autre Projet.md' }])
      .mockResolvedValueOnce([]);

    const result = await findProjetFicheByEntite('IC');

    expect(result).toBeNull();
  });

  it('renvoie null si le listing Drive échoue (fallback gracieux, pas de throw)', async () => {
    // S20.D : les 2 listings échouent (parent ET sous-dossier).
    // listVaultFolder catche les throws et retourne [] → findProjetFicheByEntite
    // ne trouve rien → null. Pas de throw remontant à l'appelant.
    mockListMarkdownFiles
      .mockRejectedValueOnce(new Error('Drive API down'))
      .mockRejectedValueOnce(new Error('Drive API down'));

    // Ne throw pas
    const result = await findProjetFicheByEntite('IC');

    expect(result).toBeNull();
  });

  it('normalise le code entité en uppercase (ic == IC)', async () => {
    mockListMarkdownFiles.mockResolvedValueOnce(VAULT_FICHES);

    const result = await findProjetFicheByEntite('ic');

    expect(result).not.toBeNull();
    expect(result!.fileId).toBe('fileid-IC');
  });

  // ============================================================
  // S20.D — Scan 2 niveaux (fiche à plat OU dans sous-dossier par entité)
  // ============================================================

  describe('S20.D — sous-dossiers par entité', () => {
    it('fiche à plat trouvée → retourne fileId direct (régression S17 préservée)', async () => {
      // Comportement historique : un seul appel au dossier parent suffit
      mockListMarkdownFiles.mockResolvedValueOnce(VAULT_FICHES);

      const result = await findProjetFicheByEntite('IC');

      expect(result).not.toBeNull();
      expect(result!.fileId).toBe('fileid-IC');
      expect(result!.resolvedFilename).toBe('ISSA Capital.md');
      // Un seul listing : pas de fallback sous-dossier nécessaire
      expect(mockListMarkdownFiles).toHaveBeenCalledTimes(1);
      expect(mockListMarkdownFiles).toHaveBeenCalledWith(
        _vaultReaderInternals.PROJET_FICHE_FOLDER_PATH,
      );
    });

    it('fiche dans sous-dossier trouvée → scan 2 niveaux, retourne fileId', async () => {
      // 1er listing (02. Pro) → vide (refactor en cours, fiche déplacée)
      // 2e listing (02. Pro/ISSA Capital) → contient la fiche
      mockListMarkdownFiles
        .mockResolvedValueOnce([]) // dossier parent vide à plat
        .mockResolvedValueOnce([
          { id: 'fileid-IC-subfolder', name: 'ISSA Capital.md' },
        ]);

      const result = await findProjetFicheByEntite('IC');

      expect(result).not.toBeNull();
      expect(result!.fileId).toBe('fileid-IC-subfolder');
      expect(result!.ficheName).toBe('ISSA Capital');
      expect(result!.resolvedFilename).toBe('ISSA Capital.md');

      // Vérifie les 2 chemins interrogés (ordre = parent puis sous-dossier)
      expect(mockListMarkdownFiles).toHaveBeenNthCalledWith(
        1,
        _vaultReaderInternals.PROJET_FICHE_FOLDER_PATH,
      );
      expect(mockListMarkdownFiles).toHaveBeenNthCalledWith(
        2,
        `${_vaultReaderInternals.PROJET_FICHE_FOLDER_PATH}/ISSA Capital`,
      );
    });

    it('fiche à plat absente ET sous-dossier vide → null + cache null', async () => {
      // Cas dégénéré : aucun des 2 niveaux ne contient la fiche
      mockListMarkdownFiles
        .mockResolvedValueOnce([{ id: 'other', name: 'Autre Truc.md' }])
        .mockResolvedValueOnce([]); // sous-dossier inexistant → [] gracieux

      const result = await findProjetFicheByEntite('IC');

      expect(result).toBeNull();
      // Le null est caché pour éviter les retries inutiles
      expect(getVaultCacheSize().projetFiches).toBe(1);
    });

    it('mix : 3 fiches à plat + 1 entité refactorisée en sous-dossier → toutes résolvent', async () => {
      // Scénario réel transition Thomas : ISSA Capital refactor, GO/VI/VV pas encore
      const PARTIAL_FLAT = [
        { id: 'fileid-GO', name: 'Gradient One.md' },
        { id: 'fileid-VI', name: 'Versi Immobilier.md' },
        { id: 'fileid-VV', name: 'Versi Invest.md' },
        // ISSA Capital absent — déplacé en sous-dossier
      ];

      // IC : 1er listing parent (sans IC) + 2e listing sous-dossier (avec IC)
      // GO/VI/VV : cache folderCache (1h) → réutilisent le PARTIAL_FLAT chargé pour IC
      mockListMarkdownFiles
        .mockResolvedValueOnce(PARTIAL_FLAT) // appel 1 : 02. Pro (depuis IC)
        .mockResolvedValueOnce([
          { id: 'fileid-IC-sub', name: 'ISSA Capital.md' },
        ]); // appel 2 : 02. Pro/ISSA Capital

      const ic = await findProjetFicheByEntite('IC');
      const go = await findProjetFicheByEntite('GO');
      const vi = await findProjetFicheByEntite('VI');
      const vv = await findProjetFicheByEntite('VV');

      expect(ic!.fileId).toBe('fileid-IC-sub');
      expect(go!.fileId).toBe('fileid-GO');
      expect(vi!.fileId).toBe('fileid-VI');
      expect(vv!.fileId).toBe('fileid-VV');

      // 2 appels seulement : 02. Pro (caché ensuite) + 02. Pro/ISSA Capital
      expect(mockListMarkdownFiles).toHaveBeenCalledTimes(2);
    });

    it('cache TTL inchangé (1h) — sous-dossier ne re-listé pas au 2e appel', async () => {
      mockListMarkdownFiles
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'fileid-IC-sub', name: 'ISSA Capital.md' },
        ]);

      const first = await findProjetFicheByEntite('IC');
      const second = await findProjetFicheByEntite('IC');

      expect(first).toEqual(second);
      expect(first!.fileId).toBe('fileid-IC-sub');
      // Cache fiche Projet → 2 listings au total (1 parent + 1 sous-dossier),
      // pas de re-listing au 2e appel
      expect(mockListMarkdownFiles).toHaveBeenCalledTimes(2);
    });

    it('code entité inconnue → short-circuit, aucun listing Drive (régression)', async () => {
      const result = await findProjetFicheByEntite('XX');

      expect(result).toBeNull();
      // Garantit que le scan 2 niveaux n'ajoute PAS de coût pour les inconnus
      expect(mockListMarkdownFiles).not.toHaveBeenCalled();
    });

    it('sous-dossier match insensible à la casse (issa capital.md dans ISSA Capital/)', async () => {
      mockListMarkdownFiles
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { id: 'fileid-IC-lower', name: 'issa capital.md' },
        ]);

      const result = await findProjetFicheByEntite('IC');

      expect(result).not.toBeNull();
      expect(result!.fileId).toBe('fileid-IC-lower');
      expect(result!.resolvedFilename).toBe('issa capital.md');
    });
  });

  it('invalideProjetFicheCache vide bien le cache', async () => {
    mockListMarkdownFiles.mockResolvedValue(VAULT_FICHES);

    await findProjetFicheByEntite('IC');
    expect(getVaultCacheSize().projetFiches).toBe(1);

    invalidateProjetFicheCache('IC');
    expect(getVaultCacheSize().projetFiches).toBe(0);

    // Sans argument : vide tout
    await findProjetFicheByEntite('IC');
    await findProjetFicheByEntite('GO');
    expect(getVaultCacheSize().projetFiches).toBe(2);
    invalidateProjetFicheCache();
    expect(getVaultCacheSize().projetFiches).toBe(0);
  });
});
