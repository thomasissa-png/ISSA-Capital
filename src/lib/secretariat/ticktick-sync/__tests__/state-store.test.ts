/**
 * Tests state-store — comportement sans accès Drive (token null).
 *
 * Les tests d'écriture/lecture Drive réels sont reportés en S18.3 (E2E
 * avec OAuth Thomas). On valide ici :
 *   - chargement sans token → emptyState()
 *   - sauvegarde sans token → false (skip gracieux)
 *   - mutex sérialise correctement
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  loadSyncState,
  saveSyncState,
  _resetStateStoreLockForTests,
} from '../state-store';
import { emptyState } from '../types';

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn(async () => null),
  getOrCreateSubfolder: vi.fn(async () => null),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  resolvePath: vi.fn(async () => ({ success: false })),
}));

beforeEach(() => {
  _resetStateStoreLockForTests();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('loadSyncState — token absent', () => {
  it('retourne emptyState() si pas de token OAuth2', async () => {
    const s = await loadSyncState();
    expect(s.version).toBe(1);
    expect(s.tasks).toEqual({});
    expect(s.projects).toEqual({});
  });

  it('chaque appel reste cohérent (pas de mutation cachée)', async () => {
    const a = await loadSyncState();
    const b = await loadSyncState();
    expect(a).not.toBe(b); // instances différentes
    expect(a).toEqual(b);
  });
});

describe('saveSyncState — token absent', () => {
  it('retourne false si pas de token', async () => {
    const s = emptyState();
    s.projects.Personnel = 'p1';
    const result = await saveSyncState(s);
    expect(result).toBe(false);
  });
});

describe('state-store — mutex', () => {
  it('sérialise correctement plusieurs appels concurrents', async () => {
    const promises = [loadSyncState(), loadSyncState(), loadSyncState()];
    const results = await Promise.all(promises);
    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(r.version).toBe(1);
    });
  });
});
