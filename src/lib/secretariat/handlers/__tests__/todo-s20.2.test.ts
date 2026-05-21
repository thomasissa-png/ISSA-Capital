/**
 * Tests S20.2 — fix complémentaires Telegram → TickTick (post Thomas).
 *
 * Couvre :
 *  - Fix 1 (vocal) : message vocal → transcription Whisper → preview TickTick
 *    OU fallback note Drive (pas de router Calendar/Todo.md).
 *  - Fix 2 (modify intelligent) : `patchDraftFromInstruction` patche les champs
 *    concernés via Sonnet/Haiku, conserve les autres byte-à-byte.
 *  - Fix 2 (orchestrateur) : `patchAndPreviewAddTaskFromInstruction` drop l'ancien
 *    pending + re-preview, OU re-demande Telegram si instruction ambiguë.
 *  - Message Telegram "Quoi modifier ?" (nouveau texte patch-friendly).
 *  - R4 strict : préfixes task_* toujours stables.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../llm/client', () => ({
  callAnthropic: vi.fn(),
}));

vi.mock('../../ticktick/ticktick-client', () => ({
  createTask: vi.fn(),
  listProjects: vi.fn(),
  completeTask: vi.fn(),
}));

vi.mock('../../telegram', () => ({
  sendTelegramMessage: vi.fn(async () => ({ success: true, messageId: 1 })),
  sendTelegramMessageWithButtons: vi.fn(async () => ({ success: true, messageId: 555 })),
  answerCallbackQuery: vi.fn(async () => undefined),
  sendTypingAction: vi.fn(async () => undefined),
}));

vi.mock('../../telegram-validation/telegram-cards', () => ({
  editMessageText: vi.fn(async () => true),
  editMessageTextWithButtons: vi.fn(async () => true),
}));

import {
  patchDraftFromInstruction,
  patchAndPreviewAddTaskFromInstruction,
  previewAddTaskFromTelegram,
  startModifyPreview,
  finalizeAddTaskFromPending,
  PATCH_DRAFT_SYSTEM_PROMPT,
  TASK_VALIDATE_PREFIX,
  TASK_MODIFY_PREFIX,
  TASK_CANCEL_PREVIEW_PREFIX,
  type ParsedAddTask,
} from '../todo-from-telegram';
import {
  _resetTaskPendingStoreForTests,
  getTaskPending,
  saveTaskPending,
  generateTaskPendingId,
  findLatestAwaitingEditForChat,
  type TaskPendingEntry,
} from '../../task-pending-store';
import { handleTaskCallback } from '../task';
import { callAnthropic } from '../../llm/client';
import { listProjects, createTask } from '../../ticktick/ticktick-client';
import {
  sendTelegramMessage,
  sendTelegramMessageWithButtons,
} from '../../telegram';
import { editMessageTextWithButtons } from '../../telegram-validation/telegram-cards';

beforeEach(() => {
  vi.clearAllMocks();
  _resetTaskPendingStoreForTests();
});

// Helper : mock callAnthropic avec une réponse JSON donnée
function mockAnthropicJson(json: unknown): void {
  vi.mocked(callAnthropic).mockResolvedValueOnce({
    message: {} as never,
    text: JSON.stringify(json),
    networkRetries: 0,
    jsonRetryUsed: false,
  });
}

// ============================================================
// Fix 2 — patchDraftFromInstruction (unitaire LLM mocké)
// ============================================================

describe('patchDraftFromInstruction (Fix 2 — patch partiel Sonnet/Haiku)', () => {
  it('Test 4 — "à 15h" patche dueDate uniquement, title inchangé', async () => {
    const draft: ParsedAddTask = {
      intent: 'add_task',
      title: 'appeler Martin',
      dueDate: '2026-05-22T00:00:00.000Z',
    };
    mockAnthropicJson({
      intent: 'add_task',
      title: 'appeler Martin',
      dueDate: '2026-05-22T15:00:00.000Z',
      priority: null,
      projectName: null,
    });

    const patched = await patchDraftFromInstruction(draft, 'à 15h');
    expect(patched.title).toBe('appeler Martin');
    expect(patched.dueDate).toBe('2026-05-22T15:00:00.000Z');
    expect(patched.priority).toBeUndefined();
    expect(patched.projectName).toBeUndefined();
  });

  it('Test 5 — "plutôt vendredi" patche dueDate, title inchangé', async () => {
    const draft: ParsedAddTask = {
      intent: 'add_task',
      title: 'X',
      dueDate: '2026-05-22T00:00:00.000Z',
    };
    mockAnthropicJson({
      intent: 'add_task',
      title: 'X',
      dueDate: '2026-05-23T00:00:00.000Z',
      priority: null,
      projectName: null,
    });

    const patched = await patchDraftFromInstruction(draft, 'plutôt vendredi');
    expect(patched.title).toBe('X');
    expect(patched.dueDate).toBe('2026-05-23T00:00:00.000Z');
  });

  it('Test 6 — "important" patche priority à 3, title inchangé', async () => {
    const draft: ParsedAddTask = {
      intent: 'add_task',
      title: 'préparer RDV',
    };
    mockAnthropicJson({
      intent: 'add_task',
      title: 'préparer RDV',
      dueDate: null,
      priority: 3,
      projectName: null,
    });

    const patched = await patchDraftFromInstruction(draft, 'important');
    expect(patched.title).toBe('préparer RDV');
    expect(patched.priority).toBe(3);
    expect(patched.dueDate).toBeUndefined();
  });

  it('Test 7 — "change Martin en Marc" patche title, dueDate inchangé', async () => {
    const draft: ParsedAddTask = {
      intent: 'add_task',
      title: 'appeler Martin Dupond',
    };
    mockAnthropicJson({
      intent: 'add_task',
      title: 'appeler Marc Dupond',
      dueDate: null,
      priority: null,
      projectName: null,
    });

    const patched = await patchDraftFromInstruction(draft, 'change Martin en Marc');
    expect(patched.title).toBe('appeler Marc Dupond');
    expect(patched.dueDate).toBeUndefined();
  });

  it('Test 8 — instruction "blabla" ambiguë → draft inchangé (LLM renvoie identique)', async () => {
    const draft: ParsedAddTask = {
      intent: 'add_task',
      title: 'X',
    };
    // LLM renvoie exactement le draft d'entrée → instruction non comprise.
    mockAnthropicJson({
      intent: 'add_task',
      title: 'X',
      dueDate: null,
      priority: null,
      projectName: null,
    });

    const patched = await patchDraftFromInstruction(draft, 'blabla incompréhensible');
    expect(patched.title).toBe('X');
    expect(patched.dueDate).toBeUndefined();
    expect(patched.priority).toBeUndefined();
    expect(patched.projectName).toBeUndefined();
  });

  it('LLM throw → draft inchangé retourné (never throw)', async () => {
    const draft: ParsedAddTask = {
      intent: 'add_task',
      title: 'X',
      priority: 5,
    };
    vi.mocked(callAnthropic).mockRejectedValueOnce(new Error('Anthropic 500'));

    const patched = await patchDraftFromInstruction(draft, 'à 15h');
    expect(patched.title).toBe('X');
    expect(patched.priority).toBe(5);
  });

  it('instruction vide → draft inchangé sans appel LLM', async () => {
    const draft: ParsedAddTask = { intent: 'add_task', title: 'X' };
    const patched = await patchDraftFromInstruction(draft, '   ');
    expect(patched).toEqual(draft);
    expect(callAnthropic).not.toHaveBeenCalled();
  });

  it('PATCH_DRAFT_SYSTEM_PROMPT exporté contient les règles clé', () => {
    expect(PATCH_DRAFT_SYSTEM_PROMPT).toContain('CONSERVÉS À L\'IDENTIQUE');
    expect(PATCH_DRAFT_SYSTEM_PROMPT).toContain('Instruction "à 15h"');
    expect(PATCH_DRAFT_SYSTEM_PROMPT).toContain('Instruction "important"');
  });
});

// ============================================================
// Fix 2 — patchAndPreviewAddTaskFromInstruction (E2E orchestrateur)
// ============================================================

describe('patchAndPreviewAddTaskFromInstruction (Fix 2 — orchestrateur)', () => {
  it('Test 9 — preview → modify → "à 15h" → nouvelle preview avec dueDate patchée + ancien pending nettoyé', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);

    // 1. preview initial (parsed déjà fourni, pas d'appel Anthropic ici).
    const first = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 100,
      parsed: {
        intent: 'add_task',
        title: 'appeler Martin',
        dueDate: '2026-05-22T00:00:00.000Z',
      },
    });
    expect(first.status).toBe('preview_sent');

    // 2. modify → bascule en awaiting_edit
    await startModifyPreview(first.pendingId!);
    const pending = getTaskPending(first.pendingId!);
    expect(pending!.phase).toBe('awaiting_edit');

    // 3. Thomas tape "à 15h" → patchAndPreview
    //    mock callAnthropic pour patchDraftFromInstruction (heure patchée)
    mockAnthropicJson({
      intent: 'add_task',
      title: 'appeler Martin',
      dueDate: '2026-05-22T15:00:00.000Z',
      priority: null,
      projectName: null,
    });

    const result = await patchAndPreviewAddTaskFromInstruction({
      chatId: 1,
      messageId: 200,
      pending: pending!,
      instruction: 'à 15h',
    });

    expect(result.status).toBe('preview_sent');
    expect(result.pendingId).toBeDefined();
    expect(result.pendingId).not.toBe(first.pendingId);

    // Ancien pending drop
    expect(getTaskPending(first.pendingId!)).toBeNull();

    // Nouveau pending avec dueDate patchée + title inchangé
    const newEntry = getTaskPending(result.pendingId!);
    expect(newEntry).not.toBeNull();
    expect(newEntry!.parsed.title).toBe('appeler Martin');
    expect(newEntry!.parsed.dueDate).toBe('2026-05-22T15:00:00.000Z');
    expect(newEntry!.phase).toBe('preview');
  });

  it('Test 10 — instruction ambiguë "blabla" → message Telegram "Je n\'ai pas compris" + pending preservé', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);

    // 1. preview
    const first = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 100,
      parsed: { intent: 'add_task', title: 'X' },
    });
    await startModifyPreview(first.pendingId!);
    const pending = getTaskPending(first.pendingId!);

    // 2. LLM renvoie le draft INCHANGÉ → instruction non comprise.
    mockAnthropicJson({
      intent: 'add_task',
      title: 'X',
      dueDate: null,
      priority: null,
      projectName: null,
    });

    // Reset le mock send avant l'appel (1 call attendu : "Je n'ai pas compris")
    vi.mocked(sendTelegramMessage).mockClear();

    const result = await patchAndPreviewAddTaskFromInstruction({
      chatId: 1,
      messageId: 200,
      pending: pending!,
      instruction: 'blabla incompréhensible',
    });

    expect(result.status).toBe('unchanged');
    expect(result.pendingId).toBeUndefined();

    // Message Telegram envoyé à Thomas
    expect(sendTelegramMessage).toHaveBeenCalledWith(
      1,
      expect.stringContaining("Je n'ai pas compris"),
    );

    // Pending preservé en awaiting_edit (Thomas peut retaper)
    const stillAwaiting = getTaskPending(first.pendingId!);
    expect(stillAwaiting).not.toBeNull();
    expect(stillAwaiting!.phase).toBe('awaiting_edit');
  });

  it('flow complet : preview → modify → patch "important" → validate → tâche créée avec priority=3', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createTask).mockResolvedValue({
      id: 'tt-priority-3',
      projectId: '',
      title: 'préparer RDV',
      status: 0,
      priority: 3,
    } as never);

    // 1. preview
    const first = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 100,
      parsed: { intent: 'add_task', title: 'préparer RDV' },
    });

    // 2. modify
    await startModifyPreview(first.pendingId!);
    const pending = getTaskPending(first.pendingId!);

    // 3. patch "important" → priority=3
    mockAnthropicJson({
      intent: 'add_task',
      title: 'préparer RDV',
      dueDate: null,
      priority: 3,
      projectName: null,
    });
    const patched = await patchAndPreviewAddTaskFromInstruction({
      chatId: 1,
      messageId: 200,
      pending: pending!,
      instruction: 'important',
    });
    expect(patched.status).toBe('preview_sent');

    // 4. validate
    const final = await finalizeAddTaskFromPending(patched.pendingId!);
    expect(final.status).toBe('created');
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'préparer RDV',
        priority: 3,
      }),
    );
  });
});

// ============================================================
// Fix 2 — Test 11 : nouveau texte Telegram "Quoi modifier ?"
// ============================================================

describe('task_modify message Telegram (Fix 2 — UX)', () => {
  it('Test 11 — message édité contient "✏️ Quoi modifier ?" et NON "Tape la version corrigée"', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);

    const first = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 100,
      parsed: { intent: 'add_task', title: 'X' },
    });
    vi.mocked(editMessageTextWithButtons).mockClear();

    await startModifyPreview(first.pendingId!);

    expect(editMessageTextWithButtons).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(editMessageTextWithButtons).mock.calls[0]!;
    const messageText = callArgs[2] as string;

    expect(messageText).toContain('Quoi modifier');
    expect(messageText).toContain("à 15h"); // exemple dans le prompt
    expect(messageText).toContain('plutôt vendredi'); // exemple dans le prompt
    expect(messageText).toContain('important'); // exemple dans le prompt
    expect(messageText).not.toContain('Tape la version corrigée');
  });
});

// ============================================================
// Fix 2 — Test 12 : R4 strict dispatch préfixes
// ============================================================

describe('R4 strict — préfixes task_* dispatchés (S20.2 sanity)', () => {
  it('Test 12a — task_validate: bien dispatché vers finalize', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createTask).mockResolvedValue({
      id: 'tt-v',
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
      callbackQueryId: 'cb',
      callbackData: `${TASK_VALIDATE_PREFIX}${preview.pendingId}`,
      chatId: 1,
      messageId: 555,
    });

    expect(result.status).toBe('validated');
  });

  it('Test 12b — task_modify: dispatch + phase=awaiting_edit', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    const preview = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: 'X' },
    });

    const result = await handleTaskCallback({
      callbackQueryId: 'cb',
      callbackData: `${TASK_MODIFY_PREFIX}${preview.pendingId}`,
      chatId: 1,
      messageId: 555,
    });

    expect(result.status).toBe('modify_pending');
    expect(getTaskPending(preview.pendingId!)!.phase).toBe('awaiting_edit');
  });

  it('Test 12c — task_cancel_preview: dispatch, AUCUN createTask, pending drop', async () => {
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
    expect(createTask).not.toHaveBeenCalled();
    expect(getTaskPending(preview.pendingId!)).toBeNull();
  });

  it('Test 12d — task_cancel: (post-création, distinct de task_cancel_preview:) garde son sémantique', async () => {
    // On crée juste un pending phase=created et on déclenche task_cancel:
    // pour vérifier qu'il n'est pas avalé par task_cancel_preview:.
    const pendingId = generateTaskPendingId();
    saveTaskPending({
      pendingId,
      phase: 'created',
      parsed: { intent: 'add_task', title: 'X' },
      projectName: 'X',
      projectId: 'p1',
      taskId: 'tt-postcreate',
      chatId: 1,
      messageId: 555,
      createdAt: Date.now(),
    });

    // Mock TickTick API (utilisé par handleCancel post-création)
    const { completeTask } = await import('../../ticktick/ticktick-client');
    vi.mocked(completeTask).mockResolvedValueOnce(undefined);

    const result = await handleTaskCallback({
      callbackQueryId: 'cb',
      callbackData: 'task_cancel:tt-postcreate',
      chatId: 1,
      messageId: 555,
    });

    expect(result.status).toBe('cancelled');
    expect(result.taskId).toBe('tt-postcreate');
  });
});

// ============================================================
// Fix 1 — vocal Telegram → preview TickTick (test intégration helper)
//
// Fix 1 vit dans la route webhook (route.ts). On teste ici les 3 cas via le
// pattern direct car le helper réel `transcribeWithWhisper` est mocké par le
// webhook lui-même. Les tests via POST sont dans webhook/__tests__/router.test.ts
// (extension S20.2 ci-dessous).
// ============================================================

describe('Fix 1 — pipeline vocal (helpers utilisés par webhook)', () => {
  it('Pattern attendu : transcript OK + looksLikeTask=true → previewAddTaskFromTelegram appelé', async () => {
    // Ce test documente le contrat : si on a un transcript task-like, on doit
    // pouvoir lancer previewAddTaskFromTelegram exactement comme pour du texte.
    vi.mocked(listProjects).mockResolvedValue([]);
    const parsed: ParsedAddTask = {
      intent: 'add_task',
      title: 'appeler Martin demain',
    };

    const result = await previewAddTaskFromTelegram({
      chatId: 1,
      messageId: 100,
      parsed,
    });

    expect(result.status).toBe('preview_sent');
    expect(sendTelegramMessageWithButtons).toHaveBeenCalled();
    expect(createTask).not.toHaveBeenCalled();
  });

  it('Pattern fallback : si parseAddTaskFromText échoue (Sonnet down) → handle peut routeur vers note Drive', async () => {
    // Test du contrat : un parse qui throw ne doit pas bloquer le flow vocal.
    // Le webhook attrape l'exception et continue vers handleInboxVoice.
    vi.mocked(callAnthropic).mockRejectedValueOnce(new Error('Anthropic down'));

    // parseAddTaskFromText fallback sur le titre brut (jamais throw).
    const { parseAddTaskFromText } = await import('../todo-from-telegram');
    const result = await parseAddTaskFromText('hello world');

    // Le fallback retourne le texte brut comme titre (jamais throw au caller).
    expect(result.title).toBe('hello world');
  });
});

// ============================================================
// Fix 1 — vérification que la pending-store helper sert toujours
// ============================================================

describe('Fix 1 sanity — task-pending-store toujours utilisable post-vocal', () => {
  it('findLatestAwaitingEditForChat retourne le pending vocal patché', async () => {
    // Simule un pending créé via flow vocal → modify : il doit être trouvable
    // pour permettre patchAndPreviewAddTaskFromInstruction.
    const pendingId = generateTaskPendingId();
    const entry: TaskPendingEntry = {
      pendingId,
      phase: 'awaiting_edit',
      parsed: { intent: 'add_task', title: 'depuis vocal' },
      projectName: null,
      projectId: null,
      taskId: null,
      chatId: 99,
      messageId: 1234,
      createdAt: Date.now(),
    };
    saveTaskPending(entry);

    const found = findLatestAwaitingEditForChat(99);
    expect(found).not.toBeNull();
    expect(found!.pendingId).toBe(pendingId);
    expect(found!.parsed.title).toBe('depuis vocal');
  });
});
