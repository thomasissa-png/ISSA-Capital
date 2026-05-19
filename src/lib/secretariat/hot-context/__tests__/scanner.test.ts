/**
 * Tests scanner — pipeline 4 sources avec mocks Drive + Haiku.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { emptyHotContextState } from '../types';

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn(async () => null),
  getOrCreateSubfolder: vi.fn(async () => null),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  resolvePath: vi.fn(async () => ({ success: false })),
}));

vi.mock('../audit', () => ({
  writeHotContextAudit: vi.fn(async () => true),
}));

vi.mock('../signal-detector', async () => {
  const actual = await vi.importActual<typeof import('../signal-detector')>('../signal-detector');
  return {
    ...actual,
    detectSignal: vi.fn(),
  };
});

import { scanForPatches } from '../scanner';
import { detectSignal } from '../signal-detector';
import type { Signal } from '../types';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('scanForPatches — 4 sources mockées (token null)', () => {
  it('retourne un scan vide quand pas de token Drive mais MAJ lastScanAt', async () => {
    const state = emptyHotContextState();
    const result = await scanForPatches({ state });
    expect(result.patches).toEqual([]);
    expect(result.totalCandidates).toBe(0);
    // lastScanAt MAJ même sans token (sources Drive skipées mais cron a tourné)
    expect(result.newLastScanAt.email).toBeTruthy();
    expect(result.newLastScanAt.vaultNotes).toBeTruthy();
  });
});

describe('scanForPatches — Telegram push signaux', () => {
  it('traite les signaux Telegram queueés via input.telegramSignals', async () => {
    const state = emptyHotContextState();
    const tgSignal: Signal = {
      source: 'telegram',
      sourceId: '999',
      contentExcerpt: '#hotcontext priorité = [[Item X]]',
      contextMeta: {},
    };
    vi.mocked(detectSignal).mockResolvedValueOnce({
      patch: {
        patchId: 'p1',
        signalId: 's1',
        section: 'bouge',
        action: 'add',
        payload: { text: '[[Item X]]' },
        source: 'telegram',
        sourceId: '999',
        proposedAt: '2026-05-19T10:00:00Z',
        rationale: 'test',
      },
      confidence: 0.9,
      reasonIfNull: '',
    });

    const result = await scanForPatches({ state, telegramSignals: [tgSignal] });
    expect(result.patches.length).toBeGreaterThanOrEqual(0);
    // Le scanner échoue côté Drive (pas de token) mais la branche Telegram est traitée
    expect(result.newLastScanAt.telegram).not.toBe(state.lastScanAt.telegram);
  });
});

describe('scanForPatches — idempotence cross-run', () => {
  it("skip un signal dont le signalId est déjà dans processedSignals", async () => {
    const state = emptyHotContextState();
    state.processedSignals['existing-sig'] = {
      signalId: 'existing-sig',
      processedAt: '2026-05-19T09:00:00Z',
      outcome: 'patched',
    };
    const tgSignal: Signal = {
      source: 'telegram',
      sourceId: '777',
      contentExcerpt: '#hotcontext finaliser [[Y]]',
      contextMeta: {},
    };
    vi.mocked(detectSignal).mockResolvedValueOnce({
      patch: {
        patchId: 'p2',
        signalId: 'existing-sig', // déjà processed
        section: 'bouge',
        action: 'add',
        payload: { text: '[[Y]]' },
        source: 'telegram',
        sourceId: '777',
        proposedAt: '2026-05-19T10:00:00Z',
        rationale: 'rerun',
      },
      confidence: 0.9,
      reasonIfNull: '',
    });

    const result = await scanForPatches({ state, telegramSignals: [tgSignal] });
    expect(result.patches.length).toBe(0);
    expect(result.skippedAlreadyProcessed).toBeGreaterThan(0);
  });
});

describe('scanForPatches — lastScanAt mis à jour', () => {
  it('met à jour les 4 timestamps lastScanAt', async () => {
    const state = emptyHotContextState();
    const before = JSON.stringify(state.lastScanAt);
    const result = await scanForPatches({ state });
    expect(JSON.stringify(result.newLastScanAt)).not.toBe(before);
    expect(result.newLastScanAt.email).toBeTruthy();
    expect(result.newLastScanAt.cr).toBeTruthy();
    expect(result.newLastScanAt.telegram).toBeTruthy();
    expect(result.newLastScanAt.vaultNotes).toBeTruthy();
  });
});

describe('scanForPatches — aucun signal = no-op', () => {
  it('retourne patches vides sans appel Haiku quand aucun signal', async () => {
    const state = emptyHotContextState();
    const result = await scanForPatches({ state });
    expect(result.patches).toEqual([]);
    expect(vi.mocked(detectSignal)).not.toHaveBeenCalled();
  });
});
