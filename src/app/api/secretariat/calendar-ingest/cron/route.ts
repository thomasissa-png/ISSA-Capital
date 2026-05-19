/**
 * GET /api/secretariat/calendar-ingest/cron
 *
 * Endpoint cron pour le sync Google Calendar → vault Reunions (S18.6).
 * Cadence cible : toutes les 15 min via GitHub Actions
 * (.github/workflows/cron-calendar-ingest.yml).
 *
 * Pré-requis runtime :
 *   - CRON_SECRET (header Authorization: Bearer OU query ?token=)
 *   - Refresh token Google avec scope calendar.readonly
 *   - DRIVE_VAULT_ROOT_ID (pour écriture vault)
 *   - TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID_THOMAS (carte récap, optionnel)
 *
 * Auth : pattern aligné sur cron-pull/cron-push TickTick.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  runCalendarIngest,
  sendCalendarRecapCard,
} from '@/lib/secretariat/calendar-ingest';

// ============================================================
// GET handler
// ============================================================

export async function GET(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  const queryToken = req.nextUrl.searchParams.get('token');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || expectedSecret === '__TO_FILL__') {
    console.warn('[cron-calendar-ingest] CRON_SECRET non configuré');
    return NextResponse.json(
      { ok: false, error: 'Endpoint non configuré' },
      { status: 500 },
    );
  }

  const headerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const token = headerToken ?? queryToken;
  if (!token || token !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'Non autorisé' },
      { status: 401 },
    );
  }

  // Optionnel : windowDays via query (?windowDays=30)
  const windowDaysParam = req.nextUrl.searchParams.get('windowDays');
  let windowDays = 14;
  if (windowDaysParam) {
    const parsed = parseInt(windowDaysParam, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 90) {
      windowDays = parsed;
    }
  }

  // Optionnel : dryRun via query (?dryRun=1)
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  console.warn(
    `[cron-calendar-ingest] déclenchement (windowDays=${windowDays}, dryRun=${dryRun})`,
  );

  try {
    const { stats, results, stateSaved } = await runCalendarIngest({
      windowDays,
      dryRun,
    });

    // Carte récap Telegram si actionable
    let recapSent = false;
    if (!dryRun && stats.reunionsCreated + stats.reunionsUpdated > 0) {
      try {
        recapSent = await sendCalendarRecapCard(results);
      } catch (err) {
        console.warn(
          `[cron-calendar-ingest] erreur envoi carte récap : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return NextResponse.json({
      ok: stats.errors === 0,
      stats,
      stateSaved,
      recapSent,
      results: results.slice(0, 50),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-calendar-ingest] erreur pipeline : ${message}`);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
