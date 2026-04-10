/**
 * Backup/restore des données Anya sur Google Drive.
 *
 * Les fichiers JSON locaux (/home/runner/issa-data/) sont effacés à chaque
 * redéploiement Replit. Ce module sauvegarde et restaure les données
 * critiques (compteur CR + historique) sur Google Drive.
 *
 * Le fichier _anya-data-backup.json est stocké dans le dossier ISSA Capital
 * sur Drive. Il contient le compteur de références et l'historique des CR.
 */

import { google } from 'googleapis';
import { Readable } from 'node:stream';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BACKUP_FILENAME = '_anya-data-backup.json';
const BACKUP_FOLDER_ID = '1AUUB3Kx2hOil0GNIC858dD_ndUQ4VAOx'; // ISSA Capital folder
const DATA_DIR = existsSync('/home/runner') ? '/home/runner/issa-data' : '/tmp/issa-secretariat';

interface BackupData {
  counter: Record<string, number>;
  history: unknown[];
  lastBackupAt: string;
}

function getAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json || json === '__TO_FILL__') return null;

  try {
    const creds = JSON.parse(json) as { client_email: string; private_key: string };
    return new google.auth.JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
  } catch {
    return null;
  }
}

/**
 * Sauvegarde le compteur et l'historique sur Google Drive.
 * Appelé après chaque validation de CR.
 */
export async function backupToGoogleDrive(): Promise<void> {
  const auth = getAuth();
  if (!auth) return;

  try {
    const counterPath = resolve(DATA_DIR, 'cr-counter.json');
    const historyPath = resolve(DATA_DIR, 'cr-history.json');

    const counter = existsSync(counterPath)
      ? JSON.parse(readFileSync(counterPath, 'utf8'))
      : {};
    const history = existsSync(historyPath)
      ? JSON.parse(readFileSync(historyPath, 'utf8'))
      : [];

    const backup: BackupData = {
      counter,
      history,
      lastBackupAt: new Date().toISOString(),
    };

    const drive = google.drive({ version: 'v3', auth });
    const content = JSON.stringify(backup, null, 2);
    const stream = new Readable();
    stream.push(content);
    stream.push(null);

    // Chercher si le fichier backup existe déjà
    const existing = await drive.files.list({
      q: `name = '${BACKUP_FILENAME}' and '${BACKUP_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id)',
    } as unknown as Parameters<typeof drive.files.list>[0]);

    const files = (existing as unknown as { data: { files?: { id: string }[] } }).data.files;
    const existingFileId = files?.[0]?.id;

    if (existingFileId) {
      // Mettre à jour le fichier existant
      await drive.files.update({
        fileId: existingFileId,
        media: { mimeType: 'application/json', body: stream },
      } as unknown as Parameters<typeof drive.files.update>[0]);
    } else {
      // Créer un nouveau fichier
      await drive.files.create({
        requestBody: {
          name: BACKUP_FILENAME,
          parents: [BACKUP_FOLDER_ID],
          mimeType: 'application/json',
        },
        media: { mimeType: 'application/json', body: stream },
      } as unknown as Parameters<typeof drive.files.create>[0]);
    }

    console.info('[backup] données sauvegardées sur Google Drive');
  } catch (err) {
    console.warn('[backup] échec sauvegarde Drive :', err instanceof Error ? err.message : err);
  }
}

/**
 * Restaure le compteur et l'historique depuis Google Drive.
 * Appelé au démarrage si les fichiers locaux n'existent pas.
 */
export async function restoreFromGoogleDrive(): Promise<boolean> {
  const auth = getAuth();
  if (!auth) return false;

  const counterPath = resolve(DATA_DIR, 'cr-counter.json');
  const historyPath = resolve(DATA_DIR, 'cr-history.json');

  // Si les fichiers locaux existent déjà, pas besoin de restaurer
  if (existsSync(counterPath) && existsSync(historyPath)) {
    return true;
  }

  try {
    const drive = google.drive({ version: 'v3', auth });

    // Trouver le fichier backup
    const result = await drive.files.list({
      q: `name = '${BACKUP_FILENAME}' and '${BACKUP_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id)',
    } as unknown as Parameters<typeof drive.files.list>[0]);

    const files = (result as unknown as { data: { files?: { id: string }[] } }).data.files;
    const fileId = files?.[0]?.id;

    if (!fileId) {
      console.info('[backup] aucun backup trouvé sur Drive — première utilisation');
      return false;
    }

    // Télécharger le contenu
    const response = await drive.files.get({
      fileId,
      alt: 'media',
    } as unknown as Parameters<typeof drive.files.get>[0]);

    const data = (response as unknown as { data: BackupData }).data;

    // Écrire les fichiers locaux
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    if (data.counter) {
      writeFileSync(counterPath, JSON.stringify(data.counter, null, 2), 'utf8');
    }
    if (data.history) {
      writeFileSync(historyPath, JSON.stringify(data.history, null, 2), 'utf8');
    }

    console.info(`[backup] données restaurées depuis Drive (backup du ${data.lastBackupAt})`);
    return true;
  } catch (err) {
    console.warn('[backup] échec restauration Drive :', err instanceof Error ? err.message : err);
    return false;
  }
}
