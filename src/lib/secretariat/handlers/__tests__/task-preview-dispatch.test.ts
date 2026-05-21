/**
 * Tests S20.1 — dispatcher `handleTaskCallback` pour les nouveaux préfixes
 * `task_validate:`, `task_modify:`, `task_cancel_preview:` (R4 strict).
 *
 * + Test Bug 3 : `task_cancel:<taskId>` post-création utilise le pending-store
 *   pour récupérer projectId en O(1) (pas de boucle `listProjects` quand le
 *   pending existe encore).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ticktick/ticktick-client', () => ({
  completeTask: vi.fn(),
  listProjects: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock('../../telegram', () => ({
  answerCallbackQuery: vi.fn(async () => undefined),
  sendTelegramMessage: vi.fn(async () => ({ success: true, messageId: 1 })),
  sendTelegramMessageWithButtons: vi.fn(async () => ({ success: true, messageId: 555 })),
}));

vi.mock('../../telegram-validation/telegram-cards', () => ({
  editMessageText: vi.fn(async () => true),
  editMessageTextWithButtons: vi.fn(async () => true),
}));

import { handleTaskCallback, TASK_CALLBACK_PREFIX } from '../task';
import {
  previewAddTaskFromTelegram,
  finalizeAddTaskFromPending,
  TASK_VALIDATE_PREFIX,
  TASK_MODIFY_PREFIX,
  TASK_CANCEL_PREVIEW_PREFIX,
} from '../todo-from-telegram';
import {
  _resetTaskPendingStoreForTests,
  getTaskPending,
  saveTaskPending,
  generateTaskPendingId,
} from '../../task-pending-store';
import { completeTask, listProjects, createTask } from '../../ticktick/ticktick-client';

beforeEach(() => {
  vi.clearAllMocks();
  _resetTaskPendingStoreForTests();
});

// ============================================================
// Dispatch task_validate:
// ============================================================

describe('handleTaskCallback — dispatch task_validate:', () => {
  it('appelle finalizeAddTaskFromPending → createTask + status validated', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createTask).mockResolvedValue({
      id: 'tt-v-1',
      projectId: '',
      title: 'X',
      status: 0,
      priority: 0,
    } as never);

    const preview = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'X' },
    });

    const result = await handleTaskCallback({
      callbackQueryId: 'cb1',
      callbackData: `${TASK_VALIDATE_PREFIX}${preview.pendingId}`,
      chatId: 1,
      messageId: 555,
    });

    expect(result.status).toBe('validated');
    expect(result.taskId).toBe('tt-v-1');
    expect(createTask).toHaveBeenCalledTimes(1);
  });

  it('pendingId vide → error', async () => {
    const result = await handleTaskCallback({
      callbackQueryId: 'cb1',
      callbackData: TASK_VALIDATE_PREFIX, // pas de pendingId après le :
      chatId: 1,
      messageId: 1,
    });
    expect(result.status).toBe('error');
  });
});

// ============================================================
// Dispatch task_modify:
// ============================================================

describe('handleTaskCallback — dispatch task_modify:', () => {
  it('bascule en awaiting_edit + status modify_pending', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);

    const preview = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'X' },
    });

    const result = await handleTaskCallback({
      callbackQueryId: 'cb2',
      callbackData: `${TASK_MODIFY_PREFIX}${preview.pendingId}`,
      chatId: 1,
      messageId: 555,
    });

    expect(result.status).toBe('modify_pending');
    const entry = getTaskPending(preview.pendingId!);
    expect(entry!.phase).toBe('awaiting_edit');
  });
});

// ============================================================
// Dispatch task_cancel_preview: (ne doit pas matcher task_cancel:)
// ============================================================

describe('handleTaskCallback — dispatch task_cancel_preview:', () => {
  it('drop pending + status preview_cancelled + AUCUN completeTask', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);

    const preview = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'X' },
    });

    const result = await handleTaskCallback({
      callbackQueryId: 'cb3',
      callbackData: `${TASK_CANCEL_PREVIEW_PREFIX}${preview.pendingId}`,
      chatId: 1,
      messageId: 555,
    });

    expect(result.status).toBe('preview_cancelled');
    expect(completeTask).not.toHaveBeenCalled();
    expect(getTaskPending(preview.pendingId!)).toBeNull();
  });

  it('ordre dispatch : task_cancel_preview: matché AVANT task_cancel:', async () => {
    // Si l'ordre était inversé, `task_cancel_preview:foo` matcherait
    // `task_cancel:` et essaierait completeTask('preview:foo') → KO.
    vi.mocked(listProjects).mockResolvedValue([]);
    const preview = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'X' },
    });

    const result = await handleTaskCallback({
      callbackQueryId: 'cb',
      callbackData: `${TASK_CANCEL_PREVIEW_PREFIX}${preview.pendingId}`,
      chatId: 1,
      messageId: 555,
    });

    expect(result.status).toBe('preview_cancelled');
    expect(completeTask).not.toHaveBeenCalled();
  });
});

// ============================================================
// Bug 3 fix : task_cancel post-création utilise pending O(1)
// ============================================================

describe('handleTaskCallback — task_cancel: post-création (Bug 3 fix O(1))', () => {
  it('completeTask appelé avec le projectId stocké dans le pending — 1 seul call', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p-decoy-1', name: 'Decoy' } as never,
      { id: 'p-real', name: 'Critique' } as never,
    ]);
    vi.mocked(createTask).mockResolvedValue({
      id: 'tt-cancel-O1',
      projectId: 'p-real',
      title: 'X',
      status: 0,
      priority: 0,
    } as never);

    // 1. preview + validate → pending passe en phase created avec projectId
    const preview = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'X', projectName: 'Critique' },
    });
    await finalizeAddTaskFromPending(preview.pendingId!);

    // Reset le mock listProjects pour vérifier qu'il n'est PAS rappelé.
    vi.mocked(listProjects).mockClear();
    vi.mocked(completeTask).mockResolvedValue(undefined);

    // 2. task_cancel:tt-cancel-O1 → lookup O(1) dans pending-store
    const result = await handleTaskCallback({
      callbackQueryId: 'cbC',
      callbackData: `${TASK_CALLBACK_PREFIX}cancel:tt-cancel-O1`,
      chatId: 1,
      messageId: 555,
    });

    expect(result.status).toBe('cancelled');
    expect(completeTask).toHaveBeenCalledTimes(1);
    expect(completeTask).toHaveBeenCalledWith('p-real', 'tt-cancel-O1');
    // Lookup O(1) → pas de listProjects (preuve qu'on n'est plus dans la boucle legacy).
    expect(listProjects).not.toHaveBeenCalled();
  });

  it('pending expiré → fallback legacy listProjects (compatibilité)', async () => {
    // Pas de pending dans le store, taskId connu seulement → fallback boucle.
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p-only', name: 'X' } as never,
    ]);
    vi.mocked(completeTask).mockResolvedValue(undefined);

    const result = await handleTaskCallback({
      callbackQueryId: 'cbL',
      callbackData: `${TASK_CALLBACK_PREFIX}cancel:tt-legacy`,
      chatId: 1,
      messageId: 555,
    });

    expect(result.status).toBe('cancelled');
    expect(listProjects).toHaveBeenCalledTimes(1);
    expect(completeTask).toHaveBeenCalledWith('p-only', 'tt-legacy');
  });

  it('pending stocké avec projectId KO → fallback legacy automatique', async () => {
    // Simule un pending obsolète (projectId stocké mais TickTick l'a renommé).
    const pendingId = generateTaskPendingId();
    saveTaskPending({
      pendingId,
      phase: 'created',
      parsed: { intent: 'add_task', title: 'X' },
      projectName: 'X',
      projectId: 'p-obsolete',
      taskId: 'tt-fallback',
      chatId: 1,
      messageId: 555,
      createdAt: Date.now(),
    });

    // 1er completeTask (avec p-obsolete) échoue, fallback liste les projets.
    vi.mocked(completeTask)
      .mockRejectedValueOnce(new Error('404 not found in p-obsolete'))
      .mockResolvedValueOnce(undefined);
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p-real-now', name: 'Y' } as never,
    ]);

    const result = await handleTaskCallback({
      callbackQueryId: 'cbF',
      callbackData: `${TASK_CALLBACK_PREFIX}cancel:tt-fallback`,
      chatId: 1,
      messageId: 555,
    });

    expect(result.status).toBe('cancelled');
    expect(completeTask).toHaveBeenCalledTimes(2);
    expect(listProjects).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// R4 E2E — préfixes exposés stables
// ============================================================

describe('R4 strict — préfixes task_* stables (E2E source)', () => {
  it('TASK_CALLBACK_PREFIX === "task_" (header partagé)', () => {
    expect(TASK_CALLBACK_PREFIX).toBe('task_');
  });

  it('tous les sous-préfixes commencent par task_', () => {
    expect(TASK_VALIDATE_PREFIX.startsWith('task_')).toBe(true);
    expect(TASK_MODIFY_PREFIX.startsWith('task_')).toBe(true);
    expect(TASK_CANCEL_PREVIEW_PREFIX.startsWith('task_')).toBe(true);
  });
});
