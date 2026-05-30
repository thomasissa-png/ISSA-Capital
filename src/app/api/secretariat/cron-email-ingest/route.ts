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
import { parisParts } from '@/lib/secretariat/hot-context-staleness/staleness';

// Fenêtre d'activité (heure de Paris, DST-safe via parisParts) : actif de 6h à
// 23h, en pause de 23h à 6h (décision Thomas S26). Le cron tire toujours toutes
// les heures (crontab `0 * * * *`) mais l'endpoint no-ope la nuit. `?force=1`
// ignore la fenêtre (test manuel).
const ACTIVE_FROM_HOUR = 6; // inclus (1er run à 6h Paris)
const ACTIVE_UNTIL_HOUR = 23; // exclu (dernier run à 22h Paris)

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

  // Fenêtre 6h–23h Paris : la nuit on ne traite pas (pause 23h→6h, S26).
  const force = req.nextUrl.searchParams.get('force') === '1';
  const { hour } = parisParts();
  if (!force && (hour < ACTIVE_FROM_HOUR || hour >= ACTIVE_UNTIL_HOUR)) {
    console.warn(
      `[cron-email-ingest] hors fenêtre (Paris ${hour}h) — skip (actif ${ACTIVE_FROM_HOUR}h→${ACTIVE_UNTIL_HOUR}h)`,
    );
    return NextResponse.json({ ok: true, skipped: true, reason: `pause nuit (Paris ${hour}h)` });
  }

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
