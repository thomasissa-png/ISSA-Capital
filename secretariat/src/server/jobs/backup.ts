/**
 * Job CLI — backup SQLite (Phase 6).
 *
 * Rôle :
 *   Crée une copie atomique du fichier DB SQLite vers un dossier de backup
 *   local, avec rotation automatique pour respecter la rétention configurée
 *   (default 30 jours). Les backups distants (S3 / Backblaze B2) sont
 *   laissés en stub commenté — activables via env flag.
 *
 * Usage :
 *   npm run job:backup
 *   ou : tsx src/server/jobs/backup.ts
 *
 * Flag env :
 *   BACKUP_DIR              — dossier cible (défaut ./backups)
 *   BACKUP_LOCAL_RETENTION  — jours de rétention locale (défaut 30)
 *   BACKUP_S3_ENABLED       — true pour activer S3 (stub)
 *   BACKUP_B2_ENABLED       — true pour activer Backblaze B2 (stub)
 *
 * Stratégie backup SQLite :
 *   - On utilise `db.backup(path)` de better-sqlite3 qui fait un "online
 *     backup" : la DB source peut continuer à écrire pendant la copie.
 *     C'est beaucoup plus safe qu'un `fs.copyFile` qui peut capturer un
 *     état incohérent si une écriture est en cours (WAL actif).
 *   - Le fichier de sortie est nommé `issa-sec-YYYY-MM-DDTHH-MM-SS.db`.
 *
 * Rotation :
 *   - On liste le dossier de backup, on parse les dates des noms de fichier,
 *     on supprime ceux plus vieux que BACKUP_LOCAL_RETENTION jours.
 *
 * Off-site (commenté — à activer Phase 6b si Thomas le demande) :
 *   - S3 : aws-sdk v3, bucket privé, chiffrement SSE-S3 par défaut
 *   - B2 : backblaze-b2 SDK, application key, bucket privé
 *   Aucun SDK n'est installé pour éviter de gonfler le bundle tant que
 *   Thomas n'a pas pris la décision.
 *
 * Source :
 *   docs/ia/secretariat-implementation-plan.md Phase 6 (backup cron)
 */

import fs from 'node:fs';
import path from 'node:path';

import { getDb, initDatabase } from '../db/connection';
import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';

interface BackupStats {
  created: string;
  sizeBytes: number;
  durationMs: number;
  rotated: number;
  s3Pushed: boolean;
  b2Pushed: boolean;
}

// ============================================================
// Core
// ============================================================

function nowIsoForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function parseBackupDate(filename: string): Date | null {
  // Format attendu : issa-sec-2026-04-09T12-34-56.db
  const match = filename.match(
    /^issa-sec-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.db$/,
  );
  if (match === null) return null;
  const [, day, hh, mm, ss] = match;
  const iso = `${day}T${hh}:${mm}:${ss}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveBackupDir(): string {
  const custom = process.env.BACKUP_DIR;
  if (custom !== undefined && custom.length > 0) {
    return path.resolve(custom);
  }
  return path.resolve('./backups');
}

/**
 * Exécute un backup local du DB SQLite.
 */
export async function runBackup(): Promise<BackupStats> {
  const log = getLogger();
  const env = getEnv();
  const startTime = Date.now();

  const backupDir = resolveBackupDir();
  fs.mkdirSync(backupDir, { recursive: true });

  const filename = `issa-sec-${nowIsoForFilename()}.db`;
  const destPath = path.join(backupDir, filename);

  log.info({ dest: destPath }, '[backup] démarrage backup SQLite');

  // Backup atomique via better-sqlite3 .backup()
  // (plus sûr qu'un fs.copyFile qui peut capturer un état WAL inconsistant)
  const db = getDb();
  const backupResult = db.backup(destPath);
  // .backup() retourne une Promise<{ totalPages, remainingPages }>
  await backupResult;

  const stats = fs.statSync(destPath);
  const durationMs = Date.now() - startTime;

  log.info(
    { dest: destPath, sizeBytes: stats.size, durationMs },
    '[backup] backup local créé',
  );

  // Rotation locale
  const rotated = rotateLocalBackups(backupDir, env.BACKUP_LOCAL_RETENTION);

  // Stubs off-site — activables via env flags
  let s3Pushed = false;
  let b2Pushed = false;

  if (env.BACKUP_S3_ENABLED) {
    s3Pushed = await pushToS3Stub(destPath);
  }
  if (env.BACKUP_B2_ENABLED) {
    b2Pushed = await pushToB2Stub(destPath);
  }

  return {
    created: destPath,
    sizeBytes: stats.size,
    durationMs,
    rotated,
    s3Pushed,
    b2Pushed,
  };
}

/**
 * Supprime les backups locaux plus vieux que `retentionDays`.
 * Retourne le nombre de fichiers supprimés.
 */
export function rotateLocalBackups(
  backupDir: string,
  retentionDays: number,
): number {
  const log = getLogger();
  if (!fs.existsSync(backupDir)) return 0;

  const cutoffMs = Date.now() - retentionDays * 24 * 3600 * 1000;
  const files = fs.readdirSync(backupDir);
  let removed = 0;

  for (const file of files) {
    const date = parseBackupDate(file);
    if (date === null) continue;
    if (date.getTime() < cutoffMs) {
      const filePath = path.join(backupDir, file);
      try {
        fs.unlinkSync(filePath);
        removed += 1;
        log.info({ file }, '[backup] ancien backup supprimé (rotation)');
      } catch (err) {
        log.warn(
          { file, err: err instanceof Error ? err.message : String(err) },
          '[backup] échec suppression backup ancien',
        );
      }
    }
  }

  return removed;
}

// ============================================================
// Stubs off-site
// ============================================================

/**
 * STUB S3 — à activer Phase 6b.
 *
 * Exemple d'implémentation (NE PAS décommenter tant que @aws-sdk/client-s3
 * n'est pas dans package.json) :
 *
 *   import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
 *   const client = new S3Client({
 *     region: env.BACKUP_S3_REGION,
 *     credentials: {
 *       accessKeyId: env.BACKUP_S3_KEY,
 *       secretAccessKey: env.BACKUP_S3_SECRET,
 *     },
 *   });
 *   const body = fs.readFileSync(filePath);
 *   await client.send(new PutObjectCommand({
 *     Bucket: env.BACKUP_S3_BUCKET,
 *     Key: `backups/${path.basename(filePath)}`,
 *     Body: body,
 *     ServerSideEncryption: 'AES256',
 *   }));
 *   return true;
 */
async function pushToS3Stub(filePath: string): Promise<boolean> {
  const log = getLogger();
  log.warn(
    { filePath },
    '[backup] BACKUP_S3_ENABLED=true mais SDK non installé — stub no-op',
  );
  return false;
}

/**
 * STUB Backblaze B2 — à activer Phase 6b.
 *
 * Exemple d'implémentation (NE PAS décommenter tant que `backblaze-b2`
 * n'est pas dans package.json) :
 *
 *   import B2 from 'backblaze-b2';
 *   const b2 = new B2({
 *     applicationKeyId: env.BACKUP_B2_KEY_ID,
 *     applicationKey: env.BACKUP_B2_KEY,
 *   });
 *   await b2.authorize();
 *   const uploadUrl = await b2.getUploadUrl({ bucketId: env.BACKUP_B2_BUCKET_ID });
 *   const body = fs.readFileSync(filePath);
 *   await b2.uploadFile({
 *     uploadUrl: uploadUrl.data.uploadUrl,
 *     uploadAuthToken: uploadUrl.data.authorizationToken,
 *     fileName: `backups/${path.basename(filePath)}`,
 *     data: body,
 *   });
 *   return true;
 */
async function pushToB2Stub(filePath: string): Promise<boolean> {
  const log = getLogger();
  log.warn(
    { filePath },
    '[backup] BACKUP_B2_ENABLED=true mais SDK non installé — stub no-op',
  );
  return false;
}

// ============================================================
// Entry point CLI
// ============================================================

async function main(): Promise<void> {
  try {
    initDatabase();
    const stats = await runBackup();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(stats, null, 2));
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[backup] erreur fatale:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}
