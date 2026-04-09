/**
 * /admin/api/contacts — CRUD complet sur la table `contacts` (Phase 5).
 *
 * Endpoints (tous protégés par authJwt + requireAdmin via le router parent) :
 *  - GET    /admin/api/contacts            → liste paginée + filtre `q`
 *  - GET    /admin/api/contacts/:id        → détail
 *  - POST   /admin/api/contacts            → création
 *  - PATCH  /admin/api/contacts/:id        → update partiel
 *  - DELETE /admin/api/contacts/:id        → soft delete (deleted_at = now)
 *  - PATCH  /admin/api/contacts/:id/whatsapp-authorize → toggle boolean
 *
 * Règles :
 *  - Le filtre `q` porte sur nom, prenom, email, telephone, societe (LIKE %q%)
 *  - Les contacts soft-deleted sont exclus par défaut (WHERE deleted_at IS NULL)
 *  - Tri par updated_at DESC
 *  - Pagination 50 par défaut, max 200
 *  - entites_visibles est stocké en JSON string — on parse/sérialise ici
 *  - source est obligatoire : pour un POST depuis l'admin, on force
 *    `source = 'admin_YYYY-MM-DD'`
 *
 * RBAC : V1 mono-compte, pas de filtre par entité. Phase 6 filtrera les
 * contacts par `entites_visibles` selon le rôle du user authentifié.
 */

import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { getDb } from '../../db/connection';
import { AppError } from '../../middleware/errorHandler';
import { getLogger } from '../../utils/logger';

export const contactsRouter = Router();

// ============================================================
// Types DB
// ============================================================

