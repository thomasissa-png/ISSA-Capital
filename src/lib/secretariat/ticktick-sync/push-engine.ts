/**
 * Push engine — vault → TickTick.
 *
 * Algorithme (cf. spec §2) :
 *   1. scan vault → VaultTask[]
 *   2. read state JSON
 *   3. pour chaque VaultTask :
 *      - clé = positionKey(t.position)
 *      - pas dans state          → NEW       → POST /open/v1/task
 *      - dans state, hash !=     → MODIFIED  → POST /open/v1/task/{id} (TickTick PATCH-like)
 *      - dans state, hash ==     → no-op (idempotence red line §9.7)
 *   4. pour chaque clé state absente de VaultTask → DELETED → DELETE TickTick
 *   5. pour chaque [x] vault     → completeTask + retire du state
 *   6. write state JSON
 *
 * Red lines respectées :
 *   - §9.5 backoff 429 : retry avec délai croissant (max 3 tentatives)
 *   - §9.6 #hide-tcw : filtré en amont par le parser
 *   - §9.7 idempotence : re-run sans modif = 0 mutation
 *
 * Note importante : la spec dit que le push gère aussi le `serializer` pour
 * détecter la transition `[ ]` → `[x]` via le hash. On simplifie : si
 * status=2 dans VaultTask actuel ET status était 0 dans le hash précédent
 * → completeTask. Sinon update normal. Le hash inclut déjà `[x]`, donc
 * une coche change le hash → MODIFIED → mais on veut completeTask.
 *
 * Solution : on regarde le status courant directement (présent dans
 * VaultTask), pas via le hash. Le hash sert juste à détecter "MODIFIED?".
 */

import { hashLine } from './hasher';
import { serializeTaskToLine } from './serializer';
import {
  positionKey,
  emptyStats,
  type PushResult,
  type PushStats,
  type SyncState,
  type SyncStateEntry,
  type VaultTask,
} from './types';
import { resolveProjectId, projectsReady } from './project-manager';

// ============================================================
// Constantes
// ============================================================

const TICKTICK_BASE = 'https://api.ticktick.com/open/v1';
const REQUEST_TIMEOUT_MS = 15_000;

/** Délai entre tentatives 429 (ms). Backoff 1s / 2s / 4s. */
const RETRY_DELAYS = [1_000, 2_000, 4_000];

// ============================================================
// TickTick HTTP — abstraction injectable pour tests
// ============================================================

/** Payload de création/update TickTick task */
export interface TickTickTaskPayload {
  title: string;
  projectId: string;
  priority: number;
  isAllDay: boolean;
  dueDate?: string;
  tags?: string[];
  repeatFlag?: string;
}

/** Réponse minimale TickTick (création/update) */
export interface TickTickTaskResponse {
  id: string;
  projectId: string;
}

/** Interface injectable — facilite les tests sans réseau */
export interface TickTickPushClient {
  createTask(payload: TickTickTaskPayload): Promise<TickTickTaskResponse>;
  updateTask(
    ticktickId: string,
    projectId: string,
    payload: Partial<TickTickTaskPayload>,
  ): Promise<TickTickTaskResponse>;
  completeTask(ticktickId: string, projectId: string): Promise<void>;
  deleteTask(ticktickId: string, projectId: string): Promise<void>;
}

// ============================================================
// Implémentation HTTP par défaut (production)
// ============================================================

