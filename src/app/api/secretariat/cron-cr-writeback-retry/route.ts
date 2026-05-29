/**
 * GET /api/secretariat/cron-cr-writeback-retry
 *
 * Cron de retry pour les CR write-back en pending (fiche Projet introuvable
 * au premier passage). Lit le store JSONL Drive
 * `_Inbox/AnyaState/cr-writeback-pending.jsonl` et rejoue chaque entrée
 * via `writeBackCrToFiche`.
 *
 * Stratégie (S25, P0 #1 — reprise secretariat) :
 *   - succès                 → `removePending(id)`
 *   - échec attempts < 2     → `updatePendingAttempt(id, attempts+1, lastError)`
 *   - échec atteint attempts=3 → alerte Telegram CRITIQUE à Thomas
 *                                (abandon du retry) puis `removePending(id)`.
 *
 * Décision sur l'abandon : on supprime l'entrée APRÈS l'alerte critique
 * (plutôt que de la laisser en stock avec attempts>=3 et la skipper
 * indéfiniment). Raison : éviter une fuite de stock pending qui grossirait
 * indéfiniment ; l'alerte critique est la trace primaire pour Thomas.
 *
 * Protégé par `Authorization: Bearer <CRON_SECRET>` (calqué sur
 * cron-health-check). Désactivable via `CR_WRITEBACK_RETRY_DISABLED=true`.
 * Horaire : toutes les 2 heures (voir deploy/crontab.anya).
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  readPending,
  removePending,
  updatePendingAttempt,
  type PendingCrWritebackEntry,
} from '@/lib/secretariat/handlers/cr-writeback-pending';
import { writeBackCrToFiche } from '@/lib/secretariat/handlers/cr-writeback';
import { sendTelegramMessage } from '@/lib/secretariat/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 3;

// ============================================================
// GET handler
// ============================================================

export async function GET(req: NextRequest): Promise<Response> {
  // Vérifier le secret via Authorization: Bearer
  const authHeader = req.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || expectedSecret === '__TO_FILL__') {
    console.warn('[cron-cr-writeback-retry] CRON_SECRET non configuré');
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

  // Désactivation rapide via env (sans toucher au crontab)
  if (process.env.CR_WRITEBACK_RETRY_DISABLED === 'true') {
    return NextResponse.json({ ok: true, disabled: true });
  }

  const startedAt = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let abandoned = 0;
  const errors: string[] = [];

  try {
    const entries = await readPending();

    for (const entry of entries) {
      // Sécurité : si une entrée trainait avec attempts >= MAX_ATTEMPTS
      // (cas d'arrêt brutal entre alerte et removePending), on l'abandonne
      // ici sans la rejouer.
      if (entry.attempts >= MAX_ATTEMPTS) {
        await removePending(entry.id);
        abandoned++;
        continue;
      }

      processed++;

      let result;
      try {
        result = await writeBackCrToFiche({
          entiteCode: entry.entiteCode,
          crFileId: entry.crFileId,
          crWebViewLink: entry.crWebViewLink,
          crFilename: entry.crFilename,
          crDate: entry.crDate,
          crTitle: entry.crTitle,
        });
      } catch (err) {
        result = {
          success: false,
          modified: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      if (result.success) {
        await removePending(entry.id);
        succeeded++;
        continue;
      }

      // Échec — incrémenter attempts
      const newAttempts = entry.attempts + 1;
      const lastError = result.error ?? 'erreur inconnue';

      if (newAttempts >= MAX_ATTEMPTS) {
        // Abandon : alerte critique + retrait du store
        try {
          await sendAbandonAlert(entry, lastError);
        } catch (err) {
          const msg = `[${entry.id}] envoi alerte abandon échoué : ${err instanceof Error ? err.message : String(err)}`;
          console.warn(`[cron-cr-writeback-retry] ${msg}`);
          errors.push(msg);
        }
        await removePending(entry.id);
        abandoned++;
      } else {
        await updatePendingAttempt(entry.id, {
          attempts: newAttempts,
          lastError,
        });
        failed++;
      }
    }

    const durationMs = Date.now() - startedAt;

    console.warn(
      `[cron-cr-writeback-retry] terminé — processed=${processed} ` +
        `succeeded=${succeeded} failed=${failed} abandoned=${abandoned} ` +
        `errors=${errors.length} ${durationMs}ms`,
    );

    return NextResponse.json({
      ok: true,
      processed,
      succeeded,
      failed,
      abandoned,
      errors,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[cron-cr-writeback-retry] erreur pipeline : ${message}`);
    return NextResponse.json(
      {
        ok: false,
        processed,
        succeeded,
        failed,
        abandoned,
        errors: [message, ...errors],
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

// ============================================================
// Helpers
// ============================================================

async function sendAbandonAlert(
  entry: PendingCrWritebackEntry,
  lastError: string,
): Promise<void> {
  const chatIdRaw = process.env.TELEGRAM_CHAT_ID_THOMAS;
  const chatId = chatIdRaw ? parseInt(chatIdRaw, 10) : NaN;
  if (!chatIdRaw || !Number.isFinite(chatId)) {
    console.warn(
      '[cron-cr-writeback-retry] TELEGRAM_CHAT_ID_THOMAS absent — alerte abandon non envoyée',
    );
    return;
  }
  const text =
    `[CRITIQUE] CR write-back fiche Projet abandonné après ${MAX_ATTEMPTS} tentatives\n\n` +
    `Entité : ${entry.entiteCode}\n` +
    `CR : ${entry.crFilename}\n` +
    `Date : ${entry.crDate}\n` +
    `Lien : ${entry.crWebViewLink}\n\n` +
    `Dernière erreur : ${lastError}\n\n` +
    `Action : créer/renommer la fiche Projet pour ce code entité, ` +
    `puis re-trigger le write-back via le webhook Telegram. ` +
    `Le PDF du CR reste sauvegardé dans Drive.`;
  // sendTelegramMessage renvoie {success,error}; on log mais on ne crash pas
  const res = await sendTelegramMessage(chatId, text);
  if (!res.success) {
    console.warn(
      `[cron-cr-writeback-retry] alerte abandon Telegram echec : ${res.error ?? 'inconnu'}`,
    );
  }
}
