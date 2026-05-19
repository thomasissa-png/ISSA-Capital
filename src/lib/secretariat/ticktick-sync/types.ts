/**
 * Types — sync bidirectionnel vault ↔ TickTick (S18.1).
 *
 * Phase 4 push only : vault Obsidian = source de vérité, TickTick = miroir.
 * Pull TickTick → vault, résolution conflits, deletes Telegram : S18.2/S18.3.
 *
 * Spec source : `second-cerveau/Anya - Prompt Claude Code TickTick sync.md`
 * Adaptations S15 : pas de refresh_token TickTick (#102), pas de webhook
 * (polling GitHub Actions). Pas de webhook Drive (idem polling).
 */

// ============================================================
// VaultTask — représentation d'une ligne `- [ ]` du vault
// ============================================================

/**
 * Une tâche extraite d'une ligne markdown du vault.
 *
 * Format source attendu :
 *   `- [ ] description 📅 YYYY-MM-DD #tag1 #tag2 🔼 🔁 weekly ⏰ HH:MM`
 *
 * Champs dérivés du parsing :
 *   - status : 0 (todo) | 2 (done) — depuis `[ ]` ou `[x]`
 *   - priority : 0 | 1 | 5 — depuis 🔼 / 🔽 (3 = medium pas utilisé V1)
 *   - dueDate : ISO 8601 (UTC) — depuis 📅 (+ ⏰ si présent)
 *   - isAllDay : false si heure spécifiée, true sinon
 *   - tags : liste sans préfixe `#`
 *   - projectName : nom du projet TickTick déterminé via PROJECT_TAG_MAPPING
 *   - repeatFlag : RRULE simple depuis 🔁
 */
export interface VaultTask {
  /** Description nettoyée (sans emojis ni tags) */
  title: string;
  /** 0 = active, 2 = completed */
  status: 0 | 2;
  /** 0 = none, 1 = low, 5 = high (TickTick API) */
  priority: 0 | 1 | 5;
  /** ISO 8601 si présent (ex: "2026-05-19T00:00:00.000Z") */
  dueDate?: string;
  /** True si pas d'heure spécifiée */
  isAllDay: boolean;
  /** Tags sans `#` (ex: ["versi", "urgent"]) */
  tags: string[];
  /** Nom du projet TickTick cible (clé de PROJECT_TAG_MAPPING) */
  projectName: string;
  /** RRULE simple (ex: "FREQ=WEEKLY") si 🔁 présent */
  repeatFlag?: string;
  /** Position vault : "chemin/du/fichier.md:L42" */
  position: TaskPosition;
}

/**
 * Position canonique d'une tâche dans le vault.
 * Clé primaire pour le state store.
 */
export interface TaskPosition {
  /** Chemin logique relatif au vault (ex: "Taches/Todo.md") */
  vaultPath: string;
  /** Numéro de ligne 1-indexed */
  lineNumber: number;
}

/**
 * Génère la clé state "{path}:L{lineNumber}".
 */
export function positionKey(position: TaskPosition): string {
  return `${position.vaultPath}:L${position.lineNumber}`;
}

// ============================================================
// State store
// ============================================================

/** Entrée par tâche dans le state store */
export interface SyncStateEntry {
  /** ID TickTick retourné à la création */
  ticktickId: string;
  /** ID du projet TickTick parent (utile pour PATCH/DELETE) */
  projectId: string;
  /** SHA-1 de la ligne markdown source (détection MODIFIED) */
  vaultHash: string;
  /** ISO timestamp du dernier sync réussi */
  lastSyncedAt: string;
  /** ISO timestamp côté TickTick lors du dernier sync (modifiedAt vu).
   *  Optionnel : présent depuis S18.2 (pull engine). Permet last-write-wins. */
  ticktickModifiedAt?: string;
}

/** State complet persisté dans Drive (`_Inbox/AnyaState/ticktick-sync-state.json`) */
export interface SyncState {
  /** Version du schéma — bump si breaking change */
  version: 1;
  /** Tâches synchronisées, clé = positionKey(VaultTask.position) */
  tasks: Record<string, SyncStateEntry>;
  /** Mapping nom projet TickTick → projectId */
  projects: Record<string, string>;
  /** ISO timestamp du dernier sync full */
  lastFullSyncAt: string;
  /** ISO timestamp du dernier pull TickTick→vault réussi (S18.2). */
  lastPollTickTick?: string;
  /** Verrou simple anti-concurrence push/pull (S18.2).
   *  Si défini, un sync est en cours depuis `lockAcquiredAt`. TTL 30s. */
  syncLock?: { kind: 'push' | 'pull'; lockAcquiredAt: string };
  /** Pending delete confirmations Telegram (S18.2 red line §9.2).
   *  Clé = ticktickId. TTL 7j (R3). */
  pendingDeletes?: Record<string, PendingDelete>;
}

/** Pending delete confirmation Telegram (R3 TTL ≥ 7j). */
export interface PendingDelete {
  ticktickId: string;
  taskKey: string;
  title: string;
  vaultPath: string;
  lineNumber: number;
  /** Project TickTick (utile si callback [Garder] recrée la tâche). */
  projectId?: string;
  createdAt: string;
  /** Message Telegram envoyé — pour edit après callback */
  telegramMessageId?: number;
  telegramChatId?: number | string;
}

/** State vide (premier run) */
export function emptyState(): SyncState {
  return {
    version: 1,
    tasks: {},
    projects: {},
    lastFullSyncAt: new Date(0).toISOString(),
  };
}

// ============================================================
// Project mapping
// ============================================================

