/**
 * Tests `mirror-renderer.ts` — régénération miroir `Todo.md` depuis TickTick (S20).
 *
 * Couvre :
 *  - Groupement par projet + section `## Inbox` pour tâches orphelines.
 *  - Ordre dueDate asc + priority desc.
 *  - Header AUTO-GENERATED + timestamp.
 *  - Idempotence via hash sha1 (no-op si contenu inchangé).
 *  - Tâches complétées (status=2) exclues.
 *  - Réutilisation propre du serializer S18.
 *  - Erreur Drive PATCH → warn, pas de throw vers l'appelant.
 *  - fileId introuvable → stats.error, jamais de throw.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TickTickProject, TickTickTask } from '../types';

// Mocks au niveau module (vi.mock est hoisté)
vi.mock('../ticktick-client', () => ({
  listProjects: vi.fn(),
  listTasks: vi.fn(),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  resolveFilePath: vi.fn(),
  listMarkdownFiles: vi.fn(),
}));

vi.mock('../../drive-upload', () => ({
  updateFileContent: vi.fn(),
}));

// Imports après mocks
import {
  compareTasksForRender,
  hashContent,
  loadMirrorState,
  regenerateTodoMirror,
  renderMirrorMarkdown,
  saveMirrorState,
  TODO_MIRROR_FILENAME,
  TODO_MIRROR_FOLDER,
} from '../mirror-renderer';
import { listProjects, listTasks } from '../ticktick-client';
import { resolveFilePath, listMarkdownFiles } from '../../vault-client/drive-resolver';
import { updateFileContent } from '../../drive-upload';
import { unlinkSync, existsSync } from 'node:fs';

// Helper : nettoyer le state hash entre tests
const STATE_PATH_TEST = existsSync('/home/runner')
  ? '/home/runner/issa-data/ticktick-mirror-state.json'
  : '/tmp/issa-secretariat/ticktick-mirror-state.json';

function clearMirrorStateFile(): void {
  try {
    if (existsSync(STATE_PATH_TEST)) unlinkSync(STATE_PATH_TEST);
  } catch {
    /* ignore */
  }
}

// Helpers de fixtures
function makeProject(id: string, name: string): TickTickProject {
  return { id, name, color: '#000', sortOrder: 0, viewMode: 'list', closed: false } as TickTickProject;
}

function makeTask(p: Partial<TickTickTask> & { id: string; title: string }): TickTickTask {
  return {
    id: p.id,
    projectId: p.projectId ?? '',
    title: p.title,
    status: p.status ?? 0,
    priority: p.priority ?? 0,
    isAllDay: p.isAllDay ?? true,
    dueDate: p.dueDate,
    tags: p.tags,
    repeatFlag: p.repeatFlag,
  } as TickTickTask;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearMirrorStateFile();
});

describe('compareTasksForRender', () => {
  it('dueDate asc en priorité', () => {
    const a = makeTask({ id: 'a', title: 'A', dueDate: '2026-06-01T00:00:00.000Z' });
    const b = makeTask({ id: 'b', title: 'B', dueDate: '2026-05-01T00:00:00.000Z' });
    expect(compareTasksForRender(a, b)).toBeGreaterThan(0);
    expect(compareTasksForRender(b, a)).toBeLessThan(0);
  });

  it('priority desc à dueDate égal', () => {
    const a = makeTask({ id: 'a', title: 'A', dueDate: '2026-06-01T00:00:00.000Z', priority: 1 });
    const b = makeTask({ id: 'b', title: 'B', dueDate: '2026-06-01T00:00:00.000Z', priority: 5 });
    // priority desc → 5 avant 1 → b doit venir avant a → compare(a,b) > 0
    expect(compareTasksForRender(a, b)).toBeGreaterThan(0);
  });

  it('tâche sans dueDate placée en fin', () => {
    const withDue = makeTask({ id: 'a', title: 'A', dueDate: '2026-06-01T00:00:00.000Z' });
    const noDue = makeTask({ id: 'b', title: 'B' });
    expect(compareTasksForRender(withDue, noDue)).toBeLessThan(0);
    expect(compareTasksForRender(noDue, withDue)).toBeGreaterThan(0);
  });
});

