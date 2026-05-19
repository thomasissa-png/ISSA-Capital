/**
 * Tests push-engine — coeur de S18.1.
 *
 * Mock du client TickTick pour éviter le réseau. Couvre :
 *   - NEW push (createTask)
 *   - MODIFIED (updateTask)
 *   - COMPLETED ([x] → completeTask + state cleanup)
 *   - DELETED (clé state absente du scan)
 *   - Idempotence (même hash → no-op)
 *   - Erreurs TickTick → stats.errors++
 *   - Projets pas créés → skip total
 */

import { describe, it, expect } from 'vitest';
import { runPushEngine, type TickTickPushClient } from '../push-engine';
import {
  emptyState,
  type SyncState,
  type VaultTask,
  PROJECT_NAMES,
} from '../types';
import { parseTaskLine } from '../parser';

// ============================================================
// Mock client
// ============================================================

interface MockCall {
  method: 'create' | 'update' | 'complete' | 'delete';
  args: unknown;
}

function createMockClient(opts?: {
  failOn?: 'create' | 'update' | 'complete' | 'delete';
}): TickTickPushClient & { calls: MockCall[]; nextId: () => string } {
  const calls: MockCall[] = [];
  let counter = 0;
  const nextId = () => `tt_${++counter}`;

  return {
    calls,
    nextId,
    async createTask(payload) {
      calls.push({ method: 'create', args: payload });
      if (opts?.failOn === 'create') throw new Error('mock create failed');
      const id = nextId();
      return { id, projectId: payload.projectId };
    },
    async updateTask(ticktickId, projectId, payload) {
      calls.push({ method: 'update', args: { ticktickId, projectId, payload } });
      if (opts?.failOn === 'update') throw new Error('mock update failed');
      return { id: ticktickId, projectId };
    },
    async completeTask(ticktickId, projectId) {
      calls.push({ method: 'complete', args: { ticktickId, projectId } });
      if (opts?.failOn === 'complete') throw new Error('mock complete failed');
    },
    async deleteTask(ticktickId, projectId) {
      calls.push({ method: 'delete', args: { ticktickId, projectId } });
      if (opts?.failOn === 'delete') throw new Error('mock delete failed');
    },
  };
}

function stateWithProjects(): SyncState {
  const s = emptyState();
  for (const name of PROJECT_NAMES) {
    s.projects[name] = `proj_${name.toLowerCase().replace(/\s+/g, '_')}`;
  }
  return s;
}

function makeTask(line: string, lineNumber = 1): VaultTask {
  const t = parseTaskLine(line, { vaultPath: 'Taches/Todo.md', lineNumber });
  if (!t) throw new Error(`parse failed for: ${line}`);
  return t;
}

// ============================================================
// Tests
// ============================================================

describe('runPushEngine — projets pas créés', () => {
  it('skip tout si state.projects vide', async () => {
    const state = emptyState();
    const client = createMockClient();
    const tasks = [makeTask('- [ ] test')];

    const { stats } = await runPushEngine(tasks, state, client);
    expect(stats.created).toBe(0);
    expect(stats.scanned).toBe(0); // pas même scanné
    expect(client.calls).toHaveLength(0);
  });
});

describe('runPushEngine — NEW (create)', () => {
  it('crée une tâche absente du state', async () => {
    const state = stateWithProjects();
    const client = createMockClient();
    const tasks = [makeTask('- [ ] hello 📅 2026-05-19 #versi')];

    const { stats, results } = await runPushEngine(tasks, state, client);

    expect(stats.created).toBe(1);
    expect(stats.updated).toBe(0);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.method).toBe('create');

    expect(results[0]?.action).toBe('created');
    expect(results[0]?.ticktickId).toBe('tt_1');

    // State a été mis à jour
    const key = 'Taches/Todo.md:L1';
    expect(state.tasks[key]).toBeDefined();
    expect(state.tasks[key]?.ticktickId).toBe('tt_1');
    expect(state.tasks[key]?.projectId).toBe('proj_versi');
  });

  it('crée plusieurs tâches en série', async () => {
    const state = stateWithProjects();
    const client = createMockClient();
    const tasks = [
      makeTask('- [ ] t1 #versi', 1),
      makeTask('- [ ] t2 #issa', 2),
      makeTask('- [ ] t3 #famille', 3),
    ];

    const { stats } = await runPushEngine(tasks, state, client);
    expect(stats.created).toBe(3);
    expect(Object.keys(state.tasks)).toHaveLength(3);
  });
});

