/**
 * Tests handler Telegram hot-context — parsing callback + dispatch actions.
 *
 * R4 (P1 #97) : test E2E pour vérifier callback `hotcontext:` correctement
 * dispatché (responsabilité du webhook/route.ts — testé séparément).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseHotContextCallback,
  handleHotContextPatchCallback,
  purgeExpiredPendings,
  HOT_CONTEXT_CALLBACK_PREFIX,
  HOT_CONTEXT_PENDING_TTL_MS,
} from '../hot-context-patch';
import { emptyHotContextState } from '../../../hot-context/types';

vi.mock('../../telegram-cards', () => ({
  editMessageText: vi.fn(async () => true),
  sendSimpleMessage: vi.fn(async () => undefined),
}));

vi.mock('../../../telegram', () => ({
  answerCallbackQuery: vi.fn(async () => undefined),
}));

vi.mock('../../../hot-context/state-store', () => ({
  loadHotContextState: vi.fn(),
  saveHotContextState: vi.fn(async () => true),
}));

vi.mock('../../../hot-context/applier', () => ({
  applyPatchToDrive: vi.fn(),
  renderPatchLine: vi.fn(() => '- [[X]]'),
}));

vi.mock('../../../hot-context/audit', () => ({
  writeHotContextAudit: vi.fn(async () => true),
}));

import { loadHotContextState, saveHotContextState } from '../../../hot-context/state-store';
import { applyPatchToDrive } from '../../../hot-context/applier';
import type { Patch } from '../../../hot-context/types';

function makePending(patchId: string, proposedAt: string): {
  patchId: string;
  patch: Patch;
  proposedAt: string;
} {
  return {
    patchId,
    proposedAt,
    patch: {
      patchId,
      signalId: `sig-${patchId}`,
      section: 'bouge',
      action: 'add',
      payload: { text: '[[X]]' },
      source: 'telegram',
      sourceId: '123',
      proposedAt,
      rationale: 'test',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('parseHotContextCallback', () => {
  it('parse les 3 actions valides', () => {
    expect(parseHotContextCallback(`${HOT_CONTEXT_CALLBACK_PREFIX}valid:p1`)).toEqual({
      action: 'valid',
      patchId: 'p1',
    });
    expect(parseHotContextCallback(`${HOT_CONTEXT_CALLBACK_PREFIX}modify:p1`)).toEqual({
      action: 'modify',
      patchId: 'p1',
    });
    expect(parseHotContextCallback(`${HOT_CONTEXT_CALLBACK_PREFIX}skip:p1`)).toEqual({
      action: 'skip',
      patchId: 'p1',
    });
  });

  it('rejette un préfixe inconnu', () => {
    expect(parseHotContextCallback('other:valid:p1')).toBeNull();
    expect(parseHotContextCallback(`${HOT_CONTEXT_CALLBACK_PREFIX}unknown:p1`)).toBeNull();
    expect(parseHotContextCallback(`${HOT_CONTEXT_CALLBACK_PREFIX}valid:`)).toBeNull();
  });
});

describe('purgeExpiredPendings — R3 TTL 7j', () => {
  it('supprime les pendings > 7j', () => {
    const state = emptyHotContextState();
    const old = new Date(Date.now() - HOT_CONTEXT_PENDING_TTL_MS - 1000).toISOString();
    const fresh = new Date().toISOString();
    state.pendingPatches['old'] = makePending('old', old);
    state.pendingPatches['fresh'] = makePending('fresh', fresh);
    const purged = purgeExpiredPendings(state);
    expect(purged).toBe(1);
    expect(state.pendingPatches['old']).toBeUndefined();
    expect(state.pendingPatches['fresh']).toBeDefined();
  });
});

describe('handleHotContextPatchCallback — valid', () => {
  it('applique le patch et passe outcome=patched', async () => {
    const state = emptyHotContextState();
    state.pendingPatches['p1'] = makePending('p1', new Date().toISOString());
    vi.mocked(loadHotContextState).mockResolvedValue(state);
    vi.mocked(applyPatchToDrive).mockResolvedValue({
      success: true,
      fileTokensBefore: 100,
      fileTokensAfter: 110,
      capWarnTriggered: false,
    });

    const result = await handleHotContextPatchCallback({
      callback_query_id: 'cb1',
      data: `${HOT_CONTEXT_CALLBACK_PREFIX}valid:p1`,
      message_id: 42,
      chat_id: 555,
    });

    expect(result).toBe('patched');
    expect(vi.mocked(saveHotContextState)).toHaveBeenCalled();
    expect(state.processedSignals['sig-p1']?.outcome).toBe('patched');
  });
});

describe('handleHotContextPatchCallback — modify (V1 loop pending)', () => {
  it('garde le pending et informe Thomas', async () => {
    const state = emptyHotContextState();
    state.pendingPatches['p2'] = makePending('p2', new Date().toISOString());
    vi.mocked(loadHotContextState).mockResolvedValue(state);

    const result = await handleHotContextPatchCallback({
      callback_query_id: 'cb2',
      data: `${HOT_CONTEXT_CALLBACK_PREFIX}modify:p2`,
      message_id: 43,
      chat_id: 555,
    });

    expect(result).toBe('modify_pending');
    expect(state.pendingPatches['p2']).toBeDefined(); // toujours présent
  });
});

describe('handleHotContextPatchCallback — skip', () => {
  it('retire le pending et marque outcome=rejected', async () => {
    const state = emptyHotContextState();
    state.pendingPatches['p3'] = makePending('p3', new Date().toISOString());
    vi.mocked(loadHotContextState).mockResolvedValue(state);

    const result = await handleHotContextPatchCallback({
      callback_query_id: 'cb3',
      data: `${HOT_CONTEXT_CALLBACK_PREFIX}skip:p3`,
      message_id: 44,
      chat_id: 555,
    });

    expect(result).toBe('skipped');
    expect(state.pendingPatches['p3']).toBeUndefined();
    expect(state.processedSignals['sig-p3']?.outcome).toBe('rejected');
  });
});

describe('handleHotContextPatchCallback — TTL expired / unknown patch', () => {
  it('retourne unknown_patch_or_expired si patchId inconnu', async () => {
    const state = emptyHotContextState();
    vi.mocked(loadHotContextState).mockResolvedValue(state);
    const result = await handleHotContextPatchCallback({
      callback_query_id: 'cb4',
      data: `${HOT_CONTEXT_CALLBACK_PREFIX}valid:unknown`,
      message_id: 45,
      chat_id: 555,
    });
    expect(result).toBe('unknown_patch_or_expired');
  });

  it("purge les pendings expirés et reporte TTL si le patch était périmé", async () => {
    const state = emptyHotContextState();
    const old = new Date(Date.now() - HOT_CONTEXT_PENDING_TTL_MS - 1000).toISOString();
    state.pendingPatches['expired'] = makePending('expired', old);
    vi.mocked(loadHotContextState).mockResolvedValue(state);

    const result = await handleHotContextPatchCallback({
      callback_query_id: 'cb5',
      data: `${HOT_CONTEXT_CALLBACK_PREFIX}valid:expired`,
      message_id: 46,
      chat_id: 555,
    });
    expect(result).toBe('unknown_patch_or_expired');
    expect(state.pendingPatches['expired']).toBeUndefined();
  });
});
