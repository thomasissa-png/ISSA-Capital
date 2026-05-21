/**
 * Tests `todo-from-telegram.ts` — création tâche TickTick depuis Telegram (S20).
 *
 * Couvre :
 *  - parseAddTaskFromText : title verbatim (jamais reformulé), parsing date/priority.
 *  - handleAddTaskFromTelegram : création, dédup, fallback Inbox, carte confirmation.
 *  - Tag `anya-telegram` toujours appliqué.
 *  - Bouton Annuler avec callback_data `task_cancel:<taskId>` (R4 préfixe `task_`).
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
  sendTelegramMessageWithButtons: vi.fn(async () => ({ success: true, messageId: 2 })),
}));

import {
  handleAddTaskFromTelegram,
  parseAddTaskFromText,
  _clearDedupCache,
  ANYA_TELEGRAM_TAG,
  TASK_CALLBACK_PREFIX,
  _internals,
} from '../todo-from-telegram';
import { callAnthropic } from '../../llm/client';
import { createTask, listProjects } from '../../ticktick/ticktick-client';
import { sendTelegramMessage, sendTelegramMessageWithButtons } from '../../telegram';

beforeEach(() => {
  vi.clearAllMocks();
  _clearDedupCache();
});

describe('parseAddTaskFromText', () => {
  it('strip /todo prefix + parse JSON Sonnet', async () => {
    vi.mocked(callAnthropic).mockResolvedValue({
      message: {} as never,
      text: JSON.stringify({
        intent: 'add_task',
        title: 'Relancer Martin',
        dueDate: '2026-05-30T09:00:00.000Z',
        priority: 5,
        projectName: null,
      }),
      networkRetries: 0,
      jsonRetryUsed: false,
    });

    const parsed = await parseAddTaskFromText('/todo Relancer Martin demain matin');
    expect(parsed.intent).toBe('add_task');
    expect(parsed.title).toBe('Relancer Martin');
    expect(parsed.priority).toBe(5);
    expect(parsed.dueDate).toBe('2026-05-30T09:00:00.000Z');
  });

  it('priority invalide → undefined (filtré)', async () => {
    vi.mocked(callAnthropic).mockResolvedValue({
      message: {} as never,
      text: JSON.stringify({ intent: 'add_task', title: 'X', priority: 99 }),
      networkRetries: 0,
      jsonRetryUsed: false,
    });
    const parsed = await parseAddTaskFromText('X');
    expect(parsed.priority).toBeUndefined();
  });

  it('fallback titre brut si Sonnet throw', async () => {
    vi.mocked(callAnthropic).mockRejectedValue(new Error('Anthropic 500'));
    const parsed = await parseAddTaskFromText('/todo Acheter du pain');
    expect(parsed.intent).toBe('add_task');
    expect(parsed.title).toBe('Acheter du pain');
    expect(parsed.dueDate).toBeUndefined();
  });

  it('text vide → title vide', async () => {
    const parsed = await parseAddTaskFromText('/todo');
    expect(parsed.title).toBe('');
  });

  it('markdown fences nettoyés', async () => {
    vi.mocked(callAnthropic).mockResolvedValue({
      message: {} as never,
      text: '```json\n{"intent":"add_task","title":"Tâche"}\n```',
      networkRetries: 0,
      jsonRetryUsed: false,
    });
    const parsed = await parseAddTaskFromText('Tâche');
    expect(parsed.title).toBe('Tâche');
  });
});

describe('handleAddTaskFromTelegram', () => {
  const baseParsed = {
    intent: 'add_task' as const,
    title: 'Test task',
  };

  it('crée la tâche TickTick avec tag anya-telegram', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createTask).mockResolvedValue({
      id: 'tt-123',
      projectId: '',
      title: 'Test task',
      status: 0,
      priority: 0,
    } as never);

    const result = await handleAddTaskFromTelegram({
      chatId: 42,
      messageId: 100,
      parsed: baseParsed,
    });

    expect(result.status).toBe('created');
    expect(result.taskId).toBe('tt-123');
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test task',
        tags: [ANYA_TELEGRAM_TAG],
      }),
    );
  });

  it('idempotence — 2e appel avec même chatId+messageId → skipped_duplicate', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createTask).mockResolvedValue({
      id: 'tt-dedup',
      projectId: '',
      title: 'Dup',
      status: 0,
      priority: 0,
    } as never);

    const r1 = await handleAddTaskFromTelegram({
      chatId: 1,
      messageId: 99,
      parsed: { intent: 'add_task', title: 'Dup' },
    });
    const r2 = await handleAddTaskFromTelegram({
      chatId: 1,
      messageId: 99,
      parsed: { intent: 'add_task', title: 'Dup' },
    });

    expect(r1.status).toBe('created');
    expect(r2.status).toBe('skipped_duplicate');
    expect(createTask).toHaveBeenCalledTimes(1);
  });

  it('title vide → message Telegram d\'erreur + pas de création', async () => {
    const result = await handleAddTaskFromTelegram({
      chatId: 1,
      messageId: 2,
      parsed: { intent: 'add_task', title: '   ' },
    });
    expect(result.status).toBe('error');
    expect(createTask).not.toHaveBeenCalled();
    expect(sendTelegramMessage).toHaveBeenCalled();
  });

  it('createTask throw → message d\'erreur Telegram + status error', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createTask).mockRejectedValue(new Error('TickTick 401'));

    const result = await handleAddTaskFromTelegram({
      chatId: 1,
      messageId: 3,
      parsed: { intent: 'add_task', title: 'Test' },
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('TickTick 401');
    expect(sendTelegramMessage).toHaveBeenCalledWith(
      1,
      expect.stringContaining('TickTick 401'),
    );
  });

  it('projectName mappé sur projectId TickTick (match exact)', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p-crit', name: 'Critique' } as never,
      { id: 'p-imp', name: 'Important' } as never,
    ]);
    vi.mocked(createTask).mockResolvedValue({
      id: 't-p',
      projectId: 'p-crit',
      title: 'X',
      status: 0,
      priority: 0,
    } as never);

    const result = await handleAddTaskFromTelegram({
      chatId: 1,
      messageId: 200,
      parsed: { intent: 'add_task', title: 'X', projectName: 'Critique' },
    });

    expect(result.projectId).toBe('p-crit');
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'p-crit' }),
    );
  });

  it('projectName inconnu → projectId undefined (fallback Inbox TickTick)', async () => {
    vi.mocked(listProjects).mockResolvedValue([{ id: 'p1', name: 'Critique' } as never]);
    vi.mocked(createTask).mockResolvedValue({ id: 't-x', projectId: '', title: 'X', status: 0, priority: 0 } as never);

    const result = await handleAddTaskFromTelegram({
      chatId: 1,
      messageId: 201,
      parsed: { intent: 'add_task', title: 'X', projectName: 'Inexistant' },
    });

    expect(result.projectId).toBeUndefined();
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: undefined }),
    );
  });

  it('carte confirmation envoyée avec bouton Annuler `task_cancel:<taskId>`', async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createTask).mockResolvedValue({
      id: 'tt-cancel-456',
      projectId: '',
      title: 'À annuler',
      status: 0,
      priority: 0,
    } as never);

    await handleAddTaskFromTelegram({
      chatId: 7,
      messageId: 8,
      parsed: { intent: 'add_task', title: 'À annuler' },
    });

    expect(sendTelegramMessageWithButtons).toHaveBeenCalledWith(
      7,
      expect.stringContaining('✅ Tâche créée'),
      [[expect.objectContaining({
        text: 'Annuler',
        callback_data: `${TASK_CALLBACK_PREFIX}cancel:tt-cancel-456`,
      })]],
    );
  });
});

describe('_internals — formatters', () => {
  it('formatDueDate — ISO → DD/MM/YYYY HH:MM', () => {
    expect(_internals.formatDueDate('2026-05-30T09:00:00.000Z')).toBe('30/05/2026 09:00');
  });

  it('formatDueDate — all-day (00:00) → DD/MM/YYYY sans heure', () => {
    expect(_internals.formatDueDate('2026-05-30T00:00:00.000Z')).toBe('30/05/2026');
  });

  it('formatDueDate — undefined → null', () => {
    expect(_internals.formatDueDate(undefined)).toBeNull();
  });

  it('priorityLabel — mapping fr', () => {
    expect(_internals.priorityLabel(5)).toBe('Critique');
    expect(_internals.priorityLabel(3)).toBe('Important');
    expect(_internals.priorityLabel(1)).toBe('Basse');
    expect(_internals.priorityLabel(0)).toBe('Normale');
    expect(_internals.priorityLabel(undefined)).toBe('Normale');
  });
});
