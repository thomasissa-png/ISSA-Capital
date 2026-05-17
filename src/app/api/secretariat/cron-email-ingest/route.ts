/**
 * GET /api/secretariat/cron-email-ingest
 *
 * Endpoint cron pour le polling email-ingest toutes les 1h.
 * Protégé par un secret via header Authorization: Bearer <CRON_SECRET>.
 *
 * Appelé par le scheduled task Replit (cron 1h).
 * Déduplication native : listUnprocessed() exclut déjà les emails labellisés
 * "Anya/traité" — un même email ne sera jamais traité deux fois.
 *
 * Spec: docs/dev-decisions.md section "S15 Q2 — Cron polling Gmail 1h"
 */

import { type NextRequest, NextResponse } from 'next/server';
import { runEmailIngest } from '@/lib/secretariat/email-ingest/email-ingest-runner';

// ============================================================
// GET handler (Replit cron utilise GET par défaut)
// ============================================================

export async function GET(req: NextRequest): Promise<Response> {
  // Vérifier le secret via Authorization: Bearer
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || expectedSecret === '__TO_FILL__') {
    console.warn('[cron-email-ingest] CRON_SECRET non configuré');
    return NextResponse.json(
      { ok: false, error: 'Endpoint non configuré' },
      { status: 500 },
    );
  }

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token || token !== expectedSecret) {
    return NextResponse.json(
      { ok: false, error: 'Non autorisé' },
      { status: 401 },
    );
  }

  console.warn('[cron-email-ingest] déclenchement cron email-ingest (1h)');

  try {
    const stats = await runEmailIngest();

    console.warn(
      `[cron-email-ingest] terminé — ${stats.totalListed} emails, ` +
      `${stats.pendingCreated} pendings, ${stats.errors} erreurs, ${stats.durationMs}ms`,
    );

    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-email-ingest] erreur pipeline : ${message}`);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
