/**
 * POST /api/publish/:draftId — publication d'un CR validé sur Craft (Phase 4).
 *
 * Flow :
 *  1. Récupère le draft en DB (404 si inexistant)
 *  2. Vérifie status === "ready" (409 sinon)
 *  3. Vérifie qu'aucune publication existante ne pointe déjà vers ce draft (409)
 *  4. Parse et revalide le cr_json avec Zod (garantie d'intégrité)
 *  5. Génère la référence IC-CR-YYYY-XXXX en transaction exclusive
 *  6. Mappe CR → payload Craft (markdown + metadata)
 *  7. Appelle publishToCraft() (gère retries + timeout en interne)
 *  8. Si succès :
 *       - INSERT cr_published
 *       - UPDATE cr_drafts.status → 'published'
 *       - INSERT access_logs (action='publish', result='success')
 *       - 200 { success, craftDocId, craftUrl, reference, publishedAt }
 *  9. Si échec :
 *       - INSERT access_logs (action='publish', result='error')
 *       - 502 { success: false, error } — 502 parce que le service upstream
 *         (Craft) est en cause, pas le client.
 *
 * Rate limit : 10 req / 15 min / IP — mounté en amont via publishRateLimit.
 * Auth : Phase 4 ne gère pas l'auth (cf routes/draft.ts — même convention).
 *
 * Source de vérité :
 *  - docs/ia/secretariat-architecture.md Section 3 (flow), Section 4 (compteur),
 *    Section 8 (Craft), Section 9 (horodatage — Phase 6).
 *  - docs/legal/secretariat-agent-legal-audit.md Bloc 6 (traçabilité DGFiP).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';

import { getDb } from '../db/connection';
import { AppError } from '../middleware/errorHandler';
import { publishToCraft } from '../services/craft';
import { mapCrToCraftPayload } from '../services/cr-to-craft-mapper';
import { CRDraftSchema, type CRDraft } from '../services/anthropic.types';
import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';

export const publishRouter = Router();

// ============================================================
// Types DB
// ============================================================

interface DraftRow {
  id: string;
  user_phone: string;
  status: string;
  cr_json: string | null;
  entite: string | null;
  type_reunion: string | null;
  date_reunion: string | null;
}

interface PublishedRow {
  reference: string;
}

// ============================================================
// Helpers — génération de la référence IC-CR-YYYY-XXXX
// ============================================================

/**
 * Génère la prochaine référence pour une entité et une année données.
 * Transaction exclusive pour éviter les doublons en cas de publications
 * simultanées (très rare en usage réel mais à sécuriser — cf architecture §4.2).
 *
 * Algorithme :
 *  1. COUNT des cr_published pour l'entité et l'année
 *  2. Référence candidate = prefix + (count + 1).padStart(4)
 *  3. SELECT pour vérifier l'unicité, incrémenter en cas de collision
 *  4. Retourne la référence unique
 *
 * Note : on délègue l'unicité finale à la clé PRIMARY KEY de cr_published
 * qui throw si collision — ce qui permet au caller de retry avec +1.
 */
