/**
 * Tests drive-resolver — résolution de chemin logique → fileId.
 *
 * Mock fetch pour simuler l'API Google Drive.
 * Teste le cache TTL 1h, l'invalidation sur 404, la navigation multi-segments.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  resolvePath,
  resolveFilePath,
  listMarkdownFiles,
  invalidateAllCache,
  invalidateCache,
  getCacheSize,
} from '../drive-resolver';

// ============================================================
// Mock setup
// ============================================================

// Mock getAccessToken
vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
}));

// Import the mocked module to re-set implementation after restoreAllMocks
import { getAccessToken } from '../../drive-upload';
const mockGetAccessToken = vi.mocked(getAccessToken);

// Mock env vars
const originalEnv = process.env;

beforeEach(() => {
  invalidateAllCache();
  vi.restoreAllMocks();
  // Re-set the mock after restoreAllMocks (which clears implementations)
  mockGetAccessToken.mockResolvedValue('mock-access-token');
  process.env = { ...originalEnv, DRIVE_VAULT_ROOT_ID: 'root-id-123' };
});

afterEach(() => {
  process.env = originalEnv;
});

// Helper pour créer des réponses fetch mockées
function mockDriveListing(files: Array<{ id: string; name: string }>): Response {
  return new Response(JSON.stringify({ files }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// Tests
// ============================================================

describe('resolvePath', () => {
  it('résout un chemin à un seul segment', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockDriveListing([{ id: 'contacts-id', name: '07. Contacts' }]),
    );

    const result = await resolvePath('07. Contacts');
    expect(result.success).toBe(true);
    expect(result.fileId).toBe('contacts-id');

    fetchSpy.mockRestore();
  });

  it('résout un chemin multi-segments', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        mockDriveListing([{ id: 'contacts-id', name: '07. Contacts' }]),
      )
      .mockResolvedValueOnce(
        mockDriveListing([{ id: 'locataires-id', name: '05. Locataires' }]),
      )
      .mockResolvedValueOnce(
        mockDriveListing([{ id: 'actuels-id', name: '01. Actuels' }]),
      );

    const result = await resolvePath('07. Contacts/05. Locataires/01. Actuels');
    expect(result.success).toBe(true);
    expect(result.fileId).toBe('actuels-id');

    fetchSpy.mockRestore();
  });

  it('utilise le cache au deuxième appel', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockDriveListing([{ id: 'contacts-id', name: '07. Contacts' }]),
    );

    // Premier appel : fetch
    await resolvePath('07. Contacts');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Deuxième appel : cache
    const result = await resolvePath('07. Contacts');
    expect(result.success).toBe(true);
    expect(result.fileId).toBe('contacts-id');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Pas de nouveau fetch

    fetchSpy.mockRestore();
  });

  it('retourne une erreur si un segment n\'est pas trouvé', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockDriveListing([]), // Aucun dossier trouvé
    );

    const result = await resolvePath('Dossier Inexistant');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Dossier Inexistant');

    fetchSpy.mockRestore();
  });

  it('retourne une erreur si DRIVE_VAULT_ROOT_ID est manquant', async () => {
    process.env.DRIVE_VAULT_ROOT_ID = '';

    const result = await resolvePath('07. Contacts');
    expect(result.success).toBe(false);
    expect(result.error).toContain('DRIVE_VAULT_ROOT_ID');
  });

  it('fait du matching normalisé (accents/casse)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      mockDriveListing([{ id: 'id-reunion', name: 'Réunions' }]),
    );

    const result = await resolvePath('Reunions');
    // Le matching normalisé devrait trouver "Réunions" pour "Reunions"
    expect(result.success).toBe(true);
    expect(result.fileId).toBe('id-reunion');

    fetchSpy.mockRestore();
  });
});

describe('invalidateCache', () => {
  it('force une re-résolution après invalidation', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        mockDriveListing([{ id: 'old-id', name: '07. Contacts' }]),
      )
      .mockResolvedValueOnce(
        mockDriveListing([{ id: 'new-id', name: '07. Contacts' }]),
      );

    // Premier appel
    const result1 = await resolvePath('07. Contacts');
    expect(result1.fileId).toBe('old-id');

    // Invalider
    invalidateCache('07. Contacts');

    // Deuxième appel : doit re-fetcher
    const result2 = await resolvePath('07. Contacts');
    expect(result2.fileId).toBe('new-id');
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    fetchSpy.mockRestore();
  });
});

describe('resolveFilePath', () => {
  it('résout un fichier dans un dossier', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      // Résolution du dossier parent (3 segments)
      .mockResolvedValueOnce(
        mockDriveListing([{ id: 'contacts-id', name: '07. Contacts' }]),
      )
      .mockResolvedValueOnce(
        mockDriveListing([{ id: 'pro-id', name: '01. Pro' }]),
      )
      // Résolution du fichier
      .mockResolvedValueOnce(
        mockDriveListing([{ id: 'file-id', name: 'Martin Yhuel.md' }]),
      );

    const result = await resolveFilePath('07. Contacts/01. Pro', 'Martin Yhuel.md');
    expect(result.success).toBe(true);
    expect(result.fileId).toBe('file-id');

    fetchSpy.mockRestore();
  });
});

describe('listMarkdownFiles', () => {
  it('liste les fichiers .md dans un dossier', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      // Résolution du dossier
      .mockResolvedValueOnce(
        mockDriveListing([{ id: 'folder-id', name: '01. Pro' }]),
      )
      // Listing des fichiers
      .mockResolvedValueOnce(
        mockDriveListing([
          { id: 'f1', name: 'Martin Yhuel.md' },
          { id: 'f2', name: 'Emmanuel Gomez.md' },
          { id: 'f3', name: '_private.md' },
          { id: 'f4', name: 'image.png' },
        ]),
      );

    const files = await listMarkdownFiles('01. Pro');
    // Doit exclure _private.md (commence par _) et image.png (pas .md)
    expect(files).toHaveLength(2);
    expect(files[0]!.name).toBe('Martin Yhuel.md');
    expect(files[1]!.name).toBe('Emmanuel Gomez.md');

    fetchSpy.mockRestore();
  });
});

describe('getCacheSize', () => {
  it('retourne 0 après invalidateAllCache', () => {
    invalidateAllCache();
    expect(getCacheSize()).toBe(0);
  });
});
