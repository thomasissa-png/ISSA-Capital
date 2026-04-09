/**
 * Service TOTP (Phase 6 — 2FA admin).
 *
 * Responsabilités :
 *   - Générer un secret TOTP base32 + otpauth URL + QR code (data URL)
 *   - Activer la 2FA après vérification du premier code
 *   - Vérifier un code TOTP (window ±1 step = 60s)
 *   - Générer / vérifier / régénérer les backup codes (10 codes usage unique)
 *   - Désactiver la 2FA
 *
 * Librairies :
 *   - `speakeasy` : RFC 6238 (TOTP HOTP), support base32, window configurable
 *   - `qrcode` : génération QR code en PNG data URL (pour inline dans la UI)
 *   - `bcryptjs` : hash des backup codes (déjà installé pour l'auth admin)
 *
 * Sécurité :
 *   - Secret TOTP stocké en clair en DB (migration 004). La DB sera chiffrée
 *     at-rest via SQLCipher en Phase 6b (voir db/encryption.ts).
 *   - Backup codes hashés bcrypt, consommés une seule fois (retirés de
 *     l'array JSON après vérification).
 *   - Window ±1 step = accepte 30s avant/après l'instant serveur pour
 *     tolérer la dérive d'horloge (valeur standard RFC 6238 §5.2).
 *
 * Sources :
 *   - docs/ia/secretariat-implementation-plan.md Phase 6 (2FA TOTP)
 *   - https://datatracker.ietf.org/doc/html/rfc6238
 */

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import qrcode from 'qrcode';
import speakeasy from 'speakeasy';

import { getDb } from '../db/connection';
import { getLogger } from '../utils/logger';

// ============================================================
// Constantes
// ============================================================

const TOTP_ISSUER = 'ISSA Capital';
const BACKUP_CODES_COUNT = 10;
const BCRYPT_ROUNDS = 10;
/** Tolérance d'horloge : ±1 step de 30s. */
const TOTP_WINDOW = 1;

// ============================================================
// Types
// ============================================================

interface TwoFactorRow {
  id: string;
  secret: string;
  enabled: number;
  verified_at: string | null;
  backup_codes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  pending: boolean;
  verifiedAt: string | null;
  backupCodesRemaining: number;
}

export interface GeneratedSecret {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

export interface EnableResult {
  backupCodes: string[];
}

// ============================================================
// Helpers DB
// ============================================================

function getRow(userId: string): TwoFactorRow | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM admin_2fa_secrets WHERE id = ?`)
    .get(userId) as TwoFactorRow | undefined;
  return row ?? null;
}

function parseBackupCodes(raw: string | null): string[] {
  if (raw === null || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

// ============================================================
// Génération de secret
// ============================================================

/**
 * Génère un secret TOTP + otpauth URL + QR code.
 * Stocke en DB avec enabled=0 (en attente de validation).
 * Si une ligne existe déjà pour ce userId → elle est écrasée (nouveau secret).
 */
export async function generateSecret(userId: string): Promise<GeneratedSecret> {
  const secret = speakeasy.generateSecret({
    name: `${TOTP_ISSUER}:${userId}`,
    issuer: TOTP_ISSUER,
    length: 20,
  });

  if (
    secret.base32 === undefined ||
    secret.otpauth_url === undefined ||
    secret.otpauth_url === ''
  ) {
    throw new Error('[totp] génération du secret a échoué (speakeasy)');
  }

  const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 1,
    width: 256,
  });

  const db = getDb();
  const now = new Date().toISOString();

  // UPSERT : si une ligne existe pour ce userId (ex: régénération), on
  // écrase le secret et on repasse en enabled=0.
  db.prepare(
    `INSERT INTO admin_2fa_secrets
       (id, secret, enabled, verified_at, backup_codes, created_at, updated_at)
     VALUES (?, ?, 0, NULL, NULL, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       secret = excluded.secret,
       enabled = 0,
       verified_at = NULL,
       backup_codes = NULL,
       updated_at = excluded.updated_at`,
  ).run(userId, secret.base32, now, now);

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrDataUrl,
  };
}

// ============================================================
// Activation (enable) après vérification du premier code
// ============================================================

/**
 * Active la 2FA : vérifie que le code fourni correspond au secret en DB,
 * puis passe enabled=1 et génère 10 backup codes.
 *
 * @returns Les 10 backup codes en CLAIR — à afficher UNE SEULE FOIS à l'admin.
 */
export async function enable(
  userId: string,
  code: string,
): Promise<EnableResult> {
  const row = getRow(userId);
  if (row === null) {
    throw new Error('[totp] aucun secret en attente — appeler generateSecret d\'abord');
  }
  if (row.enabled === 1) {
    throw new Error('[totp] 2FA déjà activée');
  }

  const ok = speakeasy.totp.verify({
    secret: row.secret,
    encoding: 'base32',
    token: code,
    window: TOTP_WINDOW,
  });

  if (!ok) {
    throw new Error('[totp] code invalide');
  }

  // Génère les backup codes en clair + leurs hashes
  const clearCodes = generateBackupCodesClear();
  const hashedCodes = await Promise.all(
    clearCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)),
  );

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE admin_2fa_secrets
     SET enabled = 1,
         verified_at = ?,
         backup_codes = ?,
         updated_at = ?
     WHERE id = ?`,
  ).run(now, JSON.stringify(hashedCodes), now, userId);

