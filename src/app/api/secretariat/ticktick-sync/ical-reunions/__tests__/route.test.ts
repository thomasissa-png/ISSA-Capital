/**
 * Tests unitaires — GET /api/secretariat/ticktick-sync/ical-reunions (S18.3a)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================
// Mocks (avant import du module testé)
// ============================================================

const mockListVaultReunions = vi.fn();
const mockGenerateICal = vi.fn();

vi.mock('@/lib/secretariat/ticktick-sync/ical-feed-reunions', () => ({
  listVaultReunions: (...args: unknown[]) => mockListVaultReunions(...args),
  generateICalFromReunions: (...args: unknown[]) => mockGenerateICal(...args),
}));

vi.stubEnv('TICKTICK_ICAL_SECRET', 'ical-secret-test');

import { GET } from '../route';

// ============================================================
// Helpers
// ============================================================

function makeRequest(token?: string): NextRequest {
  const url = token
    ? `http://localhost:3000/api/secretariat/ticktick-sync/ical-reunions?token=${token}`
    : 'http://localhost:3000/api/secretariat/ticktick-sync/ical-reunions';
  return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListVaultReunions.mockResolvedValue([]);
  mockGenerateICal.mockReturnValue('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
});

// ============================================================
// Tests
// ============================================================

describe('GET /api/secretariat/ticktick-sync/ical-reunions', () => {
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

  it('retourne 200 avec content-type text/calendar si token correct', async () => {
    mockGenerateICal.mockReturnValue(
      'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Test\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
    );
    const req = makeRequest('ical-secret-test');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/calendar');
    const text = await res.text();
    expect(text).toContain('BEGIN:VCALENDAR');
  });

  it('inclut Content-Disposition avec filename anya-reunions.ics', async () => {
    const req = makeRequest('ical-secret-test');
    const res = await GET(req);
    expect(res.headers.get('content-disposition')).toContain('anya-reunions.ics');
  });

  it('inclut Cache-Control max-age=3600', async () => {
    const req = makeRequest('ical-secret-test');
    const res = await GET(req);
    expect(res.headers.get('cache-control')).toContain('max-age=3600');
  });

  it('retourne 500 si TICKTICK_ICAL_SECRET non configuré', async () => {
    const original = process.env.TICKTICK_ICAL_SECRET;
    delete process.env.TICKTICK_ICAL_SECRET;

    const req = makeRequest('any');
    const res = await GET(req);

    expect(res.status).toBe(500);

    process.env.TICKTICK_ICAL_SECRET = original;
  });

  it('retourne 500 si listVaultReunions throw', async () => {
    mockListVaultReunions.mockRejectedValue(new Error('Vault down'));
    const req = makeRequest('ical-secret-test');
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Vault down');
  });

  it('appelle listVaultReunions puis generateICalFromReunions', async () => {
    const fakeList = [{ uid: 'a' }];
    mockListVaultReunions.mockResolvedValue(fakeList);
    mockGenerateICal.mockReturnValue('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');

    const req = makeRequest('ical-secret-test');
    await GET(req);

    expect(mockListVaultReunions).toHaveBeenCalled();
    expect(mockGenerateICal).toHaveBeenCalledWith(fakeList);
  });
});
