/**
 * Tests state-store hot-context — token absent + mutex.
 *
 * Les tests d'écriture Drive réels seront couverts en post-merge avec OAuth
 * Thomas (R6). On valide ici le comportement gracieux sans token.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  loadHotContextState,
  saveHotContextState,
  _resetHotContextLockForTests,
} from '../state-store';
import { emptyHotContextState } from '../types';

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn(async () => null),
  getOrCreateSubfolder: vi.fn(async () => null),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  resolvePath: vi.fn(async () => ({ success: false })),
}));

beforeEach(() => {
  _resetHotContextLockForTests();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('loadHotContextState — token absent', () => {
  it('retourne emptyHotContextState() si pas de token OAuth2', async () => {
    const s = await loadHotContextState();
    expect(s.schemaVersion).toBe(1);
    expect(s.processedSignals).toEqual({});
    expect(s.pendingPatches).toEqual({});
    expect(s.lastFileTokensEstimate).toBe(0);
  });

  it('chaque appel retourne un nouvel objet (pas de cache partagé)', async () => {
    const a = await loadHotContextState();
    const b = await loadHotContextState();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('saveHotContextState — token absent', () => {
  it('retourne false si pas de token', async () => {
    const s = emptyHotContextState();
    s.processedSignals['sig1'] = {
      signalId: 'sig1',
      processedAt: '2026-05-19T10:00:00Z',
      outcome: 'patched',
    };
    const result = await saveHotContextState(s);
    expect(result).toBe(false);
  });
});

describe('state-store hot-context — mutex', () => {
  it('sérialise correctement plusieurs appels concurrents', async () => {
    const results = await Promise.all([
      loadHotContextState(),
      loadHotContextState(),
      loadHotContextState(),
    ]);
    expect(results).toHaveLength(3);
    results.forEach((r) => expect(r.schemaVersion).toBe(1));
  });
});
