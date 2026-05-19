/**
 * Tests d'intégration audit-log — vérifie le branchement dans push-engine,
 * pull-engine et ticktick-delete-confirm.
 *
 * On mocke `./audit-log` (appendAuditLog) avec un spy pour observer les
 * appels sans toucher Drive. Chaque scénario fonctionnel doit produire
 * une entrée d'audit avec l'op + direction + status corrects.
 *
 * Couverture spec critère §11.6 — chaque op tracée.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Spy global pour appendAuditLog (hoisted)
// ============================================================

const hoisted = vi.hoisted(() => {
  return {
    appendAuditLogSpy: vi.fn<
      (entry: Omit<import('../types').AuditEntry, 'ts'> & { ts?: string }) => Promise<boolean>
    >(async () => true),
  };
});
const appendAuditLogSpy = hoisted.appendAuditLogSpy;

vi.mock('../audit-log', async () => {
  const actual = await vi.importActual<typeof import('../audit-log')>('../audit-log');
  return {
    ...actual,
    appendAuditLog: hoisted.appendAuditLogSpy,
  };
});

import { runPushEngine, type TickTickPushClient } from '../push-engine';
import {
  runPullEngine,
  type TickTickPullClient,
  type VaultPatcher,
  type TelegramDeleteNotifier,
} from '../pull-engine';
import {
  emptyState,
  PROJECT_NAMES,
  type SyncState,
  type TickTickRawTask,
  type VaultTask,
} from '../types';
import { parseTaskLine } from '../parser';

// ============================================================
// Helpers
// ============================================================

function stateWithProjects(): SyncState {
  const s = emptyState();
  for (const name of PROJECT_NAMES) {
    s.projects[name] = `proj_${name.toLowerCase().replace(/\s+/g, '_')}`;
  }
  return s;
}

function makeTask(line: string, lineNumber = 1): VaultTask {
  const t = parseTaskLine(line, { vaultPath: '03. Tâches/Todo.md', lineNumber });
  if (!t) throw new Error(`parse failed: ${line}`);
  return t;
}

function createMockPushClient(): TickTickPushClient {
  let counter = 0;
  return {
    async createTask(payload) {
      counter++;
      return { id: `tt_${counter}`, projectId: payload.projectId };
    },
    async updateTask(id, projectId) {
      return { id, projectId };
    },
    async completeTask() { /* no-op */ },
    async deleteTask() { /* no-op */ },
  };
}

beforeEach(() => {
  appendAuditLogSpy.mockClear();
});

// ============================================================
// Push engine — 5 ops audit
// ============================================================

describe('audit-log branchement push-engine', () => {
  it('appendAuditLog appelé pour CREATE', async () => {
    const state = stateWithProjects();
    const tasks = [makeTask('- [ ] test push create')];
    await runPushEngine(tasks, state, createMockPushClient());
    const createCall = appendAuditLogSpy.mock.calls.find(
      ([entry]) => entry.op === 'create' && entry.direction === 'push',
    );
    expect(createCall).toBeDefined();
    expect(createCall![0].status).toBe('ok');
    expect(createCall![0].vaultPath).toBe('03. Tâches/Todo.md');
  });

  it('appendAuditLog appelé pour UPDATE (hash change)', async () => {
    const state = stateWithProjects();
    state.tasks['03. Tâches/Todo.md:L1'] = {
      ticktickId: 'tt_old',
      projectId: 'proj_inbox',
      vaultHash: 'old_hash_different',
      lastSyncedAt: '2026-05-19T00:00:00Z',
    };
    const tasks = [makeTask('- [ ] test push update modified')];
    await runPushEngine(tasks, state, createMockPushClient());
    const updateCall = appendAuditLogSpy.mock.calls.find(
      ([entry]) => entry.op === 'update' && entry.direction === 'push',
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![0].taskId).toBe('tt_old');
  });

  it('appendAuditLog appelé pour COMPLETE ([x])', async () => {
    const state = stateWithProjects();
    state.tasks['03. Tâches/Todo.md:L1'] = {
      ticktickId: 'tt_to_complete',
      projectId: 'proj_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T00:00:00Z',
    };
    const tasks = [makeTask('- [x] test push complete')];
    await runPushEngine(tasks, state, createMockPushClient());
    const completeCall = appendAuditLogSpy.mock.calls.find(
      ([entry]) => entry.op === 'complete' && entry.direction === 'push',
    );
    expect(completeCall).toBeDefined();
    expect(completeCall![0].taskId).toBe('tt_to_complete');
  });

  it('appendAuditLog appelé pour DELETE (clé absente du scan)', async () => {
    const state = stateWithProjects();
    state.tasks['03. Tâches/Todo.md:L42'] = {
      ticktickId: 'tt_to_delete',
      projectId: 'proj_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T00:00:00Z',
    };
    // scan vide → la tâche state est orpheline → DELETE
    await runPushEngine([], state, createMockPushClient());
    const deleteCall = appendAuditLogSpy.mock.calls.find(
      ([entry]) => entry.op === 'delete' && entry.direction === 'push',
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0].taskId).toBe('tt_to_delete');
  });

  it('appendAuditLog appelé pour SKIP (erreur)', async () => {
    const state = stateWithProjects();
    const tasks = [makeTask('- [ ] test push fail')];
    const failingClient: TickTickPushClient = {
      async createTask() { throw new Error('mock TT 500'); },
      async updateTask() { return { id: '', projectId: '' }; },
      async completeTask() { /* */ },
      async deleteTask() { /* */ },
    };
    await runPushEngine(tasks, state, failingClient);
    const skipCall = appendAuditLogSpy.mock.calls.find(
      ([entry]) => entry.op === 'skip' && entry.direction === 'push' && entry.status === 'error',
    );
    expect(skipCall).toBeDefined();
    expect(skipCall![0].error).toContain('mock TT 500');
  });

  it('idempotence (hash égal) ne déclenche aucun audit', async () => {
    const state = stateWithProjects();
    const task = makeTask('- [ ] idempotent line');
    // Préremplir le state avec le hash exact
    const { _pushEngineInternals } = await import('../push-engine');
    const hash = _pushEngineInternals.canonicalHash(task);
    state.tasks['03. Tâches/Todo.md:L1'] = {
      ticktickId: 'tt_skip',
      projectId: 'proj_inbox',
      vaultHash: hash,
      lastSyncedAt: '2026-05-19T00:00:00Z',
    };
    await runPushEngine([task], state, createMockPushClient());
    // Aucune entrée audit (no-op silencieux)
    expect(appendAuditLogSpy).not.toHaveBeenCalled();
  });
});

