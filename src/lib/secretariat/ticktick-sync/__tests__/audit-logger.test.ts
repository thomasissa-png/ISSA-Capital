/**
 * Tests audit-logger — comportement déterministe sans Drive réel.
 *
 * On mock drive-upload + drive-resolver. On valide :
 *  - format JSONL strict (1 entrée = 1 ligne minifiée + \n)
 *  - serialize/parse round-trip
 *  - logAuditEntry ne throw JAMAIS (red line spec §9.4)
 *  - mutex sérialise les append
 *  - cache fileId du jour (lookup une seule fois)
 *  - fichier créé si absent, sinon PATCH in-place
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks - ils doivent être déclarés AVANT l'import
const mockGetAccessToken = vi.fn();
const mockUpdateFileContent = vi.fn();
const mockUploadToInbox = vi.fn();
const mockGetOrCreateSubfolder = vi.fn();
const mockResolvePath = vi.fn();
const mockFetch = vi.fn();

vi.mock('../../drive-upload', () => ({
  getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
  updateFileContent: (...args: unknown[]) => mockUpdateFileContent(...args),
  uploadToInbox: (...args: unknown[]) => mockUploadToInbox(...args),
  getOrCreateSubfolder: (...args: unknown[]) => mockGetOrCreateSubfolder(...args),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  resolvePath: (...args: unknown[]) => mockResolvePath(...args),
}));

// Mock global fetch (pour le listing et la lecture)
const originalFetch = global.fetch;

import {
  logAuditEntry,
  readTodayLog,
  serializeEntry,
  parseJsonlBuffer,
  _resetAuditLoggerCacheForTests,
  _auditLoggerInternals,
  type AuditEntry,
} from '../audit-logger';

beforeEach(() => {
  _resetAuditLoggerCacheForTests();
  mockGetAccessToken.mockReset();
  mockUpdateFileContent.mockReset();
  mockUploadToInbox.mockReset();
  mockGetOrCreateSubfolder.mockReset();
  mockResolvePath.mockReset();
  mockFetch.mockReset();
  global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.clearAllMocks();
});

// ============================================================
// Helpers — réponse fetch mockée
// ============================================================

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'text/plain' }),
    json: async () => JSON.parse(body),
    text: async () => body,
  } as unknown as Response;
}

// ============================================================
// 1. Format JSONL
// ============================================================

describe('audit-logger — format JSONL', () => {
  it('serializeEntry produit JSON minifié + \\n final', () => {
    const entry: AuditEntry = {
      timestamp: '2026-05-19T10:00:00.000Z',
      direction: 'push',
      op: 'create',
      ticktickId: 'tt-abc',
      vaultPath: '03. Tâches/Todo.md',
      lineNumber: 12,
      status: 'success',
    };
    const out = serializeEntry(entry);
    expect(out.endsWith('\n')).toBe(true);
    expect(out.includes('\n', 0)).toBe(true);
    expect(out.split('\n').filter(Boolean)).toHaveLength(1);
    // Re-parsable
    const parsed = JSON.parse(out.trim()) as AuditEntry;
    expect(parsed).toEqual(entry);
  });

  it('parseJsonlBuffer round-trip 3 entrées', () => {
    const entries: AuditEntry[] = [
      { timestamp: '2026-05-19T10:00:00.000Z', direction: 'push', op: 'create', status: 'success' },
      { timestamp: '2026-05-19T10:01:00.000Z', direction: 'pull', op: 'update', status: 'success' },
      { timestamp: '2026-05-19T10:02:00.000Z', direction: 'push', op: 'delete', status: 'error', errorMessage: 'HTTP 500' },
    ];
    const buf = entries.map(serializeEntry).join('');
    const parsed = parseJsonlBuffer(buf);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.op).toBe('create');
    expect(parsed[2]?.errorMessage).toBe('HTTP 500');
  });

  it('parseJsonlBuffer skip les lignes corrompues sans throw', () => {
    const buf = '{"timestamp":"2026-05-19T10:00:00.000Z","direction":"push","op":"create","status":"success"}\n' +
      'CORRUPTED LINE\n' +
      '{"timestamp":"2026-05-19T10:01:00.000Z","direction":"pull","op":"update","status":"success"}\n';
    const parsed = parseJsonlBuffer(buf);
    expect(parsed).toHaveLength(2);
  });

  it('parseJsonlBuffer accepte CRLF', () => {
    const buf = '{"timestamp":"2026-05-19T10:00:00.000Z","direction":"push","op":"create","status":"success"}\r\n' +
      '{"timestamp":"2026-05-19T10:01:00.000Z","direction":"pull","op":"update","status":"success"}\r\n';
    const parsed = parseJsonlBuffer(buf);
    expect(parsed).toHaveLength(2);
  });

  it('parseJsonlBuffer retourne [] pour buffer vide', () => {
    expect(parseJsonlBuffer('')).toEqual([]);
    expect(parseJsonlBuffer('\n\n')).toEqual([]);
  });
});

// ============================================================
// 2. todayUtcKey et filenameForDay
// ============================================================

describe('audit-logger — date helpers', () => {
  it('todayUtcKey produit YYYY-MM-DD pad zero', () => {
    const k = _auditLoggerInternals.todayUtcKey(new Date(Date.UTC(2026, 0, 7, 10, 30)));
    expect(k).toBe('2026-01-07');
  });

  it('filenameForDay produit nom canonique', () => {
    expect(_auditLoggerInternals.filenameForDay('2026-05-19')).toBe('ticktick-sync-2026-05-19.jsonl');
  });
});

// ============================================================
// 3. logAuditEntry sans token — skip gracieux
// ============================================================

describe('logAuditEntry — pas de credentials', () => {
  it('skip silencieusement si getAccessToken retourne null', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    await expect(
      logAuditEntry({ direction: 'push', op: 'create', status: 'success' }),
    ).resolves.toBeUndefined();
    expect(mockUpdateFileContent).not.toHaveBeenCalled();
    expect(mockUploadToInbox).not.toHaveBeenCalled();
  });

  it('NE THROW JAMAIS même si une dépendance crash', async () => {
    mockGetAccessToken.mockRejectedValue(new Error('boom token'));
    await expect(
      logAuditEntry({ direction: 'push', op: 'create', status: 'success' }),
    ).resolves.toBeUndefined();
  });
});

// ============================================================
// 4. logAuditEntry crée le fichier du jour si absent
// ============================================================

describe('logAuditEntry — création fichier du jour', () => {
  it('appelle uploadToInbox si listing ne trouve aucun fichier', async () => {
    mockGetAccessToken.mockResolvedValue('token-xyz');
    mockResolvePath.mockResolvedValue({ success: true, fileId: 'folder-anya-logs' });
    // listing → 0 fichier
    mockFetch.mockResolvedValueOnce(jsonResponse({ files: [] }));
    mockUploadToInbox.mockResolvedValue({ success: true, fileId: 'file-new-day' });
    // read content existing (empty)
    mockFetch.mockResolvedValueOnce(textResponse(''));
    mockUpdateFileContent.mockResolvedValue({ success: true, fileId: 'file-new-day' });

    await logAuditEntry({
      direction: 'push',
      op: 'create',
      ticktickId: 'tt-1',
      status: 'success',
    });

    expect(mockUploadToInbox).toHaveBeenCalledTimes(1);
    const args = mockUploadToInbox.mock.calls[0]!;
    expect(args[1]).toMatch(/^ticktick-sync-\d{4}-\d{2}-\d{2}\.jsonl$/u);
    expect(args[2]).toBe('AnyaLogs');
    expect(mockUpdateFileContent).toHaveBeenCalledTimes(1);
  });

  it('réutilise le fileId du cache au 2e appel (pas de re-listing)', async () => {
    mockGetAccessToken.mockResolvedValue('token-xyz');
    mockResolvePath.mockResolvedValue({ success: true, fileId: 'folder-anya-logs' });
    mockFetch.mockResolvedValueOnce(jsonResponse({ files: [{ id: 'file-day-cached' }] }));
    mockFetch.mockResolvedValue(textResponse('{"timestamp":"2026-05-19T10:00:00.000Z","direction":"push","op":"create","status":"success"}\n'));
    mockUpdateFileContent.mockResolvedValue({ success: true, fileId: 'file-day-cached' });

    await logAuditEntry({ direction: 'push', op: 'create', status: 'success' });
    await logAuditEntry({ direction: 'pull', op: 'update', status: 'success' });

    // mockFetch appelé : 1 listing (au 1er) + 2 reads. Pas de 2e listing.
    // i.e. mockResolvePath ne devrait pas être appelé 2 fois (cache fileId)
    // (resolvePath est appelé seulement en cas de cache miss)
    expect(mockResolvePath).toHaveBeenCalledTimes(1);
    expect(mockUpdateFileContent).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// 5. logAuditEntry append (PATCH in-place R5)
// ============================================================

describe('logAuditEntry — append PATCH in-place R5', () => {
  it('concatène le contenu existant + nouvelle ligne JSONL', async () => {
    mockGetAccessToken.mockResolvedValue('token-xyz');
    mockResolvePath.mockResolvedValue({ success: true, fileId: 'folder-anya-logs' });
    // Listing → trouvé
    mockFetch.mockResolvedValueOnce(jsonResponse({ files: [{ id: 'file-existing' }] }));
    // Read content existing
    const existingLine = '{"timestamp":"2026-05-19T09:00:00.000Z","direction":"push","op":"create","status":"success"}\n';
    mockFetch.mockResolvedValueOnce(textResponse(existingLine));
    mockUpdateFileContent.mockResolvedValue({ success: true, fileId: 'file-existing' });

    await logAuditEntry({
      timestamp: '2026-05-19T10:00:00.000Z',
      direction: 'pull',
      op: 'update',
      ticktickId: 'tt-99',
      status: 'success',
    });

    expect(mockUpdateFileContent).toHaveBeenCalledTimes(1);
    const [fileId, content, mime] = mockUpdateFileContent.mock.calls[0]!;
    expect(fileId).toBe('file-existing');
    expect(mime).toBe('application/x-ndjson');
    expect(typeof content).toBe('string');
    // L'ancien contenu doit être préservé
    expect(content as string).toContain(existingLine);
    // La nouvelle ligne doit être ajoutée
    expect(content as string).toContain('"ticktickId":"tt-99"');
    // 2 lignes au total
    const lines = (content as string).split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);
  });

  it('invalide le cache si PATCH échoue', async () => {
    mockGetAccessToken.mockResolvedValue('token-xyz');
    mockResolvePath.mockResolvedValue({ success: true, fileId: 'folder-anya-logs' });
    mockFetch.mockResolvedValueOnce(jsonResponse({ files: [{ id: 'file-existing' }] }));
    mockFetch.mockResolvedValue(textResponse(''));
    mockUpdateFileContent.mockResolvedValueOnce({ success: false, error: 'HTTP 500' });

    await logAuditEntry({ direction: 'push', op: 'create', status: 'success' });

    // 2e appel : cache invalidé → re-listing
    mockResolvePath.mockClear();
    mockResolvePath.mockResolvedValue({ success: true, fileId: 'folder-anya-logs' });
    mockFetch.mockResolvedValueOnce(jsonResponse({ files: [{ id: 'file-existing' }] }));
    mockFetch.mockResolvedValue(textResponse(''));
    mockUpdateFileContent.mockResolvedValue({ success: true, fileId: 'file-existing' });

    await logAuditEntry({ direction: 'push', op: 'create', status: 'success' });

    expect(mockResolvePath).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// 6. Mutex sérialise
// ============================================================

describe('logAuditEntry — mutex', () => {
  it('sérialise plusieurs appels concurrents (pas de race)', async () => {
    mockGetAccessToken.mockResolvedValue('token-xyz');
    mockResolvePath.mockResolvedValue({ success: true, fileId: 'folder-anya-logs' });
    mockFetch.mockResolvedValue(jsonResponse({ files: [{ id: 'file-existing' }] }));
    let readCallCount = 0;
    const readContents: string[] = ['', '{"a":1}\n', '{"a":1}\n{"b":2}\n'];

    // Le fetch alterne listing puis read — mockFetch comme stratégie simple :
    // - 1er call (listing) : files
    // - 2e+ : read text
    mockFetch.mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes('?q=')) {
        return jsonResponse({ files: [{ id: 'file-existing' }] });
      }
      const text = readContents[readCallCount] ?? readContents[readContents.length - 1] ?? '';
      readCallCount++;
      return textResponse(text);
    });

    mockUpdateFileContent.mockResolvedValue({ success: true, fileId: 'file-existing' });

    await Promise.all([
      logAuditEntry({ direction: 'push', op: 'create', status: 'success' }),
      logAuditEntry({ direction: 'pull', op: 'update', status: 'success' }),
      logAuditEntry({ direction: 'push', op: 'delete', status: 'success' }),
    ]);

    expect(mockUpdateFileContent).toHaveBeenCalledTimes(3);
  });
});

// ============================================================
// 7. readTodayLog
// ============================================================

describe('readTodayLog', () => {
  it('parse les entrées du fichier du jour', async () => {
    mockGetAccessToken.mockResolvedValue('token-xyz');
    mockResolvePath.mockResolvedValue({ success: true, fileId: 'folder-anya-logs' });
    mockFetch.mockResolvedValueOnce(jsonResponse({ files: [{ id: 'file-today' }] }));
    const content = '{"timestamp":"2026-05-19T10:00:00.000Z","direction":"push","op":"create","status":"success"}\n' +
      '{"timestamp":"2026-05-19T10:01:00.000Z","direction":"pull","op":"update","status":"success"}\n';
    mockFetch.mockResolvedValueOnce(textResponse(content));

    const entries = await readTodayLog();
    expect(entries).toHaveLength(2);
    expect(entries[0]?.op).toBe('create');
    expect(entries[1]?.direction).toBe('pull');
  });

  it('retourne [] si pas de token', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    const entries = await readTodayLog();
    expect(entries).toEqual([]);
  });
});
