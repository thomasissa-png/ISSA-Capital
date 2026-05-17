/**
 * GET /api/secretariat/ticktick/ical?token=<TICKTICK_ICAL_SECRET>
 *
 * Endpoint iCal (RFC 5545) — expose les tâches TickTick d'Anya au format iCal.
 * URL à ajouter dans Google Calendar ou Apple Calendar pour visualisation.
 *
 * Auth : secret via query param `token` (lien signé).
 * Refresh : Google Calendar relit l'iCal toutes les ~3-24h automatiquement.
 *
 * Jalon 5C — Session 15.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { listTasks } from '@/lib/secretariat/ticktick/ticktick-client';
import { generateICalFromTasks } from '@/lib/secretariat/ticktick/ical-export';

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
    // Récupérer toutes les tâches actives
    const tasks = await listTasks();

    // Filtrer uniquement les tâches actives (non complétées)
    const activeTasks = tasks.filter((t) => t.status !== 2);

    // Générer le flux iCal
    const icalContent = generateICalFromTasks(activeTasks);

    return new Response(icalContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="anya-tasks.ics"',
        'Cache-Control': 'public, max-age=3600', // Cache 1h
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[ticktick-ical] erreur : ${message}`);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
