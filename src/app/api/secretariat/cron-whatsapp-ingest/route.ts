/**
 * GET /api/secretariat/cron-whatsapp-ingest
 *
 * Cron 4×/jour : ingestion WhatsApp (Beeper) — lit les nouveaux messages des
 * chats non exclus, triage la pertinence, notifie Thomas sur Telegram.
 * Protégé par Authorization: Bearer <CRON_SECRET>.
 *
 * 🔒 Lecture WhatsApp read-only ; V1 = notification seule (pas d'écriture vault).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { runWhatsappIngest } from '@/lib/secretariat/whatsapp-ingest/whatsapp-ingest-runner';

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

  console.warn('[cron-whatsapp-ingest] déclenchement');
  try {
    const stats = await runWhatsappIngest();
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-whatsapp-ingest] erreur pipeline : ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
