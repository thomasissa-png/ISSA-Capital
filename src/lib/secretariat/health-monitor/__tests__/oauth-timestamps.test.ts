/**
 * Tests oauth-timestamps — health-monitor.
 *
 * Utilise un répertoire temporaire pour isoler les tests du store réel.
 * Jalon S15.5E — Task A.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================
// Mock du module pour rediriger le store vers un répertoire temp
// ============================================================

// Mock fs.existsSync pour rediriger '/home/runner' check
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    // Override existsSync pour le pattern STORE_DIR
    existsSync: (p: string) => {
      if (p === '/home/runner') return false; // Force fallback /tmp/issa-data
      return actual.existsSync(p);
    },
  };
});

// Nous devons aussi mocker le chemin du store.
// Le module utilise des constantes calculées au top-level,
// donc on re-importe après mock.
// Approche : on mock le module entier en important les fonctions d'origine
// et en les testant via un store temporaire.

// Plutôt que mocker le filesystem, on va tester les fonctions en utilisant
// le store réel (qui pointe vers /tmp/issa-data/ grâce au mock ci-dessus).

describe('oauth-timestamps', () => {
  // Chemin effectif du store après mock (fallback /tmp/issa-data/)
  const EFFECTIVE_STORE_PATH = resolve('/tmp/issa-data', 'oauth-timestamps.json');
  let backupExists = false;
  let backupContent = '';

  beforeEach(() => {
    // Sauvegarder le store existant s'il existe
    try {
      if (existsSync(EFFECTIVE_STORE_PATH)) {
        backupExists = true;
        // Note: existsSync est mocké mais le path n'est pas '/home/runner'
        // On utilise readFileSync directement (non mocké)
        backupContent = readFileSync(EFFECTIVE_STORE_PATH, 'utf-8');
      }
    } catch {
      backupExists = false;
    }

    // Nettoyer le store avant chaque test
    try {
      rmSync(EFFECTIVE_STORE_PATH, { force: true });
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    // Restaurer le store original
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

  // Import dynamique pour que le mock fs soit actif
  async function importModule() {
    // Purger le cache pour chaque test
    vi.resetModules();
    return import('../oauth-timestamps');
  }

  // ============================================================
  // recordOAuthCallback
  // ============================================================

  it('recordOAuthCallback pose obtainedAt et lastUsedAt', async () => {
    const mod = await importModule();
    const before = Date.now();
    mod.recordOAuthCallback('ticktick');
    const after = Date.now();

    const ts = mod.getOAuthTimestamps('ticktick');
    expect(ts).not.toBeNull();
    expect(ts!.obtainedAt).not.toBeNull();
    expect(ts!.lastUsedAt).not.toBeNull();

    const obtainedMs = new Date(ts!.obtainedAt!).getTime();
    expect(obtainedMs).toBeGreaterThanOrEqual(before);
    expect(obtainedMs).toBeLessThanOrEqual(after);
    expect(ts!.obtainedAt).toBe(ts!.lastUsedAt);
  });

  // ============================================================
  // recordOAuthUsage throttle
  // ============================================================

  it('recordOAuthUsage throttle : 2 appels < 24h = 1 seule écriture', async () => {
    const mod = await importModule();
    mod.recordOAuthCallback('gmail'); // initialise

    const firstWrite = mod.recordOAuthUsage('gmail');
    // Le callback vient de poser lastUsedAt, donc l'usage est throttlé
    expect(firstWrite).toBe(false);

    // Deuxième appel immédiat — toujours throttlé
    const secondWrite = mod.recordOAuthUsage('gmail');
    expect(secondWrite).toBe(false);
  });

  it('recordOAuthUsage écrit si lastUsedAt > 24h', async () => {
    // Poser un timestamp vieux de 25h manuellement
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    mkdirSync('/tmp/issa-data', { recursive: true });
    writeFileSync(
      EFFECTIVE_STORE_PATH,
      JSON.stringify({ gmail: { obtainedAt: oldDate, lastUsedAt: oldDate } }),
      'utf-8',
    );

    const mod2 = await importModule();
    const wrote = mod2.recordOAuthUsage('gmail');
    expect(wrote).toBe(true);

    const ts = mod2.getOAuthTimestamps('gmail');
    expect(ts!.lastUsedAt).not.toBe(oldDate);
  });

  // ============================================================
  // getExpiresAt
  // ============================================================

  it('getExpiresAt ticktick = obtainedAt + 180j', async () => {
    const mod = await importModule();
    mod.recordOAuthCallback('ticktick');

    const ts = mod.getOAuthTimestamps('ticktick');
    const expires = mod.getExpiresAt('ticktick');

    expect(expires).not.toBeNull();
    const expectedMs = new Date(ts!.obtainedAt!).getTime() + 180 * 24 * 60 * 60 * 1000;
    expect(expires!.getTime()).toBe(expectedMs);
  });

  it('getExpiresAt gmail = lastUsedAt + 180j', async () => {
    const mod = await importModule();
    mod.recordOAuthCallback('gmail');

    const ts = mod.getOAuthTimestamps('gmail');
    const expires = mod.getExpiresAt('gmail');

    expect(expires).not.toBeNull();
    const expectedMs = new Date(ts!.lastUsedAt!).getTime() + 180 * 24 * 60 * 60 * 1000;
    expect(expires!.getTime()).toBe(expectedMs);
  });

  it('getExpiresAt drive = lastUsedAt + 180j', async () => {
    const mod = await importModule();
    mod.recordOAuthCallback('drive');

    const ts = mod.getOAuthTimestamps('drive');
    const expires = mod.getExpiresAt('drive');

    expect(expires).not.toBeNull();
    const expectedMs = new Date(ts!.lastUsedAt!).getTime() + 180 * 24 * 60 * 60 * 1000;
    expect(expires!.getTime()).toBe(expectedMs);
  });

  // ============================================================
  // Fichier absent → init vide
  // ============================================================

  it('fichier absent → getOAuthTimestamps retourne null', async () => {
    const mod = await importModule();
    const ts = mod.getOAuthTimestamps('ticktick');
    expect(ts).toBeNull();
  });

  it('getExpiresAt retourne null si pas d\'enregistrement', async () => {
    const mod = await importModule();
    expect(mod.getExpiresAt('ticktick')).toBeNull();
    expect(mod.getExpiresAt('gmail')).toBeNull();
    expect(mod.getExpiresAt('drive')).toBeNull();
  });

  // ============================================================
  // Fichier corrompu → fallback
  // ============================================================

  it('fichier corrompu → fallback {} (pas de crash)', async () => {
    mkdirSync('/tmp/issa-data', { recursive: true });
    writeFileSync(EFFECTIVE_STORE_PATH, 'NOT JSON {{{{', 'utf-8');

    const mod = await importModule();
    const ts = mod.getOAuthTimestamps('ticktick');
    expect(ts).toBeNull();

    // L'écriture fonctionne quand même
    mod.recordOAuthCallback('ticktick');
    const ts2 = mod.getOAuthTimestamps('ticktick');
    expect(ts2).not.toBeNull();
    expect(ts2!.obtainedAt).not.toBeNull();
  });

  it('fichier contenant un array → fallback {} (pas un objet)', async () => {
    mkdirSync('/tmp/issa-data', { recursive: true });
    writeFileSync(EFFECTIVE_STORE_PATH, '[1,2,3]', 'utf-8');

    const mod = await importModule();
    const ts = mod.getOAuthTimestamps('gmail');
    expect(ts).toBeNull();
  });
});
