/**
 * Tests health-monitor core — evaluateItem + runHealthCheck.
 *
 * Mock les dépendances (MONITORED_ITEMS, dedup-store) pour tester
 * la logique d'évaluation de manière isolée.
 *
 * Jalon S15.5E — Task B.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MonitoredItem } from '../types';

// ============================================================
// Mocks
// ============================================================

// Mock dedup-store
vi.mock('../dedup-store', () => ({
  shouldNotify: vi.fn(() => true),
}));

// Mock monitored-items (pour runHealthCheck — on contrôle les items)
vi.mock('../monitored-items', () => ({
  MONITORED_ITEMS: [] as MonitoredItem[],
}));

import { evaluateItem, runHealthCheck } from '../health-monitor';
import { shouldNotify } from '../dedup-store';
import { MONITORED_ITEMS } from '../monitored-items';

// ============================================================
// Helpers
// ============================================================

function makeItem(overrides: Partial<MonitoredItem> = {}): MonitoredItem {
  return {
    id: 'test_item',
    label: 'Test Item',
    category: 'oauth',
    thresholdsDays: [30, 7, 1],
    getExpiresAt: async () => null,
    ...overrides,
  };
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ============================================================
// Tests evaluateItem
// ============================================================

describe('evaluateItem', () => {
  it('retourne unknown quand getExpiresAt = null et pas de healthCheck', async () => {
    const item = makeItem({ getExpiresAt: async () => null });
    const status = await evaluateItem(item);

    expect(status.state).toBe('unknown');
    expect(status.expiresAt).toBeNull();
    expect(status.daysRemaining).toBeNull();
    expect(status.thresholdHit).toBeNull();
    expect(status.reason).toContain('Aucune date');
  });

  it('retourne ok quand expiration lointaine (au-dessus de tous les seuils)', async () => {
    const item = makeItem({
      thresholdsDays: [30, 7, 1],
      getExpiresAt: async () => daysFromNow(90),
    });
    const status = await evaluateItem(item);

    expect(status.state).toBe('ok');
    expect(status.daysRemaining).toBeGreaterThanOrEqual(89);
    expect(status.thresholdHit).toBeNull();
  });

  it('retourne warn quand entre min et max threshold', async () => {
    // thresholds [30, 7, 1], daysRemaining ~15 → warn, thresholdHit = 30
    const item = makeItem({
      thresholdsDays: [30, 7, 1],
      getExpiresAt: async () => daysFromNow(15),
    });
    const status = await evaluateItem(item);

    expect(status.state).toBe('warn');
    expect(status.thresholdHit).toBe(30);
  });

  it('retourne critical quand sous le seuil minimum', async () => {
    // thresholds [30, 7, 1], daysRemaining = 0 → critical, thresholdHit = 1 (min)
    const item = makeItem({
      thresholdsDays: [30, 7, 1],
      getExpiresAt: async () => daysFromNow(0.5), // ~12h
    });
    const status = await evaluateItem(item);

    expect(status.state).toBe('critical');
    expect(status.thresholdHit).toBe(1);
  });

  it('retourne critical avec thresholdHit = -1 quand déjà expiré', async () => {
    const item = makeItem({
      thresholdsDays: [30, 7, 1],
      getExpiresAt: async () => daysFromNow(-5),
    });
    const status = await evaluateItem(item);

    expect(status.state).toBe('critical');
    expect(status.thresholdHit).toBe(-1);
    expect(status.daysRemaining).toBeLessThan(0);
    expect(status.reason).toContain('Expiré depuis');
  });

  it('sélectionne le seuil le plus serré franchi', async () => {
    // thresholds [60, 14, 3], daysRemaining ~10 → warn, thresholdHit = 14
    const item = makeItem({
      thresholdsDays: [60, 14, 3],
      getExpiresAt: async () => daysFromNow(10),
    });
    const status = await evaluateItem(item);

    expect(status.state).toBe('warn');
    expect(status.thresholdHit).toBe(14);
  });

  it('copie renewalUrl et renewalInstructions depuis item', async () => {
    const item = makeItem({
      renewalUrl: 'https://example.com/renew',
      renewalInstructions: 'Click the link',
      getExpiresAt: async () => daysFromNow(5),
    });
    const status = await evaluateItem(item);

    expect(status.renewalUrl).toBe('https://example.com/renew');
    expect(status.renewalInstructions).toBe('Click the link');
  });

  // ----------------------------------------------------------
  // getHealthCheck path
  // ----------------------------------------------------------

  it('utilise getHealthCheck quand défini — retourne ok', async () => {
    const item = makeItem({
      getHealthCheck: async () => ({ ok: true }),
      getExpiresAt: async () => daysFromNow(5), // Ignoré car getHealthCheck existe
    });
    const status = await evaluateItem(item);

    expect(status.state).toBe('ok');
    expect(status.thresholdHit).toBeNull();
  });

  it('utilise getHealthCheck quand défini — retourne critical avec reason', async () => {
    const item = makeItem({
      getHealthCheck: async () => ({ ok: false, reason: 'API timeout' }),
    });
    const status = await evaluateItem(item);

    expect(status.state).toBe('critical');
    expect(status.reason).toBe('API timeout');
    expect(status.thresholdHit).toBe(0); // Signal "immédiat"
  });

  it('gère les thresholds vides sans crash (items sans date)', async () => {
    const item = makeItem({
      thresholdsDays: [],
      getExpiresAt: async () => daysFromNow(10),
    });
    const status = await evaluateItem(item);

    expect(status.state).toBe('ok');
    expect(status.daysRemaining).toBeGreaterThanOrEqual(9);
  });

  it('retourne critical pour thresholds vides quand expiré', async () => {
    const item = makeItem({
      thresholdsDays: [],
      getExpiresAt: async () => daysFromNow(-3),
    });
    const status = await evaluateItem(item);

    expect(status.state).toBe('critical');
    expect(status.thresholdHit).toBe(-1);
  });
});

// ============================================================
// Tests runHealthCheck
// ============================================================

describe('runHealthCheck', () => {
  beforeEach(() => {
    // Vider le tableau mocké
    (MONITORED_ITEMS as MonitoredItem[]).length = 0;
    vi.mocked(shouldNotify).mockReturnValue(true);
  });

  it('retourne des stats correctes avec 0 items', async () => {
    const result = await runHealthCheck();

    expect(result.totalItems).toBe(0);
    expect(result.statuses).toHaveLength(0);
    expect(result.notificationsSent).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('évalue tous les items et retourne leurs statuts', async () => {
    const items = MONITORED_ITEMS as MonitoredItem[];
    items.push(
      makeItem({ id: 'item_a', getExpiresAt: async () => daysFromNow(90) }),
      makeItem({ id: 'item_b', getExpiresAt: async () => daysFromNow(5) }),
    );

    const result = await runHealthCheck();

    expect(result.totalItems).toBe(2);
    expect(result.statuses).toHaveLength(2);
    expect(result.statuses[0]!.itemId).toBe('item_a');
    expect(result.statuses[1]!.itemId).toBe('item_b');
  });

  it('capture les erreurs sans crasher', async () => {
    const items = MONITORED_ITEMS as MonitoredItem[];
    items.push(
      makeItem({
        id: 'item_ok',
        getExpiresAt: async () => daysFromNow(90),
      }),
      makeItem({
        id: 'item_crash',
        getExpiresAt: async () => {
          throw new Error('Connection refused');
        },
      }),
    );

    const result = await runHealthCheck();

    expect(result.statuses).toHaveLength(1); // Seul item_ok a un statut
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!).toContain('item_crash');
    expect(result.errors[0]!).toContain('Connection refused');
  });

  it('compte les notifications via shouldNotify (dedup respecté)', async () => {
    vi.mocked(shouldNotify).mockReturnValue(false); // Tous déjà notifiés

    const items = MONITORED_ITEMS as MonitoredItem[];
    items.push(
      makeItem({ id: 'warn_item', getExpiresAt: async () => daysFromNow(5) }),
    );

    const result = await runHealthCheck();

    expect(result.statuses[0]!.state).toBe('warn'); // 5j restants, sous seuil 7j → warn
    expect(result.notificationsSent).toBe(0); // Dedup dit non
  });

  it('compte les notifications quand shouldNotify = true', async () => {
    vi.mocked(shouldNotify).mockReturnValue(true);

    const items = MONITORED_ITEMS as MonitoredItem[];
    items.push(
      makeItem({
        id: 'warn_item',
        thresholdsDays: [30, 7],
        getExpiresAt: async () => daysFromNow(5),
      }),
    );

    const result = await runHealthCheck();

    // State = warn ou critical, thresholdHit = 7 → shouldNotify appelé → 1 notification
    expect(result.notificationsSent).toBe(1);
  });

  it('ne notifie pas les items ok', async () => {
    vi.mocked(shouldNotify).mockReturnValue(true);

    const items = MONITORED_ITEMS as MonitoredItem[];
    items.push(
      makeItem({ id: 'ok_item', getExpiresAt: async () => daysFromNow(90) }),
    );

    const result = await runHealthCheck();

    expect(result.notificationsSent).toBe(0);
    expect(result.statuses[0]!.state).toBe('ok');
  });

  it('ne notifie pas les items unknown (thresholdHit = null)', async () => {
    vi.mocked(shouldNotify).mockReturnValue(true);

    const items = MONITORED_ITEMS as MonitoredItem[];
    items.push(
      makeItem({ id: 'unknown_item', getExpiresAt: async () => null }),
    );

    const result = await runHealthCheck();

    expect(result.notificationsSent).toBe(0);
    expect(result.statuses[0]!.state).toBe('unknown');
  });

  it('mesure la durée du health check', async () => {
    const items = MONITORED_ITEMS as MonitoredItem[];
    items.push(
      makeItem({ id: 'slow_item', getExpiresAt: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return daysFromNow(90);
      }}),
    );

    const result = await runHealthCheck();

    expect(result.durationMs).toBeGreaterThanOrEqual(40);
  });
});
