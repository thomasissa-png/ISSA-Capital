/**
 * Tests endpoint cron-morning-brief.
 *
 * Vérifie l'auth (Bearer / query / 401 / 500) + l'appel build + envoi.
 * buildMorningBrief et sendMorningBrief mockés.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/secretariat/morning-brief', () => ({
  buildMorningBrief: vi.fn(),
  sendMorningBrief: vi.fn(),
}));

import { GET } from '../route';
import { buildMorningBrief, sendMorningBrief } from '@/lib/secretariat/morning-brief';

const ORIGINAL_ENV = { ...process.env };

function makeReq(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(url), { headers });
}

const BASE = 'http://x.test/api/secretariat/cron-morning-brief';

describe('GET /api/secretariat/cron-morning-brief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: 'topsecret' };
    vi.mocked(buildMorningBrief).mockResolvedValue({
      message: 'Bonjour Thomas',
      sections: { ticktick: 'ok', calendar: 'ok', citation: 'ok' },
    });
    vi.mocked(sendMorningBrief).mockResolvedValue(true);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('500 si CRON_SECRET absent', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeReq(BASE));
    expect(res.status).toBe(500);
  });

  it('401 si pas de token', async () => {
    const res = await GET(makeReq(BASE));
    expect(res.status).toBe(401);
  });

  it('401 si token invalide', async () => {
    const res = await GET(makeReq(BASE, { authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  it('200 + envoi avec Bearer valide', async () => {
    const res = await GET(makeReq(BASE, { authorization: 'Bearer topsecret' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.sent).toBe(true);
    expect(buildMorningBrief).toHaveBeenCalledOnce();
    expect(sendMorningBrief).toHaveBeenCalledWith('Bonjour Thomas');
  });

  it('200 avec query token valide', async () => {
    const res = await GET(makeReq(`${BASE}?token=topsecret`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('dryRun=1 → ne déclenche pas l’envoi', async () => {
    const res = await GET(makeReq(`${BASE}?token=topsecret&dryRun=1`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dryRun).toBe(true);
    expect(json.sent).toBe(false);
    expect(sendMorningBrief).not.toHaveBeenCalled();
  });

  it('500 si buildMorningBrief throw', async () => {
    vi.mocked(buildMorningBrief).mockRejectedValue(new Error('boom'));
    const res = await GET(makeReq(`${BASE}?token=topsecret`));
    expect(res.status).toBe(500);
  });
});
