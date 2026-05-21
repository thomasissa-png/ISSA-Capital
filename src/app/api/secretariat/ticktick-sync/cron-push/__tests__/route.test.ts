/**
 * Tests cron-push route — auth + kill switch S20.
 *
 * Le pipeline complet est couvert par push-engine.test.ts en unitaire ;
 * ici on vérifie uniquement l'auth + le kill switch (`TICKTICK_SYNC_LEGACY_DISABLED=1`)
 * qui désactive l'endpoint S20 (voir docs/ia/ticktick-gap-analysis-s20.md).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock toutes les deps lourdes (le kill switch court-circuite tout, mais on
// mock quand même pour les tests auth normaux).
vi.mock('@/lib/secretariat/ticktick-sync/state-store', () => ({
  loadSyncState: vi.fn(async () => ({
    version: 1,
    tasks: {},
    projects: { Critique: 'p1', Important: 'p2', 'Priorité basse': 'p3' },
    lastFullSyncAt: '',
  })),
  saveSyncState: vi.fn(async () => true),
}));

vi.mock('@/lib/secretariat/ticktick-sync/vault-scanner', () => ({
  scanVault: vi.fn(async () => []),
}));

vi.mock('@/lib/secretariat/ticktick-sync/push-engine', () => ({
  createDefaultClient: vi.fn(() => ({})),
  runPushEngine: vi.fn(async () => ({
    stats: {
      scanned: 0,
      created: 0,
      updated: 0,
      completed: 0,
      deleted: 0,
      skipped: 0,
      errors: 0,
      durationMs: 1,
      errorMessages: [],
    },
    results: [],
  })),
}));

vi.mock('@/lib/secretariat/ticktick-sync/pull-engine', () => ({
  releaseSyncLock: vi.fn(),
  tryAcquireSyncLock: vi.fn(() => true),
}));

vi.mock('@/lib/secretariat/ticktick-sync/project-manager', () => ({
  projectsReady: vi.fn(() => true),
  missingProjects: vi.fn(() => []),
}));

vi.mock('@/lib/secretariat/telegram-validation/handlers/ticktick-projects-confirm', () => ({
  sendTickTickProjectsConfirmCard: vi.fn(async () => undefined),
}));

import { GET } from '../route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-secret-123';
  process.env.TICKTICK_ACCESS_TOKEN = 'tt-token-123';
  delete process.env.TICKTICK_SYNC_LEGACY_DISABLED;
});

describe('cron-push route auth', () => {
  it('401 si token absent', async () => {
    const req = new NextRequest('http://localhost/api/secretariat/ticktick-sync/cron-push');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('401 si token incorrect', async () => {
    const req = new NextRequest(
      'http://localhost/api/secretariat/ticktick-sync/cron-push',
      { headers: { Authorization: 'Bearer wrong' } },
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('200 si token valide en header', async () => {
    const req = new NextRequest(
      'http://localhost/api/secretariat/ticktick-sync/cron-push',
      { headers: { Authorization: 'Bearer test-secret-123' } },
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

describe('cron-push route S20 kill switch', () => {
  it('S20 kill switch — early return { ok:true, disabled:true } si TICKTICK_SYNC_LEGACY_DISABLED=1', async () => {
    process.env.TICKTICK_SYNC_LEGACY_DISABLED = '1';
    try {
      // Même sans auth, le kill switch court-circuite : on vérifie le body
      const req = new NextRequest('http://localhost/api/secretariat/ticktick-sync/cron-push');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ ok: true, disabled: true });
      expect(body.reason).toContain('S18');
    } finally {
      delete process.env.TICKTICK_SYNC_LEGACY_DISABLED;
    }
  });

  it('S20 kill switch — pas activé si TICKTICK_SYNC_LEGACY_DISABLED absent', async () => {
    delete process.env.TICKTICK_SYNC_LEGACY_DISABLED;
    const req = new NextRequest('http://localhost/api/secretariat/ticktick-sync/cron-push');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