describe('renderMirrorMarkdown', () => {
  const NOW = new Date('2026-05-22T10:15:00.000Z');

  it('header AUTO-GENERATED + timestamp ISO présents', () => {
    const md = renderMirrorMarkdown([], [], NOW);
    expect(md).toContain('<!-- AUTO-GENERATED depuis TickTick. NE PAS ÉDITER.');
    expect(md).toContain('Dernière régénération : 2026-05-22T10:15:00.000Z');
    expect(md).toContain('Source : TickTick API.');
  });

  it('groupement par projet, section Inbox en tête pour orphelines', () => {
    const projects = [makeProject('p1', 'Critique'), makeProject('p2', 'Important')];
    const tasks = [
      makeTask({ id: 't1', title: 'Tâche orpheline', projectId: 'inconnu' }),
      makeTask({ id: 't2', title: 'Tâche critique', projectId: 'p1' }),
      makeTask({ id: 't3', title: 'Tâche importante', projectId: 'p2' }),
    ];

    const md = renderMirrorMarkdown(tasks, projects, NOW);
    const inboxIdx = md.indexOf('## Inbox');
    const critiqueIdx = md.indexOf('## Critique');
    const importantIdx = md.indexOf('## Important');

    expect(inboxIdx).toBeGreaterThan(-1);
    expect(critiqueIdx).toBeGreaterThan(-1);
    expect(importantIdx).toBeGreaterThan(-1);
    // Inbox en tête (avant projets)
    expect(inboxIdx).toBeLessThan(critiqueIdx);
    expect(inboxIdx).toBeLessThan(importantIdx);
    // Projets en ordre alphabétique français : Critique avant Important
    expect(critiqueIdx).toBeLessThan(importantIdx);
  });

  it('tâches complétées (status=2) exclues du miroir', () => {
    const projects = [makeProject('p1', 'Critique')];
    const tasks = [
      makeTask({ id: 't1', title: 'Active', projectId: 'p1', status: 0 }),
      makeTask({ id: 't2', title: 'Complétée', projectId: 'p1', status: 2 }),
    ];
    const md = renderMirrorMarkdown(tasks, projects, NOW);
    expect(md).toContain('Active');
    expect(md).not.toContain('Complétée');
  });

  it('ordre intra-section : dueDate asc puis priority desc', () => {
    const projects = [makeProject('p1', 'Important')];
    const tasks = [
      makeTask({
        id: 't1',
        title: 'Sans échéance',
        projectId: 'p1',
      }),
      makeTask({
        id: 't2',
        title: 'Échéance lointaine basse priorité',
        projectId: 'p1',
        dueDate: '2026-12-01T00:00:00.000Z',
        priority: 1,
      }),
      makeTask({
        id: 't3',
        title: 'Échéance proche',
        projectId: 'p1',
        dueDate: '2026-06-01T00:00:00.000Z',
        priority: 0,
      }),
      makeTask({
        id: 't4',
        title: 'Échéance proche haute priorité',
        projectId: 'p1',
        dueDate: '2026-06-01T00:00:00.000Z',
        priority: 5,
      }),
    ];
    const md = renderMirrorMarkdown(tasks, projects, NOW);
    const idxHaute = md.indexOf('Échéance proche haute priorité');
    // Le titre "Échéance proche" est suivi d'un espace puis emoji 📅 (serializer)
    const idxNormale = md.indexOf('- [ ] Échéance proche 📅');
    const idxLointaine = md.indexOf('Échéance lointaine basse priorité');
    const idxSans = md.indexOf('Sans échéance');

    expect(idxHaute).toBeGreaterThan(-1);
    expect(idxNormale).toBeGreaterThan(-1);
    // Haute priorité avant normale (priority desc à dueDate égal)
    expect(idxHaute).toBeLessThan(idxNormale);
    // Échéance proche avant lointaine
    expect(idxNormale).toBeLessThan(idxLointaine);
    // Tâches sans échéance en fin
    expect(idxLointaine).toBeLessThan(idxSans);
  });

  it('serializer compatible S18 (réutilisation propre — emoji 📅 présent)', () => {
    const projects = [makeProject('p1', 'Critique')];
    const tasks = [
      makeTask({
        id: 't1',
        title: 'Avec date',
        projectId: 'p1',
        dueDate: '2026-06-15T00:00:00.000Z',
      }),
    ];
    const md = renderMirrorMarkdown(tasks, projects, NOW);
    expect(md).toContain('📅 2026-06-15');
    expect(md).toContain('- [ ] Avec date');
  });

  it('priorité haute → emoji ⏫ via serializer S18', () => {
    const projects = [makeProject('p1', 'Critique')];
    const tasks = [
      makeTask({
        id: 't1',
        title: 'Tâche critique',
        projectId: 'p1',
        priority: 5,
      }),
    ];
    const md = renderMirrorMarkdown(tasks, projects, NOW);
    expect(md).toContain('⏫');
  });
});

