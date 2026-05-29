/**
 * Tests — cr-writeback-pending store JSONL sur Drive.
 *
 * Stratégie : mock complet de la couche Drive (drive-upload + drive-resolver
 * + global fetch). Un état en mémoire simule le contenu du fichier Drive
 * `_Inbox/AnyaState/cr-writeback-pending.jsonl` :
 *
 *   - resolvePath('_Inbox/AnyaState') → succès avec un folderId fictif
 *   - GET /drive/v3/files?q=... → liste files (selon fileSimulator.exists)
 *   - GET /drive/v3/files/{id}?alt=media → renvoie fileSimulator.content
 *   - PATCH /upload/drive/v3/files/{id}?uploadType=media → met à jour content
 *   - POST /upload/drive/v3/files?uploadType=multipart → crée file (donne id)
 *
 * Couvre :
 *   - appendPending → readPending (round-trip)
 *   - removePending
 *   - updatePendingAttempt
 *   - parsing JSONL résilient (ligne corrompue ignorée)
 *   - fichier absent → readPending() = []
 *   - token absent → opérations gracieuses (false / [])
 *
 * Jalon S25 (P0 #1 — reprise secretariat).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mocks couche Drive haut niveau
// ============================================================

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn(async () => 'fake-token'),
  getOrCreateSubfolder: vi.fn(async () => 'fake-folder-id'),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  resolvePath: vi.fn(async (path: string) => {
    if (path === '_Inbox/AnyaState') {
      return { success: true, fileId: 'fake-folder-id' };
    }
    if (path === '_Inbox') {
      return { success: true, fileId: 'fake-inbox-id' };
    }
    return { success: false };
  }),
}));

// ============================================================
// Imports après mocks
// ============================================================

import {
  appendPending,
  readPending,
  removePending,
  updatePendingAttempt,
  _resetPendingStoreLockForTests,
  _internals,
  PENDING_FILENAME,
} from '../cr-writeback-pending';
import { getAccessToken } from '../../drive-upload';

const mockGetAccessToken = vi.mocked(getAccessToken);

// ============================================================
// Simulateur Drive (état du fichier JSONL en mémoire)
// ============================================================

interface DriveFileSim {
  /** true si le fichier existe sur Drive. */
  exists: boolean;
  /** Contenu courant (string brute). */
  content: string;
  /** id assigné au fichier. */
  fileId: string;
}

let drive: DriveFileSim;

function resetDrive(): void {
  drive = { exists: false, content: '', fileId: 'pending-file-id' };
}

// ============================================================
// Mock global fetch
// ============================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(text: string, status = 200): Response {
  return new Response(text, { status });
}

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input.toString();
  const method = (init?.method ?? 'GET').toUpperCase();

  // GET liste files (q=name='...' and 'folder' in parents...)
  if (
    method === 'GET' &&
    url.startsWith('https://www.googleapis.com/drive/v3/files?') &&
    url.includes('q=')
  ) {
    if (drive.exists) {
      return Promise.resolve(jsonResponse({ files: [{ id: drive.fileId }] }));
    }
    return Promise.resolve(jsonResponse({ files: [] }));
  }

  // GET media du fichier
  if (
    method === 'GET' &&
    url.startsWith(`https://www.googleapis.com/drive/v3/files/${drive.fileId}`) &&
    url.includes('alt=media')
  ) {
    if (!drive.exists) {
      return Promise.resolve(textResponse('Not Found', 404));
    }
    return Promise.resolve(textResponse(drive.content));
  }

  // PATCH in-place (upload media)
  if (
    method === 'PATCH' &&
    url.startsWith(
      `https://www.googleapis.com/upload/drive/v3/files/${drive.fileId}`,
    ) &&
    url.includes('uploadType=media')
  ) {
    const body =
      typeof init?.body === 'string'
        ? init.body
        : init?.body
          ? String(init.body)
          : '';
    drive.content = body;
    return Promise.resolve(jsonResponse({ id: drive.fileId }));
  }

  // POST multipart create
  if (
    method === 'POST' &&
    url.startsWith('https://www.googleapis.com/upload/drive/v3/files') &&
    url.includes('uploadType=multipart')
  ) {
    const body =
      typeof init?.body === 'string'
        ? init.body
        : init?.body
          ? String(init.body)
          : '';
    // Extraire le payload JSONL après le 2e header Content-Type
    // (le multipart contient metadata JSON puis le contenu NDJSON).
    const ndjsonHeader = 'Content-Type: application/x-ndjson';
    const idx = body.indexOf(ndjsonHeader);
    if (idx >= 0) {
      // Sauter le header + \r\n\r\n
      const afterHeader = body.indexOf('\r\n\r\n', idx);
      if (afterHeader >= 0) {
        const tail = body.slice(afterHeader + 4);
        // Retirer la fin multipart : \r\n--boundary--
        const endMarker = tail.lastIndexOf('\r\n--');
        drive.content = endMarker >= 0 ? tail.slice(0, endMarker) : tail;
      }
    }
    drive.exists = true;
    return Promise.resolve(jsonResponse({ id: drive.fileId }));
  }

  return Promise.resolve(textResponse('unexpected url ' + url, 500));
}

