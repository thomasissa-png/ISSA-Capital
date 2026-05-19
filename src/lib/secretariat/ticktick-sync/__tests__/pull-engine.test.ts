/**
 * Tests pull-engine — TickTick → vault (S18.2, mis à jour S19).
 *
 * On teste avec des mocks injectables (TickTickPullClient, VaultPatcher)
 * — pas de réseau, pas de Drive.
 *
 * S19 — deletes TickTick = completion silencieuse vault (remplace red
 * line §9.2 historique : carte Telegram retirée).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveConflict,
  ticktickToVaultTask,
  insertTaskUnderInbox,
  removeLineByNumber,
  replaceLineByNumber,
  tryAcquireSyncLock,
  releaseSyncLock,
  runPullEngine,
  type TickTickPullClient,
  type VaultPatcher,
} from '../pull-engine';
import {
  emptyState,
  type SyncState,
  type TickTickRawTask,
} from '../types';

// ============================================================
// Mocks helpers
// ============================================================

interface FakeStore {
  files: Map<string, { content: string; fileId: string }>;
  patchCalls: Array<{ fileId: string; content: string }>;
}

function makeFakeStore(initial: Record<string, string>): FakeStore {
  const files = new Map<string, { content: string; fileId: string }>();
  let counter = 1;
  for (const [path, content] of Object.entries(initial)) {
    files.set(path, { content, fileId: `file_${counter++}` });
  }
  return { files, patchCalls: [] };
}

function makePatcher(store: FakeStore): VaultPatcher {
  return {
    async readFile(vaultPath) {
      const f = store.files.get(vaultPath);
      return f ? { content: f.content, fileId: f.fileId } : null;
    },
    async patchFile(fileId, newContent) {
      store.patchCalls.push({ fileId, content: newContent });
      for (const [path, file] of store.files.entries()) {
        if (file.fileId === fileId) {
          store.files.set(path, { content: newContent, fileId });
          return true;
        }
      }
      return false;
    },
  };
}

function makeClient(tasks: TickTickRawTask[]): TickTickPullClient {
  return {
    async listAllTasks() { return tasks; },
  };
}

// S19 — makeNotifier retiré : completion silencieuse remplace la carte
// Telegram delete. Les anciens tests `delete_requested` deviennent
// `completed_silently` (cf. describe "delete TickTick → completion silencieuse").

function makeReadyState(): SyncState {
  const s = emptyState();
  s.projects = {
    Personnel: 'p_perso',
    Versi: 'p_versi',
    ISSA: 'p_issa',
    'Gradient One': 'p_go',
    Immobilier: 'p_immo',
    Sarani: 'p_sarani',
    Inbox: 'p_inbox',
  };
  return s;
}

// ============================================================
// Tests resolveConflict (5 cas spec §4 + 1 state corrompu)
// ============================================================

describe('resolveConflict — last-write-wins arbitre §4', () => {
  it('unknown_state si pas d\'entrée state', () => {
    const state = makeReadyState();
    const r = resolveConflict(state, 'tt_42', '2026-05-19T10:00:00Z');
    expect(r.decision).toBe('unknown_state');
  });

  it('ticktick_wins si modifiedAt > lastSyncedAt', () => {
    const state = makeReadyState();
    state.tasks['Todo.md:L1'] = {
      ticktickId: 'tt_42',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T10:00:00Z',
    };
    const r = resolveConflict(state, 'tt_42', '2026-05-19T11:00:00Z');
    expect(r.decision).toBe('ticktick_wins');
    expect(r.entry?.ticktickId).toBe('tt_42');
  });

  it('vault_wins si égalité timestamps (canonique vault, R6)', () => {
    const state = makeReadyState();
    const ts = '2026-05-19T10:00:00Z';
    state.tasks['Todo.md:L1'] = {
      ticktickId: 'tt_42',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: ts,
      ticktickModifiedAt: ts,
    };
    const r = resolveConflict(state, 'tt_42', ts);
    expect(r.decision).toBe('vault_wins');
  });

  it('vault_wins si vault plus récent', () => {
    const state = makeReadyState();
    state.tasks['Todo.md:L1'] = {
      ticktickId: 'tt_42',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T11:00:00Z',
      ticktickModifiedAt: '2026-05-19T11:00:00Z',
    };
    const r = resolveConflict(state, 'tt_42', '2026-05-19T10:00:00Z');
    expect(r.decision).toBe('vault_wins');
  });

  it('vault_wins si modifiedAt absent', () => {
    const state = makeReadyState();
    state.tasks['Todo.md:L1'] = {
      ticktickId: 'tt_42',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T10:00:00Z',
    };
    const r = resolveConflict(state, 'tt_42', undefined);
    expect(r.decision).toBe('vault_wins');
  });

  it('vault_wins si state corrompu (timestamps invalides)', () => {
    const state = makeReadyState();
    state.tasks['Todo.md:L1'] = {
      ticktickId: 'tt_42',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: 'INVALID',
    };
    const r = resolveConflict(state, 'tt_42', 'ALSO_INVALID');
    expect(r.decision).toBe('vault_wins');
  });
});

// ============================================================
// Tests insertTaskUnderInbox / removeLineByNumber / replaceLineByNumber
// ============================================================

describe('insertTaskUnderInbox', () => {
  it('insère sous `## Inbox` existante', () => {
    const before = `# Todo\n\n## Inbox\n- [ ] tache1\n\n## Autres\n- [ ] x\n`;
    const after = insertTaskUnderInbox(before, '- [ ] nouvelle');
    expect(after).toContain('## Inbox\n- [ ] nouvelle\n- [ ] tache1');
    expect(after).toContain('## Autres');
  });

  it('crée la section `## Inbox` si absente', () => {
    const before = `# Todo\n## Autres\n- [ ] x\n`;
    const after = insertTaskUnderInbox(before, '- [ ] nouvelle');
    expect(after).toMatch(/## Inbox\n- \[ \] nouvelle/u);
  });

  it('gère contenu vide', () => {
    const after = insertTaskUnderInbox('', '- [ ] x');
    expect(after).toBe('## Inbox\n- [ ] x\n');
  });
});

describe('removeLineByNumber', () => {
  it('supprime la ligne 2 sur 3', () => {
    const c = 'a\nb\nc';
    expect(removeLineByNumber(c, 2)).toBe('a\nc');
  });
  it('no-op si lineNumber hors range', () => {
    const c = 'a\nb';
    expect(removeLineByNumber(c, 99)).toBe(c);
    expect(removeLineByNumber(c, 0)).toBe(c);
  });
});

describe('replaceLineByNumber', () => {
  it('remplace la ligne 1', () => {
    expect(replaceLineByNumber('a\nb', 1, 'A')).toBe('A\nb');
  });
  it('no-op si lineNumber hors range', () => {
    expect(replaceLineByNumber('a\nb', 99, 'X')).toBe('a\nb');
  });
});

// ============================================================
// Tests tryAcquireSyncLock / releaseSyncLock (concurrence push/pull)
// ============================================================

describe('syncLock — anti-concurrence push/pull', () => {
  it('acquiert le verrou si libre', () => {
    const state = makeReadyState();
    expect(tryAcquireSyncLock(state, 'pull')).toBe(true);
    expect(state.syncLock?.kind).toBe('pull');
  });

  it('refuse si déjà tenu < 30s', () => {
    const state = makeReadyState();
    const t = new Date('2026-05-19T10:00:00Z');
    expect(tryAcquireSyncLock(state, 'pull', t)).toBe(true);
    const t2 = new Date(t.getTime() + 10_000);
    expect(tryAcquireSyncLock(state, 'push', t2)).toBe(false);
  });

  it('reprend si TTL 30s écoulé (deadlock recovery)', () => {
    const state = makeReadyState();
    const t = new Date('2026-05-19T10:00:00Z');
    tryAcquireSyncLock(state, 'pull', t);
    const t2 = new Date(t.getTime() + 31_000);
    expect(tryAcquireSyncLock(state, 'push', t2)).toBe(true);
    expect(state.syncLock?.kind).toBe('push');
  });

  it('releaseSyncLock libère le verrou', () => {
    const state = makeReadyState();
    tryAcquireSyncLock(state, 'pull');
    releaseSyncLock(state);
    expect(state.syncLock).toBeUndefined();
  });
});

// ============================================================
// Tests runPullEngine — full pipeline
// ============================================================

describe('runPullEngine — pipeline pull', () => {
  beforeEach(() => {
    // Nothing global to reset.
  });

  it('TickTick gagne timestamps → patch vault', async () => {
    const state = makeReadyState();
    state.tasks['Todo.md:L3'] = {
      ticktickId: 'tt_1',
      projectId: 'p_inbox',
      vaultHash: 'old',
      lastSyncedAt: '2026-05-19T10:00:00Z',
      ticktickModifiedAt: '2026-05-19T10:00:00Z',
    };
    const store = makeFakeStore({ 'Todo.md': '# T\n\n- [ ] old\n' });
    const patcher = makePatcher(store);
    const client = makeClient([
      { id: 'tt_1', projectId: 'p_inbox', title: 'new title', status: 0, modifiedAt: '2026-05-19T11:00:00Z' },
    ]);
    const res = await runPullEngine(state, client, patcher);
    expect(res.stats.patched).toBe(1);
    expect(store.files.get('Todo.md')?.content).toContain('new title');
  });

  it('vault gagne égalité → no-op pull (vault_wins)', async () => {
    const state = makeReadyState();
    const ts = '2026-05-19T10:00:00Z';
    state.tasks['Todo.md:L3'] = {
      ticktickId: 'tt_1',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: ts,
      ticktickModifiedAt: ts,
    };
    const store = makeFakeStore({ 'Todo.md': '# T\n\n- [ ] orig\n' });
    const patcher = makePatcher(store);
    const client = makeClient([
      { id: 'tt_1', projectId: 'p_inbox', title: 'orig', status: 0, modifiedAt: ts },
    ]);
    const res = await runPullEngine(state, client, patcher);
    expect(res.stats.vaultWins).toBe(1);
    expect(res.stats.patched).toBe(0);
    expect(store.patchCalls).toHaveLength(0);
  });

  it('vault plus récent → no-op pull (push gérera)', async () => {
    const state = makeReadyState();
    state.tasks['Todo.md:L3'] = {
      ticktickId: 'tt_1',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T12:00:00Z',
      ticktickModifiedAt: '2026-05-19T12:00:00Z',
    };
    const store = makeFakeStore({ 'Todo.md': '# T\n\n- [ ] orig\n' });
    const patcher = makePatcher(store);
    const client = makeClient([
      { id: 'tt_1', projectId: 'p_inbox', title: 'orig', status: 0, modifiedAt: '2026-05-19T10:00:00Z' },
    ]);
    const res = await runPullEngine(state, client, patcher);
    expect(res.stats.vaultWins).toBe(1);
    expect(res.stats.patched).toBe(0);
  });

  it('tâche TickTick inconnue → ajout Todo.md sous `## Inbox`', async () => {
    const state = makeReadyState();
    const store = makeFakeStore({ '03. Tâches/Todo.md': '# T\n\n## Inbox\n- [ ] ancienne\n' });
    const patcher = makePatcher(store);
    const client = makeClient([
      { id: 'tt_new', projectId: 'p_inbox', title: 'créée mobile', status: 0, modifiedAt: '2026-05-19T11:00:00Z' },
    ]);
    const res = await runPullEngine(state, client, patcher);
    expect(res.stats.created).toBe(1);
    const content = store.files.get('03. Tâches/Todo.md')?.content ?? '';
    expect(content).toContain('créée mobile');
    expect(content).toContain('ancienne'); // ne casse pas l'existant
  });

  it('complétion sync — TT status=2 → patch [x] vault', async () => {
    const state = makeReadyState();
    state.tasks['Todo.md:L3'] = {
      ticktickId: 'tt_done',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T10:00:00Z',
    };
    const store = makeFakeStore({ 'Todo.md': '# T\n\n- [ ] complete-me\n' });
    const patcher = makePatcher(store);
    const client = makeClient([
      { id: 'tt_done', projectId: 'p_inbox', title: 'complete-me', status: 2, modifiedAt: '2026-05-19T11:00:00Z' },
    ]);
    const res = await runPullEngine(state, client, patcher);
    expect(res.stats.completed).toBe(1);
    expect(store.files.get('Todo.md')?.content).toContain('[x] complete-me');
  });

  it('delete TickTick → completion silencieuse vault (S19, remplace red line §9.2)', async () => {
    const state = makeReadyState();
    // Ligne 3 = `- [ ] orphan` (après "# T" + ligne vide)
    state.tasks['Todo.md:L3'] = {
      ticktickId: 'tt_gone',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T10:00:00Z',
    };
    const store = makeFakeStore({ 'Todo.md': '# T\n\n- [ ] orphan\n' });
    const patcher = makePatcher(store);
    // TickTick ne renvoie plus tt_gone
    const client = makeClient([]);
    const res = await runPullEngine(state, client, patcher);
    expect(res.stats.completedSilently).toBe(1);
    expect(res.results.some((r) => r.action === 'completed_silently')).toBe(true);
    // Patch effectué (vault `[ ]` → `[x]`)
    expect(store.patchCalls).toHaveLength(1);
    expect(store.files.get('Todo.md')?.content).toContain('- [x] orphan');
    // lastSyncedAt mis à jour pour idempotence cross-run
    expect(state.tasks['Todo.md:L3']?.lastSyncedAt).not.toBe('2026-05-19T10:00:00Z');
  });

  it('delete TickTick idempotent — ligne déjà [x] → no-op silencieux', async () => {
    const state = makeReadyState();
    state.tasks['Todo.md:L3'] = {
      ticktickId: 'tt_gone',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T10:00:00Z',
    };
    // Ligne déjà cochée — simule passage cron N°2 après N°1
    const store = makeFakeStore({ 'Todo.md': '# T\n\n- [x] orphan déjà fait\n' });
    const patcher = makePatcher(store);
    const client = makeClient([]);
    const res = await runPullEngine(state, client, patcher);
    // Pas d'incrément stats — no-op
    expect(res.stats.completedSilently).toBe(0);
    expect(res.stats.errors).toBe(0);
    // Aucun patch émis
    expect(store.patchCalls).toHaveLength(0);
    // Contenu intact
    expect(store.files.get('Todo.md')?.content).toContain('- [x] orphan déjà fait');
  });

  it('delete TickTick — variantes markdown `*` et `+` patchées', async () => {
    const state = makeReadyState();
    state.tasks['Todo.md:L1'] = {
      ticktickId: 'tt_a',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T10:00:00Z',
    };
    state.tasks['Todo.md:L2'] = {
      ticktickId: 'tt_b',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T10:00:00Z',
    };
    const store = makeFakeStore({ 'Todo.md': '* [ ] avec étoile\n+ [ ] avec plus\n' });
    const patcher = makePatcher(store);
    const res = await runPullEngine(state, makeClient([]), patcher);
    expect(res.stats.completedSilently).toBe(2);
    const content = store.files.get('Todo.md')?.content ?? '';
    expect(content).toContain('* [x] avec étoile');
    expect(content).toContain('+ [x] avec plus');
  });

  it('delete TickTick — ligne introuvable (vault modifié) → warn no-op, pas d\'erreur', async () => {
    const state = makeReadyState();
    // state pointe vers L99 hors range
    state.tasks['Todo.md:L99'] = {
      ticktickId: 'tt_gone',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T10:00:00Z',
    };
    const store = makeFakeStore({ 'Todo.md': '# T\n' });
    const patcher = makePatcher(store);
    const res = await runPullEngine(state, makeClient([]), patcher);
    // No-op : pas de patch, pas de completion comptée
    expect(res.stats.completedSilently).toBe(0);
    expect(store.patchCalls).toHaveLength(0);
    // Pas non plus d'incrément errors (recordError n'est pas appelé pour line_out_of_range)
    // — c'est juste une trace JSONL error mais le pipeline reste sain
  });

  it('delete TickTick — ligne non-checkbox (refacto vault) → no-op silencieux', async () => {
    const state = makeReadyState();
    state.tasks['Todo.md:L2'] = {
      ticktickId: 'tt_gone',
      projectId: 'p_inbox',
      vaultHash: 'h',
      lastSyncedAt: '2026-05-19T10:00:00Z',
    };
    // Ligne 2 = du texte libre (vault refactorisé entre push et pull)
    const store = makeFakeStore({ 'Todo.md': '# T\nplain text, plus une tâche\n' });
    const patcher = makePatcher(store);
    const res = await runPullEngine(state, makeClient([]), patcher);
    expect(res.stats.completedSilently).toBe(0);
    expect(store.patchCalls).toHaveLength(0);
  });

  it('delete TickTick — purge pendingDeletes hérités du state (rétro-compat S19)', async () => {
    const state = makeReadyState();
    // Ancien state Drive pré-S19 contient des pendingDeletes
    state.pendingDeletes = {
      tt_legacy: { ticktickId: 'tt_legacy', taskKey: 'x', title: 'old' },
    };
    const store = makeFakeStore({ 'Todo.md': '## Inbox\n' });
    const patcher = makePatcher(store);
    await runPullEngine(state, makeClient([]), patcher);
    expect(state.pendingDeletes).toBeUndefined();
  });

  it('skip pipeline si projets pas encore prêts', async () => {
    const state = emptyState();
    const store = makeFakeStore({});
    const patcher = makePatcher(store);
    const client = makeClient([]);
    const res = await runPullEngine(state, client, patcher);
    expect(res.stats.fetched).toBe(0);
    expect(res.results).toHaveLength(0);
  });

  it('met à jour state.lastPollTickTick à la fin', async () => {
    const state = makeReadyState();
    const before = state.lastPollTickTick;
    const store = makeFakeStore({ '03. Tâches/Todo.md': '## Inbox\n' });
    const patcher = makePatcher(store);
    const client = makeClient([]);
    await runPullEngine(state, client, patcher);
    expect(state.lastPollTickTick).toBeDefined();
    expect(state.lastPollTickTick).not.toBe(before);
  });
});

// ============================================================
// Tests ticktickToVaultTask
// ============================================================

describe('ticktickToVaultTask', () => {
  it('map status/priority/tags', () => {
    const t = ticktickToVaultTask(
      { id: '1', projectId: 'p', title: 'hello', status: 2, priority: 5, tags: ['Versi', 'X'] },
      { vaultPath: 'Todo.md', lineNumber: 1 },
    );
    expect(t.status).toBe(2);
    expect(t.priority).toBe(5);
    expect(t.tags).toEqual(['versi', 'x']);
  });

  it('default isAllDay=true si absent', () => {
    const t = ticktickToVaultTask(
      { id: '1', projectId: 'p', title: 'x' },
      { vaultPath: 'Todo.md', lineNumber: 1 },
    );
    expect(t.isAllDay).toBe(true);
  });
});
