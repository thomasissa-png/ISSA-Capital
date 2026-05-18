/**
 * Tests unitaires — TickTick polling (diff snapshot + pipeline).
 *
 * Mock listTasks + fs. Vérifie :
 *   - diff snapshot vide → tâches (rien d'émis pour les tasks Anya)
 *   - diff ajouts (créées externe, créées par Anya skip)
 *   - diff complétions (status 0 → 2)
 *   - diff updates (titre/priorité/dueDate)
 *   - corruption snapshot → fallback empty
 *   - erreur listTasks → stats avec error, pas de crash
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { TickTickTask } from '../types';

// ============================================================
// Mocks fs
// ============================================================

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

// ============================================================
// Mock listTasks
// ============================================================

const mockListTasks = vi.fn();

vi.mock('../ticktick-client', () => ({
  listTasks: (...args: unknown[]) => mockListTasks(...args),
}));

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import {
  diffSnapshots,
  loadSnapshot,
  saveSnapshot,
  pollTickTickTasks,
  type SnapshotStore,
} from '../poll';

// ============================================================
// Helpers
// ============================================================

function makeTask(overrides: Partial<TickTickTask>): TickTickTask {
  return {
    id: 't1',
    projectId: 'p1',
    title: 'Task',
    status: 0,
    priority: 0,
    ...overrides,
  };
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(existsSync).mockReturnValue(false);
  (vi.mocked(readFileSync) as ReturnType<typeof vi.fn>).mockReturnValue('');
  (vi.mocked(writeFileSync) as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
  (vi.mocked(mkdirSync) as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
});

// ============================================================
// Tests — diffSnapshots
// ============================================================

describe('diffSnapshots', () => {
  it('snapshot vide → tâches Anya : aucun event (pas de re-émission)', () => {
    const tasks = [
      makeTask({ id: 'a1', title: 'Email lu', tags: ['anya-locataire'] }),
    ];
    const events = diffSnapshots({}, tasks);
    expect(events).toEqual([]);
  });

  it('snapshot vide → tâche externe : émet task.created.external', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Tâche perso Thomas' }),
    ];
    const events = diffSnapshots({}, tasks);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('task.created.external');
    expect(events[0]!.taskId).toBe('t1');
  });

  it('détecte une complétion (status 0 → 2)', () => {
    const before: SnapshotStore = {
      t1: {
        id: 't1',
        projectId: 'p1',
        title: 'Appeler notaire',
        status: 0,
        priority: 3,
        tags: ['anya-locataire'],
      },
    };
    const tasks = [
      makeTask({ id: 't1', title: 'Appeler notaire', status: 2, priority: 3, tags: ['anya-locataire'] }),
    ];
    const events = diffSnapshots(before, tasks);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('task.completed');
    expect(events[0]!.createdByAnya).toBe(true);
  });

  it('détecte une complétion d\'une tâche externe (createdByAnya=false)', () => {
    const before: SnapshotStore = {
      t1: { id: 't1', projectId: 'p1', title: 'Perso', status: 0, priority: 0 },
    };
    const tasks = [makeTask({ id: 't1', title: 'Perso', status: 2 })];
    const events = diffSnapshots(before, tasks);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('task.completed');
    expect(events[0]!.createdByAnya).toBe(false);
  });

  it('détecte un update de titre', () => {
    const before: SnapshotStore = {
      t1: { id: 't1', projectId: 'p1', title: 'Avant', status: 0, priority: 0 },
    };
    const tasks = [makeTask({ id: 't1', title: 'Après' })];
    const events = diffSnapshots(before, tasks);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('task.updated');
    expect(events[0]!.before?.title).toBe('Avant');
    expect(events[0]!.after?.title).toBe('Après');
  });

  it('détecte un update de priorité', () => {
    const before: SnapshotStore = {
      t1: { id: 't1', projectId: 'p1', title: 'T', status: 0, priority: 0 },
    };
    const tasks = [makeTask({ id: 't1', title: 'T', priority: 5 })];
    const events = diffSnapshots(before, tasks);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('task.updated');
  });

  it('détecte un update de dueDate', () => {
    const before: SnapshotStore = {
      t1: { id: 't1', projectId: 'p1', title: 'T', status: 0, priority: 0, dueDate: '2026-06-01' },
    };
    const tasks = [makeTask({ id: 't1', title: 'T', dueDate: '2026-06-15' })];
    const events = diffSnapshots(before, tasks);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('task.updated');
  });

  it('ignore une tâche identique (rien changé)', () => {
    const before: SnapshotStore = {
      t1: { id: 't1', projectId: 'p1', title: 'T', status: 0, priority: 3 },
    };
    const tasks = [makeTask({ id: 't1', title: 'T', priority: 3 })];
    const events = diffSnapshots(before, tasks);
    expect(events).toEqual([]);
  });

  it('ignore les suppressions (présent avant, absent après)', () => {
    const before: SnapshotStore = {
      t1: { id: 't1', projectId: 'p1', title: 'T', status: 0, priority: 0 },
      t2: { id: 't2', projectId: 'p1', title: 'T2', status: 0, priority: 0 },
    };
    const tasks = [makeTask({ id: 't1', title: 'T' })];
    const events = diffSnapshots(before, tasks);
    // t2 disparu — pas d'event (intentionnel, voir commentaire dans poll.ts)
    expect(events).toEqual([]);
  });

  it('priorise complétion sur update si les deux ont lieu', () => {
    const before: SnapshotStore = {
      t1: { id: 't1', projectId: 'p1', title: 'Avant', status: 0, priority: 0 },
    };
    // Titre + status changent en même temps → seul task.completed est émis
    const tasks = [makeTask({ id: 't1', title: 'Après', status: 2 })];
    const events = diffSnapshots(before, tasks);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('task.completed');
  });

  it('gère plusieurs events en un seul diff', () => {
    const before: SnapshotStore = {
      t1: { id: 't1', projectId: 'p1', title: 'T1', status: 0, priority: 0 },
      t2: { id: 't2', projectId: 'p1', title: 'T2', status: 0, priority: 0 },
    };
    const tasks = [
      makeTask({ id: 't1', title: 'T1', status: 2 }), // completed
      makeTask({ id: 't2', title: 'T2 modifié' }),     // updated
      makeTask({ id: 't3', title: 'Nouvelle' }),       // created.external
    ];
    const events = diffSnapshots(before, tasks);
    expect(events).toHaveLength(3);
    const types = events.map((e) => e.type).sort();
    expect(types).toEqual(['task.completed', 'task.created.external', 'task.updated']);
  });
});

// ============================================================
// Tests — loadSnapshot
// ============================================================

describe('loadSnapshot', () => {
  it('retourne {} si le fichier n\'existe pas', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(loadSnapshot()).toEqual({});
  });

  it('parse un fichier valide', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    (vi.mocked(readFileSync) as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({
        version: 1,
        lastPollAt: 123,
        tasks: {
          t1: { id: 't1', projectId: 'p1', title: 'T', status: 0, priority: 0 },
        },
      }),
    );
    const store = loadSnapshot();
    expect(store.t1).toBeDefined();
    expect(store.t1!.title).toBe('T');
  });

  it('fallback empty si JSON corrompu', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    (vi.mocked(readFileSync) as ReturnType<typeof vi.fn>).mockReturnValue('{{invalid json');
    expect(loadSnapshot()).toEqual({});
  });

  it('fallback empty si version inconnue', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    (vi.mocked(readFileSync) as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({ version: 999, tasks: {} }),
    );
    expect(loadSnapshot()).toEqual({});
  });

  it('fallback empty si tasks manquant', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    (vi.mocked(readFileSync) as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({ version: 1, lastPollAt: 0 }),
    );
    expect(loadSnapshot()).toEqual({});
  });
});

// ============================================================
// Tests — saveSnapshot
// ============================================================

describe('saveSnapshot', () => {
  it('écrit un JSON valide avec version et timestamp', () => {
    const store: SnapshotStore = {
      t1: { id: 't1', projectId: 'p1', title: 'T', status: 0, priority: 0 },
    };
    saveSnapshot(store);
    expect(writeFileSync).toHaveBeenCalledOnce();
    const [, content] = vi.mocked(writeFileSync).mock.calls[0] as [string, string];
    const parsed = JSON.parse(content);
    expect(parsed.version).toBe(1);
    expect(parsed.lastPollAt).toBeTypeOf('number');
    expect(parsed.tasks.t1.title).toBe('T');
  });

  it('ne throw pas si l\'écriture échoue', () => {
    (vi.mocked(writeFileSync) as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('disk full');
    });
    expect(() => saveSnapshot({})).not.toThrow();
  });
});

// ============================================================
// Tests — pollTickTickTasks
// ============================================================

describe('pollTickTickTasks', () => {
  it('retourne stats avec error si listTasks throw', async () => {
    mockListTasks.mockRejectedValue(new Error('TickTick down'));
    const stats = await pollTickTickTasks();
    expect(stats.error).toBe('TickTick down');
    expect(stats.events).toBe(0);
    expect(stats.totalTasks).toBe(0);
    // Le snapshot ne doit PAS être écrit (sinon on perd l'état précédent)
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('first run (pas de snapshot) → enregistre tout sans émettre d\'events Anya', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    mockListTasks.mockResolvedValue([
      makeTask({ id: 'a1', title: 'Email', tags: ['anya-locataire'] }),
    ]);

    const stats = await pollTickTickTasks();

    expect(stats.totalTasks).toBe(1);
    expect(stats.events).toBe(0);
    expect(stats.error).toBeUndefined();
    expect(writeFileSync).toHaveBeenCalledOnce();
  });

  it('détecte une complétion et la compte dans stats', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    (vi.mocked(readFileSync) as ReturnType<typeof vi.fn>).mockReturnValue(
      JSON.stringify({
        version: 1,
        lastPollAt: 0,
        tasks: {
          t1: {
            id: 't1', projectId: 'p1', title: 'T', status: 0, priority: 0,
            tags: ['anya-locataire'],
          },
        },
      }),
    );
    mockListTasks.mockResolvedValue([
      makeTask({ id: 't1', title: 'T', status: 2, tags: ['anya-locataire'] }),
    ]);

    const stats = await pollTickTickTasks();

    expect(stats.events).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.completedByAnya).toBe(1);
  });

  it('appelle listTasks avec projectId si fourni', async () => {
    mockListTasks.mockResolvedValue([]);
    await pollTickTickTasks('proj-abc');
    expect(mockListTasks).toHaveBeenCalledWith('proj-abc');
  });

  it('persiste le nouveau snapshot après diff', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    mockListTasks.mockResolvedValue([makeTask({ id: 't1', title: 'New' })]);

    await pollTickTickTasks();

    expect(writeFileSync).toHaveBeenCalledOnce();
    const [, content] = vi.mocked(writeFileSync).mock.calls[0] as [string, string];
    const parsed = JSON.parse(content);
    expect(parsed.tasks.t1).toBeDefined();
  });
});
