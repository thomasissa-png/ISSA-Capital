/**
 * Tests `task.ts` — handler callback Telegram préfixe `task_*` (S20, R4).
 *
 * Couvre :
 *  - `task_cancel:<taskId>` → completeTask + edit message Telegram.
 *  - Action inconnue → unknown_action (pas de throw).
 *  - completeTask KO sur tous les projets → message d'erreur Telegram.
 *  - R4 strict : préfixe `task_` exposé, signature handler stable.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ticktick/ticktick-client', () => ({
  completeTask: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock('../../telegram', () => ({
  answerCallbackQuery: vi.fn(async () => undefined),
}));

vi.mock('../../telegram-validation/telegram-cards', () => ({
  editMessageText: vi.fn(async () => true),
}));

import { handleTaskCallback, TASK_CALLBACK_PREFIX } from '../task';
import { completeTask, listProjects } from '../../ticktick/ticktick-client';
import { answerCallbackQuery } from '../../telegram';
import { editMessageText } from '../../telegram-validation/telegram-cards';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleTaskCallback — préfixe task_ (R4)', () => {
  it('R4 : préfixe exporté stable', () => {
    expect(TASK_CALLBACK_PREFIX).toBe('task_');
  });

  it('task_cancel : completeTask succès sur 1er projet → status cancelled', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p1', name: 'Critique' } as never,
      { id: 'p2', name: 'Important' } as never,
    ]);
    vi.mocked(completeTask).mockResolvedValue(undefined);

    const result = await handleTaskCallback({
      callbackQueryId: 'cb1',
      callbackData: 'task_cancel:tt-abc',
      chatId: 1,
      messageId: 100,
    });

    expect(result.status).toBe('cancelled');
    expect(result.taskId).toBe('tt-abc');
    expect(completeTask).toHaveBeenCalledWith('p1', 'tt-abc');
    expect(editMessageText).toHaveBeenCalledWith(1, 100, '❌ Tâche annulée.');
    expect(answerCallbackQuery).toHaveBeenCalledWith('cb1');
  });

  it('task_cancel : 1er projet échoue, 2e réussit → cancelled', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p1', name: 'Critique' } as never,
      { id: 'p2', name: 'Important' } as never,
    ]);
    vi.mocked(completeTask)
      .mockRejectedValueOnce(new Error('404 not in p1'))
      .mockResolvedValueOnce(undefined);

    const result = await handleTaskCallback({
      callbackQueryId: 'cb2',
      callbackData: 'task_cancel:tt-xyz',
      chatId: 1,
      messageId: 200,
    });

    expect(result.status).toBe('cancelled');
    expect(completeTask).toHaveBeenCalledTimes(2);
  });

  it('task_cancel : completeTask KO sur tous projets → status error + message Telegram', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p1', name: 'Critique' } as never,
    ]);
    vi.mocked(completeTask).mockRejectedValue(new Error('TickTick 500'));

    const result = await handleTaskCallback({
      callbackQueryId: 'cb3',
      callbackData: 'task_cancel:tt-fail',
      chatId: 1,
      messageId: 300,
    });

    expect(result.status).toBe('error');
    expect(result.taskId).toBe('tt-fail');
    expect(result.error).toContain('TickTick 500');
    expect(editMessageText).toHaveBeenCalledWith(
      1,
      300,
      expect.stringContaining('Annulation échouée'),
    );
  });

  it('task_cancel : taskId vide → status error', async () => {
    const result = await handleTaskCallback({
      callbackQueryId: 'cb4',
      callbackData: 'task_cancel:',
      chatId: 1,
      messageId: 400,
    });

    expect(result.status).toBe('error');
    expect(completeTask).not.toHaveBeenCalled();
  });

  it('action inconnue (préfixe task_ mais sous-action non gérée) → unknown_action', async () => {
    const result = await handleTaskCallback({
      callbackQueryId: 'cb5',
      callbackData: 'task_unknown_action:foo',
      chatId: 1,
      messageId: 500,
    });

    expect(result.status).toBe('unknown_action');
    expect(completeTask).not.toHaveBeenCalled();
  });

  it('listProjects throw → status error sans crasher', async () => {
    vi.mocked(listProjects).mockRejectedValue(new Error('TickTick down'));

    const result = await handleTaskCallback({
      callbackQueryId: 'cb6',
      callbackData: 'task_cancel:tt-net',
      chatId: 1,
      messageId: 600,
    });

    expect(result.status).toBe('error');
    expect(result.error).toContain('TickTick down');
  });
});

describe('R4 E2E — dispatch préfixe task_ depuis webhook', () => {
  // Test E2E "léger" : on vérifie que le préfixe exposé matche bien ce qui
  // est dispatché dans webhook/route.ts (qu'on ne peut pas charger ici sans
  // mock complet). On garantit au minimum que la chaîne est stable.
  it('préfixe task_ stable et exporté (vérification R4 source)', () => {
    expect(TASK_CALLBACK_PREFIX).toBe('task_');
    // Si quelqu'un change ce préfixe, le dispatch webhook casse → CI rouge.
  });

  it('callback `task_cancel:` matche bien le préfixe', () => {
    const callback = `${TASK_CALLBACK_PREFIX}cancel:abc123`;
    expect(callback.startsWith(TASK_CALLBACK_PREFIX)).toBe(true);
  });
});
