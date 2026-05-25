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
  handleHotContextEditText,
  findAwaitingEditPending,
  purgeExpiredPendings,
  HOT_CONTEXT_CALLBACK_PREFIX,
  HOT_CONTEXT_PENDING_TTL_MS,
  HOT_CONTEXT_MAX_MODIFY_ITERATIONS,
} from '../hot-context-patch';
import { emptyHotContextState } from '../../../hot-context/types';

vi.mock('../../telegram-cards', () => ({
  editMessageText: vi.fn(async () => true),
  editMessageTextWithButtons: vi.fn(async () => true),
  sendSimpleMessage: vi.fn(async () => undefined),
}));

vi.mock('../../../telegram', () => ({
  answerCallbackQuery: vi.fn(async () => undefined),
}));

vi.mock('../../../hot-context/state-store', () => ({
  loadHotContextState: vi.fn(),
  saveHotContextState: vi.fn(async () => true),
}));

// On garde le vrai applier pour computeProjectedTokens (parse/serialize/apply
// purs), mais on mocke applyPatchToDrive (effet Drive réel).
vi.mock('../../../hot-context/applier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../hot-context/applier')>();
  return {
    ...actual,
    applyPatchToDrive: vi.fn(),
  };
});

// Lecture du briefing live (loadLiveBriefingContent) — '' par défaut.
vi.mock('../../../vault-client/obsidian-file', () => ({
  readFile: vi.fn(async () => ({ success: true, content: '' })),
  writeFileById: vi.fn(async () => ({ success: true })),
}));

// Reformulation LLM partielle (défaut 2) — mockée par test.
vi.mock('../../../hot-context/signal-detector', () => ({
  patchHotContextPayloadFromInstruction: vi.fn(),
}));

vi.mock('../../../hot-context/audit', () => ({
  writeHotContextAudit: vi.fn(async () => true),
}));

import { loadHotContextState, saveHotContextState } from '../../../hot-context/state-store';
import { applyPatchToDrive } from '../../../hot-context/applier';
import { patchHotContextPayloadFromInstruction } from '../../../hot-context/signal-detector';
import { editMessageTextWithButtons, sendSimpleMessage } from '../../telegram-cards';
import type { Patch } from '../../../hot-context/types';

