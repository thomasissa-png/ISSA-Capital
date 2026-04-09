-- Migration 006 — Ajout support Telegram Bot API
-- Appliquée par src/server/db/migrations/runner.ts
-- Source : adaptation du connecteur d'entrée WhatsApp vers Telegram
--
-- Changements :
--   1. Ajout colonne `telegram_chat_id` à `whitelist_whatsapp` (identifiant
--      Telegram au lieu de phone E.164 — les deux coexistent).
--   2. Index sur `telegram_chat_id` pour lookup rapide dans le webhook Telegram.
--
-- La table n'est PAS renommée (trop invasif pour le code existant).
-- Les deux connecteurs (WhatsApp + Telegram) cohabitent.

ALTER TABLE whitelist_whatsapp ADD COLUMN telegram_chat_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_whitelist_telegram_chat_id
  ON whitelist_whatsapp(telegram_chat_id);

-- ============================================================
-- Versioning
-- ============================================================
INSERT INTO schema_version (version, applied_at)
VALUES (6, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
