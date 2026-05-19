/**
 * Tests project-manager — création et résolution projets TickTick.
 *
 * Refacto S18.4 : 3 projets (Critique / Important / Priorité basse) au lieu de 7.
 *
 * Couvre :
 *   - projectsReady / missingProjects / resolveProjectId (helpers state)
 *   - createTickTickProject (POST) : OK / HTTP error / no id
 *   - listExistingProjects (GET) : OK array / HTTP error / non-array
 *   - createMissingProjects (S18.3 hotfix idempotence, adapté S18.4 à 3 noms) :
 *       1. State vide + 0 existant TickTick → 3 créés tous neufs
 *       2. State vide + 3 existants TickTick (match nom) → 3 reused, 0 POST
 *       3. State vide + 1 existant TickTick (Important) → 1 reused, 2 created
 *       4. State partiel (1 déjà skip) → 2 traités
 *       5. POST throw 500 → re-fetch existants → si présent récupère, sinon propage avec compteur
 *       6. Match case-insensitive + trim
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  projectsReady,
  missingProjects,
  createMissingProjects,
  resolveProjectId,
  createTickTickProject,
  listExistingProjects,
} from '../project-manager';
import { emptyState, PROJECT_NAMES } from '../types';

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================
// Helpers test
// ============================================================

/**
 * Mock fetch routé par méthode HTTP :
 *   - GET  → renvoie `existingProjects`
 *   - POST → renvoie `{id: "tt_<counter>", name: <body.name>}` avec counter incrémenté
 * Retourne le spy pour inspection.
 */
function mockFetchRouted(opts: {
  existingProjects: Array<{ id: string; name: string }>;
  postFailures?: Record<string, { status: number; body?: string }>;
  /** Si défini, re-fetch GET renvoie cette liste APRÈS un POST en échec. */
  existingAfterFailure?: Array<{ id: string; name: string }>;
}) {
  let postCount = 0;
  let getCount = 0;
  const spy = vi.fn(async (_url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method === 'GET') {
      getCount++;
      const data =
        getCount > 1 && opts.existingAfterFailure
          ? opts.existingAfterFailure
          : opts.existingProjects;
      return {
        ok: true,
        status: 200,
        json: async () => data,
        text: async () => JSON.stringify(data),
      } as unknown as Response;
    }
    // POST
    postCount++;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const name = body.name as string;
    const failure = opts.postFailures?.[name];
    if (failure) {
      return {
        ok: false,
        status: failure.status,
        json: async () => ({}),
        text: async () => failure.body ?? 'server error',
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: `tt_new_${postCount}`, name }),
      text: async () => '',
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

// ============================================================
// projectsReady / missingProjects / resolveProjectId
// ============================================================

describe('projectsReady', () => {
  it('false si state vide', () => {
    expect(projectsReady(emptyState())).toBe(false);
  });

  it('false si certains projets manquent', () => {
    const s = emptyState();
    s.projects.Critique = 'p1';
    expect(projectsReady(s)).toBe(false);
  });

  it('true si les 3 projets présents (S18.4)', () => {
    const s = emptyState();
    for (const name of PROJECT_NAMES) {
      s.projects[name] = `id_${name}`;
    }
    expect(projectsReady(s)).toBe(true);
  });
});

describe('missingProjects', () => {
  it('renvoie les 3 projets si state vide (S18.4)', () => {
    expect(missingProjects(emptyState())).toEqual([...PROJECT_NAMES]);
  });

  it('renvoie uniquement ceux manquants', () => {
    const s = emptyState();
    s.projects.Critique = 'p1';
    s.projects.Important = 'p2';
    const m = missingProjects(s);
    expect(m).not.toContain('Critique');
    expect(m).not.toContain('Important');
    expect(m).toContain('Priorité basse');
  });
});

describe('resolveProjectId', () => {
  it("renvoie l'id si présent", () => {
    const s = emptyState();
    s.projects.Critique = 'proj_critique';
    expect(resolveProjectId(s, 'Critique')).toBe('proj_critique');
  });

  it('throw si projet absent', () => {
    expect(() => resolveProjectId(emptyState(), 'Critique')).toThrow();
  });
});

// ============================================================
// createTickTickProject (POST unitaire)
// ============================================================

describe('createTickTickProject (mock fetch)', () => {
  it("renvoie l'id retourné par l'API", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 'abc123', name: 'Critique' }),
      text: async () => '',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    const id = await createTickTickProject('tok', 'Critique');
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

  it("throw si pas d'id retourné", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: 'no-id' }),
      text: async () => '',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createTickTickProject('tok', 'X')).rejects.toThrow(/pas d'id/);
  });
});

// ============================================================
// listExistingProjects (GET unitaire)
// ============================================================

describe('listExistingProjects', () => {
  it('OK array : retourne la liste filtrée {id, name}', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        { id: 'p1', name: 'Critique', color: '#fff' },
        { id: 'p2', name: 'Important' },
        { id: null, name: 'broken' }, // filtré : id non-string
      ],
      text: async () => '',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    const list = await listExistingProjects('tok');
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ id: 'p1', name: 'Critique' });
    expect(list[1]).toEqual({ id: 'p2', name: 'Important' });
  });

  it('throw si HTTP non-ok', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
      text: async () => 'unauthorized',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listExistingProjects('bad')).rejects.toThrow(/401/);
  });

  it('throw si réponse non-array', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ error: 'not array' }),
      text: async () => '',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listExistingProjects('tok')).rejects.toThrow(/non-array/);
  });
});

// ============================================================
// createMissingProjects — 5 cas hotfix S18.3
// ============================================================

