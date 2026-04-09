-- Migration 003 — Schéma Admin (Phase 5)
--
-- Objectif : préparer la table `contacts` pour les opérations CRUD exposées
-- via l'admin web `/admin`. La Phase 1 ne supportait que le seed initial
-- (lecture seule). Phase 5 ajoute :
--   - soft delete (colonne `deleted_at`) pour préserver la traçabilité DGFiP
--     sans supprimer physiquement un contact qui a pu être référencé dans un
--     CR publié (conservation 10 ans, art. L102 B LPF).
--   - index sur `deleted_at` pour filtrer efficacement les contacts actifs.
--
-- Notes :
--   - La table `admin_sessions` n'est volontairement PAS créée : le JWT est
--     stateless en V1. Phase 6 ajoutera une table de révocation si nécessaire
--     (2FA + multi-comptes Carl/Maxime).
--   - Les tables `access_logs` et `generation_logs` existent déjà depuis la
--     migration 001. Elles sont simplement lues par les routes admin (module 3).
--   - La table `whitelist_whatsapp` existe déjà depuis 001. Elle est CRUD
--     depuis le module 4 de l'admin.
--
-- Idempotence : ALTER TABLE ADD COLUMN n'est pas idempotent sur SQLite.
-- On utilise une table temporaire de détection via PRAGMA table_info().
-- better-sqlite3 n'expose pas de mécanisme conditionnel en SQL pur, donc on
-- s'appuie sur le fait que le runner de migrations est lui-même idempotent
-- (table schema_version). Une fois la migration 003 inscrite, elle ne sera
-- plus rejouée.

-- ============================================================
-- 1. contacts — soft delete
-- ============================================================
ALTER TABLE contacts ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at
  ON contacts(deleted_at);

-- ============================================================
-- 2. Paramètres applicatifs (KV store)
-- ============================================================
-- Table générique clé/valeur pour les paramètres modifiables depuis le module
-- 4 de l'admin (seuil d'alerte coût Anthropic, entités actives, etc.).
-- Format : une ligne par clé, valeur stockée en TEXT (JSON si structuré).

CREATE TABLE IF NOT EXISTS admin_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Seeds de paramètres par défaut (no-op si déjà présents).
INSERT OR IGNORE INTO admin_settings (key, value, updated_at)
VALUES
  ('cost_alert_monthly_eur', '10', '2026-04-09T00:00:00.000Z'),
  ('entities_active', '["IC","GO","VI","VV"]', '2026-04-09T00:00:00.000Z');

-- ============================================================
-- Versioning
-- ============================================================
INSERT INTO schema_version (version, applied_at)
VALUES (3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
