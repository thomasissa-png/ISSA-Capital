/**
 * Tests dedup-store — health-monitor.
 *
 * Utilise /tmp/issa-data/ (fallback via mock existsSync('/home/runner') → false).
 * Jalon S15.5E — Task B.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// Mock existsSync pour forcer fallback /tmp/issa-data/
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

describe('dedup-store', () => {
  const STORE_PATH = resolve('/tmp/issa-data', 'notifications-sent.json');

  let backupExists = false;
  let backupContent = '';

  beforeEach(() => {
    try {
      if (existsSync(STORE_PATH)) {
        backupExists = true;
        backupContent = readFileSync(STORE_PATH, 'utf-8');
      }
    } catch {
      backupExists = false;
    }
    try {
      rmSync(STORE_PATH, { force: true });
    } catch {
      // ignore
    }
    vi.resetModules();
  });

  afterEach(() => {
    if (backupExists) {
      if (!existsSync('/tmp/issa-data')) {
        mkdirSync('/tmp/issa-data', { recursive: true });
      }
      writeFileSync(STORE_PATH, backupContent, 'utf-8');
    } else {
      try {
        rmSync(STORE_PATH, { force: true });
      } catch {
        // ignore
      }
    }
  });

  async function getModule() {
    return import('../dedup-store');
  }

  // ----------------------------------------------------------
  // shouldNotify
  // ----------------------------------------------------------

  it('shouldNotify retourne true si jamais notifié', async () => {
    const { shouldNotify } = await getModule();
    expect(shouldNotify('ticktick_access_token', 30)).toBe(true);
  });

  it('shouldNotify retourne false après markNotified', async () => {
    const { shouldNotify, markNotified } = await getModule();

    markNotified('ticktick_access_token', 30);
    expect(shouldNotify('ticktick_access_token', 30)).toBe(false);
  });

  it('shouldNotify différencie les thresholds', async () => {
    const { shouldNotify, markNotified } = await getModule();

    markNotified('ticktick_access_token', 30);
    // Même item, threshold différent → true
    expect(shouldNotify('ticktick_access_token', 7)).toBe(true);
    // Même threshold → false
    expect(shouldNotify('ticktick_access_token', 30)).toBe(false);
  });

  // ----------------------------------------------------------
  // snooze
  // ----------------------------------------------------------

  it('snooze empêche shouldNotify pendant la durée du snooze', async () => {
    const { shouldNotify, markNotified, snooze } = await getModule();

    markNotified('domain_renewal', 30);
    markNotified('domain_renewal', 7);

    // Snooze 3 jours
    snooze('domain_renewal', 3);

    // Les deux thresholds sont snoozés
    expect(shouldNotify('domain_renewal', 30)).toBe(false);
    expect(shouldNotify('domain_renewal', 7)).toBe(false);
  });

  it('shouldNotify retourne true quand le snooze a expiré', async () => {
    const { shouldNotify, markNotified, snooze, loadStore, saveStore } = await getModule();

    markNotified('domain_renewal', 30);
    snooze('domain_renewal', 1); // Snooze 1 jour

    // Manipuler le store pour simuler que le snooze est expiré
    const store = loadStore();
    const key = 'domain_renewal:30';
    if (store[key]) {
      store[key].snoozedUntil = Date.now() - 1000; // Expiré il y a 1s
    }
    saveStore(store);

    expect(shouldNotify('domain_renewal', 30)).toBe(true);
  });

  // ----------------------------------------------------------
  // resetItem
  // ----------------------------------------------------------

  it('resetItem supprime toutes les entries de l\'item', async () => {
    const { shouldNotify, markNotified, resetItem } = await getModule();

    markNotified('ticktick_access_token', 30);
    markNotified('ticktick_access_token', 7);
    markNotified('ticktick_access_token', 1);

    // Vérifier qu'ils sont marqués
    expect(shouldNotify('ticktick_access_token', 30)).toBe(false);
    expect(shouldNotify('ticktick_access_token', 7)).toBe(false);

    // Reset
    resetItem('ticktick_access_token');

    // Tout doit être réinitialisé
    expect(shouldNotify('ticktick_access_token', 30)).toBe(true);
    expect(shouldNotify('ticktick_access_token', 7)).toBe(true);
    expect(shouldNotify('ticktick_access_token', 1)).toBe(true);
  });

  it('resetItem ne touche pas les autres items', async () => {
    const { shouldNotify, markNotified, resetItem } = await getModule();

    markNotified('ticktick_access_token', 30);
    markNotified('domain_renewal', 30);

    resetItem('ticktick_access_token');

    // ticktick réinitialisé
    expect(shouldNotify('ticktick_access_token', 30)).toBe(true);
    // domain_renewal inchangé
    expect(shouldNotify('domain_renewal', 30)).toBe(false);
  });

  // ----------------------------------------------------------
  // TTL auto-purge
  // ----------------------------------------------------------

  it('auto-purge les entries > 1 an lors de saveStore', async () => {
    const { loadStore, saveStore } = await getModule();

    // Créer une entry vieille de 2 ans
    const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
    const store = loadStore();
    store['old_item:30'] = { sentAt: twoYearsAgo, snoozedUntil: null };
    store['recent_item:30'] = { sentAt: Date.now(), snoozedUntil: null };
    saveStore(store);

    // Relire le store — l'entry vieille doit avoir été purgée
    const afterSave = loadStore();
    expect(afterSave).not.toHaveProperty('old_item:30');
    expect(afterSave).toHaveProperty('recent_item:30');
  });

  // ----------------------------------------------------------
  // Robustesse
  // ----------------------------------------------------------

  it('gère un fichier corrompu gracieusement', async () => {
    if (!existsSync('/tmp/issa-data')) {
      mkdirSync('/tmp/issa-data', { recursive: true });
    }
    writeFileSync(STORE_PATH, 'not-json!!!', 'utf-8');

    const { shouldNotify } = await getModule();
    // Doit retourner true (store vide → jamais notifié)
    expect(shouldNotify('test_item', 30)).toBe(true);
  });
});
