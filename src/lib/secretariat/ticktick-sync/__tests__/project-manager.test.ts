/**
 * Tests project-manager — création et résolution projets TickTick.
 *
 * Couvre :
 *   - projectsReady / missingProjects / resolveProjectId (helpers state)
 *   - createTickTickProject (POST) : OK / HTTP error / no id
 *   - listExistingProjects (GET) : OK array / HTTP error / non-array
 *   - createMissingProjects (S18.3 hotfix idempotence) :
 *       1. State vide + 0 existant TickTick → 7 créés tous neufs
 *       2. State vide + 7 existants TickTick (match nom) → 7 reused, 0 POST
 *       3. State vide + 3 existants TickTick (Personnel/Versi/ISSA) → 3 reused, 4 created
 *       4. State partiel (2 déjà skip) → 5 traités
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
  it("renvoie l'id si présent", () => {
    const s = emptyState();
    s.projects.Versi = 'proj_versi';
    expect(resolveProjectId(s, 'Versi')).toBe('proj_versi');
  });

  it('throw si projet absent', () => {
    expect(() => resolveProjectId(emptyState(), 'Versi')).toThrow();
  });
});

// ============================================================
// createTickTickProject (POST unitaire)
// ============================================================

describe('createTickTickProject (mock fetch)', () => {
  it("renvoie l'id retourné par l'API", async () => {
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
        { id: 'p1', name: 'Versi', color: '#fff' },
        { id: 'p2', name: 'ISSA' },
        { id: null, name: 'broken' }, // filtré : id non-string
      ],
      text: async () => '',
    } as unknown as Response));
    vi.stubGlobal('fetch', fetchMock);

    const list = await listExistingProjects('tok');
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({ id: 'p1', name: 'Versi' });
    expect(list[1]).toEqual({ id: 'p2', name: 'ISSA' });
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

describe('createMissingProjects (hotfix S18.3 idempotence)', () => {
  it('cas 1 : state vide + 0 existant TickTick → 7 créés tous neufs', async () => {
    const spy = mockFetchRouted({ existingProjects: [] });

    const s = emptyState();
    const mapped = await createMissingProjects('tok', s);

    expect(mapped).toHaveLength(7);
    expect(mapped.every((m) => m.reused === false)).toBe(true);
    expect(projectsReady(s)).toBe(true);
    // 1 GET + 7 POST = 8 fetch
    expect(spy).toHaveBeenCalledTimes(8);
  });

  it('cas 2 : state vide + 7 existants TickTick → 7 reused, 0 POST', async () => {
    const existing = PROJECT_NAMES.map((name, i) => ({
      id: `existing_${i}`,
      name,
    }));
    const spy = mockFetchRouted({ existingProjects: existing });

    const s = emptyState();
    const mapped = await createMissingProjects('tok', s);

    expect(mapped).toHaveLength(7);
    expect(mapped.every((m) => m.reused === true)).toBe(true);
    expect(s.projects.Personnel).toBe('existing_0');
    expect(s.projects.Inbox).toBe('existing_6');
    // 1 GET, 0 POST
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('cas 3 : state vide + 3 existants TickTick → 3 reused, 4 created', async () => {
    const existing = [
      { id: 'ex_perso', name: 'Personnel' },
      { id: 'ex_versi', name: 'Versi' },
      { id: 'ex_issa', name: 'ISSA' },
    ];
    const spy = mockFetchRouted({ existingProjects: existing });

    const s = emptyState();
    const mapped = await createMissingProjects('tok', s);

    expect(mapped).toHaveLength(7);
    const reused = mapped.filter((m) => m.reused);
    const created = mapped.filter((m) => !m.reused);
    expect(reused).toHaveLength(3);
    expect(created).toHaveLength(4);
    expect(s.projects.Personnel).toBe('ex_perso');
    expect(s.projects.Versi).toBe('ex_versi');
    expect(s.projects.ISSA).toBe('ex_issa');
    // 1 GET + 4 POST = 5 fetch
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it('cas 4 : state avec 2 déjà connus → skip ces 2, traite les 5 autres', async () => {
    const spy = mockFetchRouted({ existingProjects: [] });

    const s = emptyState();
    s.projects.Personnel = 'pre_existing_perso';
    s.projects.Versi = 'pre_existing_versi';

    const mapped = await createMissingProjects('tok', s);

    // Seuls les 5 restants sont mappés (les 2 déjà en state sont skip)
    expect(mapped).toHaveLength(5);
    expect(mapped.find((m) => m.name === 'Personnel')).toBeUndefined();
    expect(mapped.find((m) => m.name === 'Versi')).toBeUndefined();
    // State conservé pour les 2 préexistants
    expect(s.projects.Personnel).toBe('pre_existing_perso');
    expect(s.projects.Versi).toBe('pre_existing_versi');
    // 1 GET + 5 POST = 6 fetch
    expect(spy).toHaveBeenCalledTimes(6);
  });

  it('cas 5a : POST throw 500, re-fetch trouve le projet → récupère sans propager', async () => {
    // Premier GET : vide. POST "Immobilier" throw 500. Re-fetch : Immobilier
    // a été créé côté TickTick (race serveur) → on doit le récupérer.
    let getCount = 0;
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        getCount++;
        const data = getCount === 1 ? [] : [{ id: 'recovered_immo', name: 'Immobilier' }];
        return {
          ok: true,
          status: 200,
          json: async () => data,
          text: async () => '',
        } as unknown as Response;
      }
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.name === 'Immobilier') {
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

    // Tous les 7 mappés : 1 reused (Immobilier récupéré post-erreur), 6 neufs
    expect(mapped).toHaveLength(7);
    expect(s.projects.Immobilier).toBe('recovered_immo');
    const immoEntry = mapped.find((m) => m.name === 'Immobilier');
    expect(immoEntry?.reused).toBe(true);
    expect(immoEntry?.id).toBe('recovered_immo');
  });

  it('cas 5b : POST throw 500, re-fetch ne trouve PAS → propage erreur avec compteur partiel', async () => {
    // Personnel et Versi créés OK. ISSA throw 500. Re-fetch reste vide
    // → propage avec compteur "2/7 mappés".
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
      if (body.name === 'ISSA') {
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
      /Échec création projet "ISSA" après 2\/7 mappés/,
    );

    // State partiel : Personnel + Versi présents (preuve d'incrémentalité — caller doit save)
    expect(s.projects.Personnel).toBeDefined();
    expect(s.projects.Versi).toBeDefined();
    expect(s.projects.ISSA).toBeUndefined();
  });

  it('cas 6 : match nom case-insensitive + trim ("Immobilier " ↔ "immobilier")', async () => {
    const existing = [
      { id: 'ci_perso', name: 'PERSONNEL' }, // upper
      { id: 'ci_versi', name: ' versi ' }, // trim + lower
      { id: 'ci_immo', name: 'IMMOBILIER  ' }, // upper + trailing spaces
    ];
    mockFetchRouted({ existingProjects: existing });

    const s = emptyState();
    const mapped = await createMissingProjects('tok', s);

    expect(s.projects.Personnel).toBe('ci_perso');
    expect(s.projects.Versi).toBe('ci_versi');
    expect(s.projects.Immobilier).toBe('ci_immo');
    const reusedNames = mapped.filter((m) => m.reused).map((m) => m.name);
    expect(reusedNames).toContain('Personnel');
    expect(reusedNames).toContain('Versi');
    expect(reusedNames).toContain('Immobilier');
  });
});
