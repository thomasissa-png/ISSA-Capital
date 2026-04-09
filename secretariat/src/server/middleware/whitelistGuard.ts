/**
 * Whitelist guard WhatsApp — contrôle qu'un numéro entrant est autorisé.
 *
 * Contrairement à un middleware Express monté sur une route, cette fonction
 * est appelée INLINE dans le handler webhook pour chaque message individuel
 * (un webhook Meta peut contenir plusieurs messages — cf architecture §7.2).
 *
 * Règles :
 *  1. Le numéro reçu côté Meta est `"33612345678"` (sans `+`). On préfixe `+`
 *     pour matcher le format E.164 stocké en DB.
 *  2. Contrainte RGPD : le numéro doit exister dans `whitelist_whatsapp`
 *     AVEC `revoked_at IS NULL`. Le gate RGPD (mandat_signed_at +
 *     rgpd_information_sent_at) est enforcé côté admin web à l'activation
 *     — pas ici (trop tard une fois le message reçu).
 *  3. Si le numéro n'est pas whitelisté, on insère un `access_log`
 *     (action = `whatsapp_blocked`) et on retourne null. Le caller répond
 *     200 OK à Meta (silent block) pour éviter les retries Meta.
 *
 * Sources :
 *  - docs/ia/secretariat-architecture.md Section 2.4 (whitelist_whatsapp).
 *  - docs/ia/secretariat-architecture.md Section 10.1 (whitelist numéros).
 *  - docs/legal/secretariat-agent-legal-audit.md Bloc 5 (base légale).
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
}

export interface WhitelistedContact {
  id: string;
  phoneE164: string;
  displayName: string;
  entitesVisibles: string[];
  isAdmin: boolean;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Normalise un numéro Meta (ex: `33612345678`) en format E.164 (`+33612345678`).
 * Si le numéro commence déjà par `+`, retourne tel quel.
 */
export function toE164(metaFrom: string): string {
  return metaFrom.startsWith('+') ? metaFrom : `+${metaFrom}`;
}

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
function logBlocked(phoneE164: string, reason: string): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO access_logs
       (actor_phone, actor_display_name, resource_type, resource_id,
        action, entite, result, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    phoneE164,
    null,
    'whatsapp_webhook',
    'incoming_message',
    'whatsapp_blocked',
    null,
    reason,
    new Date().toISOString(),
  );
}

// ============================================================
// API publique
// ============================================================

/**
 * Vérifie qu'un numéro entrant est whitelisté.
 *
 * @returns Le contact whitelisté si autorisé, `null` si refusé (dans ce cas
 *   un `access_logs` est inséré et le caller doit répondre 200 silencieux à Meta).
 */
export function checkWhitelist(metaFrom: string): WhitelistedContact | null {
  const log = getLogger();
  const phoneE164 = toE164(metaFrom);

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, phone_e164, display_name, entites_visibles, is_admin
       FROM whitelist_whatsapp
       WHERE phone_e164 = ? AND revoked_at IS NULL`,
    )
    .get(phoneE164) as WhitelistRow | undefined;

  if (row === undefined) {
    log.warn(
      { phoneE164 },
      '[whitelist] message refusé — numéro non autorisé',
    );
    logBlocked(phoneE164, 'denied_not_whitelisted');
    return null;
  }

  return {
    id: row.id,
    phoneE164: row.phone_e164,
    displayName: row.display_name,
    entitesVisibles: parseEntites(row.entites_visibles),
    isAdmin: row.is_admin === 1,
  };
}
