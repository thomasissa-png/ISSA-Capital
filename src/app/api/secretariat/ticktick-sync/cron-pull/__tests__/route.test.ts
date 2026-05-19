/**
 * Tests cron-pull route — auth only (le pipeline complet est couvert par
 * pull-engine.test.ts en unitaire).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock toutes les deps lourdes
vi.mock('@/lib/secretariat/ticktick-sync/state-store', () => ({
  loadSyncState: vi.fn(async () => ({ version: 1, tasks: {}, projects: {}, lastFullSyncAt: '' })),
  saveSyncState: vi.fn(async () => true),
}));

vi.mock('@/lib/secretariat/ticktick/ticktick-client', () => ({
  listTasks: vi.fn(async () => []),
}));

vi.mock('@/lib/secretariat/drive-upload', () => ({
  getAccessToken: vi.fn(async () => 'mock'),
  updateFileContent: vi.fn(async () => ({ success: true })),
}));

vi.mock('@/lib/secretariat/vault-client/drive-resolver', () => ({
  resolveFilePath: vi.fn(async () => ({ success: false })),
  listMarkdownFiles: vi.fn(async () => []),
}));

// S19 — mock ticktick-delete-confirm retiré : handler supprimé (completion
// silencieuse remplace la carte Telegram delete).

import { GET } from '../route';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = 'test-secret-123';
  process.env.TICKTICK_ACCESS_TOKEN = 'tt-token-123';
});

describe('cron-pull route auth', () => {
  it('401 si token absent', async () => {
    const req = new NextRequest('http://localhost/api/secretariat/ticktick-sync/cron-pull');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('401 si token incorrect', async () => {
    const req = new NextRequest(
      'http://localhost/api/secretariat/ticktick-sync/cron-pull',
      { headers: { Authorization: 'Bearer wrong' } },
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('200 si token valide en header', async () => {
    const req = new NextRequest(
      'http://localhost/api/secretariat/ticktick-sync/cron-pull',
      { headers: { Authorization: 'Bearer test-secret-123' } },
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('200 si token valide en query string', async () => {
    const req = new NextRequest(
      'http://localhost/api/secretariat/ticktick-sync/cron-pull?token=test-secret-123',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
