/**
 * GET /api/secretariat/cron-hot-context-review
 *
 * Revue nocturne autonome du hot-context.md (22h Paris). Lancé par cron aux
 * heures UTC couvrant 22h Paris ; l'endpoint ne procède qu'à 22h Paris.
 * Anya met le mémo à jour seule et envoie un Telegram listant les changements.
 * `?force=1` ignore la fenêtre horaire (test manuel).
 *
 * Protégé par Authorization: Bearer <CRON_SECRET>.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { runNightlyReview } from '@/lib/secretariat/hot-context-review/reviewer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected === '__TO_FILL__') {
    return NextResponse.json({ ok: false, error: 'Endpoint non configuré' }, { status: 500 });
  }
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || token !== expected) {
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  try {
    const result = await runNightlyReview(force);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-hot-context-review] erreur : ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
