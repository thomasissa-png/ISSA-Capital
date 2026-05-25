/**
 * Tests todo-creator — création/update todo « CR à faire » TickTick (S23).
 *
 * Mocks : ticktick-client (createTask/updateTask/listProjects) + le helper
 * parisLocalToTickTickFields (importé depuis todo-from-telegram). Zéro réseau.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockListProjects = vi.fn();

vi.mock('../../ticktick/ticktick-client', () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
  updateTask: (...args: unknown[]) => mockUpdateTask(...args),
  listProjects: (...args: unknown[]) => mockListProjects(...args),
}));

import {
  createCrTodo,
  buildTodoTitle,
  buildParisLocalIso,
} from '../todo-creator';
import type { EventProjection } from '../types';

function makeProjection(over: Partial<EventProjection> = {}): EventProjection {
  return {
    date: '2026-05-22',
    heure: '14:00',
    sujet: 'Point Versi Immobilier',
    googleHtmlLink: 'https://calendar.google.com/x',
    projectCodes: ['VI'],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListProjects.mockResolvedValue([
    { id: 'proj_vi', name: 'Versi Immobilier' },
    { id: 'proj_ic', name: 'ISSA Capital' },
  ]);
});

describe('buildTodoTitle / buildParisLocalIso', () => {
  it('titre = « CR à faire — <sujet> (<date>) »', () => {
    expect(buildTodoTitle(makeProjection())).toBe(
      'CR à faire — Point Versi Immobilier (2026-05-22)',
    );
  });

  it('ISO local Paris à partir de date + heure', () => {
    expect(buildParisLocalIso(makeProjection())).toBe('2026-05-22T14:00:00');
  });

  it('ISO local minuit si pas d\'heure (all-day)', () => {
    expect(buildParisLocalIso(makeProjection({ heure: undefined }))).toBe(
      '2026-05-22T00:00:00',
    );
  });
});

describe('createCrTodo', () => {
  it('crée le todo avec timeZone Europe/Paris (R8) + projet résolu par nom', async () => {
    mockCreateTask.mockResolvedValue({ id: 'task_1', projectId: 'proj_vi' });

    const res = await createCrTodo(makeProjection(), 'Versi Immobilier');

    expect(res.status).toBe('created');
    expect(res.todoId).toBe('task_1');
    const arg = mockCreateTask.mock.calls[0]![0];
    expect(arg.timeZone).toBe('Europe/Paris');
    expect(arg.projectId).toBe('proj_vi');
    expect(arg.title).toContain('CR à faire');
    // Heure 14:00 → pas all-day.
    expect(arg.isAllDay).toBe(false);
  });

  it('sans projet → projectId undefined (Inbox)', async () => {
    mockCreateTask.mockResolvedValue({ id: 'task_2' });

    const res = await createCrTodo(makeProjection(), undefined);
    expect(res.status).toBe('created');
    expect(mockCreateTask.mock.calls[0]![0].projectId).toBeUndefined();
  });

  it('projet introuvable dans TickTick → Inbox (undefined)', async () => {
    mockListProjects.mockResolvedValue([{ id: 'proj_x', name: 'Autre' }]);
    mockCreateTask.mockResolvedValue({ id: 'task_3' });

    await createCrTodo(makeProjection(), 'Versi Immobilier');
    expect(mockCreateTask.mock.calls[0]![0].projectId).toBeUndefined();
  });

  it('event replanifié (existingTodoId) → updateTask, pas de createTask', async () => {
    mockUpdateTask.mockResolvedValue({ id: 'task_existing' });

    const res = await createCrTodo(makeProjection(), 'Versi Immobilier', 'task_existing');

    expect(res.status).toBe('updated');
    expect(res.todoId).toBe('task_existing');
    expect(mockUpdateTask).toHaveBeenCalledOnce();
    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('createTask throw → error gracieux', async () => {
    mockCreateTask.mockRejectedValue(new Error('TickTick 401'));

    const res = await createCrTodo(makeProjection(), 'Versi Immobilier');
    expect(res.status).toBe('error');
    expect(res.error).toContain('TickTick 401');
  });
});
