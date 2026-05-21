/**
 * Tests S20.1 — PREVIEW flow Telegram → TickTick (fix Bug 1 + Bug 2 + Bug 3).
 *
 * Couvre :
 *  - previewAddTaskFromTelegram : carte 3 boutons, pending stocké, pas de createTask.
 *  - finalizeAddTaskFromPending : createTask + carte editée + projectId mémorisé.
 *  - startModifyPreview : phase bascule en awaiting_edit, prompt envoyé.
 *  - cancelPreview : drop pending, aucun call TickTick.
 *  - reparseAndPreviewFromEdit : nouveau pendingId, ancien drop.
 *  - looksLikeTask : heuristique verbe action OU date (Bug 2).
 *  - Idempotence Valider (double-tap → un seul createTask).
 *  - callback_data ≤ 64 bytes pour les 3 nouveaux préfixes.
 *  - R4 strict : préfixes exposés stables.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../llm/client', () => ({
  callAnthropic: vi.fn(),
}));

vi.mock('../../ticktick/ticktick-client', () => ({
  createTask: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock('../../telegram', () => ({
  sendTelegramMessage: vi.fn(async () => ({ success: true, messageId: 1 })),
  sendTelegramMessageWithButtons: vi.fn(async () => ({ success: true, messageId: 555 })),
}));

vi.mock('../../telegram-validation/telegram-cards', () => ({
  editMessageText: vi.fn(async () => true),
  editMessageTextWithButtons: vi.fn(async () => true),
}));

import {
  previewAddTaskFromTelegram,
  finalizeAddTaskFromPending,
  startModifyPreview,
  cancelPreview,
  reparseAndPreviewFromEdit,
  looksLikeTask,
  TASK_VALIDATE_PREFIX,
  TASK_MODIFY_PREFIX,
  TASK_CANCEL_PREVIEW_PREFIX,
  ANYA_TELEGRAM_TAG,
  type ParsedAddTask,
} from '../todo-from-telegram';
import {
  _resetTaskPendingStoreForTests,
  _getTaskPendingStoreSizeForTests,
  getTaskPending,
  generateTaskPendingId,
  saveTaskPending,
} from '../../task-pending-store';
import { callAnthropic } from '../../llm/client';
import { createTask, listProjects } from '../../ticktick/ticktick-client';
import { sendTelegramMessage, sendTelegramMessageWithButtons } from '../../telegram';
import { editMessageTextWithButtons } from '../../telegram-validation/telegram-cards';

beforeEach(() => {
  vi.clearAllMocks();
  _resetTaskPendingStoreForTests();
});

// ============================================================
// looksLikeTask — heuristique Bug 2
// ============================================================

describe('looksLikeTask (Bug 2 fix)', () => {
  const noDate: ParsedAddTask = { intent: 'add_task', title: 'X' };

  it('true sur verbe action FR "appeler"', () => {
    expect(looksLikeTask('appeler martin demain', { ...noDate, dueDate: undefined })).toBe(true);
  });

  it('true sur "rappeler à 14h"', () => {
    expect(looksLikeTask('rappeler à 14h', noDate)).toBe(true);
  });

  it('true sur "faire les courses"', () => {
    expect(looksLikeTask('faire les courses', noDate)).toBe(true);
  });

  it('true sur "envoyer le mail"', () => {
    expect(looksLikeTask('envoyer le mail au notaire', noDate)).toBe(true);
  });

  it('true si dueDate présent (même sans verbe explicite)', () => {
    expect(
      looksLikeTask('réunion équipe', {
        intent: 'add_task',
        title: 'réunion équipe',
        dueDate: '2026-06-01T09:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('false sur "ok"', () => {
    expect(looksLikeTask('ok', noDate)).toBe(false);
  });

  it('false sur "merci"', () => {
    expect(looksLikeTask('merci', noDate)).toBe(false);
  });

  it('false sur "hello"', () => {
    expect(looksLikeTask('hello', noDate)).toBe(false);
  });

  it('false sur texte vide', () => {
    expect(looksLikeTask('', noDate)).toBe(false);
  });

  it('false sur très court "ah"', () => {
    expect(looksLikeTask('ah', noDate)).toBe(false);
  });
});

// ============================================================
// previewAddTaskFromTelegram — Bug 1 fix
// ============================================================

describe('previewAddTaskFromTelegram (Bug 1 fix : carte 3 boutons)', () => {
  it('envoie carte 3 boutons (Valider/Modifier/Annuler) — sans createTask', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    const parsed: ParsedAddTask = { intent: 'add_task', title: 'Relancer Martin' };

    const result = await previewAddTaskFromTelegram({
      chatId: 42,
      messageId: 100,
      parsed,
    });

    expect(result.status).toBe('preview_sent');
    expect(result.pendingId).toBeDefined();
    expect(createTask).not.toHaveBeenCalled();
    expect(sendTelegramMessageWithButtons).toHaveBeenCalledTimes(1);

    // Vérifier qu'on a bien les 3 boutons avec les bons préfixes
    const call = vi.mocked(sendTelegramMessageWithButtons).mock.calls[0]!;
    const chatIdArg = call[0];
    const textArg = call[1];
    const keyboard = call[2];

    expect(chatIdArg).toBe(42);
    expect(textArg).toContain('preview');
    expect(textArg).toContain('Relancer Martin');
    expect(keyboard).toHaveLength(1);
    expect(keyboard[0]).toHaveLength(3);
    expect(keyboard[0]![0]!.callback_data).toMatch(/^task_validate:/);
    expect(keyboard[0]![1]!.callback_data).toMatch(/^task_modify:/);
    expect(keyboard[0]![2]!.callback_data).toMatch(/^task_cancel_preview:/);
  });

  it('stocke un pending en phase preview (TTL 7j — R3)', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    const result = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'Test' },
    });

    expect(result.pendingId).toBeDefined();
    const entry = getTaskPending(result.pendingId!);
    expect(entry).not.toBeNull();
    expect(entry!.phase).toBe('preview');
    expect(entry!.chatId).toBe(1);
    expect(entry!.taskId).toBeNull();
  });

  it('title vide → message d\'erreur Telegram + pas de pending', async () => {
    const result = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: '   ' },
    });

    expect(result.status).toBe('error');
    expect(_getTaskPendingStoreSizeForTests()).toBe(0);
    expect(sendTelegramMessage).toHaveBeenCalled();
    expect(createTask).not.toHaveBeenCalled();
  });

  it('projectId résolu et mémorisé dans le pending (préparation Bug 3 fix)', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p-crit', name: 'Critique' } as never,
    ]);
    const result = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'X', projectName: 'Critique' },
    });

    const entry = getTaskPending(result.pendingId!);
    expect(entry!.projectId).toBe('p-crit');
    expect(entry!.projectName).toBe('Critique');
  });
});

// ============================================================
// finalizeAddTaskFromPending — task_validate
// ============================================================

describe('finalizeAddTaskFromPending (callback task_validate)', () => {
  it('createTask appelé + carte editée + pending passe en phase created', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createTask).mockResolvedValue({
      id: 'tt-finalized',
      projectId: '',
      title: 'Test',
      status: 0,
      priority: 0,
    } as never);

    const preview = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'Test' },
    });

    const result = await finalizeAddTaskFromPending(preview.pendingId!);

    expect(result.status).toBe('created');
    expect(result.taskId).toBe('tt-finalized');
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test',
        tags: [ANYA_TELEGRAM_TAG],
      }),
    );

    // Pending mis à jour : phase=created + taskId mémorisé (fix Bug 3)
    const entry = getTaskPending(preview.pendingId!);
    expect(entry!.phase).toBe('created');
    expect(entry!.taskId).toBe('tt-finalized');

    // Carte Telegram editée (✅ Tâche créée + bouton Annuler)
    expect(editMessageTextWithButtons).toHaveBeenCalled();
  });

  it('idempotence : 2 clics consécutifs Valider → 1 seul createTask', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createTask).mockResolvedValue({
      id: 'tt-idem',
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

    const r1 = await finalizeAddTaskFromPending(preview.pendingId!);
    const r2 = await finalizeAddTaskFromPending(preview.pendingId!);

    expect(r1.status).toBe('created');
    expect(r2.status).toBe('already_created');
    expect(r2.taskId).toBe('tt-idem');
    expect(createTask).toHaveBeenCalledTimes(1);
  });

  it('pendingId inconnu → status expired (TTL 7j dépassé ou cancel précédent)', async () => {
    const result = await finalizeAddTaskFromPending('inexistant');
    expect(result.status).toBe('expired');
    expect(createTask).not.toHaveBeenCalled();
  });

  it('createTask throw → status error + message d\'erreur dans la carte', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createTask).mockRejectedValue(new Error('TickTick 503'));

    const preview = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'X' },
    });

    const result = await finalizeAddTaskFromPending(preview.pendingId!);
    expect(result.status).toBe('error');
    expect(result.error).toContain('TickTick 503');
    expect(editMessageTextWithButtons).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      expect.stringContaining('TickTick 503'),
      [],
    );
  });
});

// ============================================================
// startModifyPreview — task_modify
// ============================================================

describe('startModifyPreview (callback task_modify)', () => {
  it('bascule en awaiting_edit + prompt envoyé', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    const preview = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'Test' },
    });

    const result = await startModifyPreview(preview.pendingId!);

    expect(result.status).toBe('awaiting_edit');
    const entry = getTaskPending(preview.pendingId!);
    expect(entry!.phase).toBe('awaiting_edit');
    // S20.2 : message nouveau patch-friendly ("Quoi modifier ?") au lieu de
    // l'ancien "Tape la version corrigée" (Thomas : modifier ≠ retaper).
    expect(editMessageTextWithButtons).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      expect.stringContaining('Quoi modifier'),
      expect.any(Array),
    );
  });

  it('pendingId expiré → status expired', async () => {
    const result = await startModifyPreview('inexistant');
    expect(result.status).toBe('expired');
  });

  it('pending en phase created → error (modification impossible post-création)', async () => {
    const pendingId = generateTaskPendingId();
    saveTaskPending({
      pendingId,
      phase: 'created',
      parsed: { intent: 'add_task', title: 'X' },
      projectName: null,
      projectId: 'p1',
      taskId: 'tt-x',
      chatId: 1,
      messageId: 10,
      createdAt: Date.now(),
    });

    const result = await startModifyPreview(pendingId);
    expect(result.status).toBe('error');
  });
});

// ============================================================
// cancelPreview — task_cancel_preview
// ============================================================

describe('cancelPreview (callback task_cancel_preview)', () => {
  it('drop pending + message "Tâche annulée" + AUCUN createTask', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    const preview = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'Test' },
    });

    const result = await cancelPreview(preview.pendingId!);

    expect(result.status).toBe('cancelled');
    expect(_getTaskPendingStoreSizeForTests()).toBe(0);
    expect(createTask).not.toHaveBeenCalled();
    expect(editMessageTextWithButtons).toHaveBeenCalledWith(
      1,
      expect.any(Number),
      expect.stringContaining('Tâche annulée'),
      [],
    );
  });

  it('pendingId expiré → status expired', async () => {
    const result = await cancelPreview('inexistant');
    expect(result.status).toBe('expired');
  });
});

// ============================================================
// reparseAndPreviewFromEdit — flow modification complet
// ============================================================

describe('reparseAndPreviewFromEdit (modify → texte → re-preview)', () => {
  it('drop ancien pending, re-parse, nouveau pending avec titre corrigé', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(callAnthropic).mockResolvedValue({
      message: {} as never,
      text: JSON.stringify({ intent: 'add_task', title: 'Titre corrigé' }),
      networkRetries: 0,
      jsonRetryUsed: false,
    });

    // 1. preview initial
    const first = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'Titre fautif' },
    });

    // 2. modify (sans tester le re-render — fait dans test précédent)
    await startModifyPreview(first.pendingId!);

    // 3. Thomas tape un nouveau texte → reparseAndPreviewFromEdit
    const second = await reparseAndPreviewFromEdit({
      chatId: 1,
      newText: 'Titre corrigé',
      oldPendingId: first.pendingId!,
    });

    expect(second.status).toBe('preview_sent');
    expect(second.pendingId).not.toBe(first.pendingId);

    // Ancien pending drop
    expect(getTaskPending(first.pendingId!)).toBeNull();

    // Nouveau pending avec titre corrigé
    const newEntry = getTaskPending(second.pendingId!);
    expect(newEntry!.parsed.title).toBe('Titre corrigé');
    expect(newEntry!.phase).toBe('preview');
  });

  it('modify puis validate → tâche créée avec NOUVEAU titre (test cible Thomas)', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(callAnthropic).mockResolvedValue({
      message: {} as never,
      text: JSON.stringify({ intent: 'add_task', title: 'Bon titre' }),
      networkRetries: 0,
      jsonRetryUsed: false,
    });
    vi.mocked(createTask).mockResolvedValue({
      id: 'tt-modif-OK',
      projectId: '',
      title: 'Bon titre',
      status: 0,
      priority: 0,
    } as never);

    const first = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'Mauvais titre' },
    });
    await startModifyPreview(first.pendingId!);
    const second = await reparseAndPreviewFromEdit({
      chatId: 1,
      newText: 'Bon titre',
      oldPendingId: first.pendingId!,
    });
    const result = await finalizeAddTaskFromPending(second.pendingId!);

    expect(result.status).toBe('created');
    expect(createTask).toHaveBeenCalledTimes(1);
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Bon titre' }),
    );
  });
});

// ============================================================
// callback_data ≤ 64 bytes (Telegram limit)
// ============================================================

describe('callback_data ≤ 64 bytes (Telegram hard limit)', () => {
  it('TASK_VALIDATE_PREFIX + pendingId max ≤ 64 bytes', () => {
    const id = generateTaskPendingId();
    const cb = `${TASK_VALIDATE_PREFIX}${id}`;
    expect(Buffer.byteLength(cb, 'utf8')).toBeLessThanOrEqual(64);
  });

  it('TASK_MODIFY_PREFIX + pendingId max ≤ 64 bytes', () => {
    const id = generateTaskPendingId();
    const cb = `${TASK_MODIFY_PREFIX}${id}`;
    expect(Buffer.byteLength(cb, 'utf8')).toBeLessThanOrEqual(64);
  });

  it('TASK_CANCEL_PREVIEW_PREFIX + pendingId max ≤ 64 bytes', () => {
    const id = generateTaskPendingId();
    const cb = `${TASK_CANCEL_PREVIEW_PREFIX}${id}`;
    expect(Buffer.byteLength(cb, 'utf8')).toBeLessThanOrEqual(64);
  });
});

// ============================================================
// R4 strict : préfixes stables exportés
// ============================================================

describe('R4 strict — préfixes task_* stables', () => {
  it('TASK_VALIDATE_PREFIX === "task_validate:"', () => {
    expect(TASK_VALIDATE_PREFIX).toBe('task_validate:');
  });

  it('TASK_MODIFY_PREFIX === "task_modify:"', () => {
    expect(TASK_MODIFY_PREFIX).toBe('task_modify:');
  });

  it('TASK_CANCEL_PREVIEW_PREFIX === "task_cancel_preview:"', () => {
    expect(TASK_CANCEL_PREVIEW_PREFIX).toBe('task_cancel_preview:');
  });
});
