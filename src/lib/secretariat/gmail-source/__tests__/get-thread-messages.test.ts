/**
 * Tests getThreadMessages — messages + labelIds d'un thread Gmail (S23).
 *
 * Mock getAccessToken (drive-upload) + global fetch. Zéro réseau.
 * Sert de socle à hasReplyFromMe (détection « déjà répondu »).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetAccessToken = vi.fn();
vi.mock('../../drive-upload', () => ({
  getAccessToken: (...a: unknown[]) => mockGetAccessToken(...a),
}));
vi.mock('../../health-monitor/oauth-timestamps', () => ({
  recordOAuthUsage: vi.fn(),
}));

import { getThreadMessages } from '../gmail-client';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('getThreadMessages', () => {
  it('pas de token → tableau vide', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    expect(await getThreadMessages('thread-1')).toEqual([]);
  });

  it('succès → liste { id, labelIds } normalisée', async () => {
    mockGetAccessToken.mockResolvedValue('tok');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [
            { id: 'm1', labelIds: ['INBOX'] },
            { id: 'm2', labelIds: ['SENT', 'IMPORTANT'] },
            { id: 'm3' }, // pas de labelIds → []
          ],
        }),
      }),
    );

    const result = await getThreadMessages('thread-1');
    expect(result).toEqual([
      { id: 'm1', labelIds: ['INBOX'] },
      { id: 'm2', labelIds: ['SENT', 'IMPORTANT'] },
      { id: 'm3', labelIds: [] },
    ]);
  });

  it('HTTP KO → tableau vide (pas de throw)', async () => {
    mockGetAccessToken.mockResolvedValue('tok');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' }),
    );
    expect(await getThreadMessages('thread-1')).toEqual([]);
  });

  it('réponse sans messages → tableau vide', async () => {
    mockGetAccessToken.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(await getThreadMessages('thread-1')).toEqual([]);
  });

  it('fetch throw → tableau vide (pas de propagation)', async () => {
    mockGetAccessToken.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await getThreadMessages('thread-1')).toEqual([]);
  });
});
