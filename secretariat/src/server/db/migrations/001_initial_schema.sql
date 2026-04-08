-- Migration 001 — Schéma initial Phase 1
-- Appliquée par src/server/db/migrations/runner.ts
-- Source : docs/ia/secretariat-architecture.md Section 2

-- ============================================================
-- 1. contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id                    TEXT PRIMARY KEY,
  prenom                TEXT NOT NULL,
  nom                   TEXT NOT NULL,
  titre                 TEXT,
  societe               TEXT,
  email                 TEXT,
  telephone             TEXT,
  whatsapp_authorized   INTEGER NOT NULL DEFAULT 0,
  entites_visibles      TEXT,
  notes                 TEXT,
  source                TEXT NOT NULL,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_nom ON contacts(nom);
CREATE INDEX IF NOT EXISTS idx_contacts_societe ON contacts(societe);

-- ============================================================
-- 2. cr_drafts
-- ============================================================
CREATE TABLE IF NOT EXISTS cr_drafts (
  id                     TEXT PRIMARY KEY,
  user_phone             TEXT NOT NULL,
  conversation_id        TEXT NOT NULL,
  raw_input              TEXT NOT NULL,
  enriched_input         TEXT,
  status                 TEXT NOT NULL,
  clarification_history  TEXT,
  cr_json                TEXT,
  cr_markdown            TEXT,
  type_reunion           TEXT,
  entite                 TEXT,
  date_reunion           TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  published_at           TEXT
);
CREATE INDEX IF NOT EXISTS idx_drafts_user_status ON cr_drafts(user_phone, status);
CREATE INDEX IF NOT EXISTS idx_drafts_conversation ON cr_drafts(conversation_id);

-- ============================================================
-- 3. cr_published
-- ============================================================
CREATE TABLE IF NOT EXISTS cr_published (
  reference           TEXT PRIMARY KEY,
  draft_id            TEXT NOT NULL,
  entite              TEXT NOT NULL,
  type_reunion        TEXT NOT NULL,
  date_reunion        TEXT NOT NULL,
  date_etablissement  TEXT NOT NULL,
  markdown            TEXT NOT NULL,
  markdown_sha256     TEXT NOT NULL,
  craft_document_id   TEXT NOT NULL,
  craft_url           TEXT NOT NULL,
  craft_filename      TEXT NOT NULL,
  rfc3161_token       TEXT,
  rfc3161_provider    TEXT,
  published_by        TEXT NOT NULL,
  FOREIGN KEY (draft_id) REFERENCES cr_drafts(id)
);
CREATE INDEX IF NOT EXISTS idx_published_entite_date
  ON cr_published(entite, date_etablissement DESC);

-- ============================================================
-- 4. whitelist_whatsapp
-- ============================================================
CREATE TABLE IF NOT EXISTS whitelist_whatsapp (
  id                          TEXT PRIMARY KEY,
  phone_e164                  TEXT UNIQUE NOT NULL,
  contact_id                  TEXT,
  display_name                TEXT NOT NULL,
  entites_visibles            TEXT NOT NULL,
  is_admin                    INTEGER NOT NULL DEFAULT 0,
  rgpd_information_sent_at    TEXT,
  mandat_signed_at            TEXT,
  created_at                  TEXT NOT NULL,
  revoked_at                  TEXT,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

-- ============================================================
-- 5. whatsapp_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  conversation_id   TEXT PRIMARY KEY,
  user_phone        TEXT NOT NULL,
  active_draft_id   TEXT,
  state             TEXT NOT NULL,
  last_message_at   TEXT NOT NULL,
  expires_at        TEXT NOT NULL,
  FOREIGN KEY (active_draft_id) REFERENCES cr_drafts(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_phone
  ON whatsapp_sessions(user_phone);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON whatsapp_sessions(expires_at);

-- ============================================================
-- 6. access_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS access_logs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_phone         TEXT NOT NULL,
  actor_display_name  TEXT,
  resource_type       TEXT NOT NULL,
  resource_id         TEXT NOT NULL,
  action              TEXT NOT NULL,
  entite              TEXT,
  result              TEXT NOT NULL,
  timestamp           TEXT NOT NULL,
  ip_address          TEXT,
  user_agent          TEXT
);
CREATE INDEX IF NOT EXISTS idx_access_logs_actor_ts
  ON access_logs(actor_phone, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_resource
  ON access_logs(resource_type, resource_id);

-- ============================================================
-- 7. generation_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS generation_logs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id           TEXT NOT NULL,
  user_phone         TEXT NOT NULL,
  claude_model       TEXT NOT NULL,
  prompt_tokens      INTEGER,
  completion_tokens  INTEGER,
  cost_usd           REAL,
  latency_ms         INTEGER,
  status             TEXT NOT NULL,
  error_message      TEXT,
  timestamp          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_generation_logs_draft
  ON generation_logs(draft_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_timestamp
  ON generation_logs(timestamp DESC);

-- ============================================================
-- Versioning
-- ============================================================
INSERT INTO schema_version (version, applied_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