function makePending(
  patchId: string,
  proposedAt: string,
  extra: {
    phase?: 'preview' | 'awaiting_edit';
    modifyCount?: number;
    telegramMessageId?: number;
  } = {},
): {
  patchId: string;
  patch: Patch;
  proposedAt: string;
  phase?: 'preview' | 'awaiting_edit';
  modifyCount?: number;
  telegramMessageId?: number;
} {
  return {
    patchId,
    proposedAt,
    phase: extra.phase,
    modifyCount: extra.modifyCount,
    telegramMessageId: extra.telegramMessageId,
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

describe('handleHotContextPatchCallback — modify (défaut 2 — awaiting_edit)', () => {
  it('passe le pending en awaiting_edit et garde le pending', async () => {
    const state = emptyHotContextState();
    state.pendingPatches['p2'] = makePending('p2', new Date().toISOString());
    vi.mocked(loadHotContextState).mockResolvedValue(state);

    const result = await handleHotContextPatchCallback({
      callback_query_id: 'cb2',
      data: `${HOT_CONTEXT_CALLBACK_PREFIX}modify:p2`,
      message_id: 43,
      chat_id: 555,
    });

    expect(result).toBe('modify_awaiting_edit');
    expect(state.pendingPatches['p2']).toBeDefined(); // toujours présent
    expect(state.pendingPatches['p2']?.phase).toBe('awaiting_edit');
    expect(state.pendingPatches['p2']?.telegramMessageId).toBe(43);
  });

  it('refuse le modify si le cap de reformulations est atteint', async () => {
    const state = emptyHotContextState();
    state.pendingPatches['pcap'] = makePending('pcap', new Date().toISOString(), {
      modifyCount: HOT_CONTEXT_MAX_MODIFY_ITERATIONS,
    });
    vi.mocked(loadHotContextState).mockResolvedValue(state);

    const result = await handleHotContextPatchCallback({
      callback_query_id: 'cbcap',
      data: `${HOT_CONTEXT_CALLBACK_PREFIX}modify:pcap`,
      message_id: 99,
      chat_id: 555,
    });

    expect(result).toBe('modify_cap_reached');
    // pending non passé en awaiting_edit
    expect(state.pendingPatches['pcap']?.phase).not.toBe('awaiting_edit');
  });
});

describe('findAwaitingEditPending', () => {
  it('retourne le pending awaiting_edit le plus récent', () => {
    const state = emptyHotContextState();
    state.pendingPatches['a'] = makePending('a', '2026-05-20T10:00:00.000Z', {
      phase: 'preview',
    });
    state.pendingPatches['b'] = makePending('b', '2026-05-20T11:00:00.000Z', {
      phase: 'awaiting_edit',
    });
    state.pendingPatches['c'] = makePending('c', '2026-05-20T12:00:00.000Z', {
      phase: 'awaiting_edit',
    });
    expect(findAwaitingEditPending(state)?.patchId).toBe('c');
  });

  it('retourne null si aucun pending awaiting_edit', () => {
    const state = emptyHotContextState();
    state.pendingPatches['a'] = makePending('a', new Date().toISOString(), {
      phase: 'preview',
    });
    expect(findAwaitingEditPending(state)).toBeNull();
  });
});

describe('handleHotContextEditText — défaut 2 loop modify', () => {
  it('retourne no_awaiting si aucun pending awaiting_edit (ne shadow rien)', async () => {
    const state = emptyHotContextState();
    state.pendingPatches['p'] = makePending('p', new Date().toISOString(), {
      phase: 'preview',
    });
    vi.mocked(loadHotContextState).mockResolvedValue(state);

    const result = await handleHotContextEditText(555, 'un texte libre normal');
    expect(result).toBe('no_awaiting');
    // patchHotContextPayloadFromInstruction PAS appelé (pas d'awaiting)
    expect(vi.mocked(patchHotContextPayloadFromInstruction)).not.toHaveBeenCalled();
  });

  it('patche le payload (partiel) et re-propose la carte (phase preview)', async () => {
    const state = emptyHotContextState();
    state.pendingPatches['pm'] = makePending('pm', new Date().toISOString(), {
      phase: 'awaiting_edit',
      modifyCount: 0,
      telegramMessageId: 77,
    });
    vi.mocked(loadHotContextState).mockResolvedValue(state);
    // Le LLM renvoie un patch reformulé (payload changé → nouveau patchId).
    vi.mocked(patchHotContextPayloadFromInstruction).mockResolvedValue({
      ...state.pendingPatches['pm']!.patch,
      patchId: 'pm-v2',
      payload: { text: 'Finaliser [[X]] vendredi' },
    });

    const result = await handleHotContextEditText(555, 'plutôt vendredi');
    expect(result).toBe('repreviewed');
    // L'ancien pending est retiré, le nouveau (pm-v2) en phase preview avec
    // modifyCount incrémenté.
    expect(state.pendingPatches['pm']).toBeUndefined();
    expect(state.pendingPatches['pm-v2']?.phase).toBe('preview');
    expect(state.pendingPatches['pm-v2']?.modifyCount).toBe(1);
    expect(vi.mocked(editMessageTextWithButtons)).toHaveBeenCalled();
  });

  it('demande une reformulation si le payload est inchangé (instruction non comprise)', async () => {
    const state = emptyHotContextState();
    state.pendingPatches['pu'] = makePending('pu', new Date().toISOString(), {
      phase: 'awaiting_edit',
      modifyCount: 0,
      telegramMessageId: 88,
    });
    vi.mocked(loadHotContextState).mockResolvedValue(state);
    // LLM renvoie le MÊME payload → instruction non comprise.
    vi.mocked(patchHotContextPayloadFromInstruction).mockResolvedValue(
      state.pendingPatches['pu']!.patch,
    );

    const result = await handleHotContextEditText(555, 'blabla incompréhensible');
    expect(result).toBe('unchanged');
    // Le pending reste en awaiting_edit (Thomas peut retaper).
    expect(state.pendingPatches['pu']?.phase).toBe('awaiting_edit');
    expect(vi.mocked(sendSimpleMessage)).toHaveBeenCalled();
  });

  it("cap la loop à HOT_CONTEXT_MAX_MODIFY_ITERATIONS (carte sans bouton Modifier)", async () => {
    const state = emptyHotContextState();
    // modifyCount = cap - 1 → après cette reformulation, on atteint le cap.
    state.pendingPatches['pcap2'] = makePending('pcap2', new Date().toISOString(), {
      phase: 'awaiting_edit',
      modifyCount: HOT_CONTEXT_MAX_MODIFY_ITERATIONS - 1,
      telegramMessageId: 66,
    });
    vi.mocked(loadHotContextState).mockResolvedValue(state);
    vi.mocked(patchHotContextPayloadFromInstruction).mockResolvedValue({
      ...state.pendingPatches['pcap2']!.patch,
      patchId: 'pcap2-v2',
      payload: { text: 'Finaliser [[X]] lundi' },
    });

    const result = await handleHotContextEditText(555, 'plutôt lundi');
    expect(result).toBe('repreviewed');
    expect(state.pendingPatches['pcap2-v2']?.modifyCount).toBe(
      HOT_CONTEXT_MAX_MODIFY_ITERATIONS,
    );
    // Le clavier ne doit plus contenir de bouton "modify".
    const lastCall = vi.mocked(editMessageTextWithButtons).mock.calls.at(-1);
    const keyboard = lastCall?.[3] ?? [];
    const flat = keyboard.flat();
    expect(flat.some((b) => b.callback_data.includes('modify:'))).toBe(false);
    expect(flat.some((b) => b.callback_data.includes('valid:'))).toBe(true);
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
