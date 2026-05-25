/**
 * Tests `collect-ticktick.ts` — buckets today/upcoming, groupement, tri. ticktick-client mocké.
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

// Bornes du jour Paris 2026-07-15 (été) + fenêtre à venir +7j.
const START = '2026-07-14T22:00:00.000Z';
const END = '2026-07-15T21:59:59.999Z';
const END_UPCOMING = '2026-07-22T21:59:59.999Z';

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

  it('bucket today = dues aujourd’hui + en retard ; futur proche → upcoming', async () => {
    mocks.listTasks.mockResolvedValue([
      task({ id: 'a', title: 'Aujourd’hui', dueDate: '2026-07-15T10:00:00.000Z' }),
      task({ id: 'b', title: 'En retard', dueDate: '2026-07-10T10:00:00.000Z' }),
      task({ id: 'c', title: 'Dans 4 jours', dueDate: '2026-07-19T10:00:00.000Z' }),
      task({ id: 'd', title: 'Dans 30 jours', dueDate: '2026-08-14T10:00:00.000Z' }),
    ]);

    const res = await collectTickTick(START, END, END_UPCOMING);
    expect(res.today.total).toBe(2);
    const todayTitles = res.today.groups.flatMap((g) => g.tasks.map((t) => t.title));
    expect(todayTitles).toContain('Aujourd’hui');
    expect(todayTitles).toContain('En retard');

    expect(res.upcoming.total).toBe(1);
    const upTitles = res.upcoming.groups.flatMap((g) => g.tasks.map((t) => t.title));
    expect(upTitles).toEqual(['Dans 4 jours']);
    // Au-delà de 7j → ni today ni upcoming.
    expect(upTitles).not.toContain('Dans 30 jours');
  });

  it('marque overdue = true pour les tâches avant le début du jour', async () => {
    mocks.listTasks.mockResolvedValue([
      task({ id: 'b', title: 'En retard', dueDate: '2026-07-10T10:00:00.000Z' }),
    ]);
    const res = await collectTickTick(START, END, END_UPCOMING);
    expect(res.today.groups[0]!.tasks[0]!.overdue).toBe(true);
  });

  it('exclut les tâches complétées (status 2) et sans dueDate', async () => {
    mocks.listTasks.mockResolvedValue([
      task({ id: 'done', status: 2, dueDate: '2026-07-15T10:00:00.000Z' }),
      task({ id: 'nodue', dueDate: undefined }),
    ]);
    const res = await collectTickTick(START, END, END_UPCOMING);
    expect(res.today.total).toBe(0);
    expect(res.upcoming.total).toBe(0);
  });

  it('groupe par projet et trie par échéance croissante (today)', async () => {
    mocks.listTasks.mockResolvedValue([
      task({ id: 'a', projectId: 'p1', title: 'Tard', dueDate: '2026-07-15T18:00:00.000Z' }),
      task({ id: 'b', projectId: 'p1', title: 'Tôt', dueDate: '2026-07-15T08:00:00.000Z' }),
      task({ id: 'c', projectId: 'p2', title: 'Perso1', dueDate: '2026-07-15T09:00:00.000Z' }),
    ]);
    const res = await collectTickTick(START, END, END_UPCOMING);
    expect(res.today.groups).toHaveLength(2);
    const pro = res.today.groups.find((g) => g.projectName === 'Pro')!;
    expect(pro.tasks.map((t) => t.title)).toEqual(['Tôt', 'Tard']);
  });

  it('libelle « Sans projet » si projectId inconnu', async () => {
    mocks.listTasks.mockResolvedValue([
      task({ id: 'x', projectId: 'ghost', dueDate: '2026-07-15T10:00:00.000Z' }),
    ]);
    const res = await collectTickTick(START, END, END_UPCOMING);
    expect(res.today.groups[0]!.projectName).toBe('Sans projet');
  });
});
