/**
 * Tests audit-log JSONL (red line §4 spec).
 *
 * Couvre :
 *   - serializeAuditEntry : format JSON 1 ligne, UTF-8 préservé, champs optionnels
 *   - auditLogFilename / auditLogPath : nommage daté correct UTC
 *   - appendAuditLog :
 *     - sans token → return false silencieux (pas de throw)
 *     - avec token, fichier inexistant → CREATE
 *     - avec token, fichier existant → PATCH in-place (R5)
 *     - Drive 500 → return false (non-bloquant)
 *     - exception fetch → return false (jamais throw)
 *
 * On mocke `drive-upload` (getAccessToken, getOrCreateSubfolder) et
 * `vault-client/drive-resolver` (resolvePath) + `global.fetch` pour
 * simuler les réponses Drive sans réseau.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  appendAuditLog,
  auditLogFilename,
  auditLogPath,
  serializeAuditEntry,
  _resetAuditLogLockForTests,
} from '../audit-log';

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn(async () => null),
  getOrCreateSubfolder: vi.fn(async () => 'folder_anyalogs'),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  resolvePath: vi.fn(async () => ({ success: true, fileId: 'folder_anyalogs' })),
}));

import { getAccessToken } from '../../drive-upload';
import { resolvePath } from '../../vault-client/drive-resolver';

beforeEach(() => {
  _resetAuditLogLockForTests();
  vi.clearAllMocks();
  (resolvePath as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    fileId: 'folder_anyalogs',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// serializeAuditEntry
// ============================================================

describe('serializeAuditEntry', () => {
  it('produit une ligne JSON valide avec tous les champs', () => {
    const line = serializeAuditEntry({
      ts: '2026-05-19T12:00:00.000Z',
      op: 'create',
      direction: 'push',
      status: 'ok',
      taskId: 'tt_42',
      vaultPath: '03. Tâches/Todo.md',
      vaultLine: 7,
    });
    const parsed = JSON.parse(line);
    expect(parsed.op).toBe('create');
    expect(parsed.direction).toBe('push');
    expect(parsed.status).toBe('ok');
    expect(parsed.taskId).toBe('tt_42');
    expect(parsed.vaultPath).toBe('03. Tâches/Todo.md');
    expect(parsed.vaultLine).toBe(7);
    expect(parsed.ts).toBe('2026-05-19T12:00:00.000Z');
  });

  it('génère ts par défaut si absent', () => {
    const line = serializeAuditEntry({
      op: 'skip',
      direction: 'push',
      status: 'ok',
    });
    const parsed = JSON.parse(line);
    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('omet les champs optionnels absents', () => {
    const line = serializeAuditEntry({
      op: 'delete',
      direction: 'push',
      status: 'ok',
      taskId: 'tt_1',
    });
    const parsed = JSON.parse(line);
    expect('vaultPath' in parsed).toBe(false);
    expect('vaultLine' in parsed).toBe(false);
    expect('error' in parsed).toBe(false);
    expect('stats' in parsed).toBe(false);
  });

  it('produit une seule ligne (pas de \\n interne)', () => {
    const line = serializeAuditEntry({
      op: 'create',
      direction: 'push',
      status: 'ok',
      error: 'multi\nline\nerror',
    });
    // JSON.stringify échappe les \n internes — la ligne sérialisée
    // ne doit contenir aucun newline brut.
    expect(line.includes('\n')).toBe(false);
    const parsed = JSON.parse(line);
    expect(parsed.error).toBe('multi\nline\nerror');
  });

  it('préserve les accents UTF-8 (vaultPath "03. Tâches")', () => {
    const line = serializeAuditEntry({
      op: 'patch-line',
      direction: 'pull',
      status: 'ok',
      vaultPath: '03. Tâches/Todo.md',
      vaultLine: 3,
    });
    // Caractères natifs : pas d'escape \u00xx
    expect(line.includes('Tâches')).toBe(true);
    expect(line.includes('\\u00')).toBe(false);
  });
});

// ============================================================
// auditLogFilename / auditLogPath
// ============================================================

describe('auditLogFilename / auditLogPath', () => {
  it('format ticktick-sync-YYYY-MM-DD.jsonl', () => {
    const d = new Date('2026-05-19T12:34:56Z');
    expect(auditLogFilename(d)).toBe('ticktick-sync-2026-05-19.jsonl');
  });

  it('utilise UTC (pas le fuseau local)', () => {
    // 01:00 Paris = 00:00 UTC → date doit être 2026-05-19 UTC
    const d = new Date('2026-05-19T00:00:00Z');
    expect(auditLogFilename(d)).toBe('ticktick-sync-2026-05-19.jsonl');
  });

  it('chemin complet sous _Inbox/AnyaLogs/', () => {
    const d = new Date('2026-01-01T08:00:00Z');
    expect(auditLogPath(d)).toBe('_Inbox/AnyaLogs/ticktick-sync-2026-01-01.jsonl');
  });

  it('mois et jours zero-padded', () => {
    const d = new Date('2026-03-05T00:00:00Z');
    expect(auditLogFilename(d)).toBe('ticktick-sync-2026-03-05.jsonl');
  });
});

// ============================================================
// appendAuditLog — token absent → silencieux
// ============================================================

describe('appendAuditLog — sans token', () => {
  it('retourne false sans throw', async () => {
    (getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ok = await appendAuditLog({
      op: 'create',
      direction: 'push',
      status: 'ok',
      taskId: 'tt_1',
    });
    expect(ok).toBe(false);
  });

  it('ne déclenche aucun fetch', async () => {
    (getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await appendAuditLog({
      op: 'skip',
      direction: 'push',
      status: 'ok',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ============================================================
// appendAuditLog — avec token, fichier absent → CREATE
// ============================================================

describe('appendAuditLog — CREATE (fichier inexistant)', () => {
  beforeEach(() => {
    (getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue('tok_test');
  });

  it('crée le fichier via POST multipart si findLogFileId retourne null', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? 'GET').toUpperCase();
      calls.push({ url: u, method });
      // 1er call : findLogFileId (GET) → files vide
      if (u.includes('/drive/v3/files?q=')) {
        return new Response(JSON.stringify({ files: [] }), { status: 200 });
      }
      // 2e call : create multipart (POST)
      if (u.includes('/upload/drive/v3/files?uploadType=multipart')) {
        return new Response(JSON.stringify({ id: 'new_file_id' }), { status: 200 });
      }
      return new Response('not mocked', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await appendAuditLog({
      op: 'create',
      direction: 'push',
      status: 'ok',
      taskId: 'tt_1',
    });
    expect(ok).toBe(true);
    expect(calls.some((c) => c.method === 'POST')).toBe(true);
  });
});

// ============================================================
// appendAuditLog — fichier existant → PATCH in-place (R5)
// ============================================================

describe('appendAuditLog — PATCH in-place (R5)', () => {
  beforeEach(() => {
    (getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue('tok_test');
  });

  it('lit puis PATCH le fichier existant (jamais create+delete)', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = [];
    const existingContent = '{"ts":"2026-05-19T01:00:00.000Z","op":"create","direction":"push","status":"ok","taskId":"tt_old"}\n';
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? 'GET').toUpperCase();
      const body = typeof init?.body === 'string' ? init.body : undefined;
      calls.push({ url: u, method, body });
      // findLogFileId → trouve le fichier
      if (u.includes('/drive/v3/files?q=')) {
        return new Response(JSON.stringify({ files: [{ id: 'existing_id' }] }), { status: 200 });
      }
      // readLogFile → contenu existant
      if (u.includes('/drive/v3/files/existing_id?alt=media')) {
        return new Response(existingContent, { status: 200 });
      }
      // patchLogFile → succès
      if (u.includes('/upload/drive/v3/files/existing_id') && method === 'PATCH') {
        return new Response('{}', { status: 200 });
      }
      return new Response('not mocked', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await appendAuditLog({
      op: 'update',
      direction: 'push',
      status: 'ok',
      taskId: 'tt_new',
    });
    expect(ok).toBe(true);

    // Vérifie qu'on a bien fait un PATCH (pas DELETE + CREATE)
    const patchCall = calls.find((c) => c.method === 'PATCH');
    expect(patchCall).toBeDefined();
    expect(patchCall!.url).toContain('/upload/drive/v3/files/existing_id');
    // Le body contient l'ancienne ligne ET la nouvelle (append)
    expect(patchCall!.body).toContain('tt_old');
    expect(patchCall!.body).toContain('tt_new');
    expect(patchCall!.body!.endsWith('\n')).toBe(true);

    // Aucun DELETE n'a été émis (R5)
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('ajoute un \\n si le contenu existant n\'en a pas', async () => {
    let patchedBody = '';
    const existingContent = '{"ts":"x","op":"create","direction":"push","status":"ok"}'; // pas de \n final
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (u.includes('/drive/v3/files?q=')) {
        return new Response(JSON.stringify({ files: [{ id: 'fid' }] }), { status: 200 });
      }
      if (u.includes('alt=media')) {
        return new Response(existingContent, { status: 200 });
      }
      if (method === 'PATCH') {
        patchedBody = typeof init?.body === 'string' ? init.body : '';
        return new Response('{}', { status: 200 });
      }
      return new Response('not mocked', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await appendAuditLog({
      op: 'skip',
      direction: 'push',
      status: 'ok',
    });
    expect(patchedBody).toContain(existingContent);
    expect(patchedBody.indexOf('\n')).toBeGreaterThan(0);
  });
});

// ============================================================
// appendAuditLog — fallback console.warn si Drive down
// ============================================================

describe('appendAuditLog — robustesse (Drive down)', () => {
  beforeEach(() => {
    (getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue('tok_test');
  });

  it('retourne false si fetch throw (réseau down)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await appendAuditLog({
      op: 'create',
      direction: 'push',
      status: 'ok',
    });
    expect(ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('retourne false si folder introuvable + DRIVE_INBOX_FOLDER_ID absent', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (resolvePath as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });
    const prev = process.env.DRIVE_INBOX_FOLDER_ID;
    delete process.env.DRIVE_INBOX_FOLDER_ID;

    const ok = await appendAuditLog({
      op: 'skip',
      direction: 'push',
      status: 'ok',
    });
    expect(ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();

    if (prev) process.env.DRIVE_INBOX_FOLDER_ID = prev;
    warnSpy.mockRestore();
  });

  it('retourne false si PATCH Drive renvoie 500', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (u.includes('/drive/v3/files?q=')) {
        return new Response(JSON.stringify({ files: [{ id: 'fid' }] }), { status: 200 });
      }
      if (u.includes('alt=media')) {
        return new Response('', { status: 200 });
      }
      if (method === 'PATCH') {
        return new Response('boom', { status: 500 });
      }
      return new Response('not mocked', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const ok = await appendAuditLog({
      op: 'create',
      direction: 'push',
      status: 'ok',
    });
    expect(ok).toBe(false);
    warnSpy.mockRestore();
  });
});

// ============================================================
// Mutex — sérialisation des appels concurrents
// ============================================================

describe('appendAuditLog — mutex', () => {
  it('sérialise plusieurs appels concurrents sans crash', async () => {
    (getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const promises = [
      appendAuditLog({ op: 'create', direction: 'push', status: 'ok' }),
      appendAuditLog({ op: 'update', direction: 'push', status: 'ok' }),
      appendAuditLog({ op: 'delete', direction: 'push', status: 'ok' }),
    ];
    const results = await Promise.all(promises);
    expect(results).toEqual([false, false, false]);
  });
});
