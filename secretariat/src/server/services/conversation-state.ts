/**
 * Gestion des sessions conversationnelles WhatsApp (Phase 2).
 *
 * Responsabilités :
 *  - Chargement / création / mise à jour d'une session par numéro E.164.
 *  - TTL 24h (configurable via env.SESSION_TTL_HOURS) — au-delà, la session
 *    est considérée expirée et une nouvelle est créée sur le prochain message.
 *  - Finalisation (lien vers un draft_id généré par Phase 3).
 *  - Purge des sessions expirées (appelée par un cron ou à l'initialisation).
 *
 * Sources :
 *  - docs/ia/secretariat-architecture.md Section 2.5 (table whatsapp_sessions).
 *  - docs/ia/secretariat-architecture.md Section 3.1 (flow états).
 *
 * Note : la table whatsapp_sessions est déjà créée en Phase 1 (schema.sql §5).
 * Aucune migration nouvelle n'est nécessaire en Phase 2.
 */

import { randomUUID } from 'node:crypto';

import { getDb } from '../db/connection';
import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';
import type { ConversationSession, SessionState } from './whatsapp.types';

// ============================================================
// Types DB
// ============================================================

interface SessionRow {
  conversation_id: string;
  user_phone: string;
  active_draft_id: string | null;
  state: string;
  last_message_at: string;
  expires_at: string;
}

// ============================================================
// Helpers
// ============================================================

