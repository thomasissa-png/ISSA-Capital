/**
 * Pull engine — TickTick → vault (S18.2).
 *
 * Algorithme (spec §2 pull, §3, §4) :
 *
 *   1. Lire state (state-store.ts)
 *   2. Fetch tâches TickTick (toutes les listes connues, agrégées)
 *   3. Pour chaque tâche TickTick :
 *      a. Chercher dans state via ticktickId (reverse-lookup)
 *      b. Match trouvé :
 *         - Si task.modifiedAt > state.lastSyncedAt → TickTick gagne →
 *           PATCH la ligne vault correspondante (description, dueDate,
 *           status, tags) via updateFileContent.
 *         - Si égalité → vault gagne (canonique §4) → no-op pull.
 *         - Si vault plus récent → no-op (push S18.1 gérera au prochain cron).
 *      c. Pas de match : tâche créée dans TickTick app (mobile) →
 *         AJOUTER dans Todo.md sous `## Inbox` (créer la section si absente).
 *      d. Si TickTick status=2 ET vault [ ] → patch vault [x].
 *   4. Pour clé state TickTick absente du fetch (potentiellement deleted TickTick) :
 *      → Red line §9.2 : envoyer carte Telegram, JAMAIS delete silencieux.
 *      → TTL 7j sur le pending (R3).
 *   5. Update state.lastPollTickTick = now
 *
 * Verrou push/pull simple (state.syncLock, TTL 30s) pour éviter qu'un cron
 * push et un cron pull concourent au PATCH du même fichier vault.
 *
 * Toutes les modifications vault passent par updateFileContent (R5 PATCH
 * in-place — JAMAIS create+delete).
 */

import { serializeTaskToLine } from './serializer';
import {
  positionKey,
  emptyPullStats,
  type ConflictDecision,
  type PullResult,
  type PullStats,
  type SyncState,
  type SyncStateEntry,
  type TickTickRawTask,
  type VaultTask,
} from './types';

// ============================================================
// Conflict resolver — last-write-wins arbitre §4
// ============================================================

/**
 * Décide qui gagne entre vault et TickTick pour une tâche donnée.
 *
 * Inputs :
 *   - state[key].lastSyncedAt : "timestamp vault" — quand on a synchronisé
 *   - ttTask.modifiedAt : "timestamp TickTick" — dernière modif côté TT
 *
 * Décision (§4 canonique vault, last-write-wins en cas d'égalité = vault) :
 *   - pas d'entrée state → unknown_state (orphan TickTick)
 *   - modifiedAt > lastSyncedAt (avec tolérance 1s) → ticktick_wins
 *   - sinon → vault_wins
 *
 * **NOTE** : on lit `state[key].ticktickModifiedAt` quand présent (S18.2+)
 * pour comparer la dernière modif TT VUE vs celle reçue. Si différent,
 * c'est qu'une modif a eu lieu côté TT depuis notre dernier sync.
 *
 * Cas state corrompu : on retombe sur `vault_wins` par défaut (canonique).
 */
export function resolveConflict(
  state: SyncState,
  ticktickId: string,
  ttModifiedAt: string | undefined,
): { decision: ConflictDecision; entry?: SyncStateEntry; key?: string } {
  // Reverse-lookup par ticktickId
  let key: string | undefined;
  let entry: SyncStateEntry | undefined;
  for (const [k, v] of Object.entries(state.tasks)) {
    if (v.ticktickId === ticktickId) {
      key = k;
      entry = v;
      break;
    }
  }
  if (!entry || !key) return { decision: 'unknown_state' };

  if (!ttModifiedAt) {
    return { decision: 'vault_wins', entry, key };
  }

  const lastSeenTT = entry.ticktickModifiedAt ?? entry.lastSyncedAt;
  try {
    const tNow = new Date(ttModifiedAt).getTime();
    const tSeen = new Date(lastSeenTT).getTime();
    if (Number.isNaN(tNow) || Number.isNaN(tSeen)) {
      // State corrompu : vault gagne par défaut.
      return { decision: 'vault_wins', entry, key };
    }
    // Tolérance 1s (clock skew TickTick API)
    if (tNow > tSeen + 1000) {
      return { decision: 'ticktick_wins', entry, key };
    }
    return { decision: 'vault_wins', entry, key };
  } catch {
    return { decision: 'vault_wins', entry, key };
  }
}

// ============================================================
// Convertisseur TickTickRawTask → VaultTask (pour PATCH vault)
// ============================================================

/**
 * Convertit une tâche TickTick brute en VaultTask "synthétique" pour la
 * sérialisation markdown. Mappe priority/status/dueDate.
 *
 * @param raw TickTick raw task
 * @param positionForRender Position vault à utiliser pour la VaultTask
 *   synthétique (n'a d'impact que sur le hash et le placement).
 * @param fallbackProjectName Si on ne peut pas déduire d'un tag
 */
