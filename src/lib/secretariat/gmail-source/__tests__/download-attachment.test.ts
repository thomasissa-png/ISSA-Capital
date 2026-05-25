/**
 * Tests downloadAttachment — téléchargement binaire PJ Gmail (S23).
 *
 * Mock getAccessToken (drive-upload) + global fetch. Zéro réseau.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetAccessToken = vi.fn();
vi.mock('../../drive-upload', () => ({
  getAccessToken: (...a: unknown[]) => mockGetAccessToken(...a),
}));
vi.mock('../../health-monitor/oauth-timestamps', () => ({
  recordOAuthUsage: vi.fn(),
}));

import { downloadAttachment } from '../gmail-client';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('downloadAttachment', () => {
  it('pas de token → null', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    expect(await downloadAttachment('msg1', 'att1')).toBeNull();
  });

  it('succès → Buffer décodé depuis base64url', async () => {
    mockGetAccessToken.mockResolvedValue('tok');
    // "PDFDATA" en base64 standard = UERGREFUQQ== ; base64url sans padding.
    const b64url = Buffer.from('PDFDATA').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: b64url, size: 7 }),
      }),
    );
    const buf = await downloadAttachment('msg1', 'att1');
    expect(buf).not.toBeNull();
    expect(buf!.toString('utf-8')).toBe('PDFDATA');
  });

  it('HTTP KO → null', async () => {
    mockGetAccessToken.mockResolvedValue('tok');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' }),
    );
    expect(await downloadAttachment('msg1', 'att1')).toBeNull();
  });

  it('payload sans data → null', async () => {
    mockGetAccessToken.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ size: 0 }) }));
    expect(await downloadAttachment('msg1', 'att1')).toBeNull();
  });

  it('fetch throw → null (pas de propagation)', async () => {
    mockGetAccessToken.mockResolvedValue('tok');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await downloadAttachment('msg1', 'att1')).toBeNull();
  });
});
