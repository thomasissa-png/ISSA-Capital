/**
 * Tests project-manager — création et résolution projets TickTick.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  projectsReady,
  missingProjects,
  createMissingProjects,
  resolveProjectId,
  createTickTickProject,
} from '../project-manager';
import { emptyState, PROJECT_NAMES } from '../types';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('projectsReady', () => {
  it('false si state vide', () => {
    expect(projectsReady(emptyState())).toBe(false);
  });

  it('false si certains projets manquent', () => {
    const s = emptyState();
    s.projects.Personnel = 'p1';
    expect(projectsReady(s)).toBe(false);
  });

  it('true si tous les 7 projets présents', () => {
    const s = emptyState();
    for (const name of PROJECT_NAMES) {
      s.projects[name] = `id_${name}`;
    }
    expect(projectsReady(s)).toBe(true);
  });
});

describe('missingProjects', () => {
  it('renvoie les 7 projets si state vide', () => {
    expect(missingProjects(emptyState())).toEqual([...PROJECT_NAMES]);
  });

  it('renvoie uniquement ceux manquants', () => {
    const s = emptyState();
    s.projects.Personnel = 'p1';
    s.projects.Versi = 'p2';
    const m = missingProjects(s);
    expect(m).not.toContain('Personnel');
    expect(m).not.toContain('Versi');
    expect(m).toContain('ISSA');
    expect(m).toContain('Inbox');
  });
});

describe('resolveProjectId', () => {
  it('renvoie l\'id si présent', () => {
    const s = emptyState();
    s.projects.Versi = 'proj_versi';
    expect(resolveProjectId(s, 'Versi')).toBe('proj_versi');
  });

  it('throw si projet absent', () => {
    expect(() => resolveProjectId(emptyState(), 'Versi')).toThrow();
  });
});

describe('createMissingProjects (avec mock fetch)', () => {
  it('crée tous les projets manquants et patch state', async () => {
    let counter = 0;
    const fetchMock = vi.fn(async () => {
      counter++;
      return {
        ok: true,
        json: async () => ({ id: `tt_proj_${counter}`, name: 'whatever' }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const s = emptyState();
    const created = await createMissingProjects('fake-token', s);

    expect(created).toHaveLength(7);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(projectsReady(s)).toBe(true);
    expect(s.projects.Personnel).toBe('tt_proj_1');
  });

  it('idempotent : ne re-crée pas un projet présent', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'new_id', name: 'x' }),
      text: async () => '',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    const s = emptyState();
    // 6 déjà présents
    for (const name of PROJECT_NAMES.slice(0, 6)) {
      s.projects[name] = `existing_${name}`;
    }
    const created = await createMissingProjects('tok', s);

    expect(created).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(s.projects.Personnel).toBe('existing_Personnel');
  });
});

describe('createTickTickProject (mock fetch)', () => {
  it('renvoie l\'id retourné par l\'API', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'abc123', name: 'Versi' }),
      text: async () => '',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    const id = await createTickTickProject('tok', 'Versi');
    expect(id).toBe('abc123');
  });

  it('throw si HTTP non-ok', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => 'server error',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createTickTickProject('tok', 'X')).rejects.toThrow(/500/);
  });

  it('throw si pas d\'id retourné', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'no-id' }),
      text: async () => '',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createTickTickProject('tok', 'X')).rejects.toThrow(/pas d'id/);
  });
});