export function ticktickToVaultTask(
  raw: TickTickRawTask,
  positionForRender: { vaultPath: string; lineNumber: number },
  fallbackProjectName = 'Inbox',
): VaultTask {
  const status: 0 | 2 = raw.status === 2 ? 2 : 0;
  let priority: 0 | 1 | 5 = 0;
  if (raw.priority === 5) priority = 5;
  else if (raw.priority === 1) priority = 1;

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean)
    : [];

  const task: VaultTask = {
    title: raw.title || '(sans titre)',
    status,
    priority,
    isAllDay: raw.isAllDay !== false, // default true
    tags,
    projectName: fallbackProjectName,
    position: positionForRender,
  };
  if (raw.dueDate) task.dueDate = raw.dueDate;
  if (raw.repeatFlag) task.repeatFlag = raw.repeatFlag;
  return task;
}

// ============================================================
// Helpers — manipulation Todo.md (insertion sous `## Inbox`)
// ============================================================

/**
 * Insère une ligne dans Todo.md sous la section `## Inbox`. Crée la section
 * si absente. Préserve frontmatter + autres sections + ordre des lignes
 * existantes (red line §9.8).
 *
 * @returns Le nouveau contenu Todo.md.
 */
export function insertTaskUnderInbox(
  todoContent: string,
  taskLine: string,
): string {
  const inboxRe = /^##\s+Inbox\s*$/mu;
  const m = todoContent.match(inboxRe);

  if (!m || m.index === undefined) {
    // Section absente : on l'ajoute en fin de fichier
    const trimmed = todoContent.replace(/\s+$/u, '');
    const sep = trimmed.length > 0 ? '\n\n' : '';
    return `${trimmed}${sep}## Inbox\n${taskLine}\n`;
  }

  // Section présente : on insère juste après le header `## Inbox` ligne
  const headerEnd = todoContent.indexOf('\n', m.index);
  if (headerEnd < 0) {
    // header en fin de fichier sans \n
    return `${todoContent}\n${taskLine}\n`;
  }
  const before = todoContent.slice(0, headerEnd + 1);
  const after = todoContent.slice(headerEnd + 1);
  return `${before}${taskLine}\n${after}`;
}

/**
 * Supprime une ligne du contenu vault, par numéro de ligne (1-indexed).
 *
 * Préserve frontmatter + lignes restantes + EOL final.
 */
export function removeLineByNumber(
  content: string,
  lineNumber: number,
): string {
  const lines = content.split(/\r?\n/u);
  if (lineNumber < 1 || lineNumber > lines.length) return content;
  lines.splice(lineNumber - 1, 1);
  return lines.join('\n');
}

/**
 * Remplace une ligne dans le contenu vault, par numéro (1-indexed).
 */
export function replaceLineByNumber(
  content: string,
  lineNumber: number,
  newLine: string,
): string {
  const lines = content.split(/\r?\n/u);
  if (lineNumber < 1 || lineNumber > lines.length) return content;
  lines[lineNumber - 1] = newLine;
  return lines.join('\n');
}

// ============================================================
// Verrou syncLock — anti-concurrence push/pull (S18.2)
// ============================================================

const SYNC_LOCK_TTL_MS = 30_000;

/** Tente d'acquérir le verrou. Retourne true si le verrou est libre. */
export function tryAcquireSyncLock(
  state: SyncState,
  kind: 'push' | 'pull',
  now: Date = new Date(),
): boolean {
  if (state.syncLock) {
    const lockedAt = Date.parse(state.syncLock.lockAcquiredAt);
    if (!Number.isNaN(lockedAt) && now.getTime() - lockedAt < SYNC_LOCK_TTL_MS) {
      return false;
    }
  }
  state.syncLock = { kind, lockAcquiredAt: now.toISOString() };
  return true;
}

/** Libère le verrou (no-op safe si déjà libre). */
export function releaseSyncLock(state: SyncState): void {
  if (state.syncLock) delete state.syncLock;
}

// ============================================================
// Client interface — injectable pour tests
// ============================================================

export interface VaultPatcher {
  /** Lit le fichier vault à un path logique. */
  readFile(vaultPath: string): Promise<{ content: string; fileId: string } | null>;
  /** PATCH in-place le fichier vault (R5). */
  patchFile(fileId: string, newContent: string): Promise<boolean>;
}

export interface TickTickPullClient {
  /** Liste toutes les tâches actives + complétées des projets connus. */
  listAllTasks(projectIds: ReadonlyArray<string>): Promise<TickTickRawTask[]>;
}

