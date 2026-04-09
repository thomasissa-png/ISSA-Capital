/**
 * /admin/api/drafts + /admin/api/published — lecture seule Phase 5.
 *
 * Principe : proxy léger vers les tables existantes. On NE réexporte PAS la
 * logique complète des routes publiques `/api/drafts` et `/api/published` :
 *  - Ici l'auth est obligatoire (montée via authJwt + requireAdmin)
 *  - Filtres additionnels spécifiques à l'admin (entity, from, to, status)
 *  - Pagination identique (50/page, max 200)
 *
 * RBAC Phase 5 : aucun filtre par entité (mono-compte Thomas = superadmin).
 * Phase 6 filtrera selon `req.admin.entitesVisibles` quand Carl/Maxime seront
 * ajoutés.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { getDb } from '../../db/connection';
import { AppError } from '../../middleware/errorHandler';

export const draftsPublishedRouter = Router();

// ============================================================
// Types DB
// ============================================================

interface DraftRow {
  id: string;
  user_phone: string;
  conversation_id: string;
  raw_input: string;
  enriched_input: string | null;
  status: string;
  clarification_history: string | null;
  cr_json: string | null;
  cr_markdown: string | null;
  type_reunion: string | null;
  entite: string | null;
  date_reunion: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
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

interface PublishedFullRow extends PublishedListRow {
  markdown: string;
}

function serializeDraft(row: DraftRow): Record<string, unknown> {
  let crParsed: unknown = null;
  if (row.cr_json !== null) {
    try {
      crParsed = JSON.parse(row.cr_json);
    } catch {
      crParsed = null;
    }
  }
  return {
    id: row.id,
    userPhone: row.user_phone,
    conversationId: row.conversation_id,
    rawInput: row.raw_input,
    status: row.status,
    cr: crParsed,
    typeReunion: row.type_reunion,
    entite: row.entite,
    dateReunion: row.date_reunion,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
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
// GET /admin/api/drafts
// ============================================================

const DraftsQuerySchema = z.object({
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
  status: z
    .enum(['needs_clarification', 'ready', 'published', 'abandoned'])
    .optional(),
  entity: z.enum(['IC', 'GO', 'VI', 'VV']).optional(),
});

draftsPublishedRouter.get(
  '/drafts',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = DraftsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const { page, limit, status, entity } = parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();

    const where: string[] = [];
    const params: Array<string | number> = [];
    if (status !== undefined) {
      where.push('status = ?');
      params.push(status);
    }
    if (entity !== undefined) {
      where.push('entite = ?');
      params.push(entity);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `SELECT * FROM cr_drafts ${whereSql}
         ORDER BY datetime(created_at) DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as DraftRow[];

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS total FROM cr_drafts ${whereSql}`)
      .get(...params) as { total: number };

    res.status(200).json({
      page,
      limit,
      total: totalRow.total,
      items: rows.map(serializeDraft),
    });
  },
);

// ============================================================
// GET /admin/api/published
// ============================================================

const PublishedQuerySchema = z.object({
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
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

draftsPublishedRouter.get(
  '/published',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = PublishedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const { page, limit, entity, from, to } = parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();

    const where: string[] = [];
    const params: Array<string | number> = [];
    if (entity !== undefined) {
      where.push('entite = ?');
      params.push(entity);
    }
    if (from !== undefined) {
      where.push('date_reunion >= ?');
      params.push(from);
    }
    if (to !== undefined) {
      where.push('date_reunion <= ?');
      params.push(to);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `SELECT reference, draft_id, entite, type_reunion, date_reunion,
                date_etablissement, markdown_sha256, craft_document_id,
                craft_url, craft_filename, rfc3161_token, rfc3161_provider,
                published_by
         FROM cr_published ${whereSql}
         ORDER BY datetime(date_etablissement) DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as PublishedListRow[];

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS total FROM cr_published ${whereSql}`)
      .get(...params) as { total: number };

    res.status(200).json({
      page,
      limit,
      total: totalRow.total,
      items: rows.map(serializePublishedList),
    });
  },
);

// ============================================================
// GET /admin/api/published/:reference — détail avec markdown
// ============================================================

draftsPublishedRouter.get(
  '/published/:reference',
  (req: Request, res: Response, next: NextFunction): void => {
    const ref = req.params.reference;
    if (typeof ref !== 'string' || ref.length === 0) {
      next(new AppError(400, 'INVALID_REFERENCE', 'reference manquante'));
      return;
    }
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM cr_published WHERE reference = ?')
      .get(ref) as PublishedFullRow | undefined;
    if (row === undefined) {
      next(
        new AppError(
          404,
          'PUBLISHED_NOT_FOUND',
          `Publication ${ref} introuvable`,
        ),
      );
      return;
    }
    res.status(200).json({
      ...serializePublishedList(row),
      markdown: row.markdown,
    });
  },
);
