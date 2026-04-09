/**
 * /admin/api/settings — paramètres modifiables (Phase 5).
 *
 * Endpoints (tous protégés via le router parent par authJwt + requireAdmin) :
 *
 *  Whitelist WhatsApp (table `whitelist_whatsapp`) :
 *  - GET    /whitelist                  → liste
 *  - POST   /whitelist                  → ajout
 *  - DELETE /whitelist/:phoneE164       → retrait (hard delete pour V1)
 *
 *  Signature PNG (upload — stockage volume persistant) :
 *  - GET    /signature                  → status + URL publique
 *  - POST   /signature                  → upload multipart (500 KB max)
 *  - DELETE /signature                  → supprime le fichier
 *
 *  Paramètres (table `admin_settings`) :
 *  - GET    /entities                   → entités actives
 *  - PATCH  /entities                   → update
 *  - GET    /cost-alert                 → seuil mensuel €
 *  - PATCH  /cost-alert                 → update seuil
 *
 * Upload signature : on utilise l'approche native Express sans `multer`.
 * Le body est lu en raw Buffer via `express.raw()` sur une route dédiée avec
 * Content-Type=image/png. Validation : PNG valide (magic bytes), taille < 500 KB.
 * Stockage : `data/signature.png` (même dossier que la DB = volume persistant
 * Replit).
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  raw as expressRaw,
} from 'express';
import { z } from 'zod';

import { getDb } from '../../db/connection';
import { AppError } from '../../middleware/errorHandler';
import { getEnv } from '../../utils/env';
import { getLogger } from '../../utils/logger';

export const settingsRouter = Router();

// ============================================================
// Whitelist WhatsApp
// ============================================================

interface WhitelistRow {
  id: string;
  phone_e164: string;
  contact_id: string | null;
  display_name: string;
  entites_visibles: string;
  is_admin: number;
  rgpd_information_sent_at: string | null;
  mandat_signed_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

function serializeWhitelist(row: WhitelistRow): Record<string, unknown> {
  let entites: string[] = [];
  try {
    const parsed = JSON.parse(row.entites_visibles);
    if (Array.isArray(parsed)) {
      entites = parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    entites = [];
  }
  return {
    id: row.id,
    phoneE164: row.phone_e164,
    contactId: row.contact_id,
    displayName: row.display_name,
    entitesVisibles: entites,
    isAdmin: row.is_admin === 1,
    rgpdInformationSentAt: row.rgpd_information_sent_at,
    mandatSignedAt: row.mandat_signed_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  };
}

settingsRouter.get(
  '/whitelist',
  (_req: Request, res: Response): void => {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM whitelist_whatsapp ORDER BY created_at DESC')
      .all() as WhitelistRow[];
    res.status(200).json({ items: rows.map(serializeWhitelist) });
  },
);

const WhitelistCreateSchema = z.object({
  phoneE164: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'phoneE164 doit être au format E.164 (+33...)'),
  displayName: z.string().min(1).max(100),
  entitesVisibles: z
    .array(z.enum(['IC', 'GO', 'VI', 'VV']))
    .min(1, 'au moins une entité requise'),
  isAdmin: z.boolean().optional().default(false),
  contactId: z.string().uuid().optional().nullable(),
});

settingsRouter.post(
  '/whitelist',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = WhitelistCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    const data = parsed.data;
    const db = getDb();

    // Rejeter si le numéro existe déjà et est non révoqué
    const existing = db
      .prepare(
        'SELECT id, revoked_at FROM whitelist_whatsapp WHERE phone_e164 = ?',
      )
      .get(data.phoneE164) as { id: string; revoked_at: string | null } | undefined;

    if (existing !== undefined && existing.revoked_at === null) {
      next(
        new AppError(
          409,
          'WHITELIST_DUPLICATE',
          `Numéro ${data.phoneE164} déjà présent dans la whitelist`,
        ),
      );
      return;
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO whitelist_whatsapp
        (id, phone_e164, contact_id, display_name, entites_visibles,
         is_admin, rgpd_information_sent_at, mandat_signed_at,
         created_at, revoked_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL)
       ON CONFLICT(phone_e164) DO UPDATE SET
         display_name = excluded.display_name,
         entites_visibles = excluded.entites_visibles,
         is_admin = excluded.is_admin,
         revoked_at = NULL`,
    ).run(
      id,
      data.phoneE164,
      data.contactId ?? null,
      data.displayName,
      JSON.stringify(data.entitesVisibles),
      data.isAdmin ? 1 : 0,
      now,
    );

    const row = db
      .prepare('SELECT * FROM whitelist_whatsapp WHERE phone_e164 = ?')
      .get(data.phoneE164) as WhitelistRow | undefined;

    if (row === undefined) {
      next(new AppError(500, 'INSERT_FAILED', 'Échec relecture après insert'));
      return;
    }

    getLogger().info(
      { phoneE164: data.phoneE164 },
      '[admin/settings] whitelist add',
    );
    res.status(201).json(serializeWhitelist(row));
  },
);

settingsRouter.delete(
  '/whitelist/:phoneE164',
  (req: Request, res: Response, next: NextFunction): void => {
    const phone = req.params.phoneE164;
    if (typeof phone !== 'string' || !/^\+[1-9]\d{7,14}$/.test(phone)) {
      next(new AppError(400, 'INVALID_PHONE', 'phoneE164 invalide'));
      return;
    }
    const db = getDb();
    const row = db
      .prepare('SELECT id FROM whitelist_whatsapp WHERE phone_e164 = ?')
      .get(phone) as { id: string } | undefined;
    if (row === undefined) {
      next(
        new AppError(
          404,
          'WHITELIST_NOT_FOUND',
          `Numéro ${phone} introuvable`,
        ),
      );
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      'UPDATE whitelist_whatsapp SET revoked_at = ? WHERE phone_e164 = ?',
    ).run(now, phone);

    getLogger().info(
      { phoneE164: phone },
      '[admin/settings] whitelist revoke',
    );
    res.status(200).json({ phoneE164: phone, revokedAt: now });
  },
);

// ============================================================
// Signature PNG
// ============================================================

const SIGNATURE_MAX_BYTES = 500 * 1024; // 500 KB
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function getSignaturePath(): string {
  const env = getEnv();
  const dbDir = path.dirname(path.resolve(env.DB_PATH));
  return path.join(dbDir, 'signature.png');
}

settingsRouter.get(
  '/signature',
  (_req: Request, res: Response): void => {
    const signaturePath = getSignaturePath();
    if (!fs.existsSync(signaturePath)) {
      res.status(404).json({
        exists: false,
        url: null,
      });
      return;
    }
    const stat = fs.statSync(signaturePath);
    res.status(200).json({
      exists: true,
      url: '/admin/static/signature.png',
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  },
);

// POST /signature — upload raw binary (Content-Type: image/png)
// On utilise express.raw() comme middleware local à cette route uniquement,
// pour ne pas interférer avec le parsing JSON global.
settingsRouter.post(
  '/signature',
  expressRaw({
    type: 'image/png',
    limit: SIGNATURE_MAX_BYTES + 1024,
  }),
  (req: Request, res: Response, next: NextFunction): void => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      next(
        new AppError(
          400,
          'INVALID_UPLOAD',
          'Body vide — envoyer un PNG en Content-Type: image/png',
        ),
      );
      return;
    }
    if (body.length > SIGNATURE_MAX_BYTES) {
      next(
        new AppError(
          413,
          'PAYLOAD_TOO_LARGE',
          `Fichier trop volumineux (max ${SIGNATURE_MAX_BYTES} octets)`,
        ),
      );
      return;
    }
    // Vérification magic bytes PNG
    if (
      body.length < PNG_MAGIC.length ||
      !body.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
    ) {
      next(
        new AppError(
          400,
          'INVALID_PNG',
          'Fichier invalide — ce n\'est pas un PNG',
        ),
      );
      return;
    }

    const signaturePath = getSignaturePath();
    const dir = path.dirname(signaturePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(signaturePath, body);

    getLogger().info(
      { sizeBytes: body.length },
      '[admin/settings] signature uploaded',
    );

    res.status(200).json({
      exists: true,
      url: '/admin/static/signature.png',
      sizeBytes: body.length,
    });
  },
);

settingsRouter.delete(
  '/signature',
  (_req: Request, res: Response, next: NextFunction): void => {
    const signaturePath = getSignaturePath();
    if (!fs.existsSync(signaturePath)) {
      next(
        new AppError(
          404,
          'SIGNATURE_NOT_FOUND',
          'Aucune signature à supprimer',
        ),
      );
      return;
    }
    fs.unlinkSync(signaturePath);
    getLogger().info('[admin/settings] signature deleted');
    res.status(200).json({ success: true });
  },
);

// ============================================================
// Paramètres KV (admin_settings)
// ============================================================

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

function getSetting(key: string): SettingRow | undefined {
  return getDb()
    .prepare('SELECT * FROM admin_settings WHERE key = ?')
    .get(key) as SettingRow | undefined;
}

function setSetting(key: string, value: string): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO admin_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`,
    )
    .run(key, value, now);
}

// --- Entities ---

settingsRouter.get('/entities', (_req: Request, res: Response): void => {
  const row = getSetting('entities_active');
  let entities: string[] = ['IC', 'GO', 'VI', 'VV'];
  if (row !== undefined) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) {
        entities = parsed.filter((v): v is string => typeof v === 'string');
      }
    } catch {
      // fallback sur défaut
    }
  }
  res.status(200).json({ entities });
});

const EntitiesPatchSchema = z.object({
  entities: z.array(z.enum(['IC', 'GO', 'VI', 'VV'])).min(1),
});

settingsRouter.patch(
  '/entities',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = EntitiesPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    setSetting('entities_active', JSON.stringify(parsed.data.entities));
    getLogger().info(
      { entities: parsed.data.entities },
      '[admin/settings] entities patched',
    );
    res.status(200).json({ entities: parsed.data.entities });
  },
);

// --- Cost alert ---

settingsRouter.get('/cost-alert', (_req: Request, res: Response): void => {
  const row = getSetting('cost_alert_monthly_eur');
  const threshold = row !== undefined ? Number.parseFloat(row.value) : 10;
  res.status(200).json({
    thresholdMonthlyEur: Number.isFinite(threshold) ? threshold : 10,
    updatedAt: row?.updated_at ?? null,
  });
});

const CostAlertPatchSchema = z.object({
  thresholdMonthlyEur: z.number().positive().max(10000),
});

settingsRouter.patch(
  '/cost-alert',
  (req: Request, res: Response, next: NextFunction): void => {
    const parsed = CostAlertPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    setSetting(
      'cost_alert_monthly_eur',
      String(parsed.data.thresholdMonthlyEur),
    );
    getLogger().info(
      { thresholdMonthlyEur: parsed.data.thresholdMonthlyEur },
      '[admin/settings] cost alert patched',
    );
    res.status(200).json({
      thresholdMonthlyEur: parsed.data.thresholdMonthlyEur,
    });
  },
);
