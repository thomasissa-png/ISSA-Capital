/**
 * Tests unitaires — GET /api/secretariat/cron-email-ingest
 *
 * Mock de runEmailIngest. Vérifie l'auth par Bearer token,
 * le retour JSON, la gestion d'erreur.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { IngestStats } from '@/lib/secretariat/email-ingest/email-ingest-runner';

// ============================================================
// Mocks
// ============================================================

const mockRunEmailIngest = vi.fn();

vi.mock('@/lib/secretariat/email-ingest/email-ingest-runner', () => ({
  runEmailIngest: (...args: unknown[]) => mockRunEmailIngest(...args),
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
  const url = 'http://localhost:3000/api/secretariat/cron-email-ingest';
  const headers: Record<string, string> = {};
  if (bearerToken !== undefined) {
    headers['authorization'] = `Bearer ${bearerToken}`;
  }
  return new NextRequest(url, { method: 'GET', headers });
}

function makeStats(overrides: Partial<IngestStats> = {}): IngestStats {
  return {
    totalListed: 5,
    preFilteredSpam: 2,
    haikuSpam: 1,
    pendingCreated: 1,
    autoExecuted: 0,
    systemEmailsFiltered: 0,
    draftsCreated: 0,
    draftsSkipped: 0,
    draftsSkippedAlreadyReplied: 0,
    draftsFailed: 0,
    contactCardsSent: 0,
    errors: 1,
    durationMs: 987,
    ...overrides,
  };
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockRunEmailIngest.mockResolvedValue(makeStats());
});

// ============================================================
// Tests
// ============================================================

describe('GET /api/secretariat/cron-email-ingest', () => {
  it('retourne 401 si aucun header Authorization', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/secretariat/cron-email-ingest',
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
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('retourne 401 si le header Authorization n\'est pas au format Bearer', async () => {
    const url = 'http://localhost:3000/api/secretariat/cron-email-ingest';
    const req = new NextRequest(url, {
      method: 'GET',
      headers: { authorization: 'Basic dXNlcjpwYXNz' },
    });
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('retourne 200 avec stats si le Bearer token est correct', async () => {
    const stats = makeStats({ totalListed: 12, pendingCreated: 4 });
    mockRunEmailIngest.mockResolvedValue(stats);

    const req = makeRequest('cron-test-secret-32chars-ok');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.stats.totalListed).toBe(12);
    expect(body.stats.pendingCreated).toBe(4);
  });

  it('appelle runEmailIngest exactement une fois', async () => {
    const req = makeRequest('cron-test-secret-32chars-ok');
    await GET(req);

    expect(mockRunEmailIngest).toHaveBeenCalledTimes(1);
  });

  it('retourne 500 si runEmailIngest throw', async () => {
    mockRunEmailIngest.mockRejectedValue(new Error('Pipeline crash'));

    const req = makeRequest('cron-test-secret-32chars-ok');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Pipeline crash');
  });

  it('retourne 500 si CRON_SECRET non configuré', async () => {
    const original = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;

    const req = makeRequest('any-secret');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Endpoint non configuré');

    // Restaurer
    process.env.CRON_SECRET = original;
  });

  it('ne lance pas runEmailIngest si le token est absent', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/secretariat/cron-email-ingest',
      { method: 'GET' },
    );
    await GET(req);

    expect(mockRunEmailIngest).not.toHaveBeenCalled();
  });
});
