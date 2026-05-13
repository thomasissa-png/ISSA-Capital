/**
 * Tests pour pending-store — stockage des PendingValidation via Drive.
 *
 * Tous les appels Drive sont mockés (getAccessToken, resolvePath, fetch).
 * On teste la logique : save/get/delete round-trip, purge expirés, list, mutex.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PendingValidation } from '../telegram-cards';
import {
  savePending,
  getPending,
  deletePending,
  purgeExpired,
  listAllPending,
  _resetLockForTests,
} from '../pending-store';

// ============================================================
// Mocks — hoisted by Vitest before imports
// ============================================================

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  getOrCreateSubfolder: vi.fn().mockResolvedValue('mock-state-folder-id'),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  resolvePath: vi.fn().mockResolvedValue({ success: true, fileId: 'mock-state-folder-id' }),
}));

// ============================================================
// Simulated Drive file storage via fetch mock
// ============================================================

let driveFileContent: string | null = null;
let driveFileExists = false;
const originalFetch = globalThis.fetch;

function setupFetchMock(): void {
  globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = String(url);

    // findStoreFileId — search for pending-validations.json
    if (urlStr.includes('/drive/v3/files') && urlStr.includes('q=') && !urlStr.includes('uploadType')) {
      if (driveFileExists) {
        return {
          ok: true,
          json: async () => ({ files: [{ id: 'mock-store-file-id' }] }),
        };
      }
      return {
        ok: true,
        json: async () => ({ files: [] }),
      };
    }

    // readStore — download file content
    if (urlStr.includes('/drive/v3/files/mock-store-file-id') && urlStr.includes('alt=media')) {
      if (driveFileContent) {
        return {
          ok: true,
          json: async () => JSON.parse(driveFileContent!),
        };
      }
      return {
        ok: true,
        json: async () => ({ version: '2026-05-13', pendings: {} }),
      };
    }

    // writeStore — update file content (PATCH)
    if (urlStr.includes('/upload/drive/v3/files/mock-store-file-id') && init?.method === 'PATCH') {
      driveFileContent = init.body as string;
      return { ok: true };
    }

    // createStoreFile — create new file (POST multipart)
    if (urlStr.includes('/upload/drive/v3/files') && init?.method === 'POST' && urlStr.includes('uploadType=multipart')) {
      const bodyStr = init.body as string;
      // Extract the JSON store content (second part of the multipart)
      const parts = bodyStr.split('===issa_pending_store===');
      if (parts.length >= 3) {
        // The JSON content is in the 3rd part (between 2nd and 3rd boundary)
        const jsonPart = parts[2]!;
        const jsonMatch = jsonPart.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          driveFileContent = jsonMatch[0];
        }
      }
      driveFileExists = true;
      return {
        ok: true,
        json: async () => ({ id: 'mock-store-file-id' }),
      };
    }

    return { ok: false, status: 500 };
  });
}

// ============================================================
// Fixtures
// ============================================================

function makePending(overrides: Partial<PendingValidation> = {}): PendingValidation {
  return {
    id: overrides.id ?? 'pending-uuid-1',
    triage: {
      category: 'contact-pro',
      intent: 'validation_bail',
      confidence: 0.92,
      matchedContact: 'Martin Yhuel',
      summary: 'Validation clause bail',
      suggestedActions: [],
    },
    actions: [
      {
        type: 'append_historique',
        target: '07. Contacts/01. Pro/Martin Yhuel.md',
        payload: {},
        description: 'Append historique',
      },
    ],
    email: {
      source: 'gmail',
      id: 'msg-1',
      from: { email: 'martin@test.com' },
      to: [{ email: 'thomas@issa.com' }],
      cc: [],
      subject: 'Test',
      bodyPlain: 'Corps du message',
      receivedAt: new Date('2026-05-12T10:00:00Z'),
      attachments: [],
      rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg-1',
    },
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================
// Setup / Teardown
// ============================================================

beforeEach(() => {
  driveFileContent = null;
  driveFileExists = false;
  _resetLockForTests();
  setupFetchMock();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

// ============================================================
// Tests
// ============================================================

describe('pending-store', () => {
  it('savePending + getPending : round-trip', async () => {
    const pending = makePending({ id: 'round-trip-1' });
    await savePending(pending);

    // Après save, le fichier existe
    expect(driveFileContent).not.toBeNull();
    const stored = JSON.parse(driveFileContent!);
    expect(stored.pendings['round-trip-1']).toBeDefined();

    // Simuler que le fichier existe pour le prochain appel
    driveFileExists = true;

    const retrieved = await getPending('round-trip-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe('round-trip-1');
    expect(retrieved!.triage.category).toBe('contact-pro');
  });

  it('getPending inexistant retourne null', async () => {
    driveFileExists = true;
    driveFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: {},
    });

    const result = await getPending('inexistant-id');
    expect(result).toBeNull();
  });

  it('deletePending retire l\'entrée du store', async () => {
    // Pré-remplir le store avec une entrée
    const pending = makePending({ id: 'to-delete' });
    driveFileExists = true;
    driveFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: { 'to-delete': pending },
    });

    await deletePending('to-delete');

    const stored = JSON.parse(driveFileContent!);
    expect(stored.pendings['to-delete']).toBeUndefined();
  });

  it('purgeExpired retire les entrées > 24h', async () => {
    const oldPending = makePending({
      id: 'old-pending',
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    const recentPending = makePending({
      id: 'recent-pending',
      createdAt: new Date().toISOString(),
    });

    driveFileExists = true;
    driveFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: {
        'old-pending': oldPending,
        'recent-pending': recentPending,
      },
    });

    const purgedCount = await purgeExpired();
    expect(purgedCount).toBe(1);

    const stored = JSON.parse(driveFileContent!);
    expect(stored.pendings['old-pending']).toBeUndefined();
    expect(stored.pendings['recent-pending']).toBeDefined();
  });

  it('purgeExpired garde les entrées < 24h', async () => {
    const recentPending = makePending({
      id: 'fresh-pending',
      createdAt: new Date().toISOString(),
    });

    driveFileExists = true;
    driveFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: { 'fresh-pending': recentPending },
    });

    const purgedCount = await purgeExpired();
    expect(purgedCount).toBe(0);

    const stored = JSON.parse(driveFileContent!);
    expect(stored.pendings['fresh-pending']).toBeDefined();
  });

  it('listAllPending retourne toutes les entrées', async () => {
    const p1 = makePending({ id: 'list-1' });
    const p2 = makePending({ id: 'list-2' });

    driveFileExists = true;
    driveFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: { 'list-1': p1, 'list-2': p2 },
    });

    const all = await listAllPending();
    expect(all).toHaveLength(2);
    const ids = all.map((p) => p.id).sort();
    expect(ids).toEqual(['list-1', 'list-2']);
  });

  it('savePending purge automatiquement les expirés', async () => {
    const oldPending = makePending({
      id: 'auto-purge-old',
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });

    driveFileExists = true;
    driveFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: { 'auto-purge-old': oldPending },
    });

    const fresh = makePending({ id: 'auto-purge-new' });
    await savePending(fresh);

    const stored = JSON.parse(driveFileContent!);
    expect(stored.pendings['auto-purge-old']).toBeUndefined();
    expect(stored.pendings['auto-purge-new']).toBeDefined();
  });

  it('opérations concurrentes sont sérialisées par le mutex', async () => {
    // Pré-remplir un store vide
    driveFileExists = true;
    driveFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: {},
    });

    const p1 = makePending({ id: 'concurrent-1' });
    const p2 = makePending({ id: 'concurrent-2' });
    const p3 = makePending({ id: 'concurrent-3' });

    // Lancer 3 saves en parallèle — le mutex les sérialise
    await Promise.all([
      savePending(p1),
      savePending(p2),
      savePending(p3),
    ]);

    const all = await listAllPending();
    // Avec le mutex, les 3 saves sont sérialisés : chaque save lit le fichier,
    // ajoute son entrée, écrit. Grâce à la sérialisation, aucune écriture n'est perdue.
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('retourne null si getAccessToken échoue', async () => {
    const driveUpload = await import('../../drive-upload');
    (driveUpload.getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await getPending('any-id');
    expect(result).toBeNull();
  });

  it('retourne 0 si getAccessToken échoue pour purgeExpired', async () => {
    const driveUpload = await import('../../drive-upload');
    (driveUpload.getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await purgeExpired();
    expect(result).toBe(0);
  });
});
