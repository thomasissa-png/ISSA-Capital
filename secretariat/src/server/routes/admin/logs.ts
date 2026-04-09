/**
 * /admin/api/logs — lecture seule des logs `access_logs` et `generation_logs`.
 *
 * Endpoints (tous protégés par authJwt + requireAdmin via le router parent) :
 *  - GET /admin/api/logs/access      → logs d'accès paginés + filtres
 *  - GET /admin/api/logs/generation  → logs de génération LLM + métriques
 *  - GET /admin/api/logs/generation/stats → métriques agrégées (coût 30j)
 *
 * Filtres :
 *  - `user`     : filtre par actor_phone (access) ou user_phone (generation)
 *  - `from`     : YYYY-MM-DD (inclusive)
 *  - `to`       : YYYY-MM-DD (inclusive)
 *  - `action`   : read|create|update|delete|publish (access uniquement)
 *  - `entity`   : IC|GO|VI|VV (access uniquement)
 *  - `status`   : success|error|needs_clarification (generation uniquement)
 *
 * Pagination : 100/page par défaut (logs = payload léger), max 500.
 *
 * Rétention DGFiP : les logs sont conservés 10 ans. Aucune route DELETE ici.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import { getDb } from '../../db/connection';

export const logsRouter = Router();

// ============================================================
// Types DB
// ============================================================

interface AccessLogRow {
  id: number;
  actor_phone: string;
  actor_display_name: string | null;
  resource_type: string;
  resource_id: string;
  action: string;
  entite: string | null;
  result: string;
  timestamp: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface GenerationLogRow {
  id: number;
  draft_id: string;
  user_phone: string;
  claude_model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  status: string;
  error_message: string | null;
  timestamp: string;
}

function serializeAccessLog(row: AccessLogRow): Record<string, unknown> {
  return {
    id: row.id,
    actorPhone: row.actor_phone,
    actorDisplayName: row.actor_display_name,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    action: row.action,
    entite: row.entite,
    result: row.result,
    timestamp: row.timestamp,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
  };
}

function serializeGenerationLog(row: GenerationLogRow): Record<string, unknown> {
  return {
    id: row.id,
    draftId: row.draft_id,
    userPhone: row.user_phone,
    claudeModel: row.claude_model,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    costUsd: row.cost_usd,
    latencyMs: row.latency_ms,
    status: row.status,
    errorMessage: row.error_message,
    timestamp: row.timestamp,
  };
}

// ============================================================
// Schémas Zod
// ============================================================

const BasePagination = {
  page: z
    .string()
    .optional()
    .default('1')
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .default('100')
    .transform((v) => Number.parseInt(v, 10))
    .pipe(z.number().int().positive().max(500)),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
};

const AccessQuerySchema = z.object({
  ...BasePagination,
  user: z.string().max(50).optional(),
  action: z
    .enum([
      'read',
      'create',
      'update',
      'delete',
      'publish',
      'generate',
      'cancel',
      'api_request',
      'whatsapp_blocked',
      'rate_limited',
    ])
    .optional(),
  entity: z.enum(['IC', 'GO', 'VI', 'VV']).optional(),
  // Par défaut, on N'INCLUT PAS les logs d'infrastructure (accessLogger,
  // rate limits, whitelist blocked) — trop bruyants pour l'audit utilisateur.
  // L'admin peut les réactiver via `?include_infra=true` pour debug.
  include_infra: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

/** Actions considérées comme "infrastructure" — exclues du feed par défaut. */
const INFRA_ACTIONS = ['api_request', 'whatsapp_blocked', 'rate_limited'] as const;

const GenerationQuerySchema = z.object({
  ...BasePagination,
  user: z.string().max(50).optional(),
  status: z.enum(['success', 'error', 'needs_clarification']).optional(),
});

// ============================================================
// GET /admin/api/logs/access
// ============================================================

