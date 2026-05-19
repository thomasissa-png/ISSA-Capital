/**
 * Tests handler Telegram — confirmation création projets TickTick.
 *
 * Couvre :
 *   - parsing callback (create / cancel / invalide)
 *   - construction de la carte (texte + keyboard)
 *   - dispatch handler avec mocks state-store et telegram-cards
 *   - R4 (P1 #97) : callback → handler end-to-end
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseTickTickProjectsCallback,
  buildConfirmCardText,
  buildConfirmKeyboard,
  TICKTICK_PROJECTS_CALLBACK_PREFIX,
  handleTickTickProjectsCallback,
} from '../ticktick-projects-confirm';
import { emptyState } from '../../../ticktick-sync/types';

// ============================================================
// Mocks
// ============================================================

vi.mock('../../telegram-cards', () => ({
  editMessageText: vi.fn(async () => true),
  sendSimpleMessage: vi.fn(async () => ({ success: true, messageId: 1 })),
}));

vi.mock('../../../telegram', () => ({
  answerCallbackQuery: vi.fn(async () => true),
}));

vi.mock('../../../ticktick-sync/state-store', () => ({
  loadSyncState: vi.fn(async () => emptyState()),
  saveSyncState: vi.fn(async () => true),
}));

vi.mock('../../../ticktick-sync/project-manager', async () => {
  const actual = await vi.importActual<
    typeof import('../../../ticktick-sync/project-manager')
  >('../../../ticktick-sync/project-manager');
  return {
    ...actual,
    createMissingProjects: vi.fn(async (_token: string, state: ReturnType<typeof emptyState>) => {
      const names = ['Personnel', 'Versi', 'ISSA', 'Gradient One', 'Immobilier', 'Sarani', 'Inbox'];
      for (const n of names) state.projects[n] = `mock_${n}`;
      return names.map((n) => ({ name: n, id: `mock_${n}` }));
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TICKTICK_ACCESS_TOKEN = 'test-token';
});

// ============================================================
// Parsing
// ============================================================

describe('parseTickTickProjectsCallback', () => {
  it('parse "create"', () => {
    expect(
      parseTickTickProjectsCallback(`${TICKTICK_PROJECTS_CALLBACK_PREFIX}create`),
    ).toEqual({ action: 'create' });
  });

  it('parse "cancel"', () => {
    expect(
      parseTickTickProjectsCallback(`${TICKTICK_PROJECTS_CALLBACK_PREFIX}cancel`),
    ).toEqual({ action: 'cancel' });
  });

  it('null si préfixe absent', () => {
    expect(parseTickTickProjectsCallback('other:create')).toBeNull();
  });

  it('null si action inconnue', () => {
    expect(
      parseTickTickProjectsCallback(`${TICKTICK_PROJECTS_CALLBACK_PREFIX}delete`),
    ).toBeNull();
  });
});

// ============================================================
// Carte
// ============================================================

describe('buildConfirmCardText', () => {
  it('contient le nombre de projets', () => {
    const text = buildConfirmCardText(['A', 'B', 'C']);
    expect(text).toContain('3 projets');
    expect(text).toContain('• A');
    expect(text).toContain('• B');
    expect(text).toContain('• C');
  });
});

describe('buildConfirmKeyboard', () => {
  it('expose [Créer] et [Annuler]', () => {
    const k = buildConfirmKeyboard();
    expect(k).toHaveLength(1);
    expect(k[0]).toHaveLength(2);
    expect(k[0]?.[0]?.callback_data).toBe(`${TICKTICK_PROJECTS_CALLBACK_PREFIX}create`);
    expect(k[0]?.[1]?.callback_data).toBe(`${TICKTICK_PROJECTS_CALLBACK_PREFIX}cancel`);
  });
});

// ============================================================
// Handler — E2E callback → action
// ============================================================

describe('handleTickTickProjectsCallback — R4 dispatch E2E', () => {
  const baseParams = {
    callback_query_id: 'q1',
    message_id: 42,
    chat_id: 12345,
  };

  it('action "cancel" → message édité, pas de création', async () => {
    const { editMessageText } = await import('../../telegram-cards');
    const { createMissingProjects } = await import('../../../ticktick-sync/project-manager');

    const result = await handleTickTickProjectsCallback({
      ...baseParams,
      data: `${TICKTICK_PROJECTS_CALLBACK_PREFIX}cancel`,
    });

    expect(result).toBe('cancelled');
    expect(editMessageText).toHaveBeenCalled();
    expect(createMissingProjects).not.toHaveBeenCalled();
  });

  it('action "create" → createMissingProjects appelé', async () => {
    const { createMissingProjects } = await import('../../../ticktick-sync/project-manager');

    const result = await handleTickTickProjectsCallback({
      ...baseParams,
      data: `${TICKTICK_PROJECTS_CALLBACK_PREFIX}create`,
    });

    expect(result).toBe('created');
    expect(createMissingProjects).toHaveBeenCalledTimes(1);
  });

  it('callback invalide → answerCallbackQuery + retour "invalid_callback"', async () => {
    const result = await handleTickTickProjectsCallback({
      ...baseParams,
      data: 'malformed:wtf',
    });
    expect(result).toBe('invalid_callback');
  });

  it('action "create" sans TICKTICK_ACCESS_TOKEN → return "no_token"', async () => {
    delete process.env.TICKTICK_ACCESS_TOKEN;
    const result = await handleTickTickProjectsCallback({
      ...baseParams,
      data: `${TICKTICK_PROJECTS_CALLBACK_PREFIX}create`,
    });
    expect(result).toBe('no_token');
  });
});
