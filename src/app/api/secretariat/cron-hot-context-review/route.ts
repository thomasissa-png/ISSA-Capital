/**
 * GET /api/secretariat/cron-hot-context-review
 *
 * Revue autonome du hot-context.md (22h Paris). Lancé par cron aux heures UTC
 * couvrant 22h Paris ; l'endpoint ne procède qu'à 22h Paris. Mode auto :
 * dimanche = revue PROFONDE (Sonnet, profil + fiches de la semaine + relecture),
 * autres soirs = revue LÉGÈRE (Haiku, garde le mémo frais). Anya met le mémo à
 * jour seule et envoie un Telegram. `?force=1` ignore la fenêtre ; `?mode=` force.
 *
 * Protégé par Authorization: Bearer <CRON_SECRET>.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { runReview } from '@/lib/secretariat/hot-context-review/reviewer';

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
  // mode optionnel pour test manuel (?mode=light|deep) ; sinon auto (dimanche=deep).
  const modeParam = req.nextUrl.searchParams.get('mode');
  const mode = modeParam === 'light' || modeParam === 'deep' ? modeParam : undefined;
  try {
    const result = await runReview({ force, mode });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-hot-context-review] erreur : ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