logsRouter.get(
  '/access',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = AccessQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const { page, limit, from, to, user, action, entity, include_infra } =
      parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();

    const where: string[] = [];
    const params: Array<string | number> = [];

    if (user !== undefined) {
      where.push('actor_phone = ?');
      params.push(user);
    }
    if (action !== undefined) {
      where.push('action = ?');
      params.push(action);
    } else if (!include_infra) {
      // Par défaut : on exclut les actions "infrastructure" (api_request,
      // whatsapp_blocked, rate_limited) qui polluent le feed d'audit utilisateur.
      const placeholders = INFRA_ACTIONS.map(() => '?').join(', ');
      where.push(`action NOT IN (${placeholders})`);
      for (const a of INFRA_ACTIONS) {
        params.push(a);
      }
    }
    if (entity !== undefined) {
      where.push('entite = ?');
      params.push(entity);
    }
    if (from !== undefined) {
      where.push('timestamp >= ?');
      params.push(`${from}T00:00:00.000Z`);
    }
    if (to !== undefined) {
      where.push('timestamp <= ?');
      params.push(`${to}T23:59:59.999Z`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `SELECT * FROM access_logs ${whereSql}
         ORDER BY datetime(timestamp) DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as AccessLogRow[];

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS total FROM access_logs ${whereSql}`)
      .get(...params) as { total: number };

    res.status(200).json({
      page,
      limit,
      total: totalRow.total,
      items: rows.map(serializeAccessLog),
    });
  },
);

// ============================================================
// GET /admin/api/logs/generation
// ============================================================

logsRouter.get(
  '/generation',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = GenerationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const { page, limit, from, to, user, status } = parsed.data;
    const offset = (page - 1) * limit;
    const db = getDb();

    const where: string[] = [];
    const params: Array<string | number> = [];

    if (user !== undefined) {
      where.push('user_phone = ?');
      params.push(user);
    }
    if (status !== undefined) {
      where.push('status = ?');
      params.push(status);
    }
    if (from !== undefined) {
      where.push('timestamp >= ?');
      params.push(`${from}T00:00:00.000Z`);
    }
    if (to !== undefined) {
      where.push('timestamp <= ?');
      params.push(`${to}T23:59:59.999Z`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const rows = db
      .prepare(
        `SELECT * FROM generation_logs ${whereSql}
         ORDER BY datetime(timestamp) DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as GenerationLogRow[];

    const totalRow = db
      .prepare(`SELECT COUNT(*) AS total FROM generation_logs ${whereSql}`)
      .get(...params) as { total: number };

    res.status(200).json({
      page,
      limit,
      total: totalRow.total,
      items: rows.map(serializeGenerationLog),
    });
  },
);

// ============================================================
// GET /admin/api/logs/generation/stats — métriques agrégées
// ============================================================

logsRouter.get(
  '/generation/stats',
  (_req: Request, res: Response): void => {
    const db = getDb();

    // Coût cumulé sur les 30 derniers jours (compare string ISO = OK en TEXT)
    const since = new Date(
      Date.now() - 30 * 24 * 3600 * 1000,
    ).toISOString();

    const row = db
      .prepare(
        `SELECT
           COUNT(*) AS total_calls,
           COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
           COALESCE(SUM(prompt_tokens), 0) AS total_prompt_tokens,
           COALESCE(SUM(completion_tokens), 0) AS total_completion_tokens,
           COALESCE(AVG(latency_ms), 0) AS avg_latency_ms,
           SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
         FROM generation_logs
         WHERE timestamp >= ?`,
      )
      .get(since) as {
      total_calls: number;
      total_cost_usd: number;
      total_prompt_tokens: number;
      total_completion_tokens: number;
      avg_latency_ms: number;
      errors: number;
    };

    res.status(200).json({
      windowDays: 30,
      since,
      totalCalls: row.total_calls,
      totalCostUsd: Number(row.total_cost_usd.toFixed(4)),
      totalPromptTokens: row.total_prompt_tokens,
      totalCompletionTokens: row.total_completion_tokens,
      avgLatencyMs: Math.round(row.avg_latency_ms),
      errors: row.errors,
    });
  },
);
