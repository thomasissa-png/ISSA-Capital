/**
 * Tests monitored-items — health-monitor.
 *
 * Vérifie le registre des 3 items OAuth V1.
 * Jalon S15.5E — Task A.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Mock fs.existsSync pour forcer le fallback /tmp/issa-data/
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (p: string) => {
      if (p === '/home/runner') return false;
      return actual.existsSync(p);
    },
  };
});

describe('monitored-items', () => {
  const EFFECTIVE_STORE_PATH = resolve('/tmp/issa-data', 'oauth-timestamps.json');
  let backupExists = false;
  let backupContent = '';

  beforeEach(() => {
    try {
      if (existsSync(EFFECTIVE_STORE_PATH)) {
        backupExists = true;
        backupContent = readFileSync(EFFECTIVE_STORE_PATH, 'utf-8');
      }
    } catch {
      backupExists = false;
    }
    try {
      rmSync(EFFECTIVE_STORE_PATH, { force: true });
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    try {
      if (backupExists) {
        mkdirSync('/tmp/issa-data', { recursive: true });
        writeFileSync(EFFECTIVE_STORE_PATH, backupContent, 'utf-8');
      } else {
        rmSync(EFFECTIVE_STORE_PATH, { force: true });
      }
    } catch {
      // ignore
    }
  });

  async function importModule() {
    vi.resetModules();
    return import('../monitored-items');
  }

  // ============================================================
  // Structure du registre
  // ============================================================

  it('exporte 8 items (3 OAuth + 4 Task B + 1 quota DeepSeek S25)', async () => {
    const { MONITORED_ITEMS } = await importModule();
    expect(MONITORED_ITEMS).toHaveLength(8);
  });

  it('contient deepseek_monthly_quota (item S25 — audit reviewer)', async () => {
    const { MONITORED_ITEMS } = await importModule();
    const item = MONITORED_ITEMS.find((i) => i.id === 'deepseek_monthly_quota');
    expect(item).toBeDefined();
    expect(item!.category).toBe('quota');
    expect(typeof item!.getHealthCheck).toBe('function');
  });

  it('les 3 premiers items ont la catégorie oauth', async () => {
    const { MONITORED_ITEMS } = await importModule();
    const oauthItems = MONITORED_ITEMS.filter((i) => i.category === 'oauth');
    expect(oauthItems).toHaveLength(3);
  });

  it('IDs uniques', async () => {
    const { MONITORED_ITEMS } = await importModule();
    const ids = MONITORED_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contient ticktick_access_token avec thresholds [30,7,1]', async () => {
    const { MONITORED_ITEMS } = await importModule();
    const item = MONITORED_ITEMS.find((i) => i.id === 'ticktick_access_token');
    expect(item).toBeDefined();
    expect(item!.thresholdsDays).toEqual([30, 7, 1]);
    expect(item!.renewalUrl).toContain('ticktick/oauth/init');
  });

  it('contient gmail_oauth_consent avec thresholds [60,14,3]', async () => {
    const { MONITORED_ITEMS } = await importModule();
    const item = MONITORED_ITEMS.find((i) => i.id === 'gmail_oauth_consent');
    expect(item).toBeDefined();
    expect(item!.thresholdsDays).toEqual([60, 14, 3]);
    expect(item!.renewalUrl).toBeUndefined();
  });

  it('contient drive_oauth_consent avec thresholds [60,14,3]', async () => {
    const { MONITORED_ITEMS } = await importModule();
    const item = MONITORED_ITEMS.find((i) => i.id === 'drive_oauth_consent');
    expect(item).toBeDefined();
    expect(item!.thresholdsDays).toEqual([60, 14, 3]);
    expect(item!.renewalUrl).toBeUndefined();
  });

  // ============================================================
  // getExpiresAt fonctionne via les items
  // ============================================================

  it('getExpiresAt retourne null pour les 3 OAuth items si aucun timestamp enregistré', async () => {
    const { MONITORED_ITEMS } = await importModule();
    const oauthItems = MONITORED_ITEMS.filter((i) => i.category === 'oauth');
    for (const item of oauthItems) {
      const expires = await item.getExpiresAt();
      expect(expires).toBeNull();
    }
  });

  it('getExpiresAt ticktick retourne une date après recordOAuthCallback', async () => {
    // Poser un timestamp
    const oauthMod = await (async () => {
      vi.resetModules();
      return import('../oauth-timestamps');
    })();
    oauthMod.recordOAuthCallback('ticktick');

    const { MONITORED_ITEMS } = await importModule();
    const item = MONITORED_ITEMS.find((i) => i.id === 'ticktick_access_token')!;
    const expires = await item.getExpiresAt();
    expect(expires).toBeInstanceOf(Date);
    // Doit être dans ~180 jours
    const daysRemaining = (expires!.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysRemaining).toBeGreaterThan(179);
    expect(daysRemaining).toBeLessThanOrEqual(180);
  });
});