// ============================================================
// Pull engine — 5 ops audit
// ============================================================

function makePullPatcher(initial: Record<string, string>): VaultPatcher {
  const files = new Map<string, { content: string; fileId: string }>();
  let counter = 1;
  for (const [path, content] of Object.entries(initial)) {
    files.set(path, { content, fileId: `f_${counter++}` });
  }
  return {
    async readFile(path) {
      const f = files.get(path);
      return f ? { content: f.content, fileId: f.fileId } : null;
    },
    async patchFile(fileId, newContent) {
      for (const [path, file] of files.entries()) {
        if (file.fileId === fileId) {
          files.set(path, { content: newContent, fileId });
          return true;
        }
      }
      return false;
    },
  };
}

function makePullClient(tasks: TickTickRawTask[]): TickTickPullClient {
  return { async listAllTasks() { return tasks; } };
}

const silentNotifier: TelegramDeleteNotifier = {
  async notifyDeleteRequest() { return true; },
};

describe('audit-log branchement pull-engine', () => {
  it('appendAuditLog appelé pour create-from-tt (tâche orpheline TickTick)', async () => {
    const state = stateWithProjects();
    const patcher = makePullPatcher({ '03. Tâches/Todo.md': '## Inbox\n' });
    const tt: TickTickRawTask = {
      id: 'tt_orphan',
      projectId: 'proj_inbox',
      title: 'créée mobile',
      modifiedAt: '2026-05-19T10:00:00Z',
    };
    await runPullEngine(state, makePullClient([tt]), patcher, silentNotifier);
    const call = appendAuditLogSpy.mock.calls.find(
      ([e]) => e.op === 'create-from-tt' && e.direction === 'pull',
    );
    expect(call).toBeDefined();
    expect(call![0].taskId).toBe('tt_orphan');
  });

  it('appendAuditLog appelé pour complete-sync (TT status=2 → patch [x])', async () => {
    const state = stateWithProjects();
    state.tasks['03. Tâches/Todo.md:L2'] = {
      ticktickId: 'tt_done',
      projectId: 'proj_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T00:00:00Z',
    };
    const patcher = makePullPatcher({
      '03. Tâches/Todo.md': '## Inbox\n- [ ] à compléter\n',
    });
    const tt: TickTickRawTask = {
      id: 'tt_done',
      projectId: 'proj_inbox',
      title: 'x',
      status: 2,
      modifiedAt: '2026-05-19T11:00:00Z',
    };
    await runPullEngine(state, makePullClient([tt]), patcher, silentNotifier);
    const call = appendAuditLogSpy.mock.calls.find(
      ([e]) => e.op === 'complete-sync' && e.direction === 'pull',
    );
    expect(call).toBeDefined();
  });

  it('appendAuditLog appelé pour patch-line + conflict-tt-wins', async () => {
    const state = stateWithProjects();
    state.tasks['03. Tâches/Todo.md:L2'] = {
      ticktickId: 'tt_patch',
      projectId: 'proj_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T09:00:00Z',
      ticktickModifiedAt: '2026-05-19T09:00:00Z',
    };
    const patcher = makePullPatcher({
      '03. Tâches/Todo.md': '## Inbox\n- [ ] ancien titre\n',
    });
    const tt: TickTickRawTask = {
      id: 'tt_patch',
      projectId: 'proj_inbox',
      title: 'nouveau titre TT',
      modifiedAt: '2026-05-19T10:00:00Z', // > lastSyncedAt → TT gagne
    };
    await runPullEngine(state, makePullClient([tt]), patcher, silentNotifier);
    const patchCall = appendAuditLogSpy.mock.calls.find(
      ([e]) => e.op === 'patch-line' && e.direction === 'pull',
    );
    const conflictCall = appendAuditLogSpy.mock.calls.find(
      ([e]) => e.op === 'conflict-tt-wins' && e.direction === 'pull',
    );
    expect(patchCall).toBeDefined();
    expect(conflictCall).toBeDefined();
  });

  it('appendAuditLog appelé pour conflict-vault-wins', async () => {
    const state = stateWithProjects();
    state.tasks['03. Tâches/Todo.md:L1'] = {
      ticktickId: 'tt_vw',
      projectId: 'proj_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T11:00:00Z',
      ticktickModifiedAt: '2026-05-19T11:00:00Z',
    };
    const patcher = makePullPatcher({
      '03. Tâches/Todo.md': '## Inbox\n- [ ] vault récent\n',
    });
    const tt: TickTickRawTask = {
      id: 'tt_vw',
      projectId: 'proj_inbox',
      title: 'vieux titre',
      modifiedAt: '2026-05-19T09:00:00Z', // < lastSyncedAt → vault gagne
    };
    await runPullEngine(state, makePullClient([tt]), patcher, silentNotifier);
    const call = appendAuditLogSpy.mock.calls.find(
      ([e]) => e.op === 'conflict-vault-wins' && e.direction === 'pull',
    );
    expect(call).toBeDefined();
    expect(call![0].taskId).toBe('tt_vw');
  });

  it('appendAuditLog appelé pour pending-delete (red line §9.2)', async () => {
    const state = stateWithProjects();
    state.tasks['03. Tâches/Todo.md:L3'] = {
      ticktickId: 'tt_gone',
      projectId: 'proj_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T00:00:00Z',
    };
    const patcher = makePullPatcher({
      '03. Tâches/Todo.md': '## Inbox\n- [ ] supprimée\n- [ ] autre\n- [ ] cible\n',
    });
    // TickTick ne renvoie plus cette tâche → trigger pending-delete
    await runPullEngine(state, makePullClient([]), patcher, silentNotifier);
    const call = appendAuditLogSpy.mock.calls.find(
      ([e]) => e.op === 'pending-delete' && e.direction === 'pull',
    );
    expect(call).toBeDefined();
    expect(call![0].taskId).toBe('tt_gone');
    expect(call![0].status).toBe('ok');
  });
});

