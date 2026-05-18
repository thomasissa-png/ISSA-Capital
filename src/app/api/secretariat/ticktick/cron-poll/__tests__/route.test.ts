/**
 * Tests unitaires — GET /api/secretariat/ticktick/cron-poll
 *
 * Mock de pollTickTickTasks. Vérifie l'auth par Bearer token,
 * le retour JSON, la gestion d'erreur du pipeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { PollStats } from '@/lib/secretariat/ticktick/poll';

// ============================================================
// Mocks
// ============================================================

const mockPollTickTickTasks = vi.fn();

vi.mock('@/lib/secretariat/ticktick/poll', () => ({
  pollTickTickTasks: (...args: unknown[]) => mockPollTickTickTasks(...args),
}));

// ============================================================
// Env vars
// ============================================================

vi.stubEnv('CRON_SECRET', 'cron-test-secret-32chars-ok');

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import { GET } from '../route';

// ============================================================
// Helpers
// ============================================================

function makeRequest(bearerToken?: string): NextRequest {
  const url = 'http://localhost:3000/api/secretariat/ticktick/cron-poll';
  const headers: Record<string, string> = {};
  if (bearerToken !== undefined) {
    headers['authorization'] = `Bearer ${bearerToken}`;
  }
  return new NextRequest(url, { method: 'GET', headers });
}

function makeStats(overrides: Partial<PollStats> = {}): PollStats {
  return {
    totalTasks: 10,
    events: 2,
    completed: 1,
    updated: 1,
    createdExternal: 0,
    completedByAnya: 1,
    durationMs: 234,
    ...overrides,
  };
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockPollTickTickTasks.mockResolvedValue(makeStats());
});

// ============================================================
// Tests
// ============================================================

describe('GET /api/secretariat/ticktick/cron-poll', () => {
  it('retourne 401 si aucun header Authorization', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/secretariat/ticktick/cron-poll',
      { method: 'GET' },
    );
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Non autorisé');
  });

  it('retourne 401 si le Bearer token est incorrect', async () => {
    const req = makeRequest('wrong-secret');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('retourne 401 si Authorization n\'est pas au format Bearer', async () => {
    const url = 'http://localhost:3000/api/secretariat/ticktick/cron-poll';
    const req = new NextRequest(url, {
      method: 'GET',
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('retourne 200 avec stats si Bearer correct', async () => {
    const stats = makeStats({ totalTasks: 25, completed: 3 });
    mockPollTickTickTasks.mockResolvedValue(stats);

    const req = makeRequest('cron-test-secret-32chars-ok');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.stats.totalTasks).toBe(25);
    expect(body.stats.completed).toBe(3);
  });

  it('appelle pollTickTickTasks exactement une fois', async () => {
    const req = makeRequest('cron-test-secret-32chars-ok');
    await GET(req);

    expect(mockPollTickTickTasks).toHaveBeenCalledTimes(1);
  });

  it('retourne 200 avec ok=false si stats.error est présent', async () => {
    mockPollTickTickTasks.mockResolvedValue(
      makeStats({ error: 'TickTick down', totalTasks: 0, events: 0 }),
    );

    const req = makeRequest('cron-test-secret-32chars-ok');
    const res = await GET(req);

    // 200 : le cron a tourné (différencier du 5xx endpoint cassé)
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.stats.error).toBe('TickTick down');
  });

  it('retourne 500 si pollTickTickTasks throw (cas exceptionnel)', async () => {
    mockPollTickTickTasks.mockRejectedValue(new Error('Catastrophic crash'));

    const req = makeRequest('cron-test-secret-32chars-ok');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Catastrophic crash');
  });

  it('retourne 500 si CRON_SECRET non configuré', async () => {
    const original = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    const req = makeRequest('any-secret');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Endpoint non configuré');

    process.env.CRON_SECRET = original;
  });

  it('ne lance pas pollTickTickTasks si le token est absent', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/secretariat/ticktick/cron-poll',
      { method: 'GET' },
    );
    await GET(req);

    expect(mockPollTickTickTasks).not.toHaveBeenCalled();
  });
});
