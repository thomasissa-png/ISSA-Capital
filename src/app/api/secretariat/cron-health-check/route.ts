/**
 * GET /api/secretariat/cron-health-check
 *
 * Endpoint cron pour le health-monitor quotidien.
 * Protégé par Authorization: Bearer <CRON_SECRET>.
 *
 * Appelé par GitHub Actions cron (.github/workflows/cron-health-check.yml)
 * tous les jours à 8h UTC.
 *
 * Pour chaque item en état warn/critical nécessitant notification :
 * - Construit et envoie une carte Telegram à Thomas
 * - Marque l'item comme notifié (dedup-store)
 *
 * Jalon S15.5E — Task C.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { runHealthCheck } from '@/lib/secretariat/health-monitor/health-monitor';
import { shouldNotify, markNotified } from '@/lib/secretariat/health-monitor/dedup-store';
import { sendHealthAlertCard } from '@/lib/secretariat/telegram-validation/health-card';
import { parisParts } from '@/lib/secretariat/hot-context-staleness/staleness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Heure cible EN HEURE DE PARIS (DST-safe via parisParts, S26 — « pas de
// décalage été/hiver »). Le cron tire à 6h ET 7h UTC (= 8h Paris été/hiver) ;
// l'endpoint ne procède qu'à 8h Paris. `?force=1` ignore la fenêtre.
const TARGET_PARIS_HOUR = 8;

// ============================================================
// GET handler
// ============================================================

export async function GET(req: NextRequest): Promise<Response> {
  // Vérifier le secret via Authorization: Bearer
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || expectedSecret === '__TO_FILL__') {
    console.warn('[cron-health-check] CRON_SECRET non configuré');
    return NextResponse.json(
      { ok: false, error: 'Endpoint non configuré' },
      { status: 500 },
    );
  }

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token || token !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'Non autorisé' },
      { status: 401 },
    );
  }

  // Vérifier si le health-monitor est désactivé
  if (process.env.HEALTH_MONITOR_DISABLED === 'true') {
    return NextResponse.json({ ok: true, disabled: true, notificationsSent: 0 });
  }

  const chatId = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!chatId) {
    console.warn('[cron-health-check] TELEGRAM_CHAT_ID_THOMAS non configuré');
    return NextResponse.json(
      { ok: false, error: 'TELEGRAM_CHAT_ID_THOMAS manquant' },
      { status: 500 },
    );
  }

  // Garde-fou heure de Paris (8h). Le cron tire à 6h+7h UTC (couvre été+hiver) ;
  // une seule occurrence procède réellement → 1 run/jour à 8h Paris, zéro décalage.
  const force = req.nextUrl.searchParams.get('force') === '1';
  const { hour } = parisParts();
  if (!force && hour !== TARGET_PARIS_HOUR) {
    console.warn(`[cron-health-check] hors fenêtre (Paris ${hour}h) — skip (cible ${TARGET_PARIS_HOUR}h)`);
    return NextResponse.json({ ok: true, skipped: true, reason: `hors heure cible (Paris ${hour}h)` });
  }

  console.warn('[cron-health-check] déclenchement health check quotidien');

  const startedAt = Date.now();
  const errors: string[] = [];
  let notificationsSent = 0;

  try {
    const stats = await runHealthCheck();

    // Pour chaque status nécessitant notification
    for (const status of stats.statuses) {
      if (
        (status.state === 'warn' || status.state === 'critical') &&
        status.thresholdHit !== null &&
        shouldNotify(status.itemId, status.thresholdHit)
      ) {
        try {
          await sendHealthAlertCard(chatId, status);
          // markNotified APRÈS envoi réussi (pas avant — si envoi échoue, on re-essaie au prochain cron)
          markNotified(status.itemId, status.thresholdHit);
          notificationsSent++;
        } catch (err) {
          const msg = `[${status.itemId}] envoi Telegram échoué : ${err instanceof Error ? err.message : String(err)}`;
          console.warn(`[cron-health-check] ${msg}`);
          errors.push(msg);
          // Continue avec les autres items
        }
      }
    }

    // Fusionner les erreurs du health check avec les erreurs d'envoi
    const allErrors = [...stats.errors, ...errors];

    const durationMs = Date.now() - startedAt;

    console.warn(
      `[cron-health-check] terminé — ${stats.totalItems} items, ` +
      `${notificationsSent} notification(s) envoyée(s), ` +
      `${allErrors.length} erreur(s), ${durationMs}ms`,
    );

    return NextResponse.json({
      ok: allErrors.length === 0,
      totalItems: stats.totalItems,
      statuses: stats.statuses.map((s) => ({
        itemId: s.itemId,
        state: s.state,
        daysRemaining: s.daysRemaining,
      })),
      notificationsSent,
      errors: allErrors,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-health-check] erreur pipeline : ${message}`);

    return NextResponse.json({
      ok: false,
      totalItems: 0,
      statuses: [],
      notificationsSent,
      errors: [message, ...errors],
      durationMs: Date.now() - startedAt,
    });
  }
}
