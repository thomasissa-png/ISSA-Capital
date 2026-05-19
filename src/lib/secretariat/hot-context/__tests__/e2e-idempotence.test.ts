/**
 * Test E2E idempotence — un même signal scanné 2 fois ne produit qu'1 patch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Idempotence E2E — même signal 2× = 1 patch', () => {
  it('1er scan → 1 patch ; 2e scan avec processedSignals MAJ → 0 patch', async () => {
    const tgSignal: Signal = {
      source: 'telegram',
      sourceId: 'e2e-1',
      contentExcerpt: '#hotcontext priorité [[E2E]]',
      contextMeta: {},
    };

    // 1er run : Haiku produit un patch
    const detected = {
      patchId: 'p-e2e',
      signalId: 'sig-e2e',
      section: 'bouge' as const,
      action: 'add' as const,
      payload: { text: '[[E2E]]' },
      source: 'telegram' as const,
      sourceId: 'e2e-1',
      proposedAt: '2026-05-19T10:00:00Z',
      rationale: 'test E2E',
    };
    vi.mocked(detectSignal).mockResolvedValueOnce({
      patch: detected,
      confidence: 0.9,
      reasonIfNull: '',
    });

    const state1 = emptyHotContextState();
    const r1 = await scanForPatches({ state: state1, telegramSignals: [tgSignal] });
    expect(r1.patches).toHaveLength(1);

    // Simule l'enregistrement du signal après application Telegram → state
    const state2 = emptyHotContextState();
    state2.processedSignals['sig-e2e'] = {
      signalId: 'sig-e2e',
      processedAt: '2026-05-19T10:01:00Z',
      outcome: 'patched',
    };

    // 2e run : Haiku reproduirait le même patch, mais le scanner skip
    vi.mocked(detectSignal).mockResolvedValueOnce({
      patch: detected,
      confidence: 0.9,
      reasonIfNull: '',
    });

    const r2 = await scanForPatches({ state: state2, telegramSignals: [tgSignal] });
    expect(r2.patches).toHaveLength(0);
    expect(r2.skippedAlreadyProcessed).toBeGreaterThan(0);
  });
});
