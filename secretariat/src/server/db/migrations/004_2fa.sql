-- Migration 004 — 2FA TOTP (Phase 6)
--
-- Objectif : stocker le secret TOTP base32 d'un admin + backup codes hashés
-- (usage unique). Un seul compte admin en V1 (id = "thomas") mais la table
-- supporte plusieurs utilisateurs pour la Phase 7+ (Carl / Maxime).
--
-- Flow d'activation :
--   1. Admin authentifié appelle POST /admin/api/2fa/generate
--   2. Le serveur génère un secret base32 + QR code (data URL) et stocke
--      une ligne avec enabled=0 (secret en attente de validation)
--   3. Admin scanne le QR dans son authenticator et envoie le premier code
--      via POST /admin/api/2fa/enable
--   4. Si le code est correct, enabled=1, verified_at est rempli, et 10
--      backup codes sont générés (hashés bcrypt pour éviter la fuite au repos)
--   5. Au login suivant, le serveur renvoie { requires_2fa: true, temp_token }
--      et l'admin doit fournir un code TOTP via /admin/api/2fa/verify-login
--
-- Chiffrement :
--   Le secret TOTP est stocké en clair dans cette table en V1. Quand la
--   Phase 6b activera SQLCipher (voir src/server/db/encryption.ts), la DB
--   entière sera chiffrée at-rest, ce qui couvre aussi ce secret.
--
-- Backup codes :
--   Stockés comme JSON array de bcrypt hashes. Consommés un par un : au
--   premier usage, le hash correspondant est retiré du array et la ligne
--   est UPDATE. 10 codes par défaut, régénérables via
--   POST /admin/api/2fa/backup-codes/regenerate.
--
-- Sources :
--   - docs/ia/secretariat-implementation-plan.md Phase 6 (2FA)
--   - docs/ia/secretariat-architecture.md Section 10.2 (auth admin)

CREATE TABLE IF NOT EXISTS admin_2fa_secrets (
  id            TEXT PRIMARY KEY,
  secret        TEXT NOT NULL,
  enabled       INTEGER NOT NULL DEFAULT 0,
  verified_at   TEXT,
  backup_codes  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_2fa_enabled
  ON admin_2fa_secrets(enabled);

-- ============================================================
-- Versioning
-- ============================================================
INSERT INTO schema_version (version, applied_at)
VALUES (4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
