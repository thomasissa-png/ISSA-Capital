/**
 * Whitelist guard Telegram — contrôle qu'un chat_id entrant est autorisé.
 *
 * Même logique que whitelistGuard.ts mais adaptée au connecteur Telegram :
 *  - L'identifiant est un `telegram_chat_id` (INTEGER) au lieu de `phone_e164`.
 *  - La colonne `telegram_chat_id` a été ajoutée à `whitelist_whatsapp` par
 *    la migration 006_telegram.sql.
 *  - Les deux connecteurs (WhatsApp par phone, Telegram par chat_id) cohabitent
 *    dans la même table — un contact peut avoir les deux identifiants.
 *
 * Règles :
 *  1. Le chat_id reçu dans l'Update Telegram est un number.
 *  2. On cherche dans `whitelist_whatsapp` une ligne avec `telegram_chat_id = ?`
 *     ET `revoked_at IS NULL`.
 *  3. Si non trouvé, on insère un `access_log` (action = `telegram_blocked`)
 *     et on retourne null. Le caller répond 200 OK à Telegram (silent block).
 *
 * Sources :
 *  - Migration 006_telegram.sql
 *  - middleware/whitelistGuard.ts (pattern existant WhatsApp)
 */

import { getDb } from '../db/connection';
import { getLogger } from '../utils/logger';

// ============================================================
// Types
// ============================================================

interface WhitelistRow {
  id: string;
  phone_e164: string;
  display_name: string;
  entites_visibles: string;
  is_admin: number;
  telegram_chat_id: number | null;
}

export interface TelegramWhitelistedContact {
  id: string;
  /** Peut être vide si le contact n'a pas de phone_e164 (Telegram-only). */
  phoneE164: string;
  displayName: string;
  entitesVisibles: string[];
  isAdmin: boolean;
  telegramChatId: number;
}

// ============================================================
// Helpers
// ============================================================

function parseEntites(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Log un refus d'accès dans `access_logs` pour audit RGPD / sécurité.
 */
function logBlocked(chatId: number, reason: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO access_logs
       (actor_phone, actor_display_name, resource_type, resource_id,
        action, entite, result, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `telegram:${chatId}`,
    null,
    'telegram_webhook',
    'incoming_message',
    'telegram_blocked',
    null,
    reason,
    new Date().toISOString(),
  );
}

// ============================================================
// API publique
// ============================================================

/**
 * Vérifie qu'un chat_id Telegram entrant est whitelisté.
 *
 * @returns Le contact whitelisté si autorisé, `null` si refusé (dans ce cas
 *   un `access_logs` est inséré et le caller doit répondre 200 silencieux).
 */
export function checkTelegramWhitelist(chatId: number): TelegramWhitelistedContact | null {
  const log = getLogger();

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, phone_e164, display_name, entites_visibles, is_admin, telegram_chat_id
       FROM whitelist_whatsapp
       WHERE telegram_chat_id = ? AND revoked_at IS NULL`,
    )
    .get(chatId) as WhitelistRow | undefined;

  if (row === undefined) {
    log.warn(
      { chatId },
      '[telegram-whitelist] message refusé — chat_id non autorisé',
    );
    logBlocked(chatId, 'denied_not_whitelisted');
    return null;
  }

  return {
    id: row.id,
    phoneE164: row.phone_e164,
    displayName: row.display_name,
    entitesVisibles: parseEntites(row.entites_visibles),
    isAdmin: row.is_admin === 1,
    telegramChatId: chatId,
  };
}
