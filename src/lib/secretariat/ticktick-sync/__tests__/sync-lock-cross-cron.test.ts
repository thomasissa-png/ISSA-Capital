/**
 * Test E2E mocké — verrou cross-cron push ↔ pull.
 *
 * Scénario spec (S18.2 verrou syncLock TTL 30s) :
 *   1. Cron push démarre → acquire lock (kind='push')
 *   2. Cron pull démarre 5s plus tard → MUST skip avec reason 'sync_lock_busy'
 *   3. Push libère le lock → pull suivant doit s'exécuter normalement
 *   4. Cas symétrique : pull qui tourne bloque push concurrent
 *   5. TTL 30s expiré → lock auto-libéré (zombie protection)
 *
 * On teste directement via tryAcquireSyncLock + releaseSyncLock (pull-engine.ts)
 * pour rester rapide et déterministe — l'intégration HTTP est couverte par les
 * tests de route séparés.
 */

import { describe, it, expect } from 'vitest';
import {
  tryAcquireSyncLock,
  releaseSyncLock,
  _pullEngineInternals,
} from '../pull-engine';
import { emptyState } from '../types';

describe('Verrou cross-cron push ↔ pull (red line — concurrence)', () => {
  it('push acquire lock, pull 5s plus tard DOIT skip', () => {
    const state = emptyState();
    const t0 = new Date('2026-05-19T10:00:00Z');
    const t5 = new Date('2026-05-19T10:00:05Z');

    // 1. Push démarre — acquire OK
    const pushAck = tryAcquireSyncLock(state, 'push', t0);
    expect(pushAck).toBe(true);
    expect(state.syncLock?.kind).toBe('push');

    // 2. Pull démarre 5s plus tard — DOIT échouer (lock-held)
    const pullAck = tryAcquireSyncLock(state, 'pull', t5);
    expect(pullAck).toBe(false);
    // Le lock initial est préservé
    expect(state.syncLock?.kind).toBe('push');
  });

  it('après release, pull suivant DOIT s\'exécuter normalement', () => {
    const state = emptyState();
    const t0 = new Date('2026-05-19T10:00:00Z');
    const t5 = new Date('2026-05-19T10:00:05Z');
    const t10 = new Date('2026-05-19T10:00:10Z');

    // Push acquire
    tryAcquireSyncLock(state, 'push', t0);
    // Pull bloqué pendant le push
    expect(tryAcquireSyncLock(state, 'pull', t5)).toBe(false);
    // Push se termine
    releaseSyncLock(state);
    expect(state.syncLock).toBeUndefined();
    // Pull suivant peut acquérir
    expect(tryAcquireSyncLock(state, 'pull', t10)).toBe(true);
    expect(state.syncLock?.kind).toBe('pull');
  });

  it('pull qui tourne bloque push concurrent (symétrique)', () => {
    const state = emptyState();
    const t0 = new Date('2026-05-19T10:00:00Z');
    const t5 = new Date('2026-05-19T10:00:05Z');

    expect(tryAcquireSyncLock(state, 'pull', t0)).toBe(true);
    expect(state.syncLock?.kind).toBe('pull');
    // Push concurrent → bloqué
    expect(tryAcquireSyncLock(state, 'push', t5)).toBe(false);
    expect(state.syncLock?.kind).toBe('pull');
  });

  it('TTL 30s : lock zombie libéré automatiquement après expiration', () => {
    const ttlMs = _pullEngineInternals.SYNC_LOCK_TTL_MS;
    expect(ttlMs).toBe(30_000);

    const state = emptyState();
    const t0 = new Date('2026-05-19T10:00:00Z');
    // Push lock posé à t0
    tryAcquireSyncLock(state, 'push', t0);

    // À t0 + 29s : encore bloqué
    const t29 = new Date(t0.getTime() + 29_000);
    expect(tryAcquireSyncLock(state, 'pull', t29)).toBe(false);

    // À t0 + 31s : TTL expiré → pull peut prendre le lock
    const t31 = new Date(t0.getTime() + 31_000);
    expect(tryAcquireSyncLock(state, 'pull', t31)).toBe(true);
    expect(state.syncLock?.kind).toBe('pull');
  });

  it('lockAcquiredAt corrompu (NaN) → considère expiré (fail-open)', () => {
    const state = emptyState();
    state.syncLock = { kind: 'push', lockAcquiredAt: 'not-a-date' };
    // Date invalide → on considère le lock comme libre (pas de blocage indéfini)
    const result = tryAcquireSyncLock(state, 'pull', new Date('2026-05-19T10:00:00Z'));
    expect(result).toBe(true);
    expect(state.syncLock?.kind).toBe('pull');
  });

  it('releaseSyncLock idempotent — peut être appelé sans lock posé', () => {
    const state = emptyState();
    expect(state.syncLock).toBeUndefined();
    releaseSyncLock(state); // no-op safe
    expect(state.syncLock).toBeUndefined();
  });

  it('série de 3 crons alternés respecte ordre strict push→pull→push', () => {
    const state = emptyState();
    let now = new Date('2026-05-19T10:00:00Z');

    // Cron 1 : push
    expect(tryAcquireSyncLock(state, 'push', now)).toBe(true);
    releaseSyncLock(state);

    // Cron 2 : pull (10s plus tard)
    now = new Date(now.getTime() + 10_000);
    expect(tryAcquireSyncLock(state, 'pull', now)).toBe(true);
    releaseSyncLock(state);

    // Cron 3 : push (20s plus tard)
    now = new Date(now.getTime() + 10_000);
    expect(tryAcquireSyncLock(state, 'push', now)).toBe(true);
    releaseSyncLock(state);
  });
});
