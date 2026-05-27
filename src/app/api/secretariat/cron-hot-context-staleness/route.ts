/**
 * GET /api/secretariat/cron-hot-context-staleness
 *
 * Garde-fou anti-dérive du hot-context.md (V0). Lancé par cron aux heures UTC
 * couvrant 19h/20h Paris ; l'endpoint ne procède qu'aux bonnes heures Paris
 * (20h tous les jours + 19h le dimanche). Alerte Thomas sur Telegram si périmé.
 * `?force=1` ignore la fenêtre horaire (test manuel).
 *
 * Protégé par Authorization: Bearer <CRON_SECRET>. 0 appel LLM.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { runStalenessCheck } from '@/lib/secretariat/hot-context-staleness/runner';

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
    const result = await runStalenessCheck(force);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-hot-context-staleness] erreur : ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
