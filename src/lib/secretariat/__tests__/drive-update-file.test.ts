/**
 * Tests unitaires — updateFileContent (drive-upload.ts).
 *
 * Couvre la fonction PATCH in-place (R5 P0 #99) :
 *   - Succès PATCH text/markdown
 *   - Échec validation fileId vide / invalide
 *   - Échec validation mimeType vide
 *   - Échec validation content null
 *   - Échec credentials OAuth2 manquants
 *   - Échec HTTP côté Drive (4xx/5xx)
 *   - Préservation du fileId dans la réponse
 *
 * Jalon S16 Q3 — write-back CR vers fiche Projet vault.
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

import { updateFileContent, invalidateAccessToken } from '../drive-upload';

// ============================================================
// Helpers
// ============================================================

const FAKE_FILE_ID = '1l8oTuQDUePowMPCks-vDIdwLeBru-IRZ';
const FAKE_ACCESS_TOKEN = 'ya29.fake-token';
const FAKE_WEB_VIEW = 'https://drive.google.com/file/d/1l8oTuQDUePowMPCks-vDIdwLeBru-IRZ/view';

function tokenSuccessResponse() {
  return new Response(
    JSON.stringify({ access_token: FAKE_ACCESS_TOKEN, expires_in: 3600 }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function patchSuccessResponse() {
  return new Response(
    JSON.stringify({ id: FAKE_FILE_ID, webViewLink: FAKE_WEB_VIEW }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function patchErrorResponse(status: number, message = 'Bad Request') {
  return new Response(message, { status });
}

// ============================================================
// Setup
// ============================================================

describe('updateFileContent — PATCH in-place (R5 P0 #99)', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    invalidateAccessToken(); // cache token (S24) : repartir propre à chaque test
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
  // Validation inputs
  // ============================================================

  it('rejette un fileId vide', async () => {
    const result = await updateFileContent('', 'content', 'text/markdown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fileId/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejette un fileId blanc', async () => {
    const result = await updateFileContent('   ', 'content', 'text/markdown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/fileId/i);
  });

  it('rejette un mimeType vide', async () => {
    const result = await updateFileContent(FAKE_FILE_ID, 'content', '');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/mimeType/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejette un content null', async () => {
    // @ts-expect-error — test runtime guard
    const result = await updateFileContent(FAKE_FILE_ID, null, 'text/markdown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/content/i);
  });

  // ============================================================
  // Credentials
  // ============================================================

  it('échoue si les credentials OAuth2 sont manquants', async () => {
    delete process.env.GOOGLE_REFRESH_TOKEN;
    const result = await updateFileContent(FAKE_FILE_ID, 'content', 'text/markdown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/credentials OAuth2 manquants/i);
  });

  // ============================================================
  // Succès PATCH
  // ============================================================

  it('PATCH avec succès un contenu markdown et préserve le fileId', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockResolvedValueOnce(patchSuccessResponse());

    const content = '# Fiche Projet\n\n## Comptes Rendus\n\n- [2026-05-18] CR test';
    const result = await updateFileContent(FAKE_FILE_ID, content, 'text/markdown');

    expect(result.success).toBe(true);
    expect(result.fileId).toBe(FAKE_FILE_ID);
    expect(result.webViewLink).toBe(FAKE_WEB_VIEW);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Vérifier que l'appel PATCH a la bonne URL + méthode + content-type
    const patchCall = mockFetch.mock.calls[1];
    expect(patchCall).toBeDefined();
    const [url, init] = patchCall as [string, RequestInit];
    expect(url).toContain(`/upload/drive/v3/files/${FAKE_FILE_ID}`);
    expect(url).toContain('uploadType=media');
    expect(url).toContain('supportsAllDrives=true');
    expect(init.method).toBe('PATCH');
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('text/markdown');
    expect(headers.Authorization).toBe(`Bearer ${FAKE_ACCESS_TOKEN}`);
  });

  it('accepte un Buffer comme content', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockResolvedValueOnce(patchSuccessResponse());

    const buf = Buffer.from('# Markdown via buffer\n', 'utf-8');
    const result = await updateFileContent(FAKE_FILE_ID, buf, 'text/markdown');

    expect(result.success).toBe(true);
    expect(result.fileId).toBe(FAKE_FILE_ID);
  });

  it('renvoie le fileId original si la réponse Drive ne le renvoie pas', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const result = await updateFileContent(FAKE_FILE_ID, 'x', 'text/markdown');
    expect(result.success).toBe(true);
    expect(result.fileId).toBe(FAKE_FILE_ID);
  });

  // ============================================================
  // Erreurs HTTP
  // ============================================================

  it('échoue proprement sur 404 (fileId invalide côté Drive)', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockResolvedValueOnce(patchErrorResponse(404, 'File not found'));

    const result = await updateFileContent('inexistant-file-id', 'x', 'text/markdown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/404/);
  });

  it('échoue proprement sur 403 (permissions)', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockResolvedValueOnce(patchErrorResponse(403, 'Insufficient Permission'));

    const result = await updateFileContent(FAKE_FILE_ID, 'x', 'text/markdown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/403/);
  });

  it('catch les exceptions réseau (fetch throw)', async () => {
    mockFetch
      .mockResolvedValueOnce(tokenSuccessResponse())
      .mockRejectedValueOnce(new Error('ECONNRESET'));

    const result = await updateFileContent(FAKE_FILE_ID, 'x', 'text/markdown');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ECONNRESET|Erreur Drive PATCH/);
  });
});
