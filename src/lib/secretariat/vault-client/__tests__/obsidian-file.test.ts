/**
 * Tests obsidian-file — lecture/écriture de fichiers .md via Drive.
 *
 * Mock fetch pour simuler l'API Google Drive.
 * Teste la lecture, l'écriture, la création, et la préservation UTF-8.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileById, writeFileById } from '../obsidian-file';

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// Fixtures
// ============================================================

const FIXTURE_MD_CONTENT = `---
type: contact
société: PNM Avocats
rôle: Avocat Associé
date_dernière_interaction: 2026-05-06
---

# Martin Yhuel

## Qui c'est

Avocat de la famille Issa. Spécialisé en droit des sociétés.
`;

// ============================================================
// Tests : readFileById
// ============================================================

describe('readFileById', () => {
  it('lit le contenu d\'un fichier Drive', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(FIXTURE_MD_CONTENT, {
        status: 200,
        headers: { 'Content-Type': 'text/markdown' },
      }),
    );

    const result = await readFileById('mock-token', 'file-id-123');
    expect(result.success).toBe(true);
    expect(result.content).toBe(FIXTURE_MD_CONTENT);
    expect(result.fileId).toBe('file-id-123');

    fetchSpy.mockRestore();
  });

  it('préserve les caractères UTF-8 (accents français)', async () => {
    const contentWithAccents = `---
société: Société Générale
rôle: Président-Directeur Général
---

# René Élie Müller

Né à Strasbourg, spécialiste en gestion de patrimoine.
Créé le département « Héritage & Transmission ».
`;

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(contentWithAccents, {
        status: 200,
        headers: { 'Content-Type': 'text/markdown' },
      }),
    );

    const result = await readFileById('mock-token', 'file-id');
    expect(result.success).toBe(true);
    expect(result.content).toContain('Société Générale');
    expect(result.content).toContain('René Élie Müller');
    expect(result.content).toContain('« Héritage & Transmission »');

    fetchSpy.mockRestore();
  });

  it('retourne une erreur sur 404', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not found', { status: 404 }),
    );

    const result = await readFileById('mock-token', 'missing-id');
    expect(result.success).toBe(false);
    expect(result.error).toContain('404');

    fetchSpy.mockRestore();
  });

  it('retourne une erreur sur erreur réseau', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Network error'),
    );

    const result = await readFileById('mock-token', 'file-id');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');

    fetchSpy.mockRestore();
  });
});

// ============================================================
// Tests : writeFileById
// ============================================================

describe('writeFileById', () => {
  it('écrit le contenu d\'un fichier Drive', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{}', { status: 200 }),
    );

    const result = await writeFileById('mock-token', 'file-id-123', FIXTURE_MD_CONTENT);
    expect(result.success).toBe(true);

    // Vérifier que fetch a été appelé avec le bon body
    const call = fetchSpy.mock.calls[0]!;
    expect(call[1]!.method).toBe('PATCH');
    expect(call[1]!.body).toBe(FIXTURE_MD_CONTENT);
    expect(call[1]!.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'text/markdown; charset=utf-8',
      }),
    );

    fetchSpy.mockRestore();
  });

  it('retourne une erreur sur échec d\'écriture', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const result = await writeFileById('mock-token', 'file-id', 'content');
    expect(result.success).toBe(false);
    expect(result.error).toContain('403');

    fetchSpy.mockRestore();
  });

  it('gère les erreurs réseau', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Connection timeout'),
    );

    const result = await writeFileById('mock-token', 'file-id', 'content');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection timeout');

    fetchSpy.mockRestore();
  });
});
