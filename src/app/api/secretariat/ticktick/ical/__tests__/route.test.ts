/**
 * Tests unitaires — GET /api/secretariat/ticktick/ical
 *
 * Mock listTasks. Vérifie l'auth par query token, le format iCal, les erreurs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { TickTickTask } from '@/lib/secretariat/ticktick/types';

// ============================================================
// Mocks
// ============================================================

const mockListTasks = vi.fn().mockResolvedValue([]);

vi.mock('@/lib/secretariat/ticktick/ticktick-client', () => ({
  listTasks: (...args: unknown[]) => mockListTasks(...args),
}));

// Env vars
vi.stubEnv('TICKTICK_ICAL_SECRET', 'ical-secret-test');

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import { GET } from '../route';

// ============================================================
// Helpers
// ============================================================

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost:3000/api/secretariat/ticktick/ical?token=${token}`
    : 'http://localhost:3000/api/secretariat/ticktick/ical';

  return new NextRequest(url, { method: 'GET' });
}

function makeTask(overrides: Partial<TickTickTask> = {}): TickTickTask {
  return {
    id: 'task-001',
    projectId: 'proj-1',
    title: 'Tâche test',
    priority: 3,
    status: 0,
    ...overrides,
  };
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockListTasks.mockResolvedValue([]);
});

// ============================================================
// Tests
// ============================================================

describe('GET /api/secretariat/ticktick/ical', () => {
  it('retourne 401 si le token est absent', async () => {
    const req = makeRequest();
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('retourne 401 si le token est incorrect', async () => {
    const req = makeRequest('wrong-token');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('retourne 200 avec contenu iCal si le token est correct', async () => {
    mockListTasks.mockResolvedValue([makeTask()]);

    const req = makeRequest('ical-secret-test');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('BEGIN:VTODO');
    expect(text).toContain('Tâche test');
  });

  it('retourne le bon Content-Type', async () => {
    mockListTasks.mockResolvedValue([]);

    const req = makeRequest('ical-secret-test');
    const res = await GET(req);

    expect(res.headers.get('content-type')).toContain('text/calendar');
  });

  it('filtre les tâches complétées', async () => {
    mockListTasks.mockResolvedValue([
      makeTask({ id: 't1', title: 'Active', status: 0 }),
      makeTask({ id: 't2', title: 'Complétée', status: 2 }),
    ]);

    const req = makeRequest('ical-secret-test');
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain('Active');
    expect(text).not.toContain('Complétée');
  });

  it('retourne un calendrier vide si aucune tâche', async () => {
    mockListTasks.mockResolvedValue([]);

    const req = makeRequest('ical-secret-test');
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain('BEGIN:VCALENDAR');
    expect(text).toContain('END:VCALENDAR');
    expect(text).not.toContain('BEGIN:VTODO');
  });

  it('retourne 500 si listTasks throw', async () => {
    mockListTasks.mockRejectedValue(new Error('TickTick API down'));

    const req = makeRequest('ical-secret-test');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('TickTick API down');
  });

  it('retourne 500 si TICKTICK_ICAL_SECRET non configuré', async () => {
    const original = process.env.TICKTICK_ICAL_SECRET;
    delete process.env.TICKTICK_ICAL_SECRET;

    const req = makeRequest('any');
    const res = await GET(req);

    expect(res.status).toBe(500);

    process.env.TICKTICK_ICAL_SECRET = original;
  });

  it('inclut un header Cache-Control', async () => {
    mockListTasks.mockResolvedValue([makeTask()]);

    const req = makeRequest('ical-secret-test');
    const res = await GET(req);

    expect(res.headers.get('cache-control')).toContain('max-age=3600');
  });
});
