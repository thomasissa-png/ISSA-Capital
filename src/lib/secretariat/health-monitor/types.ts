/**
 * Types du health-monitor — surveillance des tokens, quotas et domaines.
 *
 * Jalon S15.5E — Task A.
 */

// ============================================================
// MonitoredItem — définition d'un élément surveillé
// ============================================================

export interface MonitoredItem {
  /** Identifiant unique (ex: 'ticktick_access_token') */
  id: string;
  /** Libellé humain pour les notifications */
  label: string;
  /** Catégorie de l'élément surveillé */
  category: 'oauth' | 'token' | 'quota' | 'domain' | 'cert';
  /** Seuils d'alerte en jours avant expiration (ex: [30, 7, 1]) */
  thresholdsDays: number[];
  /** Retourne la date d'expiration estimée, ou null si inconnue */
  getExpiresAt: () => Promise<Date | null>;
  /** Health check optionnel — vérification active */
  getHealthCheck?: () => Promise<{ ok: boolean; reason?: string }>;
  /** URL pour renouveler (ex: lien OAuth init) */
  renewalUrl?: string;
  /** Instructions humaines pour le renouvellement */
  renewalInstructions?: string;
}

// ============================================================
// MonitoredItemStatus — résultat d'évaluation d'un item
// ============================================================

export interface MonitoredItemStatus {
  itemId: string;
  label: string;
  category: MonitoredItem['category'];
  /** État calculé à partir des thresholds */
  state: 'ok' | 'warn' | 'critical' | 'unknown';
  /** Date d'expiration estimée (null si inconnue) */
  expiresAt: Date | null;
  /** Jours restants avant expiration (null si inconnue) */
  daysRemaining: number | null;
  /** Seuil atteint en jours (null si aucun) */
  thresholdHit: number | null;
  /** Raison textuelle de l'état (utile pour unknown / critical) */
  reason?: string;
  /** URL de renouvellement (copiée depuis MonitoredItem) */
  renewalUrl?: string;
  /** Instructions de renouvellement (copiées depuis MonitoredItem) */
  renewalInstructions?: string;
}

// ============================================================
// HealthCheckStats — résultat global d'un run du monitor
// ============================================================

export interface HealthCheckStats {
  totalItems: number;
  statuses: MonitoredItemStatus[];
  notificationsSent: number;
  errors: string[];
  durationMs: number;
}
