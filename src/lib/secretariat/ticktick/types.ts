/**
 * Types TickTick — intégration bidirectionnelle Anya ↔ TickTick.
 *
 * Basé sur l'API officielle : https://developer.ticktick.com/api
 * Jalon 5C — Session 15.
 */

// ============================================================
// OAuth
// ============================================================

export interface TickTickTokens {
  accessToken: string;
  // TickTick n'émet PAS toujours de refresh_token (stratégie 180j sur access_token).
  refreshToken: string | undefined;
  expiresAt: number; // Unix ms
}

// ============================================================
// Tâches
// ============================================================

export interface TickTickTask {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  isAllDay?: boolean;
  startDate?: string; // ISO 8601
  dueDate?: string; // ISO 8601
  priority: number; // 0=none, 1=low, 3=medium, 5=high
  status: number; // 0=active, 2=completed
  completedTime?: string;
  tags?: string[];
  timeZone?: string;
  /** ISO timestamp dernière modif (S18.2 pull engine — last-write-wins). */
  modifiedTime?: string;
  /** Alias de modifiedTime (certains endpoints TickTick varient). */
  modifiedAt?: string;
  /** Récurrence (S18.2 pull engine sync). */
  repeatFlag?: string;
}

export interface CreateTaskInput {
  title: string;
  content?: string;
  desc?: string;
  dueDate?: string; // ISO 8601
  startDate?: string; // ISO 8601
  priority?: number; // 0=none, 1=low, 3=medium, 5=high
  projectId?: string;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  content?: string;
  desc?: string;
  dueDate?: string;
  startDate?: string;
  priority?: number;
  projectId?: string;
  tags?: string[];
}

// ============================================================
// Projets (listes)
// ============================================================

export interface TickTickProject {
  id: string;
  name: string;
  color?: string;
  sortOrder?: number;
  closed?: boolean;
}

// ============================================================
// Webhook
// ============================================================

export interface TickTickWebhookEvent {
  /** Type d'événement (ex: task.created, task.completed, task.updated) */
  event: string;
  /** Données payload */
  payload: {
    taskId?: string;
    projectId?: string;
    title?: string;
    status?: number;
    completedTime?: string;
    [key: string]: unknown;
  };
  /** Timestamp de l'événement */
  timestamp?: string;
}