/**
 * Mapping tag vault (sans `#`) → nom projet TickTick.
 *
 * Convention humaine stable (R7) : pas un fileId, pas une env var.
 * Pour ajouter une entité, +1 ligne ici. Premier tag matché gagne.
 *
 * `Inbox` est le fallback (aucun tag mappé).
 */
export const PROJECT_TAG_MAPPING: Record<string, string[]> = {
  Personnel: ['famille', 'maison', 'sante', 'perso', 'admin', 'finance'],
  Versi: ['versi'],
  ISSA: ['issa', 'issa-capital'],
  'Gradient One': ['gradient-one', 'gradient'],
  Immobilier: ['immobilier-direct', 'immo'],
  Sarani: ['sarani'],
  Inbox: [],
};

/** Liste ordonnée des noms de projets à créer au premier run. */
export const PROJECT_NAMES: ReadonlyArray<string> = Object.keys(PROJECT_TAG_MAPPING);

/** Détermine le projet TickTick depuis une liste de tags. */
export function resolveProjectName(tags: ReadonlyArray<string>): string {
  for (const tag of tags) {
    const normalized = tag.toLowerCase().trim();
    for (const [projectName, mappedTags] of Object.entries(PROJECT_TAG_MAPPING)) {
      if (mappedTags.includes(normalized)) {
        return projectName;
      }
    }
  }
  return 'Inbox';
}

// ============================================================
// Push engine — stats & events
// ============================================================

export type PushAction = 'created' | 'updated' | 'completed' | 'deleted' | 'skipped';

export interface PushResult {
  action: PushAction;
  taskKey: string;
  ticktickId?: string;
  error?: string;
}

export interface PushStats {
  scanned: number;
  created: number;
  updated: number;
  completed: number;
  deleted: number;
  skipped: number;
  errors: number;
  durationMs: number;
  /** Détail des erreurs (max 20 conservées) */
  errorMessages: string[];
}

export function emptyStats(): PushStats {
  return {
    scanned: 0,
    created: 0,
    updated: 0,
    completed: 0,
    deleted: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
    errorMessages: [],
  };
}

// ============================================================
// Pull engine — TickTick → vault (S18.2)
// ============================================================

/**
 * Représentation minimale d'une tâche reçue de l'API TickTick.
 * Subset des champs documentés (https://developer.ticktick.com/).
 */
export interface TickTickRawTask {
  id: string;
  projectId: string;
  title: string;
  /** 0 = active, 2 = completed (cf. push side) */
  status?: number;
  priority?: number;
  isAllDay?: boolean;
  dueDate?: string;
  tags?: string[];
  repeatFlag?: string;
  /** ISO timestamp modification (last-write-wins arbitre §4) */
  modifiedAt?: string;
  /** Optionnel : indicateur de suppression (TickTick peut le passer dans certains modes) */
  deleted?: boolean | number;
}

export type PullAction =
  | 'patched_vault'   // TickTick gagne → vault PATCH
  | 'created_in_vault' // tâche TickTick inconnue → ajoutée à Todo.md
  | 'completed_in_vault' // status TT 2, vault [ ] → patch [x]
  | 'delete_requested' // carte Telegram envoyée (§9.2 red line)
  | 'vault_wins'      // égalité ou vault plus récent → no-op pull
  | 'skipped';

export interface PullResult {
  action: PullAction;
  ticktickId: string;
  taskKey?: string;
  error?: string;
}

export interface PullStats {
  fetched: number;
  patched: number;
  created: number;
  completed: number;
  deletedRequested: number;
  vaultWins: number;
  skipped: number;
  errors: number;
  durationMs: number;
  errorMessages: string[];
}

export function emptyPullStats(): PullStats {
  return {
    fetched: 0,
    patched: 0,
    created: 0,
    completed: 0,
    deletedRequested: 0,
    vaultWins: 0,
    skipped: 0,
    errors: 0,
    durationMs: 0,
    errorMessages: [],
  };
}

/** Résultat de l'arbitre de conflit (cf. spec §4 last-write-wins). */
export type ConflictDecision =
  | 'ticktick_wins'   // ticktickModifiedAt > vaultLastSync → patch vault
  | 'vault_wins'      // ticktickModifiedAt <= vaultLastSync → no-op pull
  | 'unknown_state';  // pas d'entrée state → tâche orpheline TickTick (créée mobile)

// ============================================================
// Audit log JSONL (red line §4 spec) — 1 ligne par op
// ============================================================

/**
 * Opérations tracées dans l'audit log.
 *   - Push : create, update, complete, delete, skip
 *   - Pull : create-from-tt, patch-line, complete-sync, conflict-*
 *   - Telegram : pending-delete (carte demandée), delete (action 'yes' validée),
 *     keep (action 'keep' clear pending)
 */
export type AuditOp =
  | 'create'
  | 'update'
  | 'complete'
  | 'delete'
  | 'skip'
  | 'conflict-vault-wins'
  | 'conflict-tt-wins'
  | 'create-from-tt'
  | 'patch-line'
  | 'complete-sync'
  | 'pending-delete'
  | 'keep';

export type AuditDirection = 'push' | 'pull';

export type AuditStatus = 'ok' | 'error';

/** Entrée d'audit log JSONL (1 ligne = 1 entrée sérialisée en JSON). */
export interface AuditEntry {
  /** ISO 8601 UTC */
  ts: string;
  op: AuditOp;
  direction: AuditDirection;
  status: AuditStatus;
  /** ID TickTick si applicable */
  taskId?: string;
  /** Chemin vault relatif si applicable */
  vaultPath?: string;
  /** Numéro de ligne 1-indexed si applicable */
  vaultLine?: number;
  /** Message d'erreur si status=error */
  error?: string;
  /** Stats agrégées (utile pour entrées de résumé de cron) */
  stats?: Record<string, unknown>;
}