describe('createMissingProjects (hotfix S18.3 idempotence, S18.4 noms refactos)', () => {
  it('cas 1 : state vide + 0 existant TickTick → 3 créés tous neufs', async () => {
    const spy = mockFetchRouted({ existingProjects: [] });

    const s = emptyState();
    const mapped = await createMissingProjects('tok', s);

    expect(mapped).toHaveLength(3);
    expect(mapped.every((m) => m.reused === false)).toBe(true);
    expect(projectsReady(s)).toBe(true);
    // 1 GET + 3 POST = 4 fetch
    expect(spy).toHaveBeenCalledTimes(4);
  });

  it('cas 2 : state vide + 3 existants TickTick → 3 reused, 0 POST', async () => {
    const existing = PROJECT_NAMES.map((name, i) => ({
      id: `existing_${i}`,
      name,
    }));
    const spy = mockFetchRouted({ existingProjects: existing });

    const s = emptyState();
    const mapped = await createMissingProjects('tok', s);

    expect(mapped).toHaveLength(3);
    expect(mapped.every((m) => m.reused === true)).toBe(true);
    expect(s.projects.Critique).toBe('existing_0');
    expect(s.projects.Important).toBe('existing_1');
    expect(s.projects['Priorité basse']).toBe('existing_2');
    // 1 GET, 0 POST
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('cas 3 : state vide + 1 existant TickTick (Important) → 1 reused, 2 created', async () => {
    const existing = [
      { id: 'ex_important', name: 'Important' },
    ];
    const spy = mockFetchRouted({ existingProjects: existing });

    const s = emptyState();
    const mapped = await createMissingProjects('tok', s);

    expect(mapped).toHaveLength(3);
    const reused = mapped.filter((m) => m.reused);
    const created = mapped.filter((m) => !m.reused);
    expect(reused).toHaveLength(1);
    expect(created).toHaveLength(2);
    expect(s.projects.Important).toBe('ex_important');
    // 1 GET + 2 POST = 3 fetch
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('cas 4 : state avec 1 déjà connu → skip ce 1, traite les 2 autres', async () => {
    const spy = mockFetchRouted({ existingProjects: [] });

    const s = emptyState();
    s.projects.Critique = 'pre_existing_critique';

    const mapped = await createMissingProjects('tok', s);

    // Seuls les 2 restants sont mappés
    expect(mapped).toHaveLength(2);
    expect(mapped.find((m) => m.name === 'Critique')).toBeUndefined();
    // State conservé pour le préexistant
    expect(s.projects.Critique).toBe('pre_existing_critique');
    // 1 GET + 2 POST = 3 fetch
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('cas 5a : POST throw 500, re-fetch trouve le projet → récupère sans propager', async () => {
    // Premier GET : vide. POST "Important" throw 500. Re-fetch : Important
    // a été créé côté TickTick (race serveur) → on doit le récupérer.
    let getCount = 0;
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        getCount++;
        const data = getCount === 1 ? [] : [{ id: 'recovered_important', name: 'Important' }];
        return {
          ok: true,
          status: 200,
          json: async () => data,
          text: async () => '',
        } as unknown as Response;
      }
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.name === 'Important') {
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
          text: async () => 'unknown_exception',
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: `tt_${body.name}`, name: body.name }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', spy);

    const s = emptyState();
    const mapped = await createMissingProjects('tok', s);

    // 3 mappés : 1 reused (Important récupéré post-erreur), 2 neufs
    expect(mapped).toHaveLength(3);
    expect(s.projects.Important).toBe('recovered_important');
    const entry = mapped.find((m) => m.name === 'Important');
    expect(entry?.reused).toBe(true);
    expect(entry?.id).toBe('recovered_important');
  });

  it('cas 5b : POST throw 500, re-fetch ne trouve PAS → propage erreur avec compteur partiel', async () => {
    // Critique créé OK. Important throw 500. Re-fetch reste vide
    // → propage avec compteur "1/3 mappés".
    let getCount = 0;
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        getCount++;
        return {
          ok: true,
          status: 200,
          json: async () => [],
          text: async () => '',
        } as unknown as Response;
      }
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.name === 'Important') {
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
          text: async () => 'unknown_exception',
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: `tt_${body.name}`, name: body.name }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', spy);

    const s = emptyState();
    await expect(createMissingProjects('tok', s)).rejects.toThrow(
      /Échec création projet "Important" après 1\/3 mappés/,
    );

    // State partiel : Critique présent (preuve d'incrémentalité — caller doit save)
    expect(s.projects.Critique).toBeDefined();
    expect(s.projects.Important).toBeUndefined();
  });

  it('cas 6 : match nom case-insensitive + trim ("CRITIQUE " ↔ "critique")', async () => {
    const existing = [
      { id: 'ci_critique', name: 'CRITIQUE' }, // upper
      { id: 'ci_important', name: ' important ' }, // trim + lower
      { id: 'ci_low', name: 'PRIORITÉ BASSE  ' }, // upper + trailing spaces
    ];
    mockFetchRouted({ existingProjects: existing });

    const s = emptyState();
    const mapped = await createMissingProjects('tok', s);

    expect(s.projects.Critique).toBe('ci_critique');
    expect(s.projects.Important).toBe('ci_important');
    expect(s.projects['Priorité basse']).toBe('ci_low');
    const reusedNames = mapped.filter((m) => m.reused).map((m) => m.name);
    expect(reusedNames).toContain('Critique');
    expect(reusedNames).toContain('Important');
    expect(reusedNames).toContain('Priorité basse');
  });
});
