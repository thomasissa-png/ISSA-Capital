/**
 * Tests `collect-ticktick.ts` — filtrage dû/retard, groupement, tri. ticktick-client mocké.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  listTasks: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock('../../ticktick/ticktick-client', () => ({
  listTasks: mocks.listTasks,
  listProjects: mocks.listProjects,
}));

import { collectTickTick } from '../collect-ticktick';

// Bornes du jour Paris 2026-07-15 (été).
const START = '2026-07-14T22:00:00.000Z';
const END = '2026-07-15T21:59:59.999Z';

function task(over: Partial<Record<string, unknown>>) {
  return {
    id: 'id',
    projectId: 'p1',
    title: 'T',
    priority: 0,
    status: 0,
    ...over,
  };
}

describe('collectTickTick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listProjects.mockResolvedValue([
      { id: 'p1', name: 'Pro' },
      { id: 'p2', name: 'Perso' },
    ]);
  });

  it('inclut les tâches dues aujourd’hui et en retard, exclut le futur', async () => {
    mocks.listTasks.mockResolvedValue([
      task({ id: 'a', title: 'Aujourd’hui', dueDate: '2026-07-15T10:00:00.000Z' }),
      task({ id: 'b', title: 'En retard', dueDate: '2026-07-10T10:00:00.000Z' }),
      task({ id: 'c', title: 'Demain', dueDate: '2026-07-16T10:00:00.000Z' }),
    ]);

    const res = await collectTickTick(END, START);
    expect(res.total).toBe(2);
    const titles = res.groups.flatMap((g) => g.tasks.map((t) => t.title));
    expect(titles).toContain('Aujourd’hui');
    expect(titles).toContain('En retard');
    expect(titles).not.toContain('Demain');
  });

  it('marque overdue = true pour les tâches avant le début du jour', async () => {
    mocks.listTasks.mockResolvedValue([
      task({ id: 'b', title: 'En retard', dueDate: '2026-07-10T10:00:00.000Z' }),
    ]);
    const res = await collectTickTick(END, START);
    expect(res.groups[0]!.tasks[0]!.overdue).toBe(true);
  });

  it('exclut les tâches complétées (status 2) et sans dueDate', async () => {
    mocks.listTasks.mockResolvedValue([
      task({ id: 'done', status: 2, dueDate: '2026-07-15T10:00:00.000Z' }),
      task({ id: 'nodue', dueDate: undefined }),
    ]);
    const res = await collectTickTick(END, START);
    expect(res.total).toBe(0);
  });

  it('groupe par projet et trie par échéance croissante', async () => {
    mocks.listTasks.mockResolvedValue([
      task({ id: 'a', projectId: 'p1', title: 'Tard', dueDate: '2026-07-15T18:00:00.000Z' }),
      task({ id: 'b', projectId: 'p1', title: 'Tôt', dueDate: '2026-07-15T08:00:00.000Z' }),
      task({ id: 'c', projectId: 'p2', title: 'Perso1', dueDate: '2026-07-15T09:00:00.000Z' }),
    ]);
    const res = await collectTickTick(END, START);
    expect(res.groups).toHaveLength(2);
    const pro = res.groups.find((g) => g.projectName === 'Pro')!;
    expect(pro.tasks.map((t) => t.title)).toEqual(['Tôt', 'Tard']);
  });

  it('libelle « Sans projet » si projectId inconnu', async () => {
    mocks.listTasks.mockResolvedValue([
      task({ id: 'x', projectId: 'ghost', dueDate: '2026-07-15T10:00:00.000Z' }),
    ]);
    const res = await collectTickTick(END, START);
    expect(res.groups[0]!.projectName).toBe('Sans projet');
  });
});
