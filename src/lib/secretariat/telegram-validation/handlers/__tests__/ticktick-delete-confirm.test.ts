/**
 * Tests handler Telegram — confirmation suppression vault (S18.2).
 *
 * Couvre :
 *   - parsing callback (yes / keep / view / invalide)
 *   - construction de la carte (texte + keyboard à 3 boutons)
 *   - TTL purge (>7j retire les pendings)
 *   - dispatch handler avec mocks state-store et telegram-cards
 *   - R4 (P1 #97) : callback → handler end-to-end (3 actions)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseTickTickDeleteCallback,
  buildDeleteCardText,
  buildDeleteKeyboard,
  buildObsidianDeepLink,
  purgeExpiredDeletes,
  TICKTICK_DELETE_CALLBACK_PREFIX,
  DELETE_PENDING_TTL_MS,
  handleTickTickDeleteCallback,
} from '../ticktick-delete-confirm';
import { emptyState, type SyncState, type PendingDelete } from '../../../ticktick-sync/types';

// ============================================================
// Mock state holder (shared across mocks)
// ============================================================

let mockState: SyncState = emptyState();

vi.mock('../../telegram-cards', () => ({
  editMessageText: vi.fn(async () => true),
  sendSimpleMessage: vi.fn(async () => ({ success: true, messageId: 1 })),
}));

vi.mock('../../../telegram', () => ({
  answerCallbackQuery: vi.fn(async () => true),
}));

vi.mock('../../../ticktick-sync/state-store', () => ({
  loadSyncState: vi.fn(async () => mockState),
  saveSyncState: vi.fn(async () => true),
}));

vi.mock('../../../drive-upload', () => ({
  getAccessToken: vi.fn(async () => 'mock-token'),
  updateFileContent: vi.fn(async () => ({ success: true, fileId: 'f1' })),
}));

vi.mock('../../../vault-client/drive-resolver', () => ({
  resolveFilePath: vi.fn(async () => ({ success: true, fileId: 'f1' })),
  listMarkdownFiles: vi.fn(async () => [{ id: 'f1', name: 'Todo.md' }]),
}));

// Mock global fetch (utilisé par deleteLineFromVault et sendDeleteConfirmCard)
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

beforeEach(() => {
  vi.clearAllMocks();
  mockState = emptyState();
  mockState.projects = {
    Personnel: 'p_perso', Versi: 'p_versi', ISSA: 'p_issa',
    'Gradient One': 'p_go', Immobilier: 'p_immo', Sarani: 'p_sarani', Inbox: 'p_inbox',
  };
  process.env.OBSIDIAN_VAULT_NAME = 'TestVault';
  fetchMock.mockReset();
});

// ============================================================
// Parsing
// ============================================================

describe('parseTickTickDeleteCallback', () => {
  it('parse yes:<id>', () => {
    expect(parseTickTickDeleteCallback(`${TICKTICK_DELETE_CALLBACK_PREFIX}yes:tt_42`))
      .toEqual({ action: 'yes', ticktickId: 'tt_42' });
  });

  it('parse keep:<id>', () => {
    expect(parseTickTickDeleteCallback(`${TICKTICK_DELETE_CALLBACK_PREFIX}keep:tt_42`))
      .toEqual({ action: 'keep', ticktickId: 'tt_42' });
  });

  it('parse view:<id>', () => {
    expect(parseTickTickDeleteCallback(`${TICKTICK_DELETE_CALLBACK_PREFIX}view:tt_42`))
      .toEqual({ action: 'view', ticktickId: 'tt_42' });
  });

  it('null si préfixe absent', () => {
    expect(parseTickTickDeleteCallback('other:yes:1')).toBeNull();
  });

  it('null si action inconnue', () => {
    expect(parseTickTickDeleteCallback(`${TICKTICK_DELETE_CALLBACK_PREFIX}drop:1`)).toBeNull();
  });

  it('null si ticktickId vide', () => {
    expect(parseTickTickDeleteCallback(`${TICKTICK_DELETE_CALLBACK_PREFIX}yes:`)).toBeNull();
  });
});

// ============================================================
// Carte
// ============================================================

describe('buildDeleteCardText / buildDeleteKeyboard', () => {
  const pending: PendingDelete = {
    ticktickId: 'tt_42',
    taskKey: 'Todo.md:L3',
    title: 'ma tâche',
    vaultPath: 'Todo.md',
    lineNumber: 3,
    createdAt: '2026-05-19T10:00:00Z',
  };

  it('texte contient titre + path:line', () => {
    const t = buildDeleteCardText(pending);
    expect(t).toContain('ma tâche');
    expect(t).toContain('Todo.md:L3');
  });

  it('keyboard expose 3 boutons (Oui, Garder, Voir)', () => {
    const k = buildDeleteKeyboard('tt_42');
    expect(k).toHaveLength(2); // 2 rows
    expect(k[0]).toHaveLength(2); // Oui + Garder
    expect(k[1]).toHaveLength(1); // Voir
    expect(k[0]?.[0]?.callback_data).toBe(`${TICKTICK_DELETE_CALLBACK_PREFIX}yes:tt_42`);
    expect(k[0]?.[1]?.callback_data).toBe(`${TICKTICK_DELETE_CALLBACK_PREFIX}keep:tt_42`);
    expect(k[1]?.[0]?.callback_data).toBe(`${TICKTICK_DELETE_CALLBACK_PREFIX}view:tt_42`);
  });
});

describe('buildObsidianDeepLink', () => {
  it('encode vault et path', () => {
    const link = buildObsidianDeepLink('03. Tâches/Todo.md');
    expect(link).toContain('obsidian://open?vault=');
    expect(link).toContain('TestVault');
    expect(link).toContain('03.%20T%C3%A2ches%2FTodo.md');
  });
});

// ============================================================
// TTL purge (R3 P1 #96 — TTL ≥ 7j)
// ============================================================

describe('purgeExpiredDeletes — R3 TTL ≥ 7j', () => {
  it('purge les pendings > 7j', () => {
    const state = emptyState();
    state.pendingDeletes = {
      old: {
        ticktickId: 'old', taskKey: 'k', title: 't', vaultPath: 'p', lineNumber: 1,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString(),
      },
      fresh: {
        ticktickId: 'fresh', taskKey: 'k2', title: 't2', vaultPath: 'p', lineNumber: 2,
        createdAt: new Date().toISOString(),
      },
    };
    const purged = purgeExpiredDeletes(state);
    expect(purged).toBe(1);
    expect(state.pendingDeletes?.old).toBeUndefined();
    expect(state.pendingDeletes?.fresh).toBeDefined();
  });

  it('TTL constant ≥ 7j (R3)', () => {
    expect(DELETE_PENDING_TTL_MS).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1_000);
  });

  it('purge no-op si pas de pendings', () => {
    const state = emptyState();
    expect(purgeExpiredDeletes(state)).toBe(0);
  });
});

// ============================================================
// Handler — E2E (R4 dispatch test)
// ============================================================

describe('handleTickTickDeleteCallback — R4 dispatch E2E', () => {
  const baseParams = { callback_query_id: 'q1', message_id: 42, chat_id: 12345 };

  function seedPending(id = 'tt_42'): void {
    mockState.pendingDeletes = {
      [id]: {
        ticktickId: id,
        taskKey: 'Todo.md:L3',
        title: 'à supprimer',
        vaultPath: 'Todo.md',
        lineNumber: 3,
        createdAt: new Date().toISOString(),
      },
    };
    mockState.tasks['Todo.md:L3'] = {
      ticktickId: id,
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: new Date().toISOString(),
    };
  }

  it('action "yes" → suppression vault + clear pending + clear state.tasks', async () => {
    seedPending('tt_42');
    // mock GET fichier
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => 'a\n- [ ] line2\n- [ ] à supprimer\n',
    } as unknown as Response);
    const result = await handleTickTickDeleteCallback({
      ...baseParams,
      data: `${TICKTICK_DELETE_CALLBACK_PREFIX}yes:tt_42`,
    });
    expect(result).toBe('deleted');
    expect(mockState.pendingDeletes?.['tt_42']).toBeUndefined();
    expect(mockState.tasks['Todo.md:L3']).toBeUndefined();
  });

  it('action "keep" → recreate (clear pending + clear state.tasks)', async () => {
    seedPending('tt_42');
    const result = await handleTickTickDeleteCallback({
      ...baseParams,
      data: `${TICKTICK_DELETE_CALLBACK_PREFIX}keep:tt_42`,
    });
    expect(result).toBe('kept');
    expect(mockState.pendingDeletes?.['tt_42']).toBeUndefined();
    expect(mockState.tasks['Todo.md:L3']).toBeUndefined();
  });

  it('action "view" → deep-link envoyé (pas de modification state)', async () => {
    seedPending('tt_42');
    const { sendSimpleMessage } = await import('../../telegram-cards');
    const result = await handleTickTickDeleteCallback({
      ...baseParams,
      data: `${TICKTICK_DELETE_CALLBACK_PREFIX}view:tt_42`,
    });
    expect(result).toBe('view_sent');
    expect(sendSimpleMessage).toHaveBeenCalled();
    // pending pas clear (Thomas n'a pas tranché)
    expect(mockState.pendingDeletes?.['tt_42']).toBeDefined();
  });

  it('pending expiré ou inconnu → "pending_not_found"', async () => {
    // pas de seedPending
    const result = await handleTickTickDeleteCallback({
      ...baseParams,
      data: `${TICKTICK_DELETE_CALLBACK_PREFIX}yes:tt_unknown`,
    });
    expect(result).toBe('pending_not_found');
  });

  it('callback invalide → "invalid_callback"', async () => {
    const result = await handleTickTickDeleteCallback({
      ...baseParams,
      data: 'malformed:wtf',
    });
    expect(result).toBe('invalid_callback');
  });

  it('purgeExpiredDeletes appelée AU début → pending de >7j ignoré', async () => {
    // Place un pending vieux
    mockState.pendingDeletes = {
      tt_old: {
        ticktickId: 'tt_old',
        taskKey: 'Todo.md:L5',
        title: 'old',
        vaultPath: 'Todo.md',
        lineNumber: 5,
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString(),
      },
    };
    const result = await handleTickTickDeleteCallback({
      ...baseParams,
      data: `${TICKTICK_DELETE_CALLBACK_PREFIX}yes:tt_old`,
    });
    // Le pending a été purgé → handler le voit comme inconnu
    expect(result).toBe('pending_not_found');
  });
});
