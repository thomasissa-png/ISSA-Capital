/**
 * GET /api/secretariat/ticktick-sync/cron-push
 *
 * Endpoint cron pour le push vault → TickTick (S18.1).
 * Cadence cible : toutes les 5 min via GitHub Actions
 * (.github/workflows/cron-ticktick-sync-push.yml).
 *
 * Algorithme :
 *   1. scanner le vault (Todo.md)
 *   2. lire le state Drive
 *   3. comparer + push CREATE/UPDATE/COMPLETE/DELETE vers TickTick
 *   4. sauver le state Drive
 *
 * Pré-requis runtime :
 *   - CRON_SECRET (header Authorization: Bearer)
 *   - TICKTICK_ACCESS_TOKEN
 *   - DRIVE_VAULT_ROOT_ID + scopes OAuth Drive
 *
 * Au PREMIER run (state.projects vide), le cron ne push rien et déclenche
 * une carte Telegram demandant à Thomas de confirmer la création des
 * 7 projets TickTick. Tant que la carte n'a pas été validée, chaque cron
 * suivant skip avec un log explicite.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { scanVault } from '@/lib/secretariat/ticktick-sync/vault-scanner';
import { runPushEngine, createDefaultClient } from '@/lib/secretariat/ticktick-sync/push-engine';
import { loadSyncState, saveSyncState } from '@/lib/secretariat/ticktick-sync/state-store';
import { projectsReady, missingProjects } from '@/lib/secretariat/ticktick-sync/project-manager';
import { releaseSyncLock, tryAcquireSyncLock } from '@/lib/secretariat/ticktick-sync/pull-engine';
import { sendTickTickProjectsConfirmCard } from '@/lib/secretariat/telegram-validation/handlers/ticktick-projects-confirm';

// ============================================================
// GET handler
// ============================================================

export async function GET(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || expectedSecret === '__TO_FILL__') {
    console.warn('[cron-ticktick-sync-push] CRON_SECRET non configuré');
    return NextResponse.json(
      { ok: false, error: 'Endpoint non configuré' },
      { status: 500 },
    );
  }

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 });
  }

  const accessToken = process.env.TICKTICK_ACCESS_TOKEN;
  if (!accessToken || accessToken === '__TO_FILL__') {
    return NextResponse.json(
      {
        ok: false,
        error: 'TICKTICK_ACCESS_TOKEN manquant — configurer Replit Secrets',
      },
      { status: 500 },
    );
  }

  console.warn('[cron-ticktick-sync-push] déclenchement push vault → TickTick (5 min)');

  try {
    const state = await loadSyncState();

    // Premier run : projets pas encore créés
    if (!projectsReady(state)) {
      const missing = missingProjects(state);
      console.warn(
        `[cron-ticktick-sync-push] projets manquants (${missing.length}) — envoi carte Telegram, sync skippée`,
      );

      // Envoyer la carte si elle n'a pas déjà été envoyée récemment
      // (idempotence garantie côté handler : si state.projects déjà rempli, no-op)
      await sendTickTickProjectsConfirmCard();

      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'projects_not_created',
        missing,
      });
    }

    // Verrou anti-concurrence push/pull (symétrique cron-pull, S18.3).
    // Si un pull est en cours (lock < 30s), on skip ce push.
    if (!tryAcquireSyncLock(state, 'push')) {
      console.warn('[cron-ticktick-sync-push] verrou occupé — skip ce run');
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: 'sync_lock_busy',
      });
    }

    let stats;
    let results;
    try {
      const tasks = await scanVault();
      const client = createDefaultClient(accessToken);
      const pushed = await runPushEngine(tasks, state, client);
      stats = pushed.stats;
      results = pushed.results;
    } finally {
      releaseSyncLock(state);
    }

    const saved = await saveSyncState(state);
    if (!saved) {
      console.warn('[cron-ticktick-sync-push] sauvegarde state Drive ÉCHEC — sync next run risque dupliquer');
    }

    console.warn(
      `[cron-ticktick-sync-push] terminé — scanned=${stats.scanned} created=${stats.created} ` +
      `updated=${stats.updated} completed=${stats.completed} deleted=${stats.deleted} ` +
      `skipped=${stats.skipped} errors=${stats.errors} (${stats.durationMs}ms)`,
    );

    return NextResponse.json({
      ok: stats.errors === 0,
      stats,
      stateSaved: saved,
      results: results.slice(0, 50), // tronqué pour réponse HTTP raisonnable
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-ticktick-sync-push] erreur pipeline : ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
