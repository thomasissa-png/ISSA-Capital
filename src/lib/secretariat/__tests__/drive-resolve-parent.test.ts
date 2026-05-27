/**
 * Tests unitaires — resolveParentFolderForEntite + uploadToDrive (S20.C).
 *
 * Couvre :
 *   - Résolution OK : vault → fileId fiche → Drive GET parents → parent[0]
 *   - Entité inconnue côté vault → null (cache négatif)
 *   - Drive API erreur → null (non caché)
 *   - Cache TTL 1h : 2 appels successifs = 1 seul fetch Drive
 *   - uploadToDrive : vault OK → upload vers parent vault
 *   - uploadToDrive : vault KO (null) → fallback LEGACY_DRIVE_FOLDERS + warn
 *   - LEGACY_DRIVE_FOLDERS encore présent (filet de sécurité S20→S21)
 *
 * Jalon S20.C — hotfix prod upload CR PDF (R7).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mocks — fetch global + vault-reader
// ============================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('../vault-reader', () => ({
  findProjetFicheByEntite: vi.fn(),
}));

// ============================================================
// Imports après mocks
// ============================================================

import {
  resolveParentFolderForEntite,
  uploadToDrive,
  invalidateAccessToken,
  _driveUploadInternals,
} from '../drive-upload';
import { findProjetFicheByEntite } from '../vault-reader';

const mockFindFiche = vi.mocked(findProjetFicheByEntite);

// ============================================================
// Helpers
// ============================================================

const FAKE_ACCESS_TOKEN = 'ya29.fake-token-s20c';
const FAKE_FICHE_FILE_ID = '1FICHE-IC-FILE-ID-FAKE';
const FAKE_PARENT_ID = '1PARENT-VAULT-PRO-FOLDER-ID';

function tokenSuccessResponse() {
  return new Response(
    JSON.stringify({ access_token: FAKE_ACCESS_TOKEN, expires_in: 3600 }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function parentsSuccessResponse(parents: string[] = [FAKE_PARENT_ID]) {
  return new Response(JSON.stringify({ parents }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function driveErrorResponse(status: number, body = 'error') {
  return new Response(body, { status });
}

function uploadSuccessResponse(id = 'uploaded-pdf-id') {
  return new Response(
    JSON.stringify({
      id,
      webViewLink: `https://drive.google.com/file/d/${id}/view`,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/** Réponse files.list pour getOrCreateChildFolder : dossier trouvé. */
