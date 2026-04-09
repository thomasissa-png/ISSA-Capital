/**
 * Tests unitaires — conversation-state (Phase 2).
 *
 * Utilise une vraie DB SQLite temporaire pour exercer la logique CRUD
 * (les queries sont simples, un mock ajouterait plus de bruit que de valeur).
 *
 * Couverture :
 *  - createSession insère et retourne la session
 *  - getActiveSession retourne la session active < TTL
 *  - getActiveSession retourne null pour session expirée
 *  - appendMessage met à jour last_message_at + expires_at
 *  - finalizeSession lie un draft_id et passe en awaiting_publish_confirm
 *  - updateSessionState change l'état
 *  - cleanupExpiredSessions supprime les sessions > TTL
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const SNAPSHOT = { ...process.env };

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake-for-tests',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake_test_key',
  SESSION_TTL_HOURS: '24',
};

describe('conversation-state', () => {
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = path.join(
      os.tmpdir(),
      `issa-sec-session-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);
    process.env.DB_PATH = tempDbPath;

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    const { resetDbForTests, initDatabase } = await import('../../db/connection');

    resetEnvForTests();
    resetLoggerForTests();
    resetDbForTests();
    initDatabase();
  });

  afterEach(async () => {
    const { resetDbForTests } = await import('../../db/connection');
    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');

    resetDbForTests();
    resetEnvForTests();
    resetLoggerForTests();

    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      try {
        fs.unlinkSync(tempDbPath + suffix);
      } catch {
        // ignoré
      }
    }

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);
  });

  // ----------------------------------------------------------
  // createSession + getActiveSession
  // ----------------------------------------------------------

  describe('createSession', () => {
    it('insère une nouvelle session et la retourne', async () => {
      const { createSession } = await import('../conversation-state');

      const session = createSession('+33612345678');

      expect(session.conversationId).toBeDefined();
      expect(session.userPhone).toBe('+33612345678');
      expect(session.activeDraftId).toBeNull();
      expect(session.state).toBe('drafting');
      expect(session.lastMessageAt).toBeDefined();
      expect(session.expiresAt).toBeDefined();
    });

    it('persiste la session en DB', async () => {
      const { createSession } = await import('../conversation-state');
      const { getDb } = await import('../../db/connection');

      const session = createSession('+33611111111');

      const row = getDb()
        .prepare('SELECT * FROM whatsapp_sessions WHERE conversation_id = ?')
        .get(session.conversationId) as { user_phone: string; state: string };

      expect(row.user_phone).toBe('+33611111111');
      expect(row.state).toBe('drafting');
    });
  });

  describe('getActiveSession', () => {
    it('retourne null pour un numéro sans session', async () => {
      const { getActiveSession } = await import('../conversation-state');
      expect(getActiveSession('+33600000000')).toBeNull();
    });

    it('retourne la session active d\'un numéro', async () => {
      const { createSession, getActiveSession } = await import('../conversation-state');

      const created = createSession('+33612345678');
      const found = getActiveSession('+33612345678');

      expect(found).not.toBeNull();
      expect(found?.conversationId).toBe(created.conversationId);
    });

    it('retourne null pour une session expirée', async () => {
      const { getActiveSession } = await import('../conversation-state');
      const { getDb } = await import('../../db/connection');

      // Insert direct avec expires_at déjà passé
      const past = new Date(Date.now() - 3_600_000).toISOString();
      getDb()
        .prepare(
          `INSERT INTO whatsapp_sessions
             (conversation_id, user_phone, active_draft_id, state, last_message_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('conv-expired', '+33633333333', null, 'drafting', past, past);

      const found = getActiveSession('+33633333333');
      expect(found).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // appendMessage
  // ----------------------------------------------------------

  describe('appendMessage', () => {
    it('met à jour last_message_at et expires_at', async () => {
      const { createSession, appendMessage } = await import('../conversation-state');
      const { getDb } = await import('../../db/connection');

      const session = createSession('+33612345678');
      const initialExpiresAt = session.expiresAt;

      // Attendre un peu puis append
      await new Promise((r) => setTimeout(r, 10));
      const laterDate = new Date(Date.now() + 60_000);
      appendMessage(session.conversationId, 'Nouveau message', laterDate);

      const row = getDb()
        .prepare(
          'SELECT last_message_at, expires_at FROM whatsapp_sessions WHERE conversation_id = ?',
        )
        .get(session.conversationId) as {
        last_message_at: string;
        expires_at: string;
      };

      expect(row.last_message_at).toBe(laterDate.toISOString());
      expect(row.expires_at > initialExpiresAt).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // finalizeSession
  // ----------------------------------------------------------

  describe('finalizeSession', () => {
    it('lie un draft_id et passe en awaiting_publish_confirm', async () => {
      const { createSession, finalizeSession } = await import('../conversation-state');
      const { getDb } = await import('../../db/connection');

      const session = createSession('+33612345678');

      // Insert un cr_drafts réel pour respecter la FK whatsapp_sessions.active_draft_id
      const draftId = 'draft-abc-123';
      const nowIso = new Date().toISOString();
      getDb()
        .prepare(
          `INSERT INTO cr_drafts
             (id, user_phone, conversation_id, raw_input, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          draftId,
          '+33612345678',
          session.conversationId,
          'Contenu test',
          'drafting',
          nowIso,
          nowIso,
        );

      finalizeSession(session.conversationId, draftId);

      const row = getDb()
        .prepare(
          'SELECT active_draft_id, state FROM whatsapp_sessions WHERE conversation_id = ?',
        )
        .get(session.conversationId) as { active_draft_id: string; state: string };

      expect(row.active_draft_id).toBe(draftId);
      expect(row.state).toBe('awaiting_publish_confirm');
    });
  });

  // ----------------------------------------------------------
  // updateSessionState
  // ----------------------------------------------------------

  describe('updateSessionState', () => {
    it('met à jour uniquement le champ state', async () => {
      const { createSession, updateSessionState } = await import('../conversation-state');
      const { getDb } = await import('../../db/connection');

      const session = createSession('+33612345678');
      updateSessionState(session.conversationId, 'clarifying');

      const row = getDb()
        .prepare('SELECT state FROM whatsapp_sessions WHERE conversation_id = ?')
        .get(session.conversationId) as { state: string };

      expect(row.state).toBe('clarifying');
    });
  });

  // ----------------------------------------------------------
  // cleanupExpiredSessions
  // ----------------------------------------------------------

  describe('cleanupExpiredSessions', () => {
    it('supprime les sessions dont expires_at est dépassé', async () => {
      const { createSession, cleanupExpiredSessions } = await import(
        '../conversation-state'
      );
      const { getDb } = await import('../../db/connection');

      // 1 session active
      createSession('+33611111111');

      // 2 sessions expirées
      const past = new Date(Date.now() - 3_600_000).toISOString();
      const db = getDb();
      db.prepare(
        `INSERT INTO whatsapp_sessions
           (conversation_id, user_phone, active_draft_id, state, last_message_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('expired-1', '+33622222222', null, 'drafting', past, past);
      db.prepare(
        `INSERT INTO whatsapp_sessions
           (conversation_id, user_phone, active_draft_id, state, last_message_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run('expired-2', '+33633333333', null, 'drafting', past, past);

      const deleted = cleanupExpiredSessions();
      expect(deleted).toBe(2);

      const remaining = db
        .prepare('SELECT COUNT(*) as count FROM whatsapp_sessions')
        .get() as { count: number };
      expect(remaining.count).toBe(1);
    });

    it('retourne 0 si aucune session expirée', async () => {
      const { createSession, cleanupExpiredSessions } = await import(
        '../conversation-state'
      );
      createSession('+33611111111');

      const deleted = cleanupExpiredSessions();
      expect(deleted).toBe(0);
    });
  });
});
