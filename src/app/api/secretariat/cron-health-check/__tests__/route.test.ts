/**
 * Tests cron-health-check API route.
 *
 * Mock runHealthCheck, dedup-store, sendHealthAlertCard.
 *
 * Jalon S15.5E — Task C.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HealthCheckStats, MonitoredItemStatus } from '@/lib/secretariat/health-monitor/types';

// ============================================================
// Mocks (hoisted)
// ============================================================

const mocks = vi.hoisted(() => ({
  runHealthCheck: vi.fn(),
  shouldNotify: vi.fn(),
  markNotified: vi.fn(),
  sendHealthAlertCard: vi.fn(),
}));

vi.mock('@/lib/secretariat/health-monitor/health-monitor', () => ({
  runHealthCheck: mocks.runHealthCheck,
}));

vi.mock('@/lib/secretariat/health-monitor/dedup-store', () => ({
  shouldNotify: mocks.shouldNotify,
  markNotified: mocks.markNotified,
}));

vi.mock('@/lib/secretariat/telegram-validation/health-card', () => ({
  sendHealthAlertCard: mocks.sendHealthAlertCard,
}));

// ============================================================
// Env vars
// ============================================================

vi.stubEnv('CRON_SECRET', 'test-cron-secret');
vi.stubEnv('TELEGRAM_CHAT_ID_THOMAS', '12345');

// ============================================================
// Import (AFTER mocks)
// ============================================================

import { GET } from '../route';

// ============================================================
// Helpers
// ============================================================

function makeRequest(secret?: string): Request {
  const headers: Record<string, string> = {};
  if (secret) {
    headers['authorization'] = `Bearer ${secret}`;
  }
  return new Request('http://localhost:3000/api/secretariat/cron-health-check', {
    method: 'GET',
    headers,
  }) as unknown as Request;
}

function makeStats(overrides: Partial<HealthCheckStats> = {}): HealthCheckStats {
  return {
    totalItems: 7,
    statuses: [],
    notificationsSent: 0,
    errors: [],
    durationMs: 50,
    ...overrides,
  };
}

function makeStatus(overrides: Partial<MonitoredItemStatus> = {}): MonitoredItemStatus {
  return {
    itemId: 'ticktick_access_token',
    label: 'TickTick Access Token',
    category: 'oauth',
    state: 'warn',
    expiresAt: new Date('2026-06-01'),
    daysRemaining: 14,
    thresholdHit: 30,
    renewalInstructions: 'Renouveler le token.',
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('GET /api/secretariat/cron-health-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runHealthCheck.mockResolvedValue(makeStats());
    mocks.shouldNotify.mockReturnValue(true);
    mocks.sendHealthAlertCard.mockResolvedValue({ messageId: 999 });
  });

  // ----------------------------------------------------------
  // Auth
  // ----------------------------------------------------------

  it('retourne 401 sans header Authorization', async () => {
    const res = await GET(makeRequest() as never);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it('retourne 401 avec mauvais token', async () => {
    const res = await GET(makeRequest('wrong-secret') as never);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  // ----------------------------------------------------------
  // Happy path
  // ----------------------------------------------------------

  it('appelle runHealthCheck et retourne les stats', async () => {
    const stats = makeStats({ totalItems: 7, statuses: [makeStatus({ state: 'ok', thresholdHit: null })] });
    mocks.runHealthCheck.mockResolvedValue(stats);

    const res = await GET(makeRequest('test-cron-secret') as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.totalItems).toBe(7);
    expect(mocks.runHealthCheck).toHaveBeenCalledOnce();
  });

  it('envoie des cartes Telegram pour les items warn/critical nécessitant notification', async () => {
    const warnStatus = makeStatus({ state: 'warn', thresholdHit: 30 });
    const critStatus = makeStatus({
      itemId: 'domain_renewal',
      state: 'critical',
      thresholdHit: 7,
    });
    const okStatus = makeStatus({
      itemId: 'ssl_cert',
      state: 'ok',
      thresholdHit: null,
    });

    mocks.runHealthCheck.mockResolvedValue(
      makeStats({ statuses: [warnStatus, critStatus, okStatus] }),
    );

    const res = await GET(makeRequest('test-cron-secret') as never);
    const json = await res.json();

    expect(mocks.sendHealthAlertCard).toHaveBeenCalledTimes(2);
    expect(json.notificationsSent).toBe(2);
  });

  it('appelle markNotified APRES envoi réussi', async () => {
    const warnStatus = makeStatus({ state: 'warn', thresholdHit: 30 });
    mocks.runHealthCheck.mockResolvedValue(makeStats({ statuses: [warnStatus] }));

    await GET(makeRequest('test-cron-secret') as never);

    expect(mocks.markNotified).toHaveBeenCalledWith('ticktick_access_token', 30);
  });

  it('N\'appelle PAS markNotified si envoi Telegram échoue', async () => {
    const warnStatus = makeStatus({ state: 'warn', thresholdHit: 30 });
    mocks.runHealthCheck.mockResolvedValue(makeStats({ statuses: [warnStatus] }));
    mocks.sendHealthAlertCard.mockRejectedValue(new Error('Telegram down'));

    const res = await GET(makeRequest('test-cron-secret') as never);
    const json = await res.json();

    expect(mocks.markNotified).not.toHaveBeenCalled();
    expect(json.notificationsSent).toBe(0);
    expect(json.errors.length).toBeGreaterThan(0);
  });

  it('continue avec les autres items si un envoi échoue', async () => {
    const failStatus = makeStatus({ state: 'warn', thresholdHit: 30, itemId: 'fail_item' });
    const successStatus = makeStatus({
      state: 'critical',
      thresholdHit: 7,
      itemId: 'success_item',
    });

    mocks.runHealthCheck.mockResolvedValue(
      makeStats({ statuses: [failStatus, successStatus] }),
    );

    // Première carte échoue, deuxième réussit
    mocks.sendHealthAlertCard
      .mockRejectedValueOnce(new Error('Telegram down'))
      .mockResolvedValueOnce({ messageId: 999 });

    const res = await GET(makeRequest('test-cron-secret') as never);
    const json = await res.json();

    expect(json.notificationsSent).toBe(1);
    expect(json.errors.length).toBe(1);
    expect(mocks.markNotified).toHaveBeenCalledTimes(1);
    expect(mocks.markNotified).toHaveBeenCalledWith('success_item', 7);
  });

  it('ne notifie pas si shouldNotify retourne false', async () => {
    const status = makeStatus({ state: 'warn', thresholdHit: 30 });
    mocks.runHealthCheck.mockResolvedValue(makeStats({ statuses: [status] }));
    mocks.shouldNotify.mockReturnValue(false);

    const res = await GET(makeRequest('test-cron-secret') as never);
    const json = await res.json();

    expect(mocks.sendHealthAlertCard).not.toHaveBeenCalled();
    expect(json.notificationsSent).toBe(0);
  });

  it('retourne ok false quand runHealthCheck a des erreurs', async () => {
    mocks.runHealthCheck.mockResolvedValue(
      makeStats({ errors: ['[ssl_certificate] TLS connect failed'] }),
    );

    const res = await GET(makeRequest('test-cron-secret') as never);
    const json = await res.json();

    expect(json.ok).toBe(false);
    expect(json.errors).toContain('[ssl_certificate] TLS connect failed');
  });

  it('retourne les stats JSON avec le bon format', async () => {
    const status = makeStatus({ state: 'ok', thresholdHit: null, daysRemaining: 45 });
    mocks.runHealthCheck.mockResolvedValue(makeStats({ totalItems: 7, statuses: [status] }));

    const res = await GET(makeRequest('test-cron-secret') as never);
    const json = await res.json();

    expect(json).toHaveProperty('totalItems');
    expect(json).toHaveProperty('statuses');
    expect(json).toHaveProperty('notificationsSent');
    expect(json).toHaveProperty('errors');
    expect(json).toHaveProperty('durationMs');
    expect(json.statuses[0]).toEqual({
      itemId: 'ticktick_access_token',
      state: 'ok',
      daysRemaining: 45,
    });
  });

  // ----------------------------------------------------------
  // Erreur pipeline
  // ----------------------------------------------------------

  it('retourne 200 avec ok false si runHealthCheck throw', async () => {
    mocks.runHealthCheck.mockRejectedValue(new Error('DB connection failed'));

    const res = await GET(makeRequest('test-cron-secret') as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errors).toContain('DB connection failed');
  });
});
