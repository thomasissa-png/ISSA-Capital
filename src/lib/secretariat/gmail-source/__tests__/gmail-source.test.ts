/**
 * Tests gmail-source.ts — listUnprocessed, fetchDetail, markProcessed, markFailed.
 *
 * Mocks : gmail-client (listMessages, getMessage, modifyLabels)
 *         label-resolver (resolveTraiteLabel, resolveARevoir)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  listUnprocessed,
  fetchDetail,
  markProcessed,
  markFailed,
} from '../gmail-source';

// ============================================================
// Mocks
// ============================================================

vi.mock('../gmail-client', () => ({
  listMessages: vi.fn(),
  getMessage: vi.fn(),
  modifyLabels: vi.fn(),
  getHeader: vi.fn(),
  parseEmailAddress: vi.fn(),
  parseEmailAddresses: vi.fn(),
  extractBodyPlain: vi.fn(),
  extractAttachments: vi.fn(),
}));

vi.mock('../label-resolver', () => ({
  resolveTraiteLabel: vi.fn(),
  resolveARevoir: vi.fn(),
}));

import {
  listMessages,
  getMessage,
  modifyLabels,
  getHeader as mockGetHeader,
  parseEmailAddress as mockParseEmailAddress,
  parseEmailAddresses as mockParseEmailAddresses,
  extractBodyPlain as mockExtractBodyPlain,
  extractAttachments as mockExtractAttachments,
} from '../gmail-client';

import {
  resolveTraiteLabel,
  resolveARevoir,
} from '../label-resolver';

const mockListMessages = vi.mocked(listMessages);
const mockGetMessage = vi.mocked(getMessage);
const mockModifyLabels = vi.mocked(modifyLabels);
const mockResolveTraiteLabel = vi.mocked(resolveTraiteLabel);
const mockResolveARevoir = vi.mocked(resolveARevoir);

describe('gmail-source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================
  // listUnprocessed
  // ============================================================

  describe('listUnprocessed', () => {
    it('appelle listMessages avec la bonne query', async () => {
      mockListMessages.mockResolvedValue([]);

      await listUnprocessed();

      expect(mockListMessages).toHaveBeenCalledWith(
        expect.stringContaining('-label:Anya/traité'),
        50,
      );
      expect(mockListMessages).toHaveBeenCalledWith(
        expect.stringContaining('is:inbox'),
        50,
      );
      expect(mockListMessages).toHaveBeenCalledWith(
        expect.stringContaining('newer_than:7d'),
        50,
      );
    });

    it('retourne la liste des messages', async () => {
      mockListMessages.mockResolvedValue([
        { id: 'msg-1', threadId: 'thread-1' },
        { id: 'msg-2', threadId: 'thread-2' },
        { id: 'msg-3' },
      ]);

      const result = await listUnprocessed();
      expect(result).toHaveLength(3);
      expect(result[0]!.id).toBe('msg-1');
    });

    it('respecte le maxResults', async () => {
      mockListMessages.mockResolvedValue([]);
      await listUnprocessed(10);
      expect(mockListMessages).toHaveBeenCalledWith(expect.any(String), 10);
    });

    it('utilise la variable d\'environnement pour le label', async () => {
      process.env.GMAIL_LABEL_TRAITE = 'Custom/Done';
      mockListMessages.mockResolvedValue([]);

      await listUnprocessed();

      expect(mockListMessages).toHaveBeenCalledWith(
        expect.stringContaining('-label:Custom/Done'),
        50,
      );

      delete process.env.GMAIL_LABEL_TRAITE;
    });

    it('utilise EMAIL_INGEST_LOOKBACK_DAYS', async () => {
      process.env.EMAIL_INGEST_LOOKBACK_DAYS = '14';
      mockListMessages.mockResolvedValue([]);

      await listUnprocessed();

      expect(mockListMessages).toHaveBeenCalledWith(
        expect.stringContaining('newer_than:14d'),
        50,
      );

      delete process.env.EMAIL_INGEST_LOOKBACK_DAYS;
    });
  });

  // ============================================================
  // fetchDetail
  // ============================================================

  describe('fetchDetail', () => {
    it('retourne null si getMessage échoue', async () => {
      mockGetMessage.mockResolvedValue(null);
      const result = await fetchDetail('msg-1');
      expect(result).toBeNull();
    });

    it('normalise un message en EmailMessage', async () => {
      const rawMsg = {
        id: 'msg-123',
        internalDate: '1715500800000', // 2024-05-12T12:00:00Z
        payload: {
          headers: [
            { name: 'From', value: 'Kenan <kbeguigneau@gmail.com>' },
            { name: 'To', value: 'thomas.issa@gmail.com' },
            { name: 'Subject', value: 'Quittance avril' },
            { name: 'Date', value: 'Mon, 12 May 2025 10:00:00 +0200' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Bonjour, la quittance svp').toString('base64').replace(/\+/g, '-').replace(/\//g, '_') },
        },
      };

      mockGetMessage.mockResolvedValue(rawMsg);

      // Use real implementations for header/parse functions
      vi.mocked(mockGetHeader).mockImplementation((msg, name) => {
        const headers = msg.payload?.headers ?? [];
        const h = headers.find((hdr) => hdr.name.toLowerCase() === name.toLowerCase());
        return h?.value ?? null;
      });
      vi.mocked(mockParseEmailAddress).mockImplementation((raw: string) => {
        const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
        if (match) return { name: match[1]!.trim(), email: match[2]!.toLowerCase().trim() };
        return { email: raw.toLowerCase().trim() };
      });
      vi.mocked(mockParseEmailAddresses).mockImplementation((raw: string | null) => {
        if (!raw) return [];
        return raw.split(',').map((s) => ({ email: s.trim().toLowerCase() }));
      });
      vi.mocked(mockExtractBodyPlain).mockReturnValue('Bonjour, la quittance svp');
      vi.mocked(mockExtractAttachments).mockReturnValue([]);

      const result = await fetchDetail('msg-123');

      expect(result).not.toBeNull();
      expect(result!.source).toBe('gmail');
      expect(result!.id).toBe('msg-123');
      expect(result!.from.email).toBe('kbeguigneau@gmail.com');
      expect(result!.from.name).toBe('Kenan');
      expect(result!.subject).toBe('Quittance avril');
      expect(result!.bodyPlain).toBe('Bonjour, la quittance svp');
      expect(result!.attachments).toEqual([]);
      expect(result!.rawRef).toContain('msg-123');
    });
  });

  // ============================================================
  // markProcessed
  // ============================================================

  describe('markProcessed', () => {
    it('pose le label traité sur le message', async () => {
      mockResolveTraiteLabel.mockResolvedValue('Label_traite_123');
      mockModifyLabels.mockResolvedValue(true);

      const result = await markProcessed('msg-1');

      expect(result).toBe(true);
      expect(mockModifyLabels).toHaveBeenCalledWith('msg-1', ['Label_traite_123']);
    });

    it('retourne false si le label ne peut pas être résolu', async () => {
      mockResolveTraiteLabel.mockResolvedValue(null);

      const result = await markProcessed('msg-1');
      expect(result).toBe(false);
      expect(mockModifyLabels).not.toHaveBeenCalled();
    });

    it('retourne false si modifyLabels échoue', async () => {
      mockResolveTraiteLabel.mockResolvedValue('Label_traite_123');
      mockModifyLabels.mockResolvedValue(false);

      const result = await markProcessed('msg-1');
      expect(result).toBe(false);
    });
  });

  // ============================================================
  // markFailed
  // ============================================================

  describe('markFailed', () => {
    it('pose le label à-revoir sur le message', async () => {
      mockResolveARevoir.mockResolvedValue('Label_revoir_456');
      mockModifyLabels.mockResolvedValue(true);

      const result = await markFailed('msg-2');

      expect(result).toBe(true);
      expect(mockModifyLabels).toHaveBeenCalledWith('msg-2', ['Label_revoir_456']);
    });

    it('retourne false si le label ne peut pas être résolu', async () => {
      mockResolveARevoir.mockResolvedValue(null);

      const result = await markFailed('msg-2');
      expect(result).toBe(false);
    });
  });
});
