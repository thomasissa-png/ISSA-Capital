/**
 * Health monitor core — évaluation des items surveillés.
 *
 * runHealthCheck() itère sur MONITORED_ITEMS, évalue chacun,
 * calcule les alertes à envoyer (en consultant le dedup-store).
 *
 * Task C ajoutera l'envoi Telegram des notifications.
 *
 * Jalon S15.5E — Task B.
 */

import type { MonitoredItem, MonitoredItemStatus, HealthCheckStats } from './types';
import { MONITORED_ITEMS } from './monitored-items';
import { shouldNotify } from './dedup-store';

// ============================================================
// API publique
// ============================================================

/**
 * Exécute un health check complet sur tous les items surveillés.
 *
 * Pour chaque item :
 * 1. Évalue son état (ok/warn/critical/unknown)
 * 2. Vérifie si une notification est nécessaire (via dedup-store)
 *
 * @returns Stats globales avec liste des statuts et nombre de notifications à envoyer
 */
export async function runHealthCheck(): Promise<HealthCheckStats> {
  const startedAt = Date.now();
  const statuses: MonitoredItemStatus[] = [];
  const errors: string[] = [];

  for (const item of MONITORED_ITEMS) {
    try {
      const status = await evaluateItem(item);
      statuses.push(status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${item.id}] ${msg}`);
    }
  }

  // Calculer combien d'items nécessitent une notification
  const toNotify = statuses.filter(
    (s) =>
      (s.state === 'warn' || s.state === 'critical') &&
      s.thresholdHit !== null &&
      shouldNotify(s.itemId, s.thresholdHit),
  );

  return {
    totalItems: MONITORED_ITEMS.length,
    statuses,
    notificationsSent: toNotify.length,
    errors,
    durationMs: Date.now() - startedAt,
  };
}

// ============================================================
// Évaluation d'un item
// ============================================================

/**
 * Évalue un MonitoredItem et retourne son statut.
 *
 * Logique :
 * 1. Si getHealthCheck défini → appeler, retourner ok/critical + reason
 * 2. Sinon getExpiresAt() :
 *    - null → 'unknown'
 *    - daysRemaining < 0 → 'critical' (déjà expiré), thresholdHit = -1
 *    - daysRemaining <= min(thresholds) → 'critical', thresholdHit = ce seuil
 *    - daysRemaining <= max(thresholds) → 'warn', thresholdHit = seuil franchi le plus serré
 *    - sinon → 'ok'
 */
export async function evaluateItem(item: MonitoredItem): Promise<MonitoredItemStatus> {
  const base = {
    itemId: item.id,
    label: item.label,
    category: item.category,
    renewalUrl: item.renewalUrl,
    renewalInstructions: item.renewalInstructions,
  };

  // 1. Health check actif (prioritaire)
  if (item.getHealthCheck) {
    const check = await item.getHealthCheck();
    return {
      ...base,
      state: check.ok ? 'ok' : 'critical',
      expiresAt: null,
      daysRemaining: null,
      // Pour les health checks, thresholdHit = 0 si KO (signal "immédiat")
      thresholdHit: check.ok ? null : 0,
      reason: check.reason,
    };
  }

  // 2. Évaluation par date d'expiration
  const expiresAt = await item.getExpiresAt();

  if (expiresAt === null) {
    return {
      ...base,
      state: 'unknown',
      expiresAt: null,
      daysRemaining: null,
      thresholdHit: null,
      reason: 'Aucune date d\'expiration enregistrée — OAuth jamais effectué ou pas d\'usage récent',
    };
  }

  const daysRemaining = Math.floor(
    (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );

  // Pas de thresholds définis → juste reporter l'état
  if (item.thresholdsDays.length === 0) {
    return {
      ...base,
      state: daysRemaining < 0 ? 'critical' : 'ok',
      expiresAt,
      daysRemaining,
      thresholdHit: daysRemaining < 0 ? -1 : null,
      reason: daysRemaining < 0 ? `Expiré depuis ${Math.abs(daysRemaining)} jours` : undefined,
    };
  }

  // Trier les seuils croissants (ex: [1, 7, 30] → le plus serré en premier)
  const sortedThresholds = [...item.thresholdsDays].sort((a, b) => a - b);

  // Déjà expiré
  if (daysRemaining < 0) {
    return {
      ...base,
      state: 'critical',
      expiresAt,
      daysRemaining,
      thresholdHit: -1,
      reason: `Expiré depuis ${Math.abs(daysRemaining)} jours`,
    };
  }

  // Trouver le seuil le plus serré franchi
  // Ex: thresholds [1, 7, 30], daysRemaining = 5 → thresholdHit = 7
  // Les seuils sont triés et non vides (vérifié ci-dessus)
  const minThreshold = sortedThresholds[0] as number;
  const maxThreshold = sortedThresholds[sortedThresholds.length - 1] as number;

  if (daysRemaining <= minThreshold) {
    // Sous le seuil le plus serré → critical
    return {
      ...base,
      state: 'critical',
      expiresAt,
      daysRemaining,
      thresholdHit: minThreshold,
      reason: `Expire dans ${daysRemaining}j (seuil critique : ${minThreshold}j)`,
    };
  }

  if (daysRemaining <= maxThreshold) {
    // Trouver le seuil franchi le plus serré : le plus petit seuil tel que daysRemaining <= seuil
    const hitThreshold = sortedThresholds.find((t) => daysRemaining <= t) ?? maxThreshold;
    return {
      ...base,
      state: 'warn',
      expiresAt,
      daysRemaining,
      thresholdHit: hitThreshold,
      reason: `Expire dans ${daysRemaining}j (seuil alerte : ${hitThreshold}j)`,
    };
  }

  // Au-dessus de tous les seuils → ok
  return {
    ...base,
    state: 'ok',
    expiresAt,
    daysRemaining,
    thresholdHit: null,
  };
}