// ============================================================
// Setup / teardown
// ============================================================

const originalFetch = globalThis.fetch;

beforeEach(() => {
  resetDrive();
  _resetPendingStoreLockForTests();
  globalThis.fetch = fakeFetch as unknown as typeof fetch;
  mockGetAccessToken.mockResolvedValue('fake-token');
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.clearAllMocks();
});

// ============================================================
// Constantes test
// ============================================================

const baseInput = {
  entiteCode: 'IC',
  crFileId: 'cr-pdf-123',
  crWebViewLink: 'https://drive.google.com/file/d/cr-pdf-123/view',
  crFilename: '2026-05-29-CR-IC-001.pdf',
  crDate: '2026-05-29',
  crTitle: 'Réunion préparation closing',
};

// ============================================================
// Tests
// ============================================================

describe('cr-writeback-pending — round-trip', () => {
  it('appendPending puis readPending renvoie l\'entrée avec id/createdAt/attempts=0', async () => {
    const ok = await appendPending(baseInput);
    expect(ok).toBe(true);

    const entries = await readPending();
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.entiteCode).toBe('IC');
    expect(entry.crFileId).toBe('cr-pdf-123');
    expect(entry.crWebViewLink).toBe(baseInput.crWebViewLink);
    expect(entry.crFilename).toBe(baseInput.crFilename);
    expect(entry.crDate).toBe('2026-05-29');
    expect(entry.crTitle).toBe('Réunion préparation closing');
    expect(typeof entry.id).toBe('string');
    expect(entry.id.length).toBeGreaterThan(0);
    expect(entry.attempts).toBe(0);
    expect(typeof entry.createdAt).toBe('string');
    expect(() => new Date(entry.createdAt)).not.toThrow();
  });

  it('plusieurs appendPending successifs accumulent les entrées', async () => {
    await appendPending(baseInput);
    await appendPending({ ...baseInput, entiteCode: 'GO', crFileId: 'cr-go-1' });
    await appendPending({ ...baseInput, entiteCode: 'VI', crFileId: 'cr-vi-1' });

    const entries2 = await readPending();
    expect(entries2).toHaveLength(3);
    expect(entries2.map((e) => e.entiteCode).sort()).toEqual(['GO', 'IC', 'VI']);
  });

  it('readPending sur fichier inexistant renvoie []', async () => {
    const entries = await readPending();
    expect(entries).toEqual([]);
  });
});

describe('cr-writeback-pending — removePending', () => {
  it('supprime l\'entrée par id et préserve les autres', async () => {
    await appendPending(baseInput);
    await appendPending({ ...baseInput, entiteCode: 'GO', crFileId: 'go-cr' });
    const before = await readPending();
    expect(before).toHaveLength(2);

    const target = before.find((e) => e.entiteCode === 'IC')!;
    const ok = await removePending(target.id);
    expect(ok).toBe(true);

    const after = await readPending();
    expect(after).toHaveLength(1);
    expect(after[0]!.entiteCode).toBe('GO');
  });

  it('renvoie true même si l\'id est inconnu (no-op)', async () => {
    await appendPending(baseInput);
    const ok = await removePending('id-inexistant-xyz');
    expect(ok).toBe(true);
    const entries = await readPending();
    expect(entries).toHaveLength(1);
  });

  it('renvoie true si le fichier n\'existe pas (rien à supprimer)', async () => {
    const ok = await removePending('quelconque');
    expect(ok).toBe(true);
  });
});

