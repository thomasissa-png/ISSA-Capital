/**
 * Job CLI — backfill des timestamps RFC 3161 (Phase 6).
 *
 * Rôle :
 *   Parcourt tous les CR publiés sans timestamp (rfc3161_token IS NULL)
 *   et demande un timestamp à Universign pour chacun. Utile pour :
 *     - Rattraper les CR publiés quand Universign n'était pas configuré
 *     - Re-tenter après un incident TSA
 *
 * Usage :
 *   npm run job:rfc3161-backfill
 *   ou : ts-node src/server/jobs/rfc3161-backfill.ts
 *
 * Options via env :
 *   BACKFILL_LIMIT  — nombre max de CR à traiter (défaut 50)
 *   BACKFILL_DRY_RUN — si 'true', loggue sans écrire en DB
 *
 * Sécurité :
 *   - Exécution synchrone séquentielle (1 call TSA à la fois, pas de burst)
 *   - Pause 1s entre chaque appel pour rester raisonnable sur la TSA
 *   - Commit individuel par CR — si un plante, les précédents restent
 *
 * Source :
 *   docs/ia/secretariat-implementation-plan.md Phase 6 (RFC 3161 backfill)
 */

import { getDb, initDatabase } from '../db/connection';
import {
  isConfigured,
  requestTimestamp,
  UniversignClientError,
  UniversignNotConfiguredError,
  UniversignTimeoutError,
} from '../services/universign';
import { getLogger } from '../utils/logger';

interface PendingRow {
  reference: string;
  markdown_sha256: string;
}

interface BackfillStats {
  candidates: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runBackfill(): Promise<BackfillStats> {
  const log = getLogger();

  if (!isConfigured()) {
    log.warn('[rfc3161-backfill] Universign non configuré — rien à faire');
    return { candidates: 0, succeeded: 0, failed: 0, skipped: 0 };
  }

  const limitRaw = process.env.BACKFILL_LIMIT ?? '50';
  const limit = Number.parseInt(limitRaw, 10);
  if (Number.isNaN(limit) || limit <= 0) {
    throw new Error('[rfc3161-backfill] BACKFILL_LIMIT doit être un entier positif');
  }
  const dryRun = process.env.BACKFILL_DRY_RUN === 'true';

  const db = getDb();
  const pending = db
    .prepare(
      `SELECT reference, markdown_sha256
       FROM cr_published
       WHERE rfc3161_token IS NULL
       ORDER BY date_etablissement ASC
       LIMIT ?`,
    )
    .all(limit) as PendingRow[];

  log.info(
    { candidates: pending.length, limit, dryRun },
    '[rfc3161-backfill] démarrage',
  );

  const stats: BackfillStats = {
    candidates: pending.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  const updateStmt = db.prepare(
    `UPDATE cr_published
     SET rfc3161_token = ?, rfc3161_provider = ?, rfc3161_requested_at = ?
     WHERE reference = ?`,
  );

  for (const row of pending) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await requestTimestamp(row.markdown_sha256);

      if (dryRun) {
        log.info(
          { reference: row.reference, dryRun: true },
          '[rfc3161-backfill] timestamp obtenu (dry-run, pas écrit)',
        );
      } else {
        updateStmt.run(
          result.token,
          result.provider,
          result.requestedAt,
          row.reference,
        );
        log.info(
          {
            reference: row.reference,
            provider: result.provider,
            durationMs: result.durationMs,
          },
          '[rfc3161-backfill] timestamp persisté',
        );
      }
      stats.succeeded += 1;

      // Pause 1s entre chaque appel TSA (soft rate limit côté client)
      // eslint-disable-next-line no-await-in-loop
      await sleep(1000);
    } catch (err) {
      if (err instanceof UniversignNotConfiguredError) {
        log.error(
          { reference: row.reference },
          '[rfc3161-backfill] Universign non configuré en cours de run — abandon',
        );
        stats.skipped = pending.length - (stats.succeeded + stats.failed);
        break;
      }
      if (err instanceof UniversignClientError) {
        log.error(
          { reference: row.reference, httpStatus: err.httpStatus },
          '[rfc3161-backfill] erreur client TSA — skip ce CR',
        );
        stats.failed += 1;
        continue;
      }
      if (err instanceof UniversignTimeoutError) {
        log.error(
          { reference: row.reference, attempts: err.attempts },
          '[rfc3161-backfill] timeout TSA — skip ce CR',
        );
        stats.failed += 1;
        continue;
      }
      log.error(
        { reference: row.reference, err: err instanceof Error ? err.message : String(err) },
        '[rfc3161-backfill] erreur inattendue — skip',
      );
      stats.failed += 1;
    }
  }

  log.info(stats, '[rfc3161-backfill] terminé');
  return stats;
}

// ============================================================
// Entry point CLI
// ============================================================

async function main(): Promise<void> {
  try {
    initDatabase();
    const stats = await runBackfill();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(stats, null, 2));
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[rfc3161-backfill] erreur fatale:', err);
    process.exit(1);
  }
}

// Si exécuté directement (pas importé par un test)
if (require.main === module) {
  void main();
}