describe('runPushEngine — MODIFIED (update)', () => {
  it('update si hash change', async () => {
    const state = stateWithProjects();
    const client = createMockClient();
    const tasks1 = [makeTask('- [ ] original 📅 2026-05-19')];

    await runPushEngine(tasks1, state, client);
    expect(state.tasks['Taches/Todo.md:L1']).toBeDefined();
    const ticktickId = state.tasks['Taches/Todo.md:L1']?.ticktickId;

    // Modifier la tâche
    client.calls.length = 0;
    const tasks2 = [makeTask('- [ ] modifié 📅 2026-05-20')];
    const { stats } = await runPushEngine(tasks2, state, client);

    expect(stats.updated).toBe(1);
    expect(stats.created).toBe(0);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.method).toBe('update');
    expect(state.tasks['Taches/Todo.md:L1']?.ticktickId).toBe(ticktickId);
  });
});

describe('runPushEngine — idempotence (no-op)', () => {
  it('re-run sans changement = 0 mutation', async () => {
    const state = stateWithProjects();
    const client = createMockClient();
    const tasks = [makeTask('- [ ] stable 📅 2026-05-19 #versi')];

    await runPushEngine(tasks, state, client);
    expect(client.calls).toHaveLength(1);

    client.calls.length = 0;
    const { stats } = await runPushEngine(tasks, state, client);

    expect(stats.created).toBe(0);
    expect(stats.updated).toBe(0);
    expect(stats.skipped).toBe(1);
    expect(client.calls).toHaveLength(0);
  });
});

describe('runPushEngine — COMPLETED', () => {
  it('completeTask + retire du state si [x]', async () => {
    const state = stateWithProjects();
    const client = createMockClient();
    const tasks = [makeTask('- [ ] todo 📅 2026-05-19')];

    await runPushEngine(tasks, state, client);
    const key = 'Taches/Todo.md:L1';
    expect(state.tasks[key]).toBeDefined();

    // Coche la tâche
    client.calls.length = 0;
    const tasksCompleted = [makeTask('- [x] todo 📅 2026-05-19')];
    const { stats } = await runPushEngine(tasksCompleted, state, client);

    expect(stats.completed).toBe(1);
    expect(state.tasks[key]).toBeUndefined();
    expect(client.calls[0]?.method).toBe('complete');
  });

  it('tâche cochée à la création : create puis complete', async () => {
    const state = stateWithProjects();
    const client = createMockClient();
    const tasks = [makeTask('- [x] déjà fait')];

    const { stats } = await runPushEngine(tasks, state, client);
    expect(stats.completed).toBe(1);
    // create + complete
    expect(client.calls.map((c) => c.method)).toEqual(['create', 'complete']);
    // Pas dans le state (tâche close)
    expect(state.tasks['Taches/Todo.md:L1']).toBeUndefined();
  });
});

describe('runPushEngine — DELETED', () => {
  it('delete TickTick si clé state absente du scan', async () => {
    const state = stateWithProjects();
    const client = createMockClient();

    // Crée une tâche
    await runPushEngine([makeTask('- [ ] à supprimer')], state, client);
    expect(state.tasks['Taches/Todo.md:L1']).toBeDefined();

    // Scan vide → suppression
    client.calls.length = 0;
    const { stats } = await runPushEngine([], state, client);

    expect(stats.deleted).toBe(1);
    expect(client.calls[0]?.method).toBe('delete');
    expect(state.tasks['Taches/Todo.md:L1']).toBeUndefined();
  });
});

describe('runPushEngine — gestion erreurs', () => {
  it('erreur create → recordError + stats.errors++', async () => {
    const state = stateWithProjects();
    const client = createMockClient({ failOn: 'create' });
    const tasks = [makeTask('- [ ] fail me')];

    const { stats } = await runPushEngine(tasks, state, client);
    expect(stats.errors).toBe(1);
    expect(stats.skipped).toBe(1);
    expect(stats.created).toBe(0);
    expect(state.tasks['Taches/Todo.md:L1']).toBeUndefined();
  });

  it('erreur delete → continue le pipeline', async () => {
    const state = stateWithProjects();
    const okClient = createMockClient();
    await runPushEngine([makeTask('- [ ] x')], state, okClient);

    const failClient = createMockClient({ failOn: 'delete' });
    const { stats } = await runPushEngine([], state, failClient);
    expect(stats.errors).toBe(1);
    expect(stats.deleted).toBe(0);
    // State PAS nettoyé (delete TickTick a échoué)
    expect(state.tasks['Taches/Todo.md:L1']).toBeDefined();
  });
});

describe('runPushEngine — multi-scénarios', () => {
  it('20 tâches diverses créées en un run', async () => {
    const state = stateWithProjects();
    const client = createMockClient();
    const tasks: VaultTask[] = [];
    for (let i = 1; i <= 20; i++) {
      tasks.push(makeTask(`- [ ] task ${i} #versi 📅 2026-05-${(i % 28) + 1}`, i));
    }

    const { stats } = await runPushEngine(tasks, state, client);
    expect(stats.scanned).toBe(20);
    expect(stats.created).toBe(20);
    expect(Object.keys(state.tasks)).toHaveLength(20);
  });
});
