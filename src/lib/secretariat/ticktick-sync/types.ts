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
}

/** State complet persisté dans Drive (`_Inbox/AnyaLogs/ticktick-sync-state.json`) */
export interface SyncState {
  /** Version du schéma — bump si breaking change */
  version: 1;
  /** Tâches synchronisées, clé = positionKey(VaultTask.position) */
  tasks: Record<string, SyncStateEntry>;
  /** Mapping nom projet TickTick → projectId */
  projects: Record<string, string>;
  /** ISO timestamp du dernier sync full */
  lastFullSyncAt: string;
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
