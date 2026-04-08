/**
 * GET /api/published — lecture des CR publiés (Phase 4).
 *
 * Endpoints :
 *  - GET /api/published        → liste paginée 50/page, tri DESC date_etablissement
 *                                 filtres : ?entity=IC&from=2026-01-01&to=2026-12-31
 *  - GET /api/published/:id    → récupère une publication par reference
 *                                 (avec jointure sur cr_drafts pour le raw_input)
 *
 * Règles :
 *  - Les CR publiés sont IMMUTABLES (conservation DGFiP 10 ans) — pas de PATCH/DELETE.
 *  - Pas de filtre RBAC en Phase 4 (arrive en Phase 5 via middleware d'auth).
 *  - `markdown` est inclus dans GET /api/published/:id mais PAS dans la liste
 *    (réduction de payload — 50 CR × ~3KB = 150KB par page).
 *
 * Source de vérité : docs/ia/secretariat-architecture.md Section 2.3.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { getDb } from '../db/connection';
import { AppError } from '../middleware/errorHandler';

export const publishedRouter = Router();

// ============================================================
// Types DB
// ============================================================

interface PublishedRow {
  reference: string;
  draft_id: string;
  entite: string;
  type_reunion: string;
  date_reunion: string;
  date_etablissement: string;
  markdown: string;
  markdown_sha256: string;
  craft_document_id: string;
  craft_url: string;
  craft_filename: string;
  rfc3161_token: string | null;
  rfc3161_provider: string | null;
  published_by: string;
}

interface PublishedListRow {
  reference: string;
  draft_id: string;
  entite: string;
  type_reunion: string;
  date_reunion: string;
  date_etablissement: string;
  markdown_sha256: string;
  craft_document_id: string;
  craft_url: string;
  craft_filename: string;
  rfc3161_token: string | null;
  rfc3161_provider: string | null;
  published_by: string;
}

function serializePublishedFull(row: PublishedRow): Record<string, unknown> {
  return {
    reference: row.reference,
    draftId: row.draft_id,
    entite: row.entite,
    typeReunion: row.type_reunion,
    dateReunion: row.date_reunion,
    dateEtablissement: row.date_etablissement,
    markdown: row.markdown,
    markdownSha256: row.markdown_sha256,
    craftDocumentId: row.craft_document_id,
    craftUrl: row.craft_url,
    craftFilename: row.craft_filename,
    rfc3161Token: row.rfc3161_token,
    rfc3161Provider: row.rfc3161_provider,
    publishedBy: row.published_by,
  };
}

function serializePublishedList(row: PublishedListRow): Record<string, unknown> {
  return {
    reference: row.reference,
    draftId: row.draft_id,
    entite: row.entite,
    typeReunion: row.type_reunion,
    dateReunion: row.date_reunion,
    dateEtablissement: row.date_etablissement,
    markdownSha256: row.markdown_sha256,
    craftDocumentId: row.craft_document_id,
    craftUrl: row.craft_url,
    craftFilename: row.craft_filename,
    rfc3161Token: row.rfc3161_token,
    rfc3161Provider: row.rfc3161_provider,
    publishedBy: row.published_by,
  };
}

// ============================================================
// GET /api/published — liste paginée + filtres
// ============================================================

const ListQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default('50')
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().positive().max(200)),
  entity: z.enum(['IC', 'GO', 'VI', 'VV']).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from doit être au format YYYY-MM-DD')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to doit être au format YYYY-MM-DD')
    .optional(),
});

publishedRouter.get(
  '/',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const { page, limit, entity, from, to } = parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();

    // Construction dynamique des clauses WHERE — on évite l'injection en
    // utilisant exclusivement des paramètres liés (prepared statements).
    const whereClauses: string[] = [];
    const whereParams: Array<string | number> = [];

    if (entity !== undefined) {
      whereClauses.push('entite = ?');
      whereParams.push(entity);
    }
    if (from !== undefined) {
      whereClauses.push('date_reunion >= ?');
      whereParams.push(from);
    }
    if (to !== undefined) {
      whereClauses.push('date_reunion <= ?');
      whereParams.push(to);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const listSql = `
      SELECT reference, draft_id, entite, type_reunion, date_reunion,
             date_etablissement, markdown_sha256, craft_document_id,
             craft_url, craft_filename, rfc3161_token, rfc3161_provider,
             published_by
      FROM cr_published
      ${whereSql}
      ORDER BY datetime(date_etablissement) DESC
      LIMIT ? OFFSET ?
    `;
    const countSql = `SELECT COUNT(*) as total FROM cr_published ${whereSql}`;

    const listParams = [...whereParams, limit, offset];
    const rows = db.prepare(listSql).all(...listParams) as PublishedListRow[];
    const totalRow = db.prepare(countSql).get(...whereParams) as { total: number };

    res.status(200).json({
      page,
      limit,
      total: totalRow.total,
      items: rows.map(serializePublishedList),
    });
  },
);

// ============================================================
// GET /api/published/:id — récupération complète par reference
// ============================================================

publishedRouter.get(
  '/:id',
  (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id;
    if (typeof id !== 'string' || id.length === 0) {
      next(new AppError(400, 'INVALID_ID', "id (reference) manquant dans l'URL"));
      return;
    }

    const db = getDb();
    const row = db
      .prepare('SELECT * FROM cr_published WHERE reference = ?')
      .get(id) as PublishedRow | undefined;

    if (row === undefined) {
      next(new AppError(404, 'PUBLISHED_NOT_FOUND', `Publication ${id} introuvable`));
      return;
    }

    res.status(200).json(serializePublishedFull(row));
  },
);