  getLogger().info({ userId }, '[totp] 2FA activée');

  return { backupCodes: clearCodes };
}

// ============================================================
// Vérification d'un code TOTP (runtime login)
// ============================================================

/**
 * Vérifie un code TOTP pour un user. Retourne `true` si valide, `false` sinon.
 * Ne log pas le code (sensible).
 */
export function verify(userId: string, code: string): boolean {
  const row = getRow(userId);
  if (row === null || row.enabled !== 1) {
    return false;
  }

  return speakeasy.totp.verify({
    secret: row.secret,
    encoding: 'base32',
    token: code,
    window: TOTP_WINDOW,
  });
}

// ============================================================
// Vérification d'un backup code (usage unique)
// ============================================================

/**
 * Vérifie un backup code et le marque comme consommé (retiré de l'array).
 * Retourne `true` si valide et consommé, `false` sinon.
 */
export async function verifyBackupCode(
  userId: string,
  code: string,
): Promise<boolean> {
  const row = getRow(userId);
  if (row === null || row.enabled !== 1) {
    return false;
  }

  const hashedCodes = parseBackupCodes(row.backup_codes);
  if (hashedCodes.length === 0) {
    return false;
  }

  // On itère sur les hashes pour trouver le match (usage unique).
  // Comparaison bcrypt → constant-time par hash.
  let matchIndex = -1;
  for (let i = 0; i < hashedCodes.length; i++) {
    const candidate = hashedCodes[i];
    if (typeof candidate !== 'string') continue;
    // eslint-disable-next-line no-await-in-loop
    const ok = await bcrypt.compare(code, candidate);
    if (ok) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    return false;
  }

  // Retire le code consommé et persiste
  hashedCodes.splice(matchIndex, 1);
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE admin_2fa_secrets
     SET backup_codes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(JSON.stringify(hashedCodes), now, userId);

  getLogger().info(
    { userId, remaining: hashedCodes.length },
    '[totp] backup code consommé',
  );

  return true;
}

// ============================================================
// Désactivation
// ============================================================

/**
 * Désactive la 2FA après vérification du code TOTP actuel.
 * Supprime le secret et les backup codes.
 */
export function disable(userId: string, currentCode: string): void {
  const row = getRow(userId);
  if (row === null || row.enabled !== 1) {
    throw new Error('[totp] 2FA non activée');
  }

  const ok = speakeasy.totp.verify({
    secret: row.secret,
    encoding: 'base32',
    token: currentCode,
    window: TOTP_WINDOW,
  });

  if (!ok) {
    throw new Error('[totp] code invalide');
  }

  const db = getDb();
  db.prepare(`DELETE FROM admin_2fa_secrets WHERE id = ?`).run(userId);
  getLogger().info({ userId }, '[totp] 2FA désactivée');
}

// ============================================================
// Régénération des backup codes
// ============================================================

/**
 * Régénère les 10 backup codes après vérification du code TOTP actuel.
 * Retourne les nouveaux codes en clair (affichés UNE SEULE FOIS).
 */
export async function regenerateBackupCodes(
  userId: string,
  currentCode: string,
): Promise<EnableResult> {
  const row = getRow(userId);
  if (row === null || row.enabled !== 1) {
    throw new Error('[totp] 2FA non activée');
  }

  const ok = speakeasy.totp.verify({
    secret: row.secret,
    encoding: 'base32',
    token: currentCode,
    window: TOTP_WINDOW,
  });

  if (!ok) {
    throw new Error('[totp] code invalide');
  }

  const clearCodes = generateBackupCodesClear();
  const hashedCodes = await Promise.all(
    clearCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)),
  );

  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE admin_2fa_secrets
     SET backup_codes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(JSON.stringify(hashedCodes), now, userId);

  return { backupCodes: clearCodes };
}

// ============================================================
// Statut
// ============================================================

/** Quick check : le user a-t-il la 2FA activée (enabled=1) ? */
export function isEnabled(userId: string): boolean {
  const row = getRow(userId);
  return row !== null && row.enabled === 1;
}

/** Retourne un snapshot complet de l'état 2FA du user. */
export function getStatus(userId: string): TwoFactorStatus {
  const row = getRow(userId);
  if (row === null) {
    return {
      enabled: false,
      pending: false,
      verifiedAt: null,
      backupCodesRemaining: 0,
    };
  }

  const hashedCodes = parseBackupCodes(row.backup_codes);

  return {
    enabled: row.enabled === 1,
    pending: row.enabled === 0,
    verifiedAt: row.verified_at,
    backupCodesRemaining: hashedCodes.length,
  };
}

// ============================================================
// Helpers
// ============================================================

/**
 * Génère 10 codes hexa aléatoires de 8 chiffres.
 * Usage : backup codes affichés UNE FOIS à l'admin après activation.
 */
function generateBackupCodesClear(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    // 4 bytes = 8 hex digits
    const hex = randomBytes(4).toString('hex').toUpperCase();
    codes.push(hex);
  }
  return codes;
}
