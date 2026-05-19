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

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  _driveUploadInternals.clearParentFolderCache();
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
  it('vault OK → upload vers parent vault (pas le legacy)', async () => {
    mockFindFiche.mockResolvedValueOnce({
      fileId: FAKE_FICHE_FILE_ID,
      ficheName: 'ISSA Capital',
      resolvedFilename: 'ISSA Capital.md',
    });
    mockFetch
      // 1er getAccessToken (uploadToDrive)
      .mockResolvedValueOnce(tokenSuccessResponse())
      // 2e getAccessToken (resolveParentFolderForEntite)
      .mockResolvedValueOnce(tokenSuccessResponse())
      // GET parents
      .mockResolvedValueOnce(parentsSuccessResponse())
      // POST upload
      .mockResolvedValueOnce(uploadSuccessResponse('pdf-uploaded-vault'));

    const result = await uploadToDrive(
      Buffer.from('fake-pdf'),
      'CR-2026-001.pdf',
      'IC',
      'Réunion stratégie',
    );

    expect(result.success).toBe(true);
    expect(result.fileId).toBe('pdf-uploaded-vault');

    // Vérifie que le upload utilise bien FAKE_PARENT_ID dans metadata
    const uploadCall = mockFetch.mock.calls.find(([url]) =>
      String(url).includes('uploadType=multipart'),
    );
    expect(uploadCall).toBeDefined();
    const body = uploadCall![1].body as Buffer;
    expect(body.toString('utf-8')).toContain(FAKE_PARENT_ID);
    expect(body.toString('utf-8')).not.toContain(
      _driveUploadInternals.LEGACY_DRIVE_FOLDERS.IC,
    );
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

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('fallback hardcoded'),
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
