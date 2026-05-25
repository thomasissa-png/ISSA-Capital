/**
 * GET /api/secretariat/hot-context/cron-scan
 *
 * Endpoint cron pour le scan hot-context (S19.B).
 * Cadence cible : toutes les 5 min via GitHub Actions
 * (.github/workflows/cron-hot-context-scan.yml), décalé d'au moins 1 min vs
 * `cron-ticktick-sync-pull` pour éviter la concurrence quota Drive.
 *
 * Algorithme :
 *   1. Lire state Drive (hot-context-state.json)
 *   2. Scanner les 4 sources (emails JSONL, CR vault, Telegram queueé, notes
 *      vault récentes) → file de patches typés post-Haiku
 *   3. Pour chaque patch : envoyer carte Telegram (3 boutons) → persist pending
 *   4. Mettre à jour state.lastScanAt
 *   5. Retourner stats (scanned, patches_proposed, skipped)
 *
 * Pré-requis runtime :
 *   - CRON_SECRET (header Authorization: Bearer ou ?token=)
 *   - ANTHROPIC_API_KEY (Haiku 4.5)
 *   - TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID_THOMAS
 *   - Scopes OAuth Drive (lecture vault + écriture _Inbox/AnyaState/AnyaLogs)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { loadHotContextState, saveHotContextState } from '@/lib/secretariat/hot-context/state-store';
import { scanForPatches } from '@/lib/secretariat/hot-context/scanner';
import { sendHotContextPatchCard } from '@/lib/secretariat/telegram-validation/handlers/hot-context-patch';

// ============================================================
// GET handler
// ============================================================

export async function GET(req: NextRequest): Promise<Response> {
  // Kill switch S22 — scan hot-context débranché : redondant avec le traitement
  // de l'inbox qui gère déjà le hot-context (les cartes de validation faisaient
  // doublon). Le schedule GitHub Actions est commenté (plus aucun déclenchement
  // automatique) ; ce garde-fou couvre les déclenchements manuels résiduels
  // (workflow_dispatch / curl). Réactivation : décommenter le schedule du
  // workflow + retirer HOT_CONTEXT_SCAN_DISABLED. Code conservé pour rollback.
  if (process.env.HOT_CONTEXT_SCAN_DISABLED === '1') {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const authHeader = req.headers.get('authorization');
  const queryToken = req.nextUrl.searchParams.get('token');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || expectedSecret === '__TO_FILL__') {
    console.warn('[cron-hot-context-scan] CRON_SECRET non configuré');
    return NextResponse.json(
      { ok: false, error: 'Endpoint non configuré' },
      { status: 500 },
    );
  }

  const headerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  const token = headerToken ?? queryToken;
  if (!token || token !== expectedSecret) {
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 });
  }

  console.warn('[cron-hot-context-scan] déclenchement scan');

  try {
    const state = await loadHotContextState();

    const scanResult = await scanForPatches({ state });

    let cardsSent = 0;
    let cardsFailed = 0;
    for (const patch of scanResult.patches) {
      try {
        const messageId = await sendHotContextPatchCard(patch);
        if (messageId !== null) {
          cardsSent++;
        } else {
          cardsFailed++;
        }
      } catch (err) {
        cardsFailed++;
        console.warn(
          `[cron-hot-context-scan] envoi carte patch ${patch.patchId} échoué : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Persister lastScanAt (sendHotContextPatchCard a déjà persisté les pendings,
    // on relit fresh pour préserver les pendings ajoutés)
    const finalState = await loadHotContextState();
    finalState.lastScanAt = scanResult.newLastScanAt;
    const saved = await saveHotContextState(finalState);
    if (!saved) {
      console.warn('[cron-hot-context-scan] sauvegarde state Drive ÉCHEC');
    }

    console.warn(
      `[cron-hot-context-scan] terminé — candidates=${scanResult.totalCandidates} ` +
      `prefilter_skip=${scanResult.filteredByPrefilter} ` +
      `idempotence_skip=${scanResult.skippedAlreadyProcessed} ` +
      `patches=${scanResult.patches.length} cards_sent=${cardsSent} cards_failed=${cardsFailed}`,
    );

    return NextResponse.json({
      ok: true,
      stats: {
        totalCandidates: scanResult.totalCandidates,
        filteredByPrefilter: scanResult.filteredByPrefilter,
        skippedAlreadyProcessed: scanResult.skippedAlreadyProcessed,
        patchesProposed: scanResult.patches.length,
        cardsSent,
        cardsFailed,
      },
      stateSaved: saved,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-hot-context-scan] erreur pipeline : ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
