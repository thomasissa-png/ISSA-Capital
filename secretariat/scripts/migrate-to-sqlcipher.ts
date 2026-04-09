/**
 * Script de documentation — procédure de migration SQLite → SQLCipher
 * (Phase 6b, prévisionnel — N'EXÉCUTE PAS la migration automatiquement).
 *
 * Rôle :
 *   Ce script est un guide interactif qui imprime la procédure manuelle à
 *   suivre pour migrer la base ISSA Secretariat de `better-sqlite3` vers
 *   `@journeyapps/sqlcipher` (chiffrement at-rest AES-256).
 *
 *   La migration n'est PAS automatisée parce qu'elle implique :
 *     - Un arrêt du service pendant la migration
 *     - Un changement de dépendance npm qui casse le build tant qu'il n'est
 *       pas pris en compte dans db/connection.ts
 *     - Une manipulation manuelle de la clé DB_ENCRYPTION_KEY dans les
 *       Replit Secrets
 *
 * Usage :
 *   tsx scripts/migrate-to-sqlcipher.ts
 *
 * Source :
 *   - src/server/db/encryption.ts (check de config at-rest)
 *   - docs/ia/secretariat-implementation-plan.md Phase 6b
 *   - https://www.zetetic.net/sqlcipher/sqlcipher-api/
 */

/* eslint-disable no-console */

const PROCEDURE = `
==========================================================================
  MIGRATION SQLITE → SQLCIPHER (ISSA Secretariat — Phase 6b)
==========================================================================

CONTEXTE
--------
La base actuelle (better-sqlite3) stocke les CR, contacts, secrets 2FA et
tokens RFC 3161 EN CLAIR sur le disque Replit. En production, c'est un
risque de conformité RGPD / DGFiP : si le disque Replit est compromis
ou exfiltré, toutes les données sont lisibles.

SQLCipher chiffre la DB at-rest avec AES-256. La clé est fournie au
démarrage via un PRAGMA SQL et JAMAIS persistée sur disque.

PRÉ-REQUIS
----------
  1. Backup à jour de la DB actuelle :
       npm run job:backup
     Vérifier que ./backups/ contient un fichier récent.

  2. Clé de chiffrement générée (256 bits / 64 hex caractères) :
       node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     Stocker dans Replit Secrets sous DB_ENCRYPTION_KEY.
     NE JAMAIS commit cette clé dans le repo ou .env.example.

  3. Accès SSH au volume Replit (pour exécuter sqlcipher CLI).

ÉTAPES DE MIGRATION
-------------------
  1. Arrêter le serveur Node :
       # Via Replit : stop workflow
       # Via SSH :    pkill -f 'node.*dist/server/index.js'

  2. Installer sqlcipher CLI (container Replit) :
       apt-get install sqlcipher  # ou équivalent

  3. Exporter la DB actuelle en SQL :
       sqlite3 /home/runner/workspace/secretariat/data/issa-sec.db \\
         .dump > /tmp/dump.sql

  4. Créer une nouvelle DB chiffrée à partir du dump :
       sqlcipher /tmp/issa-sec-encrypted.db <<'EOF'
         PRAGMA key = 'VOTRE_CLE_64_HEX';
         PRAGMA cipher_compatibility = 4;
         .read /tmp/dump.sql
         .exit
       EOF

  5. Vérifier que la nouvelle DB est bien chiffrée :
       file /tmp/issa-sec-encrypted.db
       # Doit afficher "data" (pas "SQLite 3.x database")
       sqlcipher /tmp/issa-sec-encrypted.db "PRAGMA key = 'VOTRE_CLE'; \\
         SELECT COUNT(*) FROM cr_published;"
       # Doit retourner le bon nombre de CR.

  6. Remplacer la DB clair par la version chiffrée :
       mv /home/runner/workspace/secretariat/data/issa-sec.db \\
          /home/runner/workspace/secretariat/data/issa-sec.db.old-cleartext
       mv /tmp/issa-sec-encrypted.db \\
          /home/runner/workspace/secretariat/data/issa-sec.db

  7. Installer le driver SQLCipher pour Node et updater package.json :
       npm uninstall better-sqlite3
       npm install @journeyapps/sqlcipher

  8. Updater src/server/db/connection.ts pour :
       - import Database from '@journeyapps/sqlcipher'
       - Après openDb(), exécuter :
           db.pragma(\`key = '\${env.DB_ENCRYPTION_KEY}'\`);
           db.pragma('cipher_compatibility = 4');
       - Re-tester npm run typecheck + npm test

  9. Supprimer le dump clair :
       rm /tmp/dump.sql
       shred -u /home/runner/workspace/secretariat/data/issa-sec.db.old-cleartext

 10. Redémarrer le serveur. L'import initDatabase() doit loguer OK
     et warnIfProductionDbNotEncrypted() ne doit plus warn.

ROLLBACK EN CAS DE PROBLÈME
---------------------------
  1. Arrêter le serveur.
  2. Restaurer depuis ./backups/ le dernier backup en clair.
  3. Revert le commit npm install @journeyapps/sqlcipher.
  4. Redémarrer.

VÉRIFICATIONS POST-MIGRATION
----------------------------
  [ ] npm test : 200+ tests PASS
  [ ] /api/health répond 200
  [ ] GET /admin/api/contacts retourne la liste complète
  [ ] Les 2FA backup codes précédents fonctionnent toujours
  [ ] Les CR déjà publiés sont toujours visibles dans Craft

RÉFÉRENCES
----------
  - src/server/db/encryption.ts
  - https://www.zetetic.net/sqlcipher/sqlcipher-api/
  - https://github.com/journeyapps/node-sqlcipher

==========================================================================
`;

console.log(PROCEDURE);

export {};
