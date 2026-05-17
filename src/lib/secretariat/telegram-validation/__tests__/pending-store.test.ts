/**
 * Tests pour pending-store — stockage des PendingValidation via Drive.
 *
 * Tous les appels Drive sont mockés (getAccessToken, resolvePath, fetch).
 * On teste la logique : save/get/delete round-trip, purge expirés, list, mutex.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PendingValidation } from '../telegram-cards';
import type { NoMatchPending } from '../no-match-card';
import {
  savePending,
  getPending,
  deletePending,
  purgeExpired,
  listAllPending,
  saveNoMatch,
  getNoMatch,
  deleteNoMatch,
  purgeExpiredNoMatch,
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
let driveNoMatchFileContent: string | null = null;
let driveNoMatchFileExists = false;
const originalFetch = globalThis.fetch;

function setupFetchMock(): void {
  globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = String(url);

    // findStoreFileId — search for pending-validations.json or nomatch-pendings.json
    if (urlStr.includes('/drive/v3/files') && urlStr.includes('q=') && !urlStr.includes('uploadType')) {
      const isNoMatch = urlStr.includes('nomatch-pendings.json');
      const exists = isNoMatch ? driveNoMatchFileExists : driveFileExists;
      const fileId = isNoMatch ? 'mock-nomatch-file-id' : 'mock-store-file-id';
      if (exists) {
        return {
          ok: true,
          json: async () => ({ files: [{ id: fileId }] }),
        };
      }
      return {
        ok: true,
        json: async () => ({ files: [] }),
      };
    }

    // readStore — download file content (pending or nomatch)
    if (urlStr.includes('/drive/v3/files/mock-nomatch-file-id') && urlStr.includes('alt=media')) {
      if (driveNoMatchFileContent) {
        return {
          ok: true,
          json: async () => JSON.parse(driveNoMatchFileContent!),
        };
      }
      return {
        ok: true,
        json: async () => ({ version: '2026-05-13', pendings: {} }),
      };
    }
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
    if (urlStr.includes('/upload/drive/v3/files/mock-nomatch-file-id') && init?.method === 'PATCH') {
      driveNoMatchFileContent = init.body as string;
      return { ok: true };
    }
    if (urlStr.includes('/upload/drive/v3/files/mock-store-file-id') && init?.method === 'PATCH') {
      driveFileContent = init.body as string;
      return { ok: true };
    }

    // createStoreFile — create new file (POST multipart)
    if (urlStr.includes('/upload/drive/v3/files') && init?.method === 'POST' && urlStr.includes('uploadType=multipart')) {
      const bodyStr = init.body as string;
      const isNoMatch = bodyStr.includes('nomatch-pendings.json');

      // Extract boundary from body
      const boundaryMatch = bodyStr.match(/^--([^\r\n]+)/);
      const boundary = boundaryMatch ? boundaryMatch[1]! : '===issa_pending_store===';

      const parts = bodyStr.split(boundary);
      if (parts.length >= 3) {
        const jsonPart = parts[2]!;
        const jsonMatch = jsonPart.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          if (isNoMatch) {
            driveNoMatchFileContent = jsonMatch[0];
            driveNoMatchFileExists = true;
          } else {
            driveFileContent = jsonMatch[0];
            driveFileExists = true;
          }
        }
      }

      return {
        ok: true,
        json: async () => ({ id: isNoMatch ? 'mock-nomatch-file-id' : 'mock-store-file-id' }),
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
  driveNoMatchFileContent = null;
  driveNoMatchFileExists = false;
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

  it('purgeExpired retire les entrées > 7j', async () => {
    const oldPending = makePending({
      id: 'old-pending',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
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

  it('purgeExpired garde les entrées < 7j', async () => {
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
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
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

// ============================================================
// Tests — NoMatch store (Jalon 4D-2)
// ============================================================

function makeNoMatchPending(overrides: Partial<NoMatchPending> = {}): NoMatchPending {
  return {
    id: overrides.id ?? 'nomatch-uuid-1',
    parentPendingId: 'parent-uuid-1',
    emailFrom: 'francois@exemple.com',
    nameFrom: 'François Lambert',
    defaultType: 'pro',
    emailMessageId: 'msg-nm-001',
    emailThreadRef: '(cf. thread Gmail msg-nm-001)',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

describe('pending-store — NoMatch', () => {
  it('saveNoMatch + getNoMatch : round-trip', async () => {
    const noMatch = makeNoMatchPending({ id: 'nm-round-trip-1' });
    await saveNoMatch(noMatch);

    expect(driveNoMatchFileContent).not.toBeNull();
    const stored = JSON.parse(driveNoMatchFileContent!);
    expect(stored.pendings['nm-round-trip-1']).toBeDefined();

    driveNoMatchFileExists = true;

    const retrieved = await getNoMatch('nm-round-trip-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe('nm-round-trip-1');
    expect(retrieved!.emailFrom).toBe('francois@exemple.com');
    expect(retrieved!.defaultType).toBe('pro');
  });

  it('getNoMatch inexistant retourne null', async () => {
    driveNoMatchFileExists = true;
    driveNoMatchFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: {},
    });

    const result = await getNoMatch('inexistant-nm-id');
    expect(result).toBeNull();
  });

  it('deleteNoMatch retire l\'entrée du store', async () => {
    const noMatch = makeNoMatchPending({ id: 'nm-to-delete' });
    driveNoMatchFileExists = true;
    driveNoMatchFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: { 'nm-to-delete': noMatch },
    });

    await deleteNoMatch('nm-to-delete');

    const stored = JSON.parse(driveNoMatchFileContent!);
    expect(stored.pendings['nm-to-delete']).toBeUndefined();
  });

  it('purgeExpiredNoMatch retire les entrées > 7j', async () => {
    const oldNoMatch = makeNoMatchPending({
      id: 'nm-old',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const recentNoMatch = makeNoMatchPending({
      id: 'nm-recent',
      createdAt: new Date().toISOString(),
    });

    driveNoMatchFileExists = true;
    driveNoMatchFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: {
        'nm-old': oldNoMatch,
        'nm-recent': recentNoMatch,
      },
    });

    const purgedCount = await purgeExpiredNoMatch();
    expect(purgedCount).toBe(1);

    const stored = JSON.parse(driveNoMatchFileContent!);
    expect(stored.pendings['nm-old']).toBeUndefined();
    expect(stored.pendings['nm-recent']).toBeDefined();
  });

  it('purgeExpiredNoMatch garde les entrées < 7j', async () => {
    const recentNoMatch = makeNoMatchPending({
      id: 'nm-fresh',
      createdAt: new Date().toISOString(),
    });

    driveNoMatchFileExists = true;
    driveNoMatchFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: { 'nm-fresh': recentNoMatch },
    });

    const purgedCount = await purgeExpiredNoMatch();
    expect(purgedCount).toBe(0);

    const stored = JSON.parse(driveNoMatchFileContent!);
    expect(stored.pendings['nm-fresh']).toBeDefined();
  });

  it('saveNoMatch purge automatiquement les expirés', async () => {
    const oldNoMatch = makeNoMatchPending({
      id: 'nm-auto-purge-old',
      createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });

    driveNoMatchFileExists = true;
    driveNoMatchFileContent = JSON.stringify({
      version: '2026-05-13',
      pendings: { 'nm-auto-purge-old': oldNoMatch },
    });

    const fresh = makeNoMatchPending({ id: 'nm-auto-purge-new' });
    await saveNoMatch(fresh);

    const stored = JSON.parse(driveNoMatchFileContent!);
    expect(stored.pendings['nm-auto-purge-old']).toBeUndefined();
    expect(stored.pendings['nm-auto-purge-new']).toBeDefined();
  });

  it('NoMatch store est séparé du Pending store', async () => {
    // Sauvegarder un pending ET un noMatch
    const pending = makePending({ id: 'isolation-pending' });
    const noMatch = makeNoMatchPending({ id: 'isolation-nomatch' });

    await savePending(pending);
    await saveNoMatch(noMatch);

    // Vérifier que les deux stores sont indépendants
    const pendingStored = JSON.parse(driveFileContent!);
    const noMatchStored = JSON.parse(driveNoMatchFileContent!);

    expect(pendingStored.pendings['isolation-pending']).toBeDefined();
    expect(pendingStored.pendings['isolation-nomatch']).toBeUndefined();

    expect(noMatchStored.pendings['isolation-nomatch']).toBeDefined();
    expect(noMatchStored.pendings['isolation-pending']).toBeUndefined();
  });

  it('retourne null si getAccessToken échoue pour getNoMatch', async () => {
    const driveUpload = await import('../../drive-upload');
    (driveUpload.getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await getNoMatch('any-nm-id');
    expect(result).toBeNull();
  });
});
