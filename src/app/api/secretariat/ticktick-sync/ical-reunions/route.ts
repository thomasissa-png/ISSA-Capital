/**
 * GET /api/secretariat/ticktick-sync/ical-reunions?token=<TICKTICK_ICAL_SECRET>
 *
 * Endpoint iCal (RFC 5545) — expose les RÉUNIONS du vault Obsidian au format iCal.
 * Module frère de `/api/secretariat/ticktick/ical` (qui expose les tâches TickTick).
 *
 * Source : `06. Réunions/YYYY/MM/*.md` (vault Drive).
 * Red line spec §9.3 : feed read-only. Aucune écriture vault depuis cet endpoint.
 *
 * Auth : query param `token` (réutilise `TICKTICK_ICAL_SECRET`).
 * URL d'abonnement :
 *   https://issa-capital.com/api/secretariat/ticktick-sync/ical-reunions?token=<TICKTICK_ICAL_SECRET>
 *
 * Jalon S18.3a — Session 18.
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  listVaultReunions,
  generateICalFromReunions,
} from '@/lib/secretariat/ticktick-sync/ical-feed-reunions';

// ============================================================
// GET handler
// ============================================================

export async function GET(req: NextRequest): Promise<Response> {
  const icalSecret = process.env.TICKTICK_ICAL_SECRET;

  if (!icalSecret) {
    return NextResponse.json(
      { ok: false, error: 'TICKTICK_ICAL_SECRET non configuré' },
      { status: 500 },
    );
  }

  // Auth par query param token
  const token = req.nextUrl.searchParams.get('token');
  if (!token || token !== icalSecret) {
    return NextResponse.json(
      { ok: false, error: 'Non autorisé' },
      { status: 401 },
    );
  }

  try {
    const reunions = await listVaultReunions();
    const icalContent = generateICalFromReunions(reunions);

    return new Response(icalContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition':
          'attachment; filename="anya-reunions.ics"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[ical-reunions] erreur : ${message}`);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
