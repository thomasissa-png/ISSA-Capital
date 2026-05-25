/**
 * GET /api/secretariat/cron-morning-brief
 *
 * Endpoint cron du « Brief du matin » d'Anya (S23). Déclenché à 7h Paris par
 * deploy/crontab.anya (CRON_TZ=Europe/Paris). Construit le brief (TickTick +
 * agenda + citation) et l'envoie à Thomas sur Telegram.
 *
 * Pré-requis runtime :
 *   - CRON_SECRET (header Authorization: Bearer OU query ?token=)
 *   - TickTick OAuth + Google refresh token (calendar + drive) + TELEGRAM_*
 *
 * Auth : pattern aligné sur cron-pull/cron-push TickTick + calendar-ingest/cron.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { buildMorningBrief, sendMorningBrief } from '@/lib/secretariat/morning-brief';
import { getParisHour } from '@/lib/secretariat/morning-brief/paris-date';

/** Heure d'envoi du brief, en heure de Paris (garde-fou DST-safe). */
const BRIEF_PARIS_HOUR = 7;

export async function GET(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  const queryToken = req.nextUrl.searchParams.get('token');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || expectedSecret === '__TO_FILL__') {
    console.warn('[cron-morning-brief] CRON_SECRET non configuré');
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
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 });
  }

  // dryRun : construit le brief sans l'envoyer (debug). force : bypass garde 7h.
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  const force = req.nextUrl.searchParams.get('force') === '1';

  // Garde-fou heure française (DST-safe). Le cron tire à 05:00 ET 06:00 UTC
  // (été + hiver) ; seule l'occurrence à 7h Paris passe → 1 envoi/jour, sans
  // dépendre du support CRON_TZ du démon cron. dryRun/force bypassent (tests).
  const parisHour = getParisHour();
  if (!dryRun && !force && parisHour !== BRIEF_PARIS_HOUR) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `hors 7h Paris (il est ${parisHour}h à Paris)`,
      parisHour,
    });
  }

  try {
    const { message, sections } = await buildMorningBrief();

    let sent = false;
    if (!dryRun) {
      sent = await sendMorningBrief(message);
    }

    return NextResponse.json({ ok: true, sections, sent, dryRun });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-morning-brief] erreur : ${reason}`);
    return NextResponse.json({ ok: false, error: reason }, { status: 500 });
  }
}