export interface TelegramDeleteNotifier {
  /**
   * Envoie une carte Telegram pour demander confirmation suppression vault
   * suite à un delete TickTick. Retourne true si l'envoi (ou la mise en
   * pending) a réussi.
   */
  notifyDeleteRequest(params: {
    ticktickId: string;
    taskKey: string;
    title: string;
    vaultPath: string;
    lineNumber: number;
  }): Promise<boolean>;
}

// ============================================================
// Pull engine — coeur
// ============================================================

function recordError(stats: PullStats, message: string): void {
  stats.errors++;
  if (stats.errorMessages.length < 20) {
    stats.errorMessages.push(message);
  }
}

/**
 * Pipeline pull : compare TickTick courant vs state, applique les changements
 * dans le vault.
 *
 * @param state State courant (sera mutated : ticktickModifiedAt, lastPollTickTick)
 * @param ttClient Client TickTick mockable
 * @param vaultPatcher Patcher Drive (lecture + PATCH in-place R5)
 * @param notifier Telegram delete notifier
 */
export async function runPullEngine(
  state: SyncState,
  ttClient: TickTickPullClient,
  vaultPatcher: VaultPatcher,
  notifier: TelegramDeleteNotifier,
): Promise<{ stats: PullStats; results: PullResult[] }> {
  const t0 = Date.now();
  const stats = emptyPullStats();
  const results: PullResult[] = [];

  const projectIds = Object.values(state.projects).filter(Boolean);
  if (projectIds.length === 0) {
    stats.durationMs = Date.now() - t0;
    return { stats, results };
  }

  let ttTasks: TickTickRawTask[];
  try {
    ttTasks = await ttClient.listAllTasks(projectIds);
  } catch (err) {
    recordError(stats, `listAllTasks: ${err instanceof Error ? err.message : String(err)}`);
    stats.durationMs = Date.now() - t0;
    return { stats, results };
  }

  stats.fetched = ttTasks.length;
  const seenTickTickIds = new Set<string>();

  // Cache fichiers lus pour éviter re-read (1 read max par fichier)
  const fileCache = new Map<string, { content: string; fileId: string }>();
  async function readFileCached(path: string) {
    const c = fileCache.get(path);
    if (c) return c;
    const r = await vaultPatcher.readFile(path);
    if (r) fileCache.set(path, r);
    return r;
  }

  for (const tt of ttTasks) {
    if (!tt.id) continue;
    seenTickTickIds.add(tt.id);

    const { decision, entry, key } = resolveConflict(state, tt.id, tt.modifiedAt);

    try {
      // ============================================================
      // Cas 1 : tâche inconnue → ajouter dans Todo.md sous `## Inbox`
      // ============================================================
      if (decision === 'unknown_state') {
        const todoPath = '03. Tâches/Todo.md';
        const file = await readFileCached(todoPath);
        if (!file) {
          recordError(stats, `Todo.md introuvable pour création ${tt.id}`);
          results.push({ action: 'skipped', ticktickId: tt.id, error: 'todo_md_missing' });
          stats.skipped++;
          continue;
        }
        // VaultTask synthétique pour serialisation
        const synth = ticktickToVaultTask(tt, {
          vaultPath: todoPath,
          lineNumber: 0,
        });
        const taskLine = serializeTaskToLine(synth);
        const newContent = insertTaskUnderInbox(file.content, taskLine);
        const ok = await vaultPatcher.patchFile(file.fileId, newContent);
        if (!ok) {
          recordError(stats, `PATCH Todo.md échoué pour création ${tt.id}`);
          results.push({ action: 'skipped', ticktickId: tt.id, error: 'patch_failed' });
          stats.skipped++;
          continue;
        }
        // On ne connaît pas encore la lineNumber finale ; on inscrira le mapping
        // au prochain push-engine via positionKey. Pour l'instant : marqueur
        // synthétique avec lineNumber=0 pour signaler "à mapper".
        const newKey = positionKey({ vaultPath: todoPath, lineNumber: 0 });
        state.tasks[newKey] = {
          ticktickId: tt.id,
          projectId: tt.projectId,
          vaultHash: '',
          lastSyncedAt: new Date().toISOString(),
          ticktickModifiedAt: tt.modifiedAt,
        };
        // Mise à jour cache pour les suivants
        fileCache.set(todoPath, { content: newContent, fileId: file.fileId });
        results.push({ action: 'created_in_vault', ticktickId: tt.id, taskKey: newKey });
        stats.created++;
        continue;
      }

      // À partir d'ici on a entry + key
      if (!entry || !key) {
        results.push({ action: 'skipped', ticktickId: tt.id });
        stats.skipped++;
        continue;
      }

      // ============================================================
      // Cas 2 : completion sync — status TT 2 ET vault encore [ ]
      // ============================================================
      // (on traite en priorité avant le conflict normal)
      if (tt.status === 2) {
        const { vaultPath, lineNumber } = parseKey(key);
        if (vaultPath && lineNumber) {
          const file = await readFileCached(vaultPath);
          if (file) {
            const lines = file.content.split(/\r?\n/u);
            const line = lines[lineNumber - 1];
            if (line && /\[\s\]/u.test(line)) {
              const newLine = line.replace(/\[\s\]/u, '[x]');
              const newContent = replaceLineByNumber(file.content, lineNumber, newLine);
              const ok = await vaultPatcher.patchFile(file.fileId, newContent);
              if (ok) {
                state.tasks[key] = {
                  ...entry,
                  lastSyncedAt: new Date().toISOString(),
                  ticktickModifiedAt: tt.modifiedAt,
                };
                fileCache.set(vaultPath, { content: newContent, fileId: file.fileId });
                results.push({ action: 'completed_in_vault', ticktickId: tt.id, taskKey: key });
                stats.completed++;
                continue;
              }
            }
          }
        }
      }

      // ============================================================
      // Cas 3 : last-write-wins selon decision
      // ============================================================
      if (decision === 'ticktick_wins') {
        const { vaultPath, lineNumber } = parseKey(key);
        if (!vaultPath || !lineNumber) {
          results.push({ action: 'skipped', ticktickId: tt.id, taskKey: key });
          stats.skipped++;
          continue;
        }
        const file = await readFileCached(vaultPath);
        if (!file) {
          results.push({ action: 'skipped', ticktickId: tt.id, taskKey: key, error: 'file_missing' });
          stats.skipped++;
          continue;
        }
        const synth = ticktickToVaultTask(tt, { vaultPath, lineNumber });
        const newLine = serializeTaskToLine(synth);
        const newContent = replaceLineByNumber(file.content, lineNumber, newLine);
        const ok = await vaultPatcher.patchFile(file.fileId, newContent);
        if (!ok) {
          recordError(stats, `PATCH ${vaultPath}:L${lineNumber} échoué`);
          results.push({ action: 'skipped', ticktickId: tt.id, taskKey: key, error: 'patch_failed' });
          stats.skipped++;
          continue;
        }
        state.tasks[key] = {
          ...entry,
          lastSyncedAt: new Date().toISOString(),
          ticktickModifiedAt: tt.modifiedAt,
        };
        fileCache.set(vaultPath, { content: newContent, fileId: file.fileId });
        results.push({ action: 'patched_vault', ticktickId: tt.id, taskKey: key });
        stats.patched++;
        continue;
      }

      // vault_wins → no-op (push gérera)
      results.push({ action: 'vault_wins', ticktickId: tt.id, taskKey: key });
      stats.vaultWins++;
    } catch (err) {
      recordError(stats, `${tt.id}: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ action: 'skipped', ticktickId: tt.id, error: String(err) });
      stats.skipped++;
    }
  }

  // ============================================================
  // Detection deletes : clé state avec ticktickId absent du fetch
  // → carte Telegram demandée (red line §9.2). Pas de delete silencieux.
  // ============================================================
  for (const [key, entry] of Object.entries(state.tasks)) {
    if (seenTickTickIds.has(entry.ticktickId)) continue;
    if (!entry.ticktickId) continue;
    const { vaultPath, lineNumber } = parseKey(key);
    if (!vaultPath || !lineNumber) continue;
    // Lire titre vault pour la carte
    let title = '(titre inconnu)';
    try {
      const file = await readFileCached(vaultPath);
      if (file) {
        const lines = file.content.split(/\r?\n/u);
        const line = lines[lineNumber - 1];
        if (line) title = line.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/u, '').slice(0, 80);
      }
    } catch { /* ignore */ }
    try {
      const ok = await notifier.notifyDeleteRequest({
        ticktickId: entry.ticktickId,
        taskKey: key,
        title,
        vaultPath,
        lineNumber,
      });
      if (ok) {
        results.push({ action: 'delete_requested', ticktickId: entry.ticktickId, taskKey: key });
        stats.deletedRequested++;
      } else {
        recordError(stats, `notifyDelete échec ${key}`);
        stats.skipped++;
      }
    } catch (err) {
      recordError(stats, `notifyDelete ${key}: ${err instanceof Error ? err.message : String(err)}`);
      stats.skipped++;
    }
  }

  state.lastPollTickTick = new Date().toISOString();
  stats.durationMs = Date.now() - t0;
  return { stats, results };
}

// ============================================================
// Helpers internes
// ============================================================

function parseKey(key: string): { vaultPath: string | null; lineNumber: number | null } {
  // key format: "path/to/file.md:L42"
  const m = key.match(/^(.+):L(\d+)$/u);
  if (!m) return { vaultPath: null, lineNumber: null };
  return { vaultPath: m[1] ?? null, lineNumber: Number(m[2]) };
}

// ============================================================
// Test helpers
// ============================================================

export const _pullEngineInternals = {
  parseKey,
  SYNC_LOCK_TTL_MS,
};
