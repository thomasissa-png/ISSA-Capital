/**
 * POST /api/secretariat/email-ingest
 *
 * Endpoint déclencheur du pipeline email-ingest Anya.
 * Protégé par un secret en query param (pas de session — appelé par cron ou manuellement).
 *
 * Usage :
 *   POST /api/secretariat/email-ingest?secret=<EMAIL_INGEST_TRIGGER_SECRET>
 *
 * Retourne : { ok: true, stats: IngestStats }
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md Jalon 4C §D.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { runEmailIngest } from '@/lib/secretariat/email-ingest/email-ingest-runner';

// ============================================================
// POST handler
// ============================================================

export async function POST(req: NextRequest): Promise<Response> {
  // Vérifier le secret
  const secret = req.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.EMAIL_INGEST_TRIGGER_SECRET;

  if (!expectedSecret || expectedSecret === '__TO_FILL__') {
    console.warn('[email-ingest-api] EMAIL_INGEST_TRIGGER_SECRET non configuré');
    return NextResponse.json(
      { ok: false, error: 'Endpoint non configuré' },
      { status: 500 },
    );
  }

  if (!secret || secret !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'Secret invalide' },
      { status: 401 },
    );
  }

  console.warn('[email-ingest-api] déclenchement pipeline email-ingest');

  try {
    const stats = await runEmailIngest();

    console.warn(
      `[email-ingest-api] terminé — ${stats.totalListed} emails, ` +
      `${stats.pendingCreated} pendings, ${stats.errors} erreurs, ${stats.durationMs}ms`,
    );

    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[email-ingest-api] erreur pipeline : ${message}`);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
