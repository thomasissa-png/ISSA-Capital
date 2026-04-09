/**
 * SQLCipher — chiffrement at-rest de la base SQLite (Phase 6 PRÉPARATOIRE).
 *
 * Statut : PRÉPARATOIRE. La Phase 6 ne bascule PAS `better-sqlite3` vers
 * `@journeyapps/sqlcipher` — la migration casserait les 200 tests existants
 * et demande une procédure de migration des données en production (export
 * clair → import chiffré). Ce fichier documente la procédure et expose
 * une fonction de détection + un warn loud au démarrage.
 *
 * Pourquoi différer :
 *   - `@journeyapps/sqlcipher` a la même surface d'API que `better-sqlite3`
 *     MAIS nécessite la commande `PRAGMA key = '...'` AVANT tout autre appel.
 *     La bascule est triviale côté code mais la migration de la DB existante
 *     demande une opération manuelle en prod :
 *       1. Arrêter le serveur
 *       2. sqlcipher secretariat.db.clear "ATTACH DATABASE 'secretariat.db.enc' AS enc KEY '...'; SELECT sqlcipher_export('enc');"
 *       3. Remplacer data/secretariat.db par data/secretariat.db.enc
 *       4. Redémarrer avec DB_ENCRYPTION_KEY renseignée
 *
 *   - Les 200 tests existants créent des DBs SQLite temporaires avec
 *     `better-sqlite3`. Une bascule globale casse tous ces tests. Phase 6b
 *     devra injecter le flag par env pour permettre aux tests de rester
 *     en clair (DB en tmpdir).
 *
 * Procédure de migration production (Phase 6b, quand Thomas approuvera) :
 *   1. Générer une clé 32 bytes hex :
 *        openssl rand -hex 32
 *   2. Renseigner dans Replit Secrets :
 *        DB_ENCRYPTION_KEY=<hex 64 chars>
 *   3. Backup de la DB actuelle :
 *        cp data/secretariat.db data/secretariat.db.bak
 *   4. Exécuter le script de migration :
 *        npm run job:migrate-to-sqlcipher
 *      (voir scripts/migrate-to-sqlcipher.ts — lit DB_ENCRYPTION_KEY,
 *       crée data/secretariat.db.enc, remplace atomiquement)
 *   5. Tester le démarrage + accès admin + publication test
 *   6. Supprimer le backup après validation
 *
 * Fichiers impactés (checklist Phase 6b) :
 *   - package.json              : remplacer better-sqlite3 par @journeyapps/sqlcipher
 *   - src/server/db/connection.ts : ajouter pragma key après new Database()
 *   - Tous les tests : injecter DB_ENCRYPTION_KEY optionnelle
 *
 * Sources :
 *   - docs/ia/secretariat-implementation-plan.md Phase 6 (SQLCipher)
 *   - docs/ia/secretariat-architecture.md Section 2 (chiffrement at-rest)
 *   - docs/legal/secretariat-agent-legal-audit.md (RGPD — chiffrement des PII)
 */

import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';

/** Valeur placeholder utilisée dans `.env.example` pour matérialiser une clé manquante. */
const PLACEHOLDER_VALUES = new Set(['', '__TO_FILL__', '32_bytes_hex_random_key']);

/**
 * Indique si la base est configurée pour être chiffrée.
 *
 * Retourne `true` UNIQUEMENT si `DB_ENCRYPTION_KEY` est définie ET n'est
 * pas un placeholder connu. Cette fonction ne CHIFFRE pas réellement la DB
 * — elle ne fait que lire la configuration. L'activation réelle du
 * chiffrement se fait dans `connection.ts` quand Phase 6b sera active.
 */
export function isDbEncrypted(): boolean {
  const env = getEnv();
  const key = env.DB_ENCRYPTION_KEY;

  if (typeof key !== 'string') return false;
  if (PLACEHOLDER_VALUES.has(key)) return false;
  // Une clé utile fait au moins 32 caractères (hex 64 pour 256 bits, ou 32 ASCII).
  if (key.length < 32) return false;

  return true;
}

/**
 * Log un warn loud au démarrage si on est en production ET que la DB n'est
 * pas chiffrée. En dev / test, on ne log rien (éviter le bruit).
 *
 * À appeler UNE fois après `initDatabase()` dans `startServer()`.
 *
 * N'exit PAS le process : permettre un déploiement initial avant que Thomas
 * ait lancé la migration Phase 6b. Le warn est suffisamment visible pour
 * alerter côté ops.
 */
export function warnIfProductionDbNotEncrypted(): void {
  const env = getEnv();
  if (env.NODE_ENV !== 'production') {
    return;
  }

  if (isDbEncrypted()) {
    return;
  }

  const log = getLogger();
  log.warn(
    {
      warning: 'DB_NOT_ENCRYPTED_AT_REST',
      severity: 'HIGH',
      action:
        'Lancer scripts/migrate-to-sqlcipher.ts après avoir renseigné DB_ENCRYPTION_KEY',
    },
    // eslint-disable-next-line no-irregular-whitespace
    '════════════════════════════════════════════════════════════\n' +
      '⚠  ATTENTION : base SQLite NON CHIFFRÉE en production ⚠\n' +
      '    La conformité RGPD exige le chiffrement at-rest des PII.\n' +
      '    1. Générer une clé : openssl rand -hex 32\n' +
      '    2. Renseigner DB_ENCRYPTION_KEY dans Replit Secrets\n' +
      '    3. Exécuter la migration SQLCipher (voir src/server/db/encryption.ts)\n' +
      '════════════════════════════════════════════════════════════',
  );
}
