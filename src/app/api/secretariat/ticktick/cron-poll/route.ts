/**
 * GET /api/secretariat/ticktick/cron-poll
 *
 * Endpoint cron pour le polling TickTick toutes les 15 min.
 * Protégé par Authorization: Bearer <CRON_SECRET> (même secret que
 * cron-email-ingest — Thomas n'a qu'un seul secret à gérer).
 *
 * Appelé par GitHub Actions cron (.github/workflows/cron-ticktick-poll.yml)
 * car le Repl dev s'endort et ne peut pas faire tourner un cron interne.
 *
 * Remplace l'ancien webhook (S15.2.1) — l'API TickTick ne supporte pas
 * de webhooks sortants.
 *
 * Spec : docs/dev-decisions.md section "S15.2.1 — Bascule polling TickTick"
 */

import { type NextRequest, NextResponse } from 'next/server';
import { pollTickTickTasks } from '@/lib/secretariat/ticktick/poll';
import { regenerateTodoMirror } from '@/lib/secretariat/ticktick/mirror-renderer';

// ============================================================
// GET handler
// ============================================================

export async function GET(req: NextRequest): Promise<Response> {
  // Vérifier le secret via Authorization: Bearer
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || expectedSecret === '__TO_FILL__') {
    console.warn('[cron-ticktick-poll] CRON_SECRET non configuré');
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

  console.warn('[cron-ticktick-poll] déclenchement cron polling TickTick (15 min)');

  try {
    const stats = await pollTickTickTasks();

    console.warn(
      `[cron-ticktick-poll] terminé — ${stats.totalTasks} tâches, ` +
      `${stats.events} events (${stats.completed} done, ${stats.updated} maj, ` +
      `${stats.createdExternal} nouvelles), ${stats.durationMs}ms` +
      (stats.error ? ` — ERROR: ${stats.error}` : ''),
    );

    // S20 — régénération du miroir `03. Tâches/Todo.md` depuis TickTick.
    // Best-effort isolé : toute erreur reste cantonnée à mirrorStats.error,
    // le poll continue de tourner même si Drive est down.
    let mirrorStats: Awaited<ReturnType<typeof regenerateTodoMirror>> | null = null;
    try {
      mirrorStats = await regenerateTodoMirror();
    } catch (err) {
      console.warn(
        `[cron-ticktick-poll] erreur régénération miroir (non bloquant) : ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Si pollTickTickTasks a remonté une erreur (TickTick down), on
    // retourne 200 quand même — l'erreur est dans stats. Permet à GH
    // Actions de différencier "cron a tourné, TickTick KO" (200 + error
    // dans body) de "endpoint cassé" (5xx).
    return NextResponse.json({ ok: !stats.error, stats, mirror: mirrorStats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-ticktick-poll] erreur pipeline : ${message}`);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
