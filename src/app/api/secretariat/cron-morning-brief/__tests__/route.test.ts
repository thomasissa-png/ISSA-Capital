/**
 * Tests endpoint cron-morning-brief.
 *
 * Vérifie l'auth (Bearer / query / 401 / 500), le garde-fou heure de Paris
 * (envoi uniquement à 7h, bypass dryRun/force) + l'appel build + envoi.
 * buildMorningBrief, sendMorningBrief et getParisHour mockés.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/secretariat/morning-brief', () => ({
  buildMorningBrief: vi.fn(),
  sendMorningBrief: vi.fn(),
}));

vi.mock('@/lib/secretariat/morning-brief/paris-date', () => ({
  getParisHour: vi.fn(),
}));

import { GET } from '../route';
import { buildMorningBrief, sendMorningBrief } from '@/lib/secretariat/morning-brief';
import { getParisHour } from '@/lib/secretariat/morning-brief/paris-date';

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
    // Par défaut : il est 7h à Paris (le cron envoie).
    vi.mocked(getParisHour).mockReturnValue(7);
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

  it('200 + envoi avec Bearer valide à 7h Paris', async () => {
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

  it('garde-fou : hors 7h Paris → skipped, pas d’envoi', async () => {
    vi.mocked(getParisHour).mockReturnValue(9);
    const res = await GET(makeReq(`${BASE}?token=topsecret`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.skipped).toBe(true);
    expect(json.parisHour).toBe(9);
    expect(buildMorningBrief).not.toHaveBeenCalled();
    expect(sendMorningBrief).not.toHaveBeenCalled();
  });

  it('force=1 → bypass le garde-fou même hors 7h', async () => {
    vi.mocked(getParisHour).mockReturnValue(15);
    const res = await GET(makeReq(`${BASE}?token=topsecret&force=1`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent).toBe(true);
    expect(sendMorningBrief).toHaveBeenCalledOnce();
  });

  it('dryRun=1 → bypass garde-fou, construit sans envoyer', async () => {
    vi.mocked(getParisHour).mockReturnValue(15);
    const res = await GET(makeReq(`${BASE}?token=topsecret&dryRun=1`));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.dryRun).toBe(true);
    expect(json.sent).toBe(false);
    expect(buildMorningBrief).toHaveBeenCalledOnce();
    expect(sendMorningBrief).not.toHaveBeenCalled();
  });

  it('500 si buildMorningBrief throw', async () => {
    vi.mocked(buildMorningBrief).mockRejectedValue(new Error('boom'));
    const res = await GET(makeReq(`${BASE}?token=topsecret`));
    expect(res.status).toBe(500);
  });
});
