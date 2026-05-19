/**
 * Tests reunion-writer — focus sur la logique create/update/no-change.
 * Les appels Drive sont mockés (fetch + vault-client).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeReunion } from '../reunion-writer';
import { serializeReunionMarkdown, mapEventToReunion } from '../event-mapper';
import * as driveResolver from '../../vault-client/drive-resolver';
import * as obsidianFile from '../../vault-client/obsidian-file';
import * as vaultClient from '../../vault-client';
import * as driveUpload from '../../drive-upload';
import type { CalendarEvent } from '../types';

vi.mock('../../vault-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../vault-client')>();
  return {
    ...actual,
    createVaultFile: vi.fn(),
  };
});

vi.mock('../../vault-client/drive-resolver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../vault-client/drive-resolver')>();
  return {
    ...actual,
    listMarkdownFiles: vi.fn(),
    resolveFilePath: vi.fn(),
  };
});

vi.mock('../../vault-client/obsidian-file', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../vault-client/obsidian-file')>();
  return {
    ...actual,
    readFileById: vi.fn(),
  };
});

vi.mock('../../drive-upload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../drive-upload')>();
  return {
    ...actual,
    getAccessToken: vi.fn(),
  };
});

function makeEvent(): CalendarEvent {
  return {
    id: 'evt_w_001',
    status: 'confirmed',
    htmlLink: 'https://calendar.google.com/event?eid=evt_w_001',
    updated: '2026-05-19T10:00:00Z',
    summary: 'Réunion test write',
    startDateTime: '2026-05-22T14:00:00+02:00',
    endDateTime: '2026-05-22T15:00:00+02:00',
    attendees: [
      { email: 'thomas@i.com', self: true },
      { email: 'maxime@v.com', displayName: 'Maxime D' },
    ],
    isAllDay: false,
  };
}

describe('writeReunion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(driveUpload.getAccessToken).mockResolvedValue('fake_token');
  });

  it('create : pas de fichier existant → createVaultFile appelé', async () => {
    vi.mocked(driveResolver.listMarkdownFiles).mockResolvedValue([]);
    vi.mocked(driveResolver.resolveFilePath).mockResolvedValue({
      success: false,
      error: 'not found',
    });
    vi.mocked(vaultClient.createVaultFile).mockResolvedValue(true);

    const entry = mapEventToReunion(makeEvent())!;
    const result = await writeReunion(entry, 'test-trigger');

    expect(result.success).toBe(true);
    expect(result.op).toBe('created');
    expect(vaultClient.createVaultFile).toHaveBeenCalledOnce();
  });

  it('update : fileId existant + contenu différent → PATCH', async () => {
    const entry = mapEventToReunion(makeEvent())!;
    const existingContent = '---\ntype: reunion\ndate: 2026-05-22\ngoogle_calendar_event_id: evt_w_001\n---\n# Vieux titre\n';

    vi.mocked(driveResolver.listMarkdownFiles).mockResolvedValue([
      { id: 'fid_existing', name: `${entry.filename}.md` },
    ]);
    vi.mocked(obsidianFile.readFileById).mockResolvedValue({
      success: true,
      content: existingContent,
      fileId: 'fid_existing',
    });
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    );

    const result = await writeReunion(entry, 'test-trigger');

    expect(result.success).toBe(true);
    expect(result.op).toBe('updated');
    expect(result.fileId).toBe('fid_existing');
    expect(fetchSpy).toHaveBeenCalled();
    const callUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(callUrl).toContain('fid_existing');
    expect(callUrl).toContain('uploadType=media');
    fetchSpy.mockRestore();
  });

  it('no-change : contenu identique → pas de PATCH', async () => {
    const entry = mapEventToReunion(makeEvent())!;
    const sameContent = serializeReunionMarkdown(entry);

    vi.mocked(driveResolver.listMarkdownFiles).mockResolvedValue([
      { id: 'fid_same', name: `${entry.filename}.md` },
    ]);
    vi.mocked(obsidianFile.readFileById).mockResolvedValue({
      success: true,
      content: sameContent,
      fileId: 'fid_same',
    });
    const fetchSpy = vi.spyOn(global, 'fetch');

    const result = await writeReunion(entry, 'test-trigger');

    expect(result.success).toBe(true);
    expect(result.op).toBe('no-change');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('idempotence : 2 appels successifs même entry → 2e = no-change', async () => {
    const entry = mapEventToReunion(makeEvent())!;
    const content = serializeReunionMarkdown(entry);

    vi.mocked(driveResolver.listMarkdownFiles).mockResolvedValue([
      { id: 'fid_idem', name: `${entry.filename}.md` },
    ]);
    vi.mocked(obsidianFile.readFileById).mockResolvedValue({
      success: true,
      content,
      fileId: 'fid_idem',
    });

    const r1 = await writeReunion(entry, 'trigger-1');
    const r2 = await writeReunion(entry, 'trigger-2');

    expect(r1.op).toBe('no-change');
    expect(r2.op).toBe('no-change');
  });
});