function folderFoundResponse(id: string, name: string) {
  return new Response(JSON.stringify({ files: [{ id, name }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Réponse files.list : aucun dossier (déclenche la création). */
function folderNotFoundResponse() {
  return new Response(JSON.stringify({ files: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Réponse files.create : dossier créé. */
function folderCreatedResponse(id: string) {
  return new Response(JSON.stringify({ id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const FAKE_DOCS_ID = '1DOCUMENTS-FOLDER-ID';
const FAKE_CR_ID = '1COMPTES-RENDUS-FOLDER-ID';

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  invalidateAccessToken(); // évite que le cache token (S24) ne fausse la séquence fetch
  _driveUploadInternals.clearParentFolderCache();
  _driveUploadInternals.clearChildFolderCache();
  process.env.GOOGLE_CLIENT_ID = 'fake-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'fake-client-secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'fake-refresh-token';
});

afterEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
});

// ============================================================
// Tests resolveParentFolderForEntite
// ============================================================

describe('resolveParentFolderForEntite', () => {
  it('résout le parent vault quand fiche trouvée + Drive OK', async () => {
    mockFindFiche.mockResolvedValueOnce({
      fileId: FAKE_FICHE_FILE_ID,
      ficheName: 'ISSA Capital',
      resolvedFilename: 'ISSA Capital.md',
      folderPath: '02. Projets/02. Pro',
    });
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockResolvedValueOnce(parentsSuccessResponse());

    const result = await resolveParentFolderForEntite('IC');

    expect(result).toBe(FAKE_PARENT_ID);
    expect(mockFindFiche).toHaveBeenCalledWith('IC');
  });

  it('retourne null si entiteCode vide', async () => {
    const result = await resolveParentFolderForEntite('');
    expect(result).toBeNull();
    expect(mockFindFiche).not.toHaveBeenCalled();
  });

  it('retourne null si fiche projet introuvable (entité inconnue)', async () => {
    mockFindFiche.mockResolvedValueOnce(null);

    const result = await resolveParentFolderForEntite('ZZ');

    expect(result).toBeNull();
  });

  it('retourne null si Drive API renvoie une erreur HTTP', async () => {
    mockFindFiche.mockResolvedValueOnce({
      fileId: FAKE_FICHE_FILE_ID,
      ficheName: 'ISSA Capital',
      resolvedFilename: 'ISSA Capital.md',
      folderPath: '02. Projets/02. Pro',
    });
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockResolvedValueOnce(driveErrorResponse(404, 'not found'));

    const result = await resolveParentFolderForEntite('IC');

    expect(result).toBeNull();
  });

  it('retourne null si fiche sans parents', async () => {
    mockFindFiche.mockResolvedValueOnce({
      fileId: FAKE_FICHE_FILE_ID,
      ficheName: 'ISSA Capital',
      resolvedFilename: 'ISSA Capital.md',
      folderPath: '02. Projets/02. Pro',
    });
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockResolvedValueOnce(parentsSuccessResponse([]));

    const result = await resolveParentFolderForEntite('IC');

    expect(result).toBeNull();
  });

  it('cache TTL 1h : 2e appel ne refetch pas Drive', async () => {
    mockFindFiche.mockResolvedValueOnce({
      fileId: FAKE_FICHE_FILE_ID,
      ficheName: 'ISSA Capital',
      resolvedFilename: 'ISSA Capital.md',
      folderPath: '02. Projets/02. Pro',
    });
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockResolvedValueOnce(parentsSuccessResponse());

    const r1 = await resolveParentFolderForEntite('IC');
    const r2 = await resolveParentFolderForEntite('IC');

    expect(r1).toBe(FAKE_PARENT_ID);
    expect(r2).toBe(FAKE_PARENT_ID);
    // Un seul appel à findProjetFicheByEntite (2e hit sur cache)
    expect(mockFindFiche).toHaveBeenCalledTimes(1);
    // 2 fetch au total (token + parents) sur le premier appel uniquement
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('normalise le code entité (lowercase → uppercase, trim)', async () => {
    mockFindFiche.mockResolvedValueOnce({
      fileId: FAKE_FICHE_FILE_ID,
      ficheName: 'ISSA Capital',
      resolvedFilename: 'ISSA Capital.md',
      folderPath: '02. Projets/02. Pro',
    });
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockResolvedValueOnce(parentsSuccessResponse());

    const result = await resolveParentFolderForEntite('  ic  ');

    expect(result).toBe(FAKE_PARENT_ID);
    expect(mockFindFiche).toHaveBeenCalledWith('IC');
  });
});

// ============================================================
// Tests uploadToDrive — branchement résolution dynamique
// ============================================================

describe('uploadToDrive — branchement vault > fallback', () => {
  /**
   * Dispatch fetch par URL pour le flux complet vault (S23) :
   *   token → token(resolve) → GET parents → search Documents → search CR → POST upload.
   * Search folder : `Documents` trouvé (FAKE_DOCS_ID), `Comptes Rendus` trouvé (FAKE_CR_ID).
   */
  function installVaultDispatch(uploadId: string) {
    mockFetch.mockImplementation((url: string) => {
      const u = String(url);
      // Token endpoint
      if (u.includes('oauth2.googleapis.com/token')) {
        return Promise.resolve(tokenSuccessResponse());
      }
      // GET parents de la fiche (resolveParentFolderForEntite)
      if (u.includes('?fields=parents')) {
        return Promise.resolve(parentsSuccessResponse());
      }
      // POST upload multipart
      if (u.includes('uploadType=multipart')) {
        return Promise.resolve(uploadSuccessResponse(uploadId));
      }
      // files.list (search folder) — distingue Documents vs Comptes Rendus via le `q`
      if (u.includes('/drive/v3/files?q=')) {
        if (u.includes('Comptes')) return Promise.resolve(folderFoundResponse(FAKE_CR_ID, 'Comptes Rendus'));
        if (u.includes('Documents')) return Promise.resolve(folderFoundResponse(FAKE_DOCS_ID, 'Documents'));
        return Promise.resolve(folderNotFoundResponse());
      }
      // files.create (fallback si search non matché)
      if (u.includes('/drive/v3/files?supportsAllDrives')) {
        return Promise.resolve(folderCreatedResponse('created-folder'));
      }
      return Promise.resolve(driveErrorResponse(500, `URL non mockée : ${u}`));
    });
  }

  it('vault OK → upload dans Documents/Comptes Rendus (pas la racine projet, pas le legacy)', async () => {
    mockFindFiche.mockResolvedValueOnce({
      fileId: FAKE_FICHE_FILE_ID,
      ficheName: 'ISSA Capital',
      resolvedFilename: 'ISSA Capital.md',
      folderPath: '02. Projets/02. Pro',
    });
    installVaultDispatch('pdf-uploaded-vault');

    const result = await uploadToDrive(
      Buffer.from('fake-pdf'),
      'CR-2026-001.pdf',
      'IC',
      'Réunion stratégie',
    );

    expect(result.success).toBe(true);
    expect(result.fileId).toBe('pdf-uploaded-vault');

    // Le PDF doit cibler le folderId de "Comptes Rendus", PAS la racine projet ni le legacy.
    const uploadCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes('uploadType=multipart'),
    );
    expect(uploadCall).toBeDefined();
    const body = (uploadCall![1].body as Buffer).toString('utf-8');
    expect(body).toContain(FAKE_CR_ID);
    expect(body).not.toContain(FAKE_PARENT_ID);
    expect(body).not.toContain(_driveUploadInternals.LEGACY_DRIVE_FOLDERS.IC);

    // On a bien navigué Documents puis Comptes Rendus (2 search folder distincts).
    const searchCalls = mockFetch.mock.calls.filter(([url]) =>
      String(url).includes('/drive/v3/files?q='),
    );
    expect(searchCalls.some(([u]) => String(u).includes('Documents'))).toBe(true);
    expect(searchCalls.some(([u]) => String(u).includes('Comptes'))).toBe(true);
  });

  it('vault OK mais env-map NON consultée : le PDF n atterrit pas dans l inbox Documents', async () => {
    // Piège env-map : si le code appelait getOrCreateSubfolder('Documents'),
    // il renverrait DRIVE_INBOX_DOCUMENTS_FOLDER_ID. On vérifie que ce n'est PAS le cas.
    process.env.DRIVE_INBOX_DOCUMENTS_FOLDER_ID = 'INBOX-DOCS-DO-NOT-USE';
    mockFindFiche.mockResolvedValueOnce({
      fileId: FAKE_FICHE_FILE_ID,
      ficheName: 'ISSA Capital',
      resolvedFilename: 'ISSA Capital.md',
      folderPath: '02. Projets/02. Pro',
    });
    installVaultDispatch('pdf-no-inbox');

    const result = await uploadToDrive(Buffer.from('fake-pdf'), 'CR.pdf', 'IC', 'CR');

    expect(result.success).toBe(true);
    const uploadCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes('uploadType=multipart'),
    );
    const body = (uploadCall![1].body as Buffer).toString('utf-8');
    expect(body).toContain(FAKE_CR_ID);
    expect(body).not.toContain('INBOX-DOCS-DO-NOT-USE');

    delete process.env.DRIVE_INBOX_DOCUMENTS_FOLDER_ID;
  });

  it('vault KO (null) → fallback LEGACY_DRIVE_FOLDERS[entiteCode]', async () => {
    mockFindFiche.mockResolvedValueOnce(null);
    mockFetch
      // 1er getAccessToken (uploadToDrive)
      .mockResolvedValueOnce(tokenSuccessResponse())
      // POST upload (pas de resolve Drive car vault déjà null)
      .mockResolvedValueOnce(uploadSuccessResponse('pdf-uploaded-legacy'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await uploadToDrive(
      Buffer.from('fake-pdf'),
      'CR-2026-002.pdf',
      'IC',
      'Réunion fallback',
    );

    expect(result.success).toBe(true);

    const uploadCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes('uploadType=multipart'),
    );
    expect(uploadCall).toBeDefined();
    const body = uploadCall![1].body as Buffer;
    expect(body.toString('utf-8')).toContain(
      _driveUploadInternals.LEGACY_DRIVE_FOLDERS.IC,
    );

    // S23 : warning explicite « HORS vault » pour diagnostiquer les fallback legacy.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('HORS vault'),
    );

    warnSpy.mockRestore();
  });

  it('LEGACY_DRIVE_FOLDERS encore présent comme filet S20→S21', () => {
    expect(_driveUploadInternals.LEGACY_DRIVE_FOLDERS.IC).toMatch(/^[\w-]+$/);
    expect(_driveUploadInternals.LEGACY_DRIVE_FOLDERS.GO).toBeDefined();
    expect(_driveUploadInternals.LEGACY_DRIVE_FOLDERS.VI).toBeDefined();
    expect(_driveUploadInternals.LEGACY_DRIVE_FOLDERS.VV).toBeDefined();
    expect(_driveUploadInternals.DEFAULT_FOLDER_ID).toBe(
      _driveUploadInternals.LEGACY_DRIVE_FOLDERS.IC,
    );
  });
});
