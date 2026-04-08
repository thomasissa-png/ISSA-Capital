-- ISSA Capital — Agent Secrétariat
-- Schéma SQLite de référence (7 tables + table de versioning)
--
-- Source de vérité : docs/ia/secretariat-architecture.md Section 2
-- Version : 1 (Phase 1 — squelette fondation)
--
-- Ce fichier est un miroir lisible de la migration 001. Les migrations
-- (src/server/db/migrations/*.sql) restent la source exécutée par le runner.
-- Garder ce fichier aligné sur la dernière version du schéma à des fins de
-- documentation et de code review.

-- ============================================================
-- 0. Table de versioning des migrations
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- ============================================================
-- 1. contacts — database enrichie (seed initial depuis docs/product)
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id                    TEXT PRIMARY KEY,              -- uuid v4
  prenom                TEXT NOT NULL,
  nom                   TEXT NOT NULL,
  titre                 TEXT,                          -- "Président", "Directeur Général"
  societe               TEXT,
  email                 TEXT,
  telephone             TEXT,                          -- format libre (saisie manuelle)
  whatsapp_authorized   INTEGER NOT NULL DEFAULT 0,    -- 0/1
  entites_visibles      TEXT,                          -- JSON array : ["IC","GO","VI","VV"]
  notes                 TEXT,
  source                TEXT NOT NULL,                 -- "import_initial" | "creation_inline_YYYY-MM-DD"
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contacts_nom ON contacts(nom);
CREATE INDEX IF NOT EXISTS idx_contacts_societe ON contacts(societe);

-- ============================================================
-- 2. cr_drafts — brouillons en cours de rédaction
-- ============================================================
CREATE TABLE IF NOT EXISTS cr_drafts (
  id                     TEXT PRIMARY KEY,             -- uuid v4
  user_phone             TEXT NOT NULL,
  conversation_id        TEXT NOT NULL,                -- regroupe tours de clarification
  raw_input              TEXT NOT NULL,
  enriched_input         TEXT,                         -- input + réponses clarifications concaténées
  status                 TEXT NOT NULL,                -- needs_clarification | ready | published | abandoned
  clarification_history  TEXT,                         -- JSON array : [{q,a,ts}]
  cr_json                TEXT,                         -- JSON structuré (cf system prompt Section 4)
  cr_markdown            TEXT,                         -- rendu final prêt à publier
  type_reunion           TEXT,                         -- dejeuner|conseil|appel|interne|visite-immo|signature|diner
  entite                 TEXT,                         -- IC|GO|VI|VV
  date_reunion           TEXT,                         -- ISO date saisie utilisateur
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL,
  published_at           TEXT                          -- NULL tant que pas publié
);
CREATE INDEX IF NOT EXISTS idx_drafts_user_status ON cr_drafts(user_phone, status);
CREATE INDEX IF NOT EXISTS idx_drafts_conversation ON cr_drafts(conversation_id);

-- ============================================================
-- 3. cr_published — CR publiés (immutables, audit DGFiP 10 ans)
-- ============================================================
CREATE TABLE IF NOT EXISTS cr_published (
  reference           TEXT PRIMARY KEY,                -- "IC-CR-2026-0042"
  draft_id            TEXT NOT NULL,                   -- FK vers cr_drafts.id
  entite              TEXT NOT NULL,
  type_reunion        TEXT NOT NULL,
  date_reunion        TEXT NOT NULL,                   -- date saisie Thomas
  date_etablissement  TEXT NOT NULL,                   -- timestamp serveur publication
  markdown            TEXT NOT NULL,                   -- copie du markdown publié (immutable)
  markdown_sha256     TEXT NOT NULL,                   -- hash pour preuve d'intégrité
  craft_document_id   TEXT NOT NULL,
  craft_url           TEXT NOT NULL,
  craft_filename      TEXT NOT NULL,                   -- "2026-04-08-dejeuner-IC-karim-benmoussa.md"
  rfc3161_token       TEXT,                            -- token Universign (NULL si Phase 6 non active)
  rfc3161_provider    TEXT,                            -- "universign"
  published_by        TEXT NOT NULL,                   -- user_phone
  FOREIGN KEY (draft_id) REFERENCES cr_drafts(id)
);
CREATE INDEX IF NOT EXISTS idx_published_entite_date
  ON cr_published(entite, date_etablissement DESC);

-- ============================================================
-- 4. whitelist_whatsapp — numéros autorisés + matrice RBAC
-- ============================================================
CREATE TABLE IF NOT EXISTS whitelist_whatsapp (
  id                          TEXT PRIMARY KEY,
  phone_e164                  TEXT UNIQUE NOT NULL,    -- "+33612345678"
  contact_id                  TEXT,                    -- FK optionnelle vers contacts.id
  display_name                TEXT NOT NULL,           -- "Thomas Issa", "Carl X"
  entites_visibles            TEXT NOT NULL,           -- JSON array : ["IC","GO","VI","VV"]
  is_admin                    INTEGER NOT NULL DEFAULT 0,
  rgpd_information_sent_at    TEXT,                    -- @legal Bloc 5 Décision 3
  mandat_signed_at            TEXT,                    -- @legal Bloc 5 Décision 1
  created_at                  TEXT NOT NULL,
  revoked_at                  TEXT,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

-- ============================================================
-- 5. whatsapp_sessions — état conversationnel (TTL 24h)
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  conversation_id   TEXT PRIMARY KEY,                  -- généré serveur, mappé à user_phone
  user_phone        TEXT NOT NULL,
  active_draft_id   TEXT,                              -- pointeur vers cr_drafts en cours
  state             TEXT NOT NULL,                     -- idle|drafting|clarifying|awaiting_publish_confirm
  last_message_at   TEXT NOT NULL,
  expires_at        TEXT NOT NULL,                     -- TTL 24h, ré-init sur interaction
  FOREIGN KEY (active_draft_id) REFERENCES cr_drafts(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_phone
  ON whatsapp_sessions(user_phone);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON whatsapp_sessions(expires_at);

-- ============================================================
-- 6. access_logs — traçabilité DGFiP (conservation 10 ans)
-- ============================================================
CREATE TABLE IF NOT EXISTS access_logs (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_phone         TEXT NOT NULL,
  actor_display_name  TEXT,
  resource_type       TEXT NOT NULL,                   -- cr_published|contact|log|draft
  resource_id         TEXT NOT NULL,
  action              TEXT NOT NULL,                   -- read|create|update|delete|publish
  entite              TEXT,
  result              TEXT NOT NULL,                   -- success|denied_rbac|error
  timestamp           TEXT NOT NULL,
  ip_address          TEXT,
  user_agent          TEXT
);
CREATE INDEX IF NOT EXISTS idx_access_logs_actor_ts
  ON access_logs(actor_phone, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_resource
  ON access_logs(resource_type, resource_id);

-- ============================================================
-- 7. generation_logs — métriques LLM (coût, latence, erreurs)
-- ============================================================
CREATE TABLE IF NOT EXISTS generation_logs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id           TEXT NOT NULL,
  user_phone         TEXT NOT NULL,
  claude_model       TEXT NOT NULL,                    -- "claude-sonnet-4-5"
  prompt_tokens      INTEGER,
  completion_tokens  INTEGER,
  cost_usd           REAL,
  latency_ms         INTEGER,
  status             TEXT NOT NULL,                    -- success|error|needs_clarification
  error_message      TEXT,
  timestamp          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_generation_logs_draft
  ON generation_logs(draft_id);
CREATE INDEX IF NOT EXISTS idx_generation_logs_timestamp
  ON generation_logs(timestamp DESC);