describe('hashContent + idempotence state', () => {
  it('hashContent stable pour même input', () => {
    const a = hashContent('hello');
    const b = hashContent('hello');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
  });

  it('hashContent différent pour inputs différents', () => {
    expect(hashContent('a')).not.toBe(hashContent('b'));
  });

  it('saveMirrorState + loadMirrorState round-trip', () => {
    saveMirrorState({
      version: 1,
      lastContentHash: 'abc123',
      lastRenderedAt: '2026-05-22T10:15:00.000Z',
    });
    const loaded = loadMirrorState();
    expect(loaded).not.toBeNull();
    expect(loaded?.lastContentHash).toBe('abc123');
  });
});

describe('regenerateTodoMirror — pipeline complet', () => {
  const NOW = new Date('2026-05-22T10:15:00.000Z');
  const projects = [makeProject('p1', 'Critique')];
  const tasks = [makeTask({ id: 't1', title: 'Test', projectId: 'p1' })];

  it('PATCH Drive réussi → stats.patched=true + state persisté', async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);
    vi.mocked(listTasks).mockResolvedValue(tasks);
    vi.mocked(resolveFilePath).mockResolvedValue({ success: true, fileId: 'file123' });
    vi.mocked(updateFileContent).mockResolvedValue({ success: true, fileId: 'file123' });

    const stats = await regenerateTodoMirror(NOW);

    expect(stats.totalTasks).toBe(1);
    expect(stats.changed).toBe(true);
    expect(stats.patched).toBe(true);
    expect(stats.error).toBeUndefined();
    expect(updateFileContent).toHaveBeenCalledWith(
      'file123',
      expect.stringContaining('## Critique'),
      'text/markdown',
    );
    // State persisté
    expect(loadMirrorState()?.lastContentHash).toBe(stats.contentHash);
  });

  it('idempotence : 2 appels successifs avec mêmes tâches → no-op via hash', async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);
    vi.mocked(listTasks).mockResolvedValue(tasks);
    vi.mocked(resolveFilePath).mockResolvedValue({ success: true, fileId: 'file123' });
    vi.mocked(updateFileContent).mockResolvedValue({ success: true, fileId: 'file123' });

    const stats1 = await regenerateTodoMirror(NOW);
    expect(stats1.changed).toBe(true);
    expect(stats1.patched).toBe(true);
    expect(updateFileContent).toHaveBeenCalledTimes(1);

    // Second appel : même contenu → no-op (pas de PATCH)
    const stats2 = await regenerateTodoMirror(NOW);
    expect(stats2.changed).toBe(false);
    expect(stats2.patched).toBe(false);
    expect(stats2.contentHash).toBe(stats1.contentHash);
    // updateFileContent toujours appelé 1 seule fois (pas de second PATCH)
    expect(updateFileContent).toHaveBeenCalledTimes(1);
  });

  it('fileId introuvable → stats.error renseigné, pas de throw', async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);
    vi.mocked(listTasks).mockResolvedValue(tasks);
    vi.mocked(resolveFilePath).mockResolvedValue({ success: false });
    vi.mocked(listMarkdownFiles).mockResolvedValue([]);

    const stats = await regenerateTodoMirror(NOW);
    expect(stats.error).toContain('fileId introuvable');
    expect(stats.patched).toBe(false);
    expect(updateFileContent).not.toHaveBeenCalled();
  });

  it('Drive PATCH KO → stats.error renseigné, pas de throw', async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);
    vi.mocked(listTasks).mockResolvedValue(tasks);
    vi.mocked(resolveFilePath).mockResolvedValue({ success: true, fileId: 'file123' });
    vi.mocked(updateFileContent).mockResolvedValue({ success: false, error: 'quota exceeded' });

    const stats = await regenerateTodoMirror(NOW);
    expect(stats.error).toContain('Drive PATCH échoué');
    expect(stats.error).toContain('quota exceeded');
    expect(stats.patched).toBe(false);
  });

  it('TickTick API throw → stats.error renseigné, pas de throw vers appelant', async () => {
    vi.mocked(listProjects).mockRejectedValue(new Error('TickTick 503'));
    vi.mocked(listTasks).mockRejectedValue(new Error('TickTick 503'));

    const stats = await regenerateTodoMirror(NOW);
    expect(stats.error).toContain('TickTick 503');
    expect(stats.patched).toBe(false);
  });

  it('résolution fileId R1/R7 — pas de hardcoded (chemin via vault-resolver)', async () => {
    vi.mocked(listProjects).mockResolvedValue(projects);
    vi.mocked(listTasks).mockResolvedValue(tasks);
    vi.mocked(resolveFilePath).mockResolvedValue({ success: true, fileId: 'dynamic-id' });
    vi.mocked(updateFileContent).mockResolvedValue({ success: true });

    await regenerateTodoMirror(NOW);
    expect(resolveFilePath).toHaveBeenCalledWith(TODO_MIRROR_FOLDER, TODO_MIRROR_FILENAME);
  });
});
