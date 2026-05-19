/**
 * Tests unitaires — POST /api/secretariat/email-ingest
 *
 * Mock de runEmailIngest. Vérifie l'auth par secret, le retour JSON,
 * la gestion d'erreur.
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

vi.stubEnv('EMAIL_INGEST_TRIGGER_SECRET', 'test-secret-32chars-very-secure');

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import { POST } from '../route';

// ============================================================
// Helpers
// ============================================================

function makeRequest(secret?: string): NextRequest {
  const url = secret
    ? `http://localhost:3000/api/secretariat/email-ingest?secret=${secret}`
    : 'http://localhost:3000/api/secretariat/email-ingest';

  return new NextRequest(url, { method: 'POST' });
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
    draftsFailed: 0,
    errors: 1,
    durationMs: 1234,
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

describe('POST /api/secretariat/email-ingest', () => {
  it('retourne 401 si le secret est manquant', async () => {
    const req = makeRequest();
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Secret invalide');
  });

  it('retourne 401 si le secret est incorrect', async () => {
    const req = makeRequest('wrong-secret');
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('retourne 200 avec stats si le secret est correct', async () => {
    const stats = makeStats({ totalListed: 10, pendingCreated: 3 });
    mockRunEmailIngest.mockResolvedValue(stats);

    const req = makeRequest('test-secret-32chars-very-secure');
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.stats.totalListed).toBe(10);
    expect(body.stats.pendingCreated).toBe(3);
  });

  it('retourne 500 si runEmailIngest throw', async () => {
    mockRunEmailIngest.mockRejectedValue(new Error('Pipeline crash'));

    const req = makeRequest('test-secret-32chars-very-secure');
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Pipeline crash');
  });

  it('retourne 500 si EMAIL_INGEST_TRIGGER_SECRET non configuré', async () => {
    // Temporairement override la var d'env
    const original = process.env.EMAIL_INGEST_TRIGGER_SECRET;
    delete process.env.EMAIL_INGEST_TRIGGER_SECRET;

    const req = makeRequest('any-secret');
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Endpoint non configuré');

    // Restaurer
    process.env.EMAIL_INGEST_TRIGGER_SECRET = original;
  });

  it('appelle runEmailIngest exactement une fois', async () => {
    const req = makeRequest('test-secret-32chars-very-secure');
    await POST(req);

    expect(mockRunEmailIngest).toHaveBeenCalledTimes(1);
  });
});