function rowToSession(row: SessionRow): ConversationSession {
  return {
    conversationId: row.conversation_id,
    userPhone: row.user_phone,
    activeDraftId: row.active_draft_id,
    state: row.state as SessionState,
    lastMessageAt: row.last_message_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Calcule un horodatage ISO pour `now + ttlHours` heures.
 * Exposé en paramètre pour faciliter les tests déterministes.
 */
function computeExpiresAt(now: Date, ttlHours: number): string {
  const expires = new Date(now.getTime() + ttlHours * 3_600_000);
  return expires.toISOString();
}

/**
 * Une session est considérée expirée si son `expires_at` est dépassé
 * par rapport à l'instant présent. La comparaison est lexicographique
 * (les ISO strings sont ordonnées chronologiquement quand le fuseau est Z).
 */
function isExpired(session: SessionRow, now: Date): boolean {
  return session.expires_at <= now.toISOString();
}

// ============================================================
// API publique
// ============================================================

/**
 * Retourne la session active pour un numéro donné, ou `null` si :
 *  - aucune session n'existe pour ce numéro, OU
 *  - la session la plus récente est expirée (TTL dépassé).
 *
 * En cas de session expirée, cette fonction ne la supprime pas (le nettoyage
 * est délégué à `cleanupExpiredSessions()`), elle retourne simplement null
 * pour que le caller crée une nouvelle session.
 */
export function getActiveSession(phoneE164: string): ConversationSession | null {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT conversation_id, user_phone, active_draft_id, state,
              last_message_at, expires_at
       FROM whatsapp_sessions
       WHERE user_phone = ?
       ORDER BY last_message_at DESC
       LIMIT 1`,
    )
    .get(phoneE164) as SessionRow | undefined;

  if (row === undefined) {
    return null;
  }

  if (isExpired(row, new Date())) {
    return null;
  }

  return rowToSession(row);
}

/**
 * Crée une nouvelle session pour un numéro. La session est initialisée
 * en état `drafting` (le premier message entrant commence toujours un brouillon).
 *
 * Si une session expirée existait déjà pour ce numéro, elle n'est PAS touchée
 * (purge séparée via `cleanupExpiredSessions`) — l'unicité est sur
 * `conversation_id`, pas sur `user_phone`.
 */
export function createSession(phoneE164: string): ConversationSession {
  const db = getDb();
  const env = getEnv();
  const log = getLogger();

  const now = new Date();
  const conversationId = randomUUID();
  const nowIso = now.toISOString();
  const expiresAt = computeExpiresAt(now, env.SESSION_TTL_HOURS);
  const state: SessionState = 'drafting';

  db.prepare(
    `INSERT INTO whatsapp_sessions
       (conversation_id, user_phone, active_draft_id, state, last_message_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(conversationId, phoneE164, null, state, nowIso, expiresAt);

  log.info(
    { conversationId, phoneE164, state, expiresAt },
    '[session] nouvelle session WhatsApp créée',
  );

  return {
    conversationId,
    userPhone: phoneE164,
    activeDraftId: null,
    state,
    lastMessageAt: nowIso,
    expiresAt,
  };
}

/**
 * Met à jour `last_message_at` et prolonge `expires_at` de +TTL à partir de
 * `timestamp`. À appeler à chaque message entrant pour prolonger la session.
 *
 * Cette fonction ne stocke PAS le texte du message lui-même — l'accumulation
 * du contenu se fait au niveau du draft (cr_drafts.raw_input / enriched_input)
 * via la route /api/draft (Phase 3). La session ne tracke que le métadata
 * conversationnel (état + dernière activité).
 *
 * Le paramètre `_messageText` est accepté pour symétrie d'API et traçabilité
 * future, mais n'est PAS persisté ici (documenté).
 *
 * Note importante : `expires_at` est toujours calculé à partir de `Date.now()`,
 * jamais de `timestamp`. Le timestamp peut provenir du client Meta (potentiellement
 * en retard de plusieurs heures sur le serveur), or le TTL doit être ancré sur
 * l'horloge serveur pour garantir qu'une session reste vivante 24h après réception
 * réelle. `last_message_at` reste indexé sur le timestamp message pour la
 * traçabilité chronologique.
 */
export function appendMessage(
  conversationId: string,
  _messageText: string,
  timestamp: Date,
): void {
  const db = getDb();
  const env = getEnv();

  const lastMessageAt = timestamp.toISOString();
  // expires_at toujours basé sur l'horloge serveur (cf. note ci-dessus)
  const expiresAt = computeExpiresAt(new Date(), env.SESSION_TTL_HOURS);

  db.prepare(
    `UPDATE whatsapp_sessions
     SET last_message_at = ?, expires_at = ?
     WHERE conversation_id = ?`,
  ).run(lastMessageAt, expiresAt, conversationId);
}

/**
 * Lie un draft_id à une session et passe son état à `awaiting_publish_confirm`.
 * Appelée après que Phase 3 a généré un brouillon en réponse à la commande
 * "terminer" — la session attend maintenant la confirmation de publication.
 */
export function finalizeSession(conversationId: string, draftId: string): void {
  const db = getDb();
  const log = getLogger();

  const state: SessionState = 'awaiting_publish_confirm';

  db.prepare(
    `UPDATE whatsapp_sessions
     SET active_draft_id = ?, state = ?, last_message_at = ?
     WHERE conversation_id = ?`,
  ).run(draftId, state, new Date().toISOString(), conversationId);

  log.info(
    { conversationId, draftId, state },
    '[session] session liée à un draft',
  );
}

/**
 * Met à jour l'état d'une session (idle/drafting/clarifying/abandoned/…).
 * Utilisé par le dispatcher webhook après parsing de commandes.
 */
export function updateSessionState(
  conversationId: string,
  state: SessionState,
): void {
  const db = getDb();
  db.prepare(
    `UPDATE whatsapp_sessions
     SET state = ?, last_message_at = ?
     WHERE conversation_id = ?`,
  ).run(state, new Date().toISOString(), conversationId);
}

/**
 * Supprime toutes les sessions dont `expires_at` est dépassé.
 * Retourne le nombre de lignes supprimées. À appeler périodiquement
 * (cron) ou au démarrage serveur.
 */
export function cleanupExpiredSessions(): number {
  const db = getDb();
  const log = getLogger();

  const result = db
    .prepare(`DELETE FROM whatsapp_sessions WHERE expires_at <= ?`)
    .run(new Date().toISOString());

  const deleted = Number(result.changes);
  if (deleted > 0) {
    log.info({ deleted }, '[session] sessions expirées purgées');
  }
  return deleted;
}