describe('cr-writeback-pending — updatePendingAttempt', () => {
  it('met à jour attempts et lastError de l\'entrée ciblée', async () => {
    await appendPending(baseInput);
    const list = await readPending();
    const entry = list[0]!;

    const ok = await updatePendingAttempt(entry.id, {
      attempts: 1,
      lastError: 'fiche introuvable',
    });
    expect(ok).toBe(true);

    const list2 = await readPending();
    const updated = list2[0]!;
    expect(updated.id).toBe(entry.id);
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toBe('fiche introuvable');
    // Données originales préservées
    expect(updated.entiteCode).toBe('IC');
    expect(updated.crWebViewLink).toBe(baseInput.crWebViewLink);
  });

  it('renvoie false si l\'id est inconnu', async () => {
    await appendPending(baseInput);
    const ok = await updatePendingAttempt('id-inexistant', {
      attempts: 99,
      lastError: 'x',
    });
    expect(ok).toBe(false);
  });

  it('renvoie false si le fichier n\'existe pas', async () => {
    const ok = await updatePendingAttempt('id-x', {
      attempts: 1,
      lastError: 'x',
    });
    expect(ok).toBe(false);
  });

  it('n\'altère pas les autres entrées', async () => {
    await appendPending(baseInput);
    await appendPending({ ...baseInput, entiteCode: 'GO', crFileId: 'go-cr' });
    const all = await readPending();
    const ic = all.find((e) => e.entiteCode === 'IC')!;

    await updatePendingAttempt(ic.id, { attempts: 2, lastError: 'kaboom' });

    const after = await readPending();
    const icAfter = after.find((e) => e.entiteCode === 'IC')!;
    const goAfter = after.find((e) => e.entiteCode === 'GO')!;
    expect(icAfter.attempts).toBe(2);
    expect(icAfter.lastError).toBe('kaboom');
    expect(goAfter.attempts).toBe(0);
    expect(goAfter.lastError).toBeUndefined();
  });
});

describe('cr-writeback-pending — parsing JSONL résilient', () => {
  const { parseJsonl, serializeJsonl } = _internals;

  it('ignore les lignes vides', () => {
    const entries = parseJsonl('\n\n\n');
    expect(entries).toEqual([]);
  });

  it('ignore les lignes JSON invalides sans throw', () => {
    const good = JSON.stringify({
      id: 'a',
      entiteCode: 'IC',
      crFileId: 'f',
      crWebViewLink: 'l',
      crFilename: 'n.pdf',
      crDate: '2026-05-29',
      crTitle: 't',
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    const content = `${good}\n{ pas du json\n${good}\n`;
    const entries = parseJsonl(content);
    expect(entries).toHaveLength(2);
  });

  it('ignore les entrées au schéma incomplet', () => {
    const incomplete = JSON.stringify({ id: 'a', entiteCode: 'IC' });
    const good = JSON.stringify({
      id: 'b',
      entiteCode: 'GO',
      crFileId: 'f',
      crWebViewLink: 'l',
      crFilename: 'n.pdf',
      crDate: '2026-05-29',
      crTitle: 't',
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
    const entries = parseJsonl(`${incomplete}\n${good}\n`);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe('b');
  });

  it('serializeJsonl([]) renvoie chaîne vide', () => {
    expect(serializeJsonl([])).toBe('');
  });

  it('round-trip serializeJsonl + parseJsonl conserve les données', () => {
    const entry = {
      id: 'x1',
      entiteCode: 'IC',
      crFileId: 'f1',
      crWebViewLink: 'https://x',
      crFilename: 'a.pdf',
      crDate: '2026-05-29',
      crTitle: 'Titre',
      createdAt: '2026-05-29T10:00:00.000Z',
      attempts: 2,
      lastError: 'kaboom',
    };
    const serialized = serializeJsonl([entry]);
    const parsed = parseJsonl(serialized);
    expect(parsed).toEqual([entry]);
  });

  it('lit après écriture corrompue (manuelle) — résiste au crash partiel', async () => {
    // Simulate corruption : on écrit directement dans le simulateur Drive
    await appendPending(baseInput);
    // Inject une ligne corrompue au milieu
    drive.content = `${drive.content}{ corrompu\n`;
    const entries = await readPending();
    // L'entrée valide reste lisible
    expect(entries).toHaveLength(1);
    expect(entries[0]!.entiteCode).toBe('IC');
  });
});

describe('cr-writeback-pending — gracieux sans token', () => {
  it('appendPending renvoie false si pas de token OAuth2', async () => {
    mockGetAccessToken.mockResolvedValueOnce(null);
    const ok = await appendPending(baseInput);
    expect(ok).toBe(false);
  });

  it('readPending renvoie [] si pas de token OAuth2', async () => {
    mockGetAccessToken.mockResolvedValueOnce(null);
    const entries = await readPending();
    expect(entries).toEqual([]);
  });

  it('removePending renvoie false si pas de token OAuth2', async () => {
    mockGetAccessToken.mockResolvedValueOnce(null);
    const ok = await removePending('x');
    expect(ok).toBe(false);
  });
});

describe('cr-writeback-pending — constantes exposées', () => {
  it('PENDING_FILENAME = cr-writeback-pending.jsonl', () => {
    expect(PENDING_FILENAME).toBe('cr-writeback-pending.jsonl');
    expect(_internals.PENDING_FILENAME).toBe(PENDING_FILENAME);
  });
});
