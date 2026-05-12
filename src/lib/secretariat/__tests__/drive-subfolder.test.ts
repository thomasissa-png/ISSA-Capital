/**
 * Tests unitaires — getOrCreateSubfolder (drive-upload.ts).
 *
 * Vérifie les 3 chemins de résolution :
 *   1. Env var pré-configurée → retour direct sans fetch
 *   2. Env var absente + search retourne un résultat → utilise l'ID trouvé
 *   3. Env var absente + search retourne vide → crée le sous-dossier
 *   4. Search échoue (HTTP non-ok) → fallback création
 *
 * Fix session 11 — dossiers Inbox dupliqués sur cold start serverless.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mock fetch global
// ============================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ============================================================
// Import après mock
// ============================================================

import { getOrCreateSubfolder } from '../drive-upload';

// ============================================================
// Helpers
// ============================================================

const FAKE_TOKEN = 'ya29.fake-access-token';
const PARENT_FOLDER_ID = '1Q8FJkcU9X06QsBDGPsHXV8y64QBpv0Fp';
const EXISTING_FOLDER_ID = 'existing-photos-folder-id';
const CREATED_FOLDER_ID = 'newly-created-folder-id';

/** Réponse search qui retourne un dossier existant */
function searchFoundResponse() {
  return new Response(
    JSON.stringify({ files: [{ id: EXISTING_FOLDER_ID, name: 'Photos' }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/** Réponse search qui ne trouve rien */
function searchEmptyResponse() {
  return new Response(
    JSON.stringify({ files: [] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

/** Réponse search en erreur */
function searchErrorResponse() {
  return new Response('Insufficient Permission', { status: 403 });
}

/** Réponse création réussie */
function createSuccessResponse() {
  return new Response(
    JSON.stringify({ id: CREATED_FOLDER_ID }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

// ============================================================
// Nettoyage cache globalThis entre chaque test
// ============================================================

const INBOX_CACHE_KEY = '__issa_inbox_folder_cache__';

beforeEach(() => {
  vi.clearAllMocks();
  // Nettoyer le cache globalThis
  delete (globalThis as Record<string, unknown>)[INBOX_CACHE_KEY];
  // Nettoyer les env vars de sous-dossier
  delete process.env.DRIVE_INBOX_PHOTOS_FOLDER_ID;
  delete process.env.DRIVE_INBOX_NOTES_FOLDER_ID;
  delete process.env.DRIVE_INBOX_VOICE_FOLDER_ID;
  delete process.env.DRIVE_INBOX_DOCUMENTS_FOLDER_ID;
});

afterEach(() => {
  delete process.env.DRIVE_INBOX_PHOTOS_FOLDER_ID;
  delete process.env.DRIVE_INBOX_NOTES_FOLDER_ID;
  delete process.env.DRIVE_INBOX_VOICE_FOLDER_ID;
  delete process.env.DRIVE_INBOX_DOCUMENTS_FOLDER_ID;
});

// ============================================================
// Tests
// ============================================================

describe('getOrCreateSubfolder', () => {
  describe('chemin 1 : env var pré-configurée', () => {
    it('retourne l\'ID depuis DRIVE_INBOX_PHOTOS_FOLDER_ID sans aucun appel fetch', async () => {
      process.env.DRIVE_INBOX_PHOTOS_FOLDER_ID = 'env-photos-id';

      const result = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Photos');

      expect(result).toBe('env-photos-id');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retourne l\'ID depuis DRIVE_INBOX_NOTES_FOLDER_ID pour le sous-dossier Notes', async () => {
      process.env.DRIVE_INBOX_NOTES_FOLDER_ID = 'env-notes-id';

      const result = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Notes');

      expect(result).toBe('env-notes-id');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retourne l\'ID depuis DRIVE_INBOX_VOICE_FOLDER_ID pour le sous-dossier Voice', async () => {
      process.env.DRIVE_INBOX_VOICE_FOLDER_ID = 'env-voice-id';

      const result = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Voice');

      expect(result).toBe('env-voice-id');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retourne l\'ID depuis DRIVE_INBOX_DOCUMENTS_FOLDER_ID pour le sous-dossier Documents', async () => {
      process.env.DRIVE_INBOX_DOCUMENTS_FOLDER_ID = 'env-docs-id';

      const result = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Documents');

      expect(result).toBe('env-docs-id');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('ignore l\'env var si elle est vide (string vide)', async () => {
      process.env.DRIVE_INBOX_PHOTOS_FOLDER_ID = '';
      mockFetch.mockResolvedValueOnce(searchFoundResponse());

      const result = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Photos');

      expect(result).toBe(EXISTING_FOLDER_ID);
      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });

  describe('chemin 2 : search retourne un dossier existant', () => {
    it('utilise l\'ID retourné par files.list et le met en cache', async () => {
      mockFetch.mockResolvedValueOnce(searchFoundResponse());

      const result = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Photos');

      expect(result).toBe(EXISTING_FOLDER_ID);
      expect(mockFetch).toHaveBeenCalledOnce();

      // Vérifier que l'URL contient supportsAllDrives
      const fetchUrl = mockFetch.mock.calls[0]![0] as string;
      expect(fetchUrl).toContain('supportsAllDrives=true');
      expect(fetchUrl).toContain('includeItemsFromAllDrives=true');
    });

    it('retourne depuis le cache globalThis au 2e appel (sans re-fetch)', async () => {
      mockFetch.mockResolvedValueOnce(searchFoundResponse());

      // Premier appel : fetch search
      const result1 = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Photos');
      expect(result1).toBe(EXISTING_FOLDER_ID);
      expect(mockFetch).toHaveBeenCalledOnce();

      // Deuxième appel : depuis cache
      const result2 = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Photos');
      expect(result2).toBe(EXISTING_FOLDER_ID);
      // Pas d'appel fetch supplémentaire
      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });

  describe('chemin 3 : search retourne vide, création du sous-dossier', () => {
    it('crée le sous-dossier et retourne le nouvel ID', async () => {
      mockFetch
        .mockResolvedValueOnce(searchEmptyResponse())
        .mockResolvedValueOnce(createSuccessResponse());

      const result = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Photos');

      expect(result).toBe(CREATED_FOLDER_ID);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Vérifier que le create utilise supportsAllDrives
      const createUrl = mockFetch.mock.calls[1]![0] as string;
      expect(createUrl).toContain('supportsAllDrives=true');

      // Vérifier les metadata de création
      const createOptions = mockFetch.mock.calls[1]![1] as RequestInit;
      const createBody = JSON.parse(createOptions.body as string) as Record<string, unknown>;
      expect(createBody.name).toBe('Photos');
      expect(createBody.mimeType).toBe('application/vnd.google-apps.folder');
      expect(createBody.parents).toEqual([PARENT_FOLDER_ID]);
    });
  });

  describe('chemin 4 : search echoue (HTTP non-ok)', () => {
    it('loggue l\'erreur et tente la création en fallback', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockFetch
        .mockResolvedValueOnce(searchErrorResponse())
        .mockResolvedValueOnce(createSuccessResponse());

      const result = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Photos');

      expect(result).toBe(CREATED_FOLDER_ID);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Vérifier que l'erreur est logguée
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('search sous-dossier Photos ECHOUEE'),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('sous-dossier non mappé dans SUBFOLDER_ENV_MAP', () => {
    it('fallback sur search/create pour un nom de sous-dossier inconnu', async () => {
      mockFetch.mockResolvedValueOnce(searchEmptyResponse());
      mockFetch.mockResolvedValueOnce(createSuccessResponse());

      const result = await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, 'Archives');

      expect(result).toBe(CREATED_FOLDER_ID);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('escape des quotes dans le nom', () => {
    it('echappe les apostrophes dans le nom du sous-dossier pour la query', async () => {
      mockFetch.mockResolvedValueOnce(searchEmptyResponse());
      mockFetch.mockResolvedValueOnce(createSuccessResponse());

      await getOrCreateSubfolder(FAKE_TOKEN, PARENT_FOLDER_ID, "Thomas's Files");

      const searchUrl = decodeURIComponent(mockFetch.mock.calls[0]![0] as string);
      expect(searchUrl).toContain("Thomas\\'s Files");
    });
  });
});