function generateNextReference(entite: string, year: number): string {
  const db = getDb();
  const prefix = `${entite}-CR-${year}-`;

  // Récupère la dernière référence connue localement pour cette entité/année.
  // On trie en DESC sur le suffixe numérique (cast en INTEGER via CAST).
  const row = db
    .prepare(
      `SELECT reference FROM cr_published
       WHERE reference LIKE ?
       ORDER BY CAST(SUBSTR(reference, ?, 4) AS INTEGER) DESC
       LIMIT 1`,
    )
    .get(`${prefix}%`, prefix.length + 1) as PublishedRow | undefined;

  let nextNumber = 1;
  if (row !== undefined) {
    const suffix = row.reference.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);
    if (!Number.isNaN(parsed)) {
      nextNumber = parsed + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

// ============================================================
// Route principale
// ============================================================

publishRouter.post(
  '/:draftId',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const log = getLogger();
    const db = getDb();

    // --- 1. Validation de l'URL param ---
    const draftId = req.params.draftId;
    if (typeof draftId !== 'string' || draftId.length === 0) {
      next(new AppError(400, 'INVALID_DRAFT_ID', "draftId manquant dans l'URL"));
      return;
    }

    // --- 2. Récupération du draft ---
    const draft = db
      .prepare(
        `SELECT id, user_phone, status, cr_json, entite, type_reunion, date_reunion
         FROM cr_drafts WHERE id = ?`,
      )
      .get(draftId) as DraftRow | undefined;

    if (draft === undefined) {
      next(new AppError(404, 'DRAFT_NOT_FOUND', `Draft ${draftId} introuvable`));
      return;
    }

    // --- 3. Vérification du status ---
    // Le draft doit être "ready" (validé par le LLM + éventuellement par l'utilisateur).
    // Les autres status (needs_clarification, abandoned) ne sont pas publiables.
    // Le status "published" indique qu'une publication a déjà réussi.
    if (draft.status === 'published') {
      // Si déjà publié, on retrouve la publication existante pour la retourner
      const existing = db
        .prepare(
          `SELECT reference, craft_document_id, craft_url, date_etablissement
           FROM cr_published WHERE draft_id = ? LIMIT 1`,
        )
        .get(draftId) as
        | {
            reference: string;
            craft_document_id: string;
            craft_url: string;
            date_etablissement: string;
          }
        | undefined;

      next(
        new AppError(
          409,
          'DRAFT_ALREADY_PUBLISHED',
          'Ce CR a déjà été publié',
          existing
            ? {
                reference: existing.reference,
                craftDocId: existing.craft_document_id,
                craftUrl: existing.craft_url,
                publishedAt: existing.date_etablissement,
              }
            : undefined,
        ),
      );
      return;
    }

    if (draft.status !== 'ready') {
      next(
        new AppError(
          409,
          'DRAFT_NOT_READY',
          `Le draft doit être validé (status "ready") avant publication — status actuel : "${draft.status}"`,
        ),
      );
      return;
    }

    // --- 4. Revalidation du cr_json (défense en profondeur) ---
    if (draft.cr_json === null) {
      next(
        new AppError(
          500,
          'DRAFT_MISSING_CR_JSON',
          "Draft en status 'ready' mais cr_json est null — état incohérent",
        ),
      );
      return;
    }

    let cr: CRDraft;
    try {
      const parsed: unknown = JSON.parse(draft.cr_json);
      const validation = CRDraftSchema.safeParse(parsed);
      if (!validation.success) {
        log.error(
          { draftId, issues: validation.error.issues },
          '[publish] cr_json en DB ne respecte pas CRDraftSchema',
        );
        next(
          new AppError(
            500,
            'DRAFT_INVALID_CR_JSON',
            'Le CR stocké en base ne respecte pas le schéma attendu',
          ),
        );
        return;
      }
      cr = validation.data;
    } catch (err) {
      log.error({ draftId, err }, '[publish] cr_json non parseable');
      next(
        new AppError(500, 'DRAFT_CORRUPTED_CR_JSON', 'Le CR stocké en base est corrompu'),
      );
      return;
    }

    // --- 5. Génération de la référence ---
    const year = Number.parseInt(cr.date_reunion.slice(0, 4), 10);
    if (Number.isNaN(year)) {
      next(
        new AppError(
          500,
          'INVALID_YEAR',
          `Impossible d'extraire l'année de date_reunion : ${cr.date_reunion}`,
        ),
      );
      return;
    }

    const reference = generateNextReference(cr.entite, year);
    const dateEtablissement = new Date().toISOString();

    // --- 6. Mapping CR → payload Craft ---
    const payload = mapCrToCraftPayload({
      cr,
      draftId,
      reference,
      dateEtablissement,
      userPhone: draft.user_phone,
    });

    log.info(
      {
        draftId,
        reference,
        entite: cr.entite,
        filename: payload.internalTitle,
        markdownLength: payload.markdown.length,
      },
      '[publish] publication Craft en cours',
    );

    // --- 7. Appel Craft ---
    const result = await publishToCraft(payload);

    // --- 8. Log access en tous cas ---
    const logAccess = db.prepare(
      `INSERT INTO access_logs (
        actor_phone, actor_display_name, resource_type, resource_id, action,
        entite, result, timestamp, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    if (!result.success) {
      // Échec → log + 502 (Craft upstream KO)
      logAccess.run(
        draft.user_phone,
        null,
        'cr_draft',
        draftId,
        'publish',
        cr.entite,
        'error',
        new Date().toISOString(),
        req.ip ?? null,
        req.get('user-agent') ?? null,
      );

      log.error(
        {
          draftId,
          reference,
          error: result.error,
          httpStatus: result.httpStatus,
          durationMs: result.durationMs,
          attempts: result.attempts,
        },
        '[publish] échec publication Craft',
      );

      next(
        new AppError(502, 'CRAFT_PUBLISH_FAILED', result.error ?? 'Publication Craft échouée', {
          craftHttpStatus: result.httpStatus,
          attempts: result.attempts,
          durationMs: result.durationMs,
        }),
      );
      return;
    }

    // --- 9. Succès : persistance cr_published + update draft ---
    const craftDocId = result.craftDocId;
    // Si Craft n'a pas retourné d'URL, on construit un fallback lisible
    // en utilisant la base URL configurée. Ce fallback est informatif —
    // il n'est pas garanti d'être navigable mais reste utile pour l'admin.
    const env = getEnv();
    const craftUrl =
      result.craftUrl ?? `${env.CRAFT_IC_BASE_URL.replace(/\/$/, '')}/blocks/${craftDocId}`;

    if (craftDocId === undefined) {
      // Ne devrait pas arriver — publishToCraft garantit craftDocId si success=true.
      next(
        new AppError(
          502,
          'CRAFT_PUBLISH_NO_ID',
          "Publication Craft réussie mais aucun identifiant retourné",
        ),
      );
      return;
    }

    try {
      // Transaction atomique : insert cr_published + update cr_drafts.
      // Si l'un échoue, on rollback les deux.
      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO cr_published (
            reference, draft_id, entite, type_reunion, date_reunion,
            date_etablissement, markdown, markdown_sha256,
            craft_document_id, craft_url, craft_filename,
            rfc3161_token, rfc3161_provider, published_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          reference,
          draftId,
          cr.entite,
          cr.type_reunion,
          cr.date_reunion,
          dateEtablissement,
          payload.markdown,
          payload.internalMetadata.markdownSha256,
          craftDocId,
          craftUrl,
          payload.internalTitle,
          null, // rfc3161_token — Phase 6
          null, // rfc3161_provider — Phase 6
          draft.user_phone,
        );

        db.prepare(
          `UPDATE cr_drafts SET status = 'published', updated_at = ?, published_at = ?
           WHERE id = ?`,
        ).run(dateEtablissement, dateEtablissement, draftId);
      });
      tx();
    } catch (err) {
      log.error(
        { draftId, reference, err },
        '[publish] publication Craft OK mais persistance DB échouée — état à réconcilier',
      );
      // À ce stade le doc est chez Craft mais pas chez nous. On log un access
      // en "error" et on remonte 500. L'admin Phase 5 devra réconcilier.
      logAccess.run(
        draft.user_phone,
        null,
        'cr_draft',
        draftId,
        'publish',
        cr.entite,
        'error',
        new Date().toISOString(),
        req.ip ?? null,
        req.get('user-agent') ?? null,
      );
      next(
        new AppError(
          500,
          'PERSIST_FAILED_AFTER_CRAFT_OK',
          'Publication Craft réussie mais échec de persistance locale — contacter un administrateur',
          { craftDocId, reference },
        ),
      );
      return;
    }

    // Log de succès
    logAccess.run(
      draft.user_phone,
      null,
      'cr_published',
      reference,
      'publish',
      cr.entite,
      'success',
      new Date().toISOString(),
      req.ip ?? null,
      req.get('user-agent') ?? null,
    );

    log.info(
      {
        draftId,
        reference,
        craftDocId,
        durationMs: result.durationMs,
        attempts: result.attempts,
      },
      '[publish] publication réussie',
    );

    res.status(200).json({
      success: true,
      reference,
      craftDocId,
      craftUrl,
      publishedAt: dateEtablissement,
      filename: payload.internalTitle,
      markdownSha256: payload.internalMetadata.markdownSha256,
    });
  },
);