// ============================================================
// ticktick-delete-confirm — actions 'yes' / 'keep' / 'view'
// ============================================================
//
// Pour ces tests, on mocke fortement les dépendances Drive/Telegram.
// On vérifie juste que appendAuditLogSpy est invoqué avec l'op correcte.

describe('audit-log branchement ticktick-delete-confirm', () => {
  it("action 'keep' déclenche appendAuditLog op='keep'", async () => {
    // Setup state avec pending
    vi.resetModules();

    vi.doMock('../state-store', () => ({
      loadSyncState: vi.fn(async () => {
        const s = stateWithProjects();
        s.pendingDeletes = {
          tt_keep_x: {
            ticktickId: 'tt_keep_x',
            taskKey: '03. Tâches/Todo.md:L7',
            title: 'à garder',
            vaultPath: '03. Tâches/Todo.md',
            lineNumber: 7,
            createdAt: new Date().toISOString(),
          },
        };
        s.tasks['03. Tâches/Todo.md:L7'] = {
          ticktickId: 'tt_keep_x',
          projectId: 'proj_inbox',
          vaultHash: 'h',
          lastSyncedAt: '2026-05-19T00:00:00Z',
        };
        return s;
      }),
      saveSyncState: vi.fn(async () => true),
    }));

    vi.doMock('../../telegram', () => ({
      answerCallbackQuery: vi.fn(async () => true),
    }));

    vi.doMock('../../telegram-validation/telegram-cards', () => ({
      editMessageText: vi.fn(async () => true),
      sendSimpleMessage: vi.fn(async () => true),
    }));

    vi.doMock('../audit-log', () => ({
      appendAuditLog: appendAuditLogSpy,
    }));

    const mod = await import('../../telegram-validation/handlers/ticktick-delete-confirm');
    const res = await mod.handleTickTickDeleteCallback({
      callback_query_id: 'cb_1',
      data: 'tickticksync_delete:keep:tt_keep_x',
      message_id: 1,
      chat_id: 42,
    });
    expect(res).toBe('kept');
    const keepCall = appendAuditLogSpy.mock.calls.find(
      ([e]) => e.op === 'keep' && e.taskId === 'tt_keep_x',
    );
    expect(keepCall).toBeDefined();

    vi.doUnmock('../state-store');
    vi.doUnmock('../../telegram');
    vi.doUnmock('../../telegram-validation/telegram-cards');
    vi.doUnmock('../audit-log');
  });
});