interface ContactRow {
  id: string;
  prenom: string;
  nom: string;
  titre: string | null;
  societe: string | null;
  email: string | null;
  telephone: string | null;
  whatsapp_authorized: number;
  entites_visibles: string | null;
  notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function serializeContact(row: ContactRow): Record<string, unknown> {
  let entites: string[] = [];
  if (row.entites_visibles !== null) {
    try {
      const parsed = JSON.parse(row.entites_visibles);
      if (Array.isArray(parsed)) {
        entites = parsed.filter((v): v is string => typeof v === 'string');
      }
    } catch {
      entites = [];
    }
  }

  return {
    id: row.id,
    prenom: row.prenom,
    nom: row.nom,
    titre: row.titre,
    societe: row.societe,
    email: row.email,
    telephone: row.telephone,
    whatsappAuthorized: row.whatsapp_authorized === 1,
    entitesVisibles: entites,
    notes: row.notes,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

// ============================================================
// Schémas Zod
// ============================================================

const EntiteEnum = z.enum(['IC', 'GO', 'VI', 'VV']);

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
  q: z.string().max(200).optional(),
  includeDeleted: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

const CreateSchema = z.object({
  prenom: z.string().min(1).max(100),
  nom: z.string().min(1).max(100),
  titre: z.string().max(200).optional().nullable(),
  societe: z.string().max(200).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal('')),
  telephone: z.string().max(50).optional().nullable(),
  whatsappAuthorized: z.boolean().optional().default(false),
  entitesVisibles: z.array(EntiteEnum).optional().default([]),
  notes: z.string().max(5000).optional().nullable(),
});

const PatchSchema = CreateSchema.partial();

// ============================================================
// GET /admin/api/contacts
// ============================================================

contactsRouter.get(
  '/',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const { page, limit, q, includeDeleted } = parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();

    const whereClauses: string[] = [];
    const whereParams: Array<string | number> = [];

    if (!includeDeleted) {
      whereClauses.push('deleted_at IS NULL');
    }

    if (q !== undefined && q.trim().length > 0) {
      const like = `%${q.trim()}%`;
      whereClauses.push(
        '(nom LIKE ? OR prenom LIKE ? OR email LIKE ? OR telephone LIKE ? OR societe LIKE ?)',
      );
      whereParams.push(like, like, like, like, like);
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const listSql = `
      SELECT * FROM contacts
      ${whereSql}
      ORDER BY datetime(updated_at) DESC
      LIMIT ? OFFSET ?
    `;
    const countSql = `SELECT COUNT(*) AS total FROM contacts ${whereSql}`;

    const rows = db
      .prepare(listSql)
      .all(...whereParams, limit, offset) as ContactRow[];
    const totalRow = db.prepare(countSql).get(...whereParams) as {
      total: number;
    };

    res.status(200).json({
      page,
      limit,
      total: totalRow.total,
      items: rows.map(serializeContact),
    });
  },
);

// ============================================================
// GET /admin/api/contacts/:id
// ============================================================

contactsRouter.get(
  '/:id',
  (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id;
    if (typeof id !== 'string' || id.length === 0) {
      next(new AppError(400, 'INVALID_ID', 'id manquant'));
      return;
    }
    const db = getDb();
    const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as
      | ContactRow
      | undefined;
    if (row === undefined) {
      next(new AppError(404, 'CONTACT_NOT_FOUND', `Contact ${id} introuvable`));
      return;
    }
    res.status(200).json(serializeContact(row));
  },
);

// ============================================================
// POST /admin/api/contacts
// ============================================================

contactsRouter.post(
  '/',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const data = parsed.data;
    const db = getDb();

    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const id = randomUUID();

    const normalizedEmail =
      data.email === '' || data.email === null || data.email === undefined
        ? null
        : data.email;

    db.prepare(
      `INSERT INTO contacts
        (id, prenom, nom, titre, societe, email, telephone,
         whatsapp_authorized, entites_visibles, notes, source,
         created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).run(
      id,
      data.prenom,
      data.nom,
      data.titre ?? null,
      data.societe ?? null,
      normalizedEmail,
      data.telephone ?? null,
      data.whatsappAuthorized ? 1 : 0,
      JSON.stringify(data.entitesVisibles ?? []),
      data.notes ?? null,
      `admin_${today}`,
      now,
      now,
    );

    const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as
      | ContactRow
      | undefined;

    if (row === undefined) {
      next(new AppError(500, 'INSERT_FAILED', 'Échec relecture après insert'));
      return;
    }

    getLogger().info({ contactId: id }, '[admin/contacts] création');
    res.status(201).json(serializeContact(row));
  },
);

// ============================================================
// PATCH /admin/api/contacts/:id
// ============================================================

contactsRouter.patch(
  '/:id',
  (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id;
    if (typeof id !== 'string' || id.length === 0) {
      next(new AppError(400, 'INVALID_ID', 'id manquant'));
      return;
    }

    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const patch = parsed.data;
    const db = getDb();
    const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as
      | ContactRow
      | undefined;

    if (row === undefined) {
      next(new AppError(404, 'CONTACT_NOT_FOUND', `Contact ${id} introuvable`));
      return;
    }

    const updates: string[] = [];
    const values: Array<string | number | null> = [];

    const mapping: Array<[keyof typeof patch, string, (v: unknown) => string | number | null]> = [
      ['prenom', 'prenom', (v) => v as string],
      ['nom', 'nom', (v) => v as string],
      ['titre', 'titre', (v) => (v as string | null) ?? null],
      ['societe', 'societe', (v) => (v as string | null) ?? null],
      [
        'email',
        'email',
        (v) => {
          if (v === '' || v === null || v === undefined) return null;
          return v as string;
        },
      ],
      ['telephone', 'telephone', (v) => (v as string | null) ?? null],
      [
        'whatsappAuthorized',
        'whatsapp_authorized',
        (v) => (v === true ? 1 : 0),
      ],
      [
        'entitesVisibles',
        'entites_visibles',
        (v) => JSON.stringify(v ?? []),
      ],
      ['notes', 'notes', (v) => (v as string | null) ?? null],
    ];

    for (const [key, column, transform] of mapping) {
      if (patch[key] !== undefined) {
        updates.push(`${column} = ?`);
        values.push(transform(patch[key]));
      }
    }

    if (updates.length === 0) {
      res.status(200).json(serializeContact(row));
      return;
    }

    const now = new Date().toISOString();
    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`).run(
      ...values,
    );

    const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as
      | ContactRow
      | undefined;
    if (updated === undefined) {
      next(new AppError(500, 'UPDATE_FAILED', 'Échec relecture après update'));
      return;
    }

    getLogger().info({ contactId: id }, '[admin/contacts] patch');
    res.status(200).json(serializeContact(updated));
  },
);

// ============================================================
// DELETE /admin/api/contacts/:id — soft delete
// ============================================================

contactsRouter.delete(
  '/:id',
  (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id;
    if (typeof id !== 'string' || id.length === 0) {
      next(new AppError(400, 'INVALID_ID', 'id manquant'));
      return;
    }
    const db = getDb();
    const row = db
      .prepare('SELECT id, deleted_at FROM contacts WHERE id = ?')
      .get(id) as { id: string; deleted_at: string | null } | undefined;

    if (row === undefined) {
      next(new AppError(404, 'CONTACT_NOT_FOUND', `Contact ${id} introuvable`));
      return;
    }
    if (row.deleted_at !== null) {
      next(
        new AppError(
          409,
          'CONTACT_ALREADY_DELETED',
          `Contact ${id} déjà supprimé`,
        ),
      );
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      'UPDATE contacts SET deleted_at = ?, updated_at = ? WHERE id = ?',
    ).run(now, now, id);

    getLogger().info({ contactId: id }, '[admin/contacts] soft delete');
    res.status(200).json({ id, deletedAt: now });
  },
);

// ============================================================
// PATCH /admin/api/contacts/:id/whatsapp-authorize
// ============================================================

const WhatsappAuthorizeSchema = z.object({
  authorized: z.boolean(),
});

contactsRouter.patch(
  '/:id/whatsapp-authorize',
  (req: Request, res: Response, next: NextFunction): void => {
    const id = req.params.id;
    if (typeof id !== 'string' || id.length === 0) {
      next(new AppError(400, 'INVALID_ID', 'id manquant'));
      return;
    }

    const parsed = WhatsappAuthorizeSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const db = getDb();
    const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as
      | ContactRow
      | undefined;
    if (row === undefined) {
      next(new AppError(404, 'CONTACT_NOT_FOUND', `Contact ${id} introuvable`));
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      'UPDATE contacts SET whatsapp_authorized = ?, updated_at = ? WHERE id = ?',
    ).run(parsed.data.authorized ? 1 : 0, now, id);

    const updated = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as
      | ContactRow
      | undefined;
    if (updated === undefined) {
      next(new AppError(500, 'UPDATE_FAILED', 'Échec relecture après update'));
      return;
    }

    getLogger().info(
      { contactId: id, authorized: parsed.data.authorized },
      '[admin/contacts] whatsapp-authorize toggle',
    );
    res.status(200).json(serializeContact(updated));
  },
);
