-- Migration 005 — RFC 3161 (horodatage qualifié Universign, Phase 6)
--
-- Contexte :
--   La migration 001 avait anticipé `rfc3161_token` et `rfc3161_provider`
--   dans cr_published mais pas `rfc3161_requested_at` (horodatage de l'appel
--   Universign côté serveur). Cette migration ajoute la colonne manquante.
--
-- Pourquoi rfc3161_requested_at :
--   Pour tracer QUAND le token a été demandé côté serveur (utile pour le
--   backfill : on veut ordonner les publications qui n'ont pas de token et
--   éviter de re-demander sans cesse). Le token Universign contient déjà
--   sa propre gen_time mais on veut aussi le timestamp local ISSA pour
--   l'audit DGFiP (art. L102 B LPF — traçabilité des opérations).
--
-- Idempotence :
--   ALTER TABLE ADD COLUMN n'est pas idempotent en SQLite. Le runner de
--   migrations n'exécute cette migration qu'une seule fois (inscrite dans
--   schema_version) donc pas de risque pratique, mais on évite quand même
--   d'ajouter les colonnes déjà présentes dans 001 (rfc3161_token,
--   rfc3161_provider).
--
-- Sources :
--   - docs/ia/secretariat-architecture.md Section 9 (horodatage qualifié)
--   - docs/legal/secretariat-agent-legal-audit.md Bloc 6 (conformité DGFiP)
--   - docs/ia/secretariat-implementation-plan.md Phase 6 (Universign RFC 3161)

ALTER TABLE cr_published ADD COLUMN rfc3161_requested_at TEXT;

CREATE INDEX IF NOT EXISTS idx_cr_published_rfc3161_token
  ON cr_published(rfc3161_token);

-- ============================================================
-- Versioning
-- ============================================================
INSERT INTO schema_version (version, applied_at)
VALUES (5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
