/**
 * GET/PATCH/DELETE /api/drafts — lecture, mise à jour, suppression soft.
 *
 * Endpoints :
 *  - GET    /api/drafts         → liste paginée (50/page, tri DESC created_at)
 *  - GET    /api/drafts/:id     → récupère un draft par id
 *  - PATCH  /api/drafts/:id     → update partiel (status, notes — le cr_json reste immutable)
 *  - DELETE /api/drafts/:id     → suppression soft (marque published_at comme tombstone)
 *
 * Auth : pas d'auth Phase 3 (cf routes/draft.ts). L'admin Phase 5 gèrera le
 * RBAC via un middleware de session.
 *
 * Persistance : table `cr_drafts` — cf schema.sql. La colonne `cr_json` est
 * stockée en TEXT (JSON sérialisé). On la reparse au moment de la lecture
 * pour la renvoyer typée côté client.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { getDb } from '../db/connection';
import { AppError } from '../middleware/errorHandler';
import { getLogger } from '../utils/logger';

export const draftsRouter = Router();

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

/**
 * Sérialise une row DB en payload JSON client-friendly.
 * Le cr_json est reparsé en objet ; clarification_history idem.
 */
function serializeDraft(row: DraftRow): Record<string, unknown> {
  let crParsed: unknown = null;
  if (row.cr_json !== null) {
    try {
      crParsed = JSON.parse(row.cr_json);
    } catch {
      crParsed = null;
    }
  }

  let historyParsed: unknown = null;
  if (row.clarification_history !== null) {
    try {
      historyParsed = JSON.parse(row.clarification_history);
    } catch {
      historyParsed = null;
    }
  }

  return {
    id: row.id,
    userPhone: row.user_phone,
    conversationId: row.conversation_id,
    rawInput: row.raw_input,
    enrichedInput: row.enriched_input,
    status: row.status,
    clarificationHistory: historyParsed,
    cr: crParsed,
    typeReunion: row.type_reunion,
    entite: row.entite,
    dateReunion: row.date_reunion,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

// ============================================================
// GET /api/drafts — liste paginée
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
  status: z.enum(['needs_clarification', 'ready', 'published', 'abandoned']).optional(),
});

draftsRouter.get(
  '/',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const { page, limit, status } = parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();

    const whereClause = status !== undefined ? 'WHERE status = ?' : '';
    const listSql = `
      SELECT * FROM cr_drafts
      ${whereClause}
      ORDER BY datetime(created_at) DESC
      LIMIT ? OFFSET ?
    `;
    const countSql = `SELECT COUNT(*) as total FROM cr_drafts ${whereClause}`;

    const listParams: Array<string | number> =
      status !== undefined ? [status, limit, offset] : [limit, offset];
    const countParams: string[] = status !== undefined ? [status] : [];

    const rows = db.prepare(listSql).all(...listParams) as DraftRow[];
    const totalRow = db.prepare(countSql).get(...countParams) as { total: number };

    res.status(200).json({
      page,
      limit,
      total: totalRow.total,
      items: rows.map(serializeDraft),
    });
  },
);

// ============================================================
// GET /api/drafts/:id
// ============================================================

draftsRouter.get(
  '/:id',
  (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id;
    if (typeof id !== 'string' || id.length === 0) {
      next(new AppError(400, 'INVALID_ID', 'id manquant dans l\'URL'));
      return;
    }

    const db = getDb();
    const row = db.prepare('SELECT * FROM cr_drafts WHERE id = ?').get(id) as
      | DraftRow
      | undefined;

    if (row === undefined) {
      next(new AppError(404, 'DRAFT_NOT_FOUND', `Draft ${id} introuvable`));
      return;
    }

    res.status(200).json(serializeDraft(row));
  },
);

// ============================================================
// PATCH /api/drafts/:id — update partiel
// ============================================================

const PatchSchema = z.object({
  status: z.enum(['needs_clarification', 'ready', 'published', 'abandoned']).optional(),
  notes: z.string().max(2000).optional(),
});

draftsRouter.patch(
  '/:id',
  (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id;
    if (typeof id !== 'string' || id.length === 0) {
      next(new AppError(400, 'INVALID_ID', 'id manquant dans l\'URL'));
      return;
    }

    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const patch = parsed.data;

    const db = getDb();
    const row = db.prepare('SELECT * FROM cr_drafts WHERE id = ?').get(id) as
      | DraftRow
      | undefined;

    if (row === undefined) {
      next(new AppError(404, 'DRAFT_NOT_FOUND', `Draft ${id} introuvable`));
      return;
    }

    // Construction dynamique de l'UPDATE — uniquement les champs fournis
    const updates: string[] = [];
    const values: Array<string | number | null> = [];

    if (patch.status !== undefined) {
      updates.push('status = ?');
      values.push(patch.status);
    }
    // Les notes sont stockées dans enriched_input (placeholder Phase 3 — une
    // colonne dédiée pourra être ajoutée Phase 5 si nécessaire).
    if (patch.notes !== undefined) {
      updates.push('enriched_input = ?');
      values.push(patch.notes);
    }

    if (updates.length === 0) {
      // Aucun champ à modifier → 200 avec le draft inchangé
      res.status(200).json(serializeDraft(row));
      return;
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE cr_drafts SET ${updates.join(', ')} WHERE id = ?`).run(
      ...values,
    );

    const updated = db.prepare('SELECT * FROM cr_drafts WHERE id = ?').get(id) as
      | DraftRow
      | undefined;

    if (updated === undefined) {
      next(new AppError(500, 'UPDATE_FAILED', 'Échec relecture après update'));
      return;
    }

    getLogger().info({ draftId: id, patch }, '[drafts] patch appliqué');
    res.status(200).json(serializeDraft(updated));
  },
);

// ============================================================
// DELETE /api/drafts/:id — soft delete (status → abandoned)
// ============================================================

draftsRouter.delete(
  '/:id',
  (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id;
    if (typeof id !== 'string' || id.length === 0) {
      next(new AppError(400, 'INVALID_ID', 'id manquant dans l\'URL'));
      return;
    }

    const db = getDb();
    const row = db.prepare('SELECT id, status FROM cr_drafts WHERE id = ?').get(id) as
      | { id: string; status: string }
      | undefined;

    if (row === undefined) {
      next(new AppError(404, 'DRAFT_NOT_FOUND', `Draft ${id} introuvable`));
      return;
    }

    if (row.status === 'published') {
      next(
        new AppError(
          409,
          'DRAFT_ALREADY_PUBLISHED',
          'Impossible de supprimer un CR déjà publié (conservation DGFiP 10 ans)',
        ),
      );
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE cr_drafts SET status = 'abandoned', updated_at = ? WHERE id = ?`,
    ).run(now, id);

    getLogger().info({ draftId: id }, '[drafts] soft delete (abandoned)');
    res.status(200).json({ id, status: 'abandoned', updatedAt: now });
  },
);
