/**
 * Tests unitaires — TickTick client (CRUD tâches).
 *
 * Mock fetch + OAuth token. Vérifie les appels API, parsing réponses, erreurs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks
// ============================================================

const mockGetTickTickAccessToken = vi.fn().mockResolvedValue('mock-access-token');

vi.mock('../oauth', () => ({
  getTickTickAccessToken: (...args: unknown[]) => mockGetTickTickAccessToken(...args),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import {
  createTask,
  getTask,
  updateTask,
  completeTask,
  listTasks,
  listProjects,
  _clearInboxIdCache,
} from '../ticktick-client';

// ============================================================
// Helpers
// ============================================================

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function mockEmptyResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'text/plain' }),
    json: async () => ({}),
    text: async () => '',
  };
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  _clearInboxIdCache();
  delete process.env.TICKTICK_INBOX_PROJECT_ID;
  mockGetTickTickAccessToken.mockResolvedValue('mock-access-token');
});

// ============================================================
// Tests
// ============================================================

describe('TickTick Client', () => {
  describe('createTask', () => {
    it('crée une tâche avec les bons paramètres', async () => {
      const taskResponse = {
        id: 'task-123',
        projectId: 'proj-1',
        title: 'Test task',
        priority: 3,
        status: 0,
      };
      mockFetch.mockResolvedValue(mockJsonResponse(taskResponse));

      const result = await createTask({
        title: 'Test task',
        desc: 'Description',
        priority: 3,
        tags: ['anya-locataire'],
      });

      expect(result.id).toBe('task-123');
      expect(result.title).toBe('Test task');

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.ticktick.com/open/v1/task');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body as string)).toMatchObject({
        title: 'Test task',
        desc: 'Description',
        priority: 3,
        tags: ['anya-locataire'],
      });
    });

    it('inclut le header Authorization Bearer', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ id: 't1', projectId: 'p1', title: 'x', priority: 0, status: 0 }));

      await createTask({ title: 'x' });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer mock-access-token');
    });

    it('throw si OAuth non configuré', async () => {
      mockGetTickTickAccessToken.mockResolvedValue(null);

      await expect(createTask({ title: 'x' })).rejects.toThrow('TickTick non authentifié');
    });

    it('throw si API retourne une erreur', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers(),
        text: async () => 'Bad request',
      });

      await expect(createTask({ title: 'x' })).rejects.toThrow('échoué (400)');
    });
  });

  describe('getTask', () => {
    it('récupère une tâche par projectId et taskId', async () => {
      const taskData = { id: 't1', projectId: 'p1', title: 'Ma tâche', priority: 0, status: 0 };
      mockFetch.mockResolvedValue(mockJsonResponse(taskData));

      const result = await getTask('p1', 't1');

      expect(result.id).toBe('t1');
      expect(result.title).toBe('Ma tâche');
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe('https://api.ticktick.com/open/v1/project/p1/task/t1');
    });
  });

  describe('updateTask', () => {
    it('met à jour une tâche avec le patch', async () => {
      const taskData = { id: 't1', projectId: 'p1', title: 'Nouveau titre', priority: 5, status: 0 };
      mockFetch.mockResolvedValue(mockJsonResponse(taskData));

      const result = await updateTask('t1', 'p1', { title: 'Nouveau titre', priority: 5 });

      expect(result.title).toBe('Nouveau titre');
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.ticktick.com/open/v1/task/t1');
      expect(JSON.parse(options.body as string)).toMatchObject({
        id: 't1',
        projectId: 'p1',
        title: 'Nouveau titre',
        priority: 5,
      });
    });
  });

  describe('completeTask', () => {
    it('marque une tâche comme complétée', async () => {
      mockFetch.mockResolvedValue(mockEmptyResponse());

      await completeTask('p1', 't1');

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.ticktick.com/open/v1/project/p1/task/t1/complete');
      expect(options.method).toBe('POST');
    });
  });

  describe('listTasks', () => {
    it('liste les tâches d\'un projet', async () => {
      const projectData = {
        tasks: [
          { id: 't1', projectId: 'p1', title: 'T1', priority: 0, status: 0 },
          { id: 't2', projectId: 'p1', title: 'T2', priority: 3, status: 0 },
        ],
      };
      mockFetch.mockResolvedValue(mockJsonResponse(projectData));

      const result = await listTasks('p1');

      expect(result).toHaveLength(2);
      expect(result[0]!.title).toBe('T1');
      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe('https://api.ticktick.com/open/v1/project/p1/data');
    });

    it('retourne un tableau vide si tasks est undefined', async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({}));

      const result = await listTasks('p1');

      expect(result).toEqual([]);
    });
  });

  describe('listProjects', () => {
    it('liste tous les projets', async () => {
      const projects = [
        { id: 'p1', name: 'Inbox' },
        { id: 'p2', name: 'Anya' },
      ];
      mockFetch.mockResolvedValue(mockJsonResponse(projects));

      const result = await listProjects();

      expect(result).toHaveLength(2);
      expect(result[1]!.name).toBe('Anya');
    });
  });

  describe('auto-résolution Inbox (S24 OPTION B)', () => {
    it('createTask sans projectId capte l’ID Inbox depuis la réponse, réutilisé par listTasks', async () => {
      // 1. createTask sans projectId → la réponse révèle l'ID Inbox.
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ id: 't1', projectId: 'inbox-XYZ', title: 'T' }),
      );
      await createTask({ title: 'Sans projet' });

      // 2. listTasks() : /project (vide) puis fetch de l'Inbox auto-résolue.
      mockFetch.mockResolvedValueOnce(mockJsonResponse([])); // listProjects
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ tasks: [{ id: 'i1', title: 'tâche inbox' }] }),
      ); // /project/inbox-XYZ/data

      const tasks = await listTasks();

      const inboxCall = mockFetch.mock.calls.find((c) =>
        String(c[0]).includes('/project/inbox-XYZ/data'),
      );
      expect(inboxCall).toBeDefined();
      expect(tasks.some((t) => (t as { id?: string }).id === 'i1')).toBe(true);
    });

    it('createTask AVEC projectId ne pollue pas le cache Inbox', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ id: 't1', projectId: 'p-anya', title: 'T' }),
      );
      await createTask({ title: 'Dans Anya', projectId: 'p-anya' });

      // listTasks : pas d'inbox en cache → pas de fetch /project/p-anya/data en tant qu'inbox.
      mockFetch.mockResolvedValueOnce(mockJsonResponse([])); // listProjects vide
      await listTasks();

      const inboxByCache = mockFetch.mock.calls.find((c) =>
        String(c[0]).includes('/project/p-anya/data'),
      );
      expect(inboxByCache).toBeUndefined();
    });
  });
});
