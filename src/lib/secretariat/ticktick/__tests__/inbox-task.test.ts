import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---- Mocks ----
const mockCreateTask = vi.fn();
const mockAppendToTodoInbox = vi.fn();
const mockSendTelegramMessage = vi.fn();

vi.mock('../ticktick-client', () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
}));

vi.mock('../../drive-todo', () => ({
  appendToTodoInbox: (...args: unknown[]) => mockAppendToTodoInbox(...args),
}));

vi.mock('../../telegram', () => ({
  sendTelegramMessage: (...args: unknown[]) => mockSendTelegramMessage(...args),
}));

// parisLocalToTickTickFields : passthrough déterministe (testé ailleurs).
vi.mock('../../handlers/todo-from-telegram', () => ({
  parisLocalToTickTickFields: (iso: string | undefined) => {
    if (!iso) return { dueDate: undefined, isAllDay: undefined, timeZone: undefined };
    const isAllDay = iso.endsWith('T00:00:00');
    return { dueDate: `${iso}Z`, isAllDay, timeZone: 'Europe/Paris' };
  },
}));

import {
  addTaskToTickTick,
  resolveDefaultProjectId,
  mapTodoPriority,
  TICKTICK_IMPORTANT_PROJECT_ID,
  ANYA_INBOX_TAG,
} from '../inbox-task';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockCreateTask.mockReset();
  mockAppendToTodoInbox.mockReset();
  mockSendTelegramMessage.mockReset();
  mockCreateTask.mockResolvedValue({ id: 'tt-123', projectId: 'p' });
  mockAppendToTodoInbox.mockResolvedValue({ success: true });
  mockSendTelegramMessage.mockResolvedValue({ success: true });
  process.env = { ...ORIGINAL_ENV };
  delete process.env.TICKTICK_DEFAULT_PROJECT_ID;
  process.env.TELEGRAM_CHAT_ID_THOMAS = '42';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('resolveDefaultProjectId', () => {
  it('retourne « Important » par défaut quand l’env est absent', () => {
    delete process.env.TICKTICK_DEFAULT_PROJECT_ID;
    expect(resolveDefaultProjectId()).toBe(TICKTICK_IMPORTANT_PROJECT_ID);
  });

  it('respecte TICKTICK_DEFAULT_PROJECT_ID', () => {
    process.env.TICKTICK_DEFAULT_PROJECT_ID = 'proj-custom';
    expect(resolveDefaultProjectId()).toBe('proj-custom');
  });
});

describe('mapTodoPriority', () => {
  it('mappe P0/P1/P2', () => {
    expect(mapTodoPriority('P0')).toBe(5);
    expect(mapTodoPriority('P1')).toBe(3);
    expect(mapTodoPriority('P2')).toBe(1);
  });
  it('passe un nombre tel quel, sinon 0', () => {
    expect(mapTodoPriority(5)).toBe(5);
    expect(mapTodoPriority(undefined)).toBe(0);
    expect(mapTodoPriority('zzz')).toBe(0);
  });
});

describe('addTaskToTickTick', () => {
  it('crée la tâche dans le projet par défaut avec le tag anya-inbox', async () => {
    const res = await addTaskToTickTick({ title: 'Générer quittance' });
    expect(res.status).toBe('created');
    expect(res.taskId).toBe('tt-123');
    expect(mockCreateTask).toHaveBeenCalledTimes(1);
    const arg = mockCreateTask.mock.calls[0]![0];
    expect(arg.title).toBe('Générer quittance');
    expect(arg.projectId).toBe(TICKTICK_IMPORTANT_PROJECT_ID);
    expect(arg.tags).toEqual([ANYA_INBOX_TAG]);
    expect(mockAppendToTodoInbox).not.toHaveBeenCalled();
  });

  it('YYYY-MM-DD → isAllDay true + timeZone Europe/Paris', async () => {
    await addTaskToTickTick({ title: 'Tâche datée', date: '2026-05-27' });
    const arg = mockCreateTask.mock.calls[0]![0];
    expect(arg.isAllDay).toBe(true);
    expect(arg.timeZone).toBe('Europe/Paris');
    expect(arg.dueDate).toBe('2026-05-27T00:00:00Z');
  });

  it('titre vide → status error, aucun appel', async () => {
    const res = await addTaskToTickTick({ title: '   ' });
    expect(res.status).toBe('error');
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockAppendToTodoInbox).not.toHaveBeenCalled();
  });

  it('createTask échoue → fallback Todo.md + alerte Telegram', async () => {
    mockCreateTask.mockRejectedValueOnce(new Error('TickTick 401'));
    const res = await addTaskToTickTick({ title: 'Compléter fiche bien' });
    expect(res.status).toBe('fallback_todo');
    expect(res.error).toContain('401');
    expect(mockAppendToTodoInbox).toHaveBeenCalledWith('Compléter fiche bien', undefined, undefined);
    expect(mockSendTelegramMessage).toHaveBeenCalledTimes(1);
    const [chatId, text] = mockSendTelegramMessage.mock.calls[0]!;
    expect(chatId).toBe(42);
    expect(text).toContain('TickTick indisponible');
  });

  it('fallback sans TELEGRAM_CHAT_ID_THOMAS → pas d’alerte mais append quand même', async () => {
    delete process.env.TELEGRAM_CHAT_ID_THOMAS;
    mockCreateTask.mockRejectedValueOnce(new Error('boom'));
    const res = await addTaskToTickTick({ title: 'X' });
    expect(res.status).toBe('fallback_todo');
    expect(mockAppendToTodoInbox).toHaveBeenCalled();
    expect(mockSendTelegramMessage).not.toHaveBeenCalled();
  });
});
