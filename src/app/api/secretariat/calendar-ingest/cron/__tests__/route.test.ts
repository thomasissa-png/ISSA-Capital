/**
 * Tests endpoint cron calendar-ingest.
 *
 * Vérifie l'auth (Bearer header / query token / 401) + le pipeline minimal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/secretariat/calendar-ingest', () => ({
  runCalendarIngest: vi.fn(),
  sendCalendarRecapCard: vi.fn(),
}));

import { GET } from '../route';
import {
  runCalendarIngest,
  sendCalendarRecapCard,
} from '@/lib/secretariat/calendar-ingest';

const ORIGINAL_ENV = { ...process.env };

function makeReq(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(url), { headers });
}

describe('GET /api/secretariat/calendar-ingest/cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: 'topsecret' };
    vi.mocked(runCalendarIngest).mockResolvedValue({
      stats: {
        eventsFetched: 0,
        eventsProcessed: 0,
        contactsEnriched: 0,
        projectsEnriched: 0,
        projectsAmbiguous: 0,
        todosCreated: 0,
        skipped: 0,
        errors: 0,
        durationMs: 100,
      },
      results: [],
      stateSaved: true,
    });
    vi.mocked(sendCalendarRecapCard).mockResolvedValue(false);
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('500 si CRON_SECRET absent', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(makeReq('http://x.test/api/secretariat/calendar-ingest/cron'));
    expect(res.status).toBe(500);
  });

  it('401 si pas de token', async () => {
    const res = await GET(makeReq('http://x.test/api/secretariat/calendar-ingest/cron'));
    expect(res.status).toBe(401);
  });

  it('401 si token invalide', async () => {
    const res = await GET(
      makeReq('http://x.test/api/secretariat/calendar-ingest/cron', {
        authorization: 'Bearer wrong',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('200 avec Bearer header valide', async () => {
    const res = await GET(
      makeReq('http://x.test/api/secretariat/calendar-ingest/cron', {
        authorization: 'Bearer topsecret',
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.stats).toBeDefined();
  });

  it('200 avec query token valide', async () => {
    const res = await GET(
      makeReq('http://x.test/api/secretariat/calendar-ingest/cron?token=topsecret'),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('appelle sendCalendarRecapCard (qui reste silencieuse en interne si rien à dire)', async () => {
    vi.mocked(runCalendarIngest).mockResolvedValue({
      stats: {
        eventsFetched: 1,
        eventsProcessed: 1,
        contactsEnriched: 0,
        projectsEnriched: 0,
        projectsAmbiguous: 0,
        todosCreated: 1,
        skipped: 0,
        errors: 0,
        durationMs: 100,
      },
      results: [],
      stateSaved: true,
    });

    await GET(
      makeReq('http://x.test/api/secretariat/calendar-ingest/cron?token=topsecret'),
    );
    expect(sendCalendarRecapCard).toHaveBeenCalledOnce();
  });

  it('appelle toujours sendCalendarRecapCard hors dryRun (silence géré côté recap)', async () => {
    await GET(
      makeReq('http://x.test/api/secretariat/calendar-ingest/cron?token=topsecret'),
    );
    expect(sendCalendarRecapCard).toHaveBeenCalledOnce();
  });

  it('dryRun → ne déclenche pas la carte', async () => {
    vi.mocked(runCalendarIngest).mockResolvedValue({
      stats: {
        eventsFetched: 1,
        eventsProcessed: 1,
        contactsEnriched: 0,
        projectsEnriched: 0,
        projectsAmbiguous: 0,
        todosCreated: 1,
        skipped: 0,
        errors: 0,
        durationMs: 100,
      },
      results: [],
      stateSaved: false,
    });
    await GET(
      makeReq(
        'http://x.test/api/secretariat/calendar-ingest/cron?token=topsecret&dryRun=1',
      ),
    );
    expect(sendCalendarRecapCard).not.toHaveBeenCalled();
  });

  it('500 si runCalendarIngest throw', async () => {
    vi.mocked(runCalendarIngest).mockRejectedValue(new Error('boom'));
    const res = await GET(
      makeReq('http://x.test/api/secretariat/calendar-ingest/cron?token=topsecret'),
    );
    expect(res.status).toBe(500);
  });
});