async function ttFetch(
  accessToken: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch(`${TICKTICK_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      // 429 = backoff
      if (response.status === 429 && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < RETRY_DELAYS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }
    }
  }

  throw lastError ?? new Error('TickTick fetch failed without error context');
}

/**
 * Crée le client HTTP par défaut (utilisé en production).
 * Les tests passent un mock via `runPush(scanner, client, state, ...)`.
 */
export function createDefaultClient(accessToken: string): TickTickPushClient {
  return {
    async createTask(payload) {
      const res = await ttFetch(accessToken, '/task', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`TickTick createTask HTTP ${res.status}: ${txt}`);
      }
      return (await res.json()) as TickTickTaskResponse;
    },

    async updateTask(ticktickId, projectId, payload) {
      const body = { id: ticktickId, projectId, ...payload };
      const res = await ttFetch(accessToken, `/task/${ticktickId}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`TickTick updateTask HTTP ${res.status}: ${txt}`);
      }
      // TickTick update endpoint may return {} or task — tolérant
      try {
        const data = (await res.json()) as Partial<TickTickTaskResponse>;
        return {
          id: data.id ?? ticktickId,
          projectId: data.projectId ?? projectId,
        };
      } catch {
        return { id: ticktickId, projectId };
      }
    },

    async completeTask(ticktickId, projectId) {
      const res = await ttFetch(
        accessToken,
        `/project/${projectId}/task/${ticktickId}/complete`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`TickTick completeTask HTTP ${res.status}: ${txt}`);
      }
    },

    async deleteTask(ticktickId, projectId) {
      const res = await ttFetch(
        accessToken,
        `/project/${projectId}/task/${ticktickId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`TickTick deleteTask HTTP ${res.status}: ${txt}`);
      }
    },
  };
}

// ============================================================
// Push engine — coeur de la logique
// ============================================================

function buildPayload(task: VaultTask, projectId: string): TickTickTaskPayload {
  const payload: TickTickTaskPayload = {
    title: task.title,
    projectId,
    priority: task.priority,
    isAllDay: task.isAllDay,
  };
  if (task.dueDate) payload.dueDate = task.dueDate;
  if (task.tags.length > 0) payload.tags = task.tags;
  if (task.repeatFlag) payload.repeatFlag = task.repeatFlag;
  return payload;
}

function recordError(stats: PushStats, message: string): void {
  stats.errors++;
  if (stats.errorMessages.length < 20) {
    stats.errorMessages.push(message);
  }
}

/**
 * Compute le hash canonique d'une VaultTask.
 *
 * Pour idempotence (§9.7), on hash la ligne ré-sérialisée (forme canonique),
 * pas la ligne brute. Sinon, un espace doublé dans Todo.md déclenche un faux
 * MODIFIED à chaque sync.
 */
function canonicalHash(task: VaultTask): string {
  return hashLine(serializeTaskToLine(task));
}

/**
 * Pipeline push : compare vault courant vs state, applique les changements.
 *
 * @param scannedTasks Tâches lues du vault
 * @param state State courant (sera mutated)
 * @param client Client HTTP TickTick (mockable pour tests)
 * @returns Stats + liste de PushResult
 */
export async function runPushEngine(
  scannedTasks: VaultTask[],
  state: SyncState,
  client: TickTickPushClient,
): Promise<{ stats: PushStats; results: PushResult[] }> {
  const t0 = Date.now();
  const stats = emptyStats();
  const results: PushResult[] = [];

  if (!projectsReady(state)) {
    stats.durationMs = Date.now() - t0;
    return { stats, results };
  }

  stats.scanned = scannedTasks.length;

  const seenKeys = new Set<string>();

  for (const task of scannedTasks) {
    const key = positionKey(task.position);
    seenKeys.add(key);

    let projectId: string;
    try {
      projectId = resolveProjectId(state, task.projectName);
    } catch (err) {
      recordError(stats, err instanceof Error ? err.message : String(err));
      results.push({ action: 'skipped', taskKey: key, error: 'project_id_missing' });
      stats.skipped++;
      continue;
    }

    const newHash = canonicalHash(task);
    const existing: SyncStateEntry | undefined = state.tasks[key];

    try {
      if (!existing) {
        if (task.status === 2) {
          // Tâche déjà complète à la création : on la crée puis on la complète
          // pour qu'elle existe côté TickTick avec l'historique correct.
          const created = await client.createTask(buildPayload(task, projectId));
          await client.completeTask(created.id, created.projectId);
          // On ne stocke pas dans le state (tâche close)
          results.push({
            action: 'completed',
            taskKey: key,
            ticktickId: created.id,
          });
          stats.completed++;
        } else {
          const created = await client.createTask(buildPayload(task, projectId));
          state.tasks[key] = {
            ticktickId: created.id,
            projectId: created.projectId,
            vaultHash: newHash,
            lastSyncedAt: new Date().toISOString(),
          };
          results.push({
            action: 'created',
            taskKey: key,
            ticktickId: created.id,
          });
          stats.created++;
        }
        continue;
      }

      // Existing — comparer hash
      if (existing.vaultHash === newHash && task.status !== 2) {
        // no-op (idempotence)
        results.push({ action: 'skipped', taskKey: key, ticktickId: existing.ticktickId });
        stats.skipped++;
        continue;
      }

      // MODIFIED ou COMPLETED
      if (task.status === 2) {
        await client.completeTask(existing.ticktickId, existing.projectId);
        delete state.tasks[key];
        results.push({
          action: 'completed',
          taskKey: key,
          ticktickId: existing.ticktickId,
        });
        stats.completed++;
      } else {
        await client.updateTask(
          existing.ticktickId,
          existing.projectId,
          buildPayload(task, projectId),
        );
        state.tasks[key] = {
          ...existing,
          vaultHash: newHash,
          lastSyncedAt: new Date().toISOString(),
        };
        results.push({
          action: 'updated',
          taskKey: key,
          ticktickId: existing.ticktickId,
        });
        stats.updated++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordError(stats, `${key}: ${msg}`);
      results.push({ action: 'skipped', taskKey: key, error: msg });
      stats.skipped++;
    }
  }

  // DELETIONS : clés présentes dans state mais absentes du scan
  for (const [key, entry] of Object.entries(state.tasks)) {
    if (seenKeys.has(key)) continue;
    try {
      await client.deleteTask(entry.ticktickId, entry.projectId);
      delete state.tasks[key];
      results.push({
        action: 'deleted',
        taskKey: key,
        ticktickId: entry.ticktickId,
      });
      stats.deleted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordError(stats, `delete ${key}: ${msg}`);
      results.push({ action: 'skipped', taskKey: key, error: msg });
      stats.skipped++;
    }
  }

  state.lastFullSyncAt = new Date().toISOString();
  stats.durationMs = Date.now() - t0;
  return { stats, results };
}

// ============================================================
// Test helpers
// ============================================================

export const _pushEngineInternals = {
  buildPayload,
  canonicalHash,
  RETRY_DELAYS,
};
