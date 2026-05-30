/**
 * GET /api/secretariat/cron-whatsapp-ingest
 *
 * Cron 4×/jour : ingestion WhatsApp (Beeper) — lit les nouveaux messages des
 * chats non exclus, enrichit le vault (fiches Contact/Projet) quand cohérent,
 * prépare un brouillon d'email si besoin, et notifie Thomas sur Telegram
 * UNIQUEMENT s'il y a une todo ou une action. Protégé par Bearer <CRON_SECRET>.
 *
 * 🔒 Lecture WhatsApp read-only ; brouillons email seulement (jamais d'envoi, règle 11).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { runWhatsappIngest } from '@/lib/secretariat/whatsapp-ingest/whatsapp-ingest-runner';
import { parisParts } from '@/lib/secretariat/hot-context-staleness/staleness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Heures cibles EN HEURE DE PARIS (DST-safe via parisParts) : 8h, 12h, 16h, 20h,
// minuit (décision Thomas S26). Le cron tire à plusieurs heures UTC couvrant
// été+hiver ; l'endpoint ne procède qu'à ces heures Paris (les autres = skip).
// ?force=1 ignore la fenêtre (test manuel).
const TARGET_PARIS_HOURS = [0, 8, 12, 16, 20];

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

  console.warn('[cron-whatsapp-ingest] déclenchement');

  // Garde-fou heures de Paris (8h/12h/16h/20h/minuit). Le cron tire plusieurs
  // fois (UTC été+hiver) mais une seule occurrence par heure cible procède.
  const force = req.nextUrl.searchParams.get('force') === '1';
  const { hour } = parisParts();
  if (!force && !TARGET_PARIS_HOURS.includes(hour)) {
    console.warn(
      `[cron-whatsapp-ingest] hors fenêtre (Paris ${hour}h) — skip (cibles : ${TARGET_PARIS_HOURS.join('h, ')}h)`,
    );
    return NextResponse.json({ ok: true, skipped: true, reason: `hors heures cibles (Paris ${hour}h)` });
  }

  try {
    const stats = await runWhatsappIngest();
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-whatsapp-ingest] erreur pipeline : ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
