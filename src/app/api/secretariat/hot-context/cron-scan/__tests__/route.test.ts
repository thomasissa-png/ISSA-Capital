/**
 * Tests cron-scan hot-context — auth + happy path mocké.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { emptyHotContextState } from '@/lib/secretariat/hot-context/types';

vi.mock('@/lib/secretariat/hot-context/state-store', () => ({
  loadHotContextState: vi.fn(async () => emptyHotContextState()),
  saveHotContextState: vi.fn(async () => true),
}));

vi.mock('@/lib/secretariat/hot-context/scanner', () => ({
  scanForPatches: vi.fn(async () => ({
    patches: [],
    newLastScanAt: {
      email: '2026-05-19T10:00:00Z',
      cr: '2026-05-19T10:00:00Z',
      telegram: '2026-05-19T10:00:00Z',
      vaultNotes: '2026-05-19T10:00:00Z',
    },
    totalCandidates: 0,
    filteredByPrefilter: 0,
    skippedAlreadyProcessed: 0,
  })),
}));

vi.mock('@/lib/secretariat/telegram-validation/handlers/hot-context-patch', () => ({
  sendHotContextPatchCard: vi.fn(async () => 999),
}));

import { GET } from '../route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-secret-456';
});

describe('cron-scan route auth', () => {
  it('401 si token absent', async () => {
    const req = new NextRequest('http://localhost/api/secretariat/hot-context/cron-scan');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('200 si token valide en header (no patches)', async () => {
    const req = new NextRequest(
      'http://localhost/api/secretariat/hot-context/cron-scan',
      { headers: { Authorization: 'Bearer test-secret-456' } },
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; stats?: { patchesProposed?: number } };
    expect(body.ok).toBe(true);
    expect(body.stats?.patchesProposed).toBe(0);
  });

  it('500 si CRON_SECRET non configuré', async () => {
    delete process.env.CRON_SECRET;
    const req = new NextRequest('http://localhost/api/secretariat/hot-context/cron-scan');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
