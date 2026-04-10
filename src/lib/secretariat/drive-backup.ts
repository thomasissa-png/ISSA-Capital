/**
 * Backup/restore des données Anya sur Google Drive via OAuth2.
 *
 * Sauvegarde le compteur de références + l'historique CR dans un fichier
 * _anya-data-backup.json sur Google Drive. Restaure au premier appel
 * après un redéploiement Replit.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BACKUP_FILENAME = '_anya-data-backup.json';
const BACKUP_FOLDER_ID = '1AUUB3Kx2hOil0GNIC858dD_ndUQ4VAOx';
const DATA_DIR = existsSync('/home/runner') ? '/home/runner/issa-data' : '/tmp/issa-secretariat';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_API = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';

interface BackupData {
  counter: Record<string, number>;
  history: unknown[];
  lastBackupAt: string;
}

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) return null;
    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Sauvegarde le compteur et l'historique sur Google Drive.
 */
export async function backupToGoogleDrive(): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) return;

  try {
    const counterPath = resolve(DATA_DIR, 'cr-counter.json');
    const historyPath = resolve(DATA_DIR, 'cr-history.json');

    const counter = existsSync(counterPath) ? JSON.parse(readFileSync(counterPath, 'utf8')) : {};
    const history = existsSync(historyPath) ? JSON.parse(readFileSync(historyPath, 'utf8')) : [];

    const backup: BackupData = { counter, history, lastBackupAt: new Date().toISOString() };
    const content = JSON.stringify(backup, null, 2);

    // Chercher si le fichier existe déjà
    const searchUrl = `${DRIVE_FILES_API}?q=name='${BACKUP_FILENAME}' and '${BACKUP_FOLDER_ID}' in parents and trashed=false&fields=files(id)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let existingFileId: string | undefined;
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as { files?: { id: string }[] };
      existingFileId = searchData.files?.[0]?.id;
    }

    if (existingFileId) {
      // Mettre à jour le fichier existant
      await fetch(`${DRIVE_API}/${existingFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: content,
      });
    } else {
      // Créer un nouveau fichier
      const boundary = '===issa_backup_boundary===';
      const metadata = JSON.stringify({
        name: BACKUP_FILENAME,
        parents: [BACKUP_FOLDER_ID],
        mimeType: 'application/json',
      });
      const body = Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`,
        'utf-8',
      );

      await fetch(`${DRIVE_API}?uploadType=multipart`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      });
    }

    console.info('[backup] données sauvegardées sur Google Drive');
  } catch (err) {
    console.warn('[backup] échec sauvegarde Drive :', err instanceof Error ? err.message : err);
  }
}

/**
 * Restaure le compteur et l'historique depuis Google Drive.
 */
export async function restoreFromGoogleDrive(): Promise<boolean> {
  const counterPath = resolve(DATA_DIR, 'cr-counter.json');
  const historyPath = resolve(DATA_DIR, 'cr-history.json');

  // Si les fichiers locaux existent déjà, pas besoin de restaurer
  if (existsSync(counterPath) && existsSync(historyPath)) return true;

  const accessToken = await getAccessToken();
  if (!accessToken) return false;

  try {
    // Chercher le fichier backup
    const searchUrl = `${DRIVE_FILES_API}?q=name='${BACKUP_FILENAME}' and '${BACKUP_FOLDER_ID}' in parents and trashed=false&fields=files(id)`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchRes.ok) return false;
    const searchData = (await searchRes.json()) as { files?: { id: string }[] };
    const fileId = searchData.files?.[0]?.id;

    if (!fileId) {
      console.info('[backup] aucun backup trouvé sur Drive');
      return false;
    }

    // Télécharger le contenu
    const downloadRes = await fetch(`${DRIVE_FILES_API}/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!downloadRes.ok) return false;
    const data = (await downloadRes.json()) as BackupData;

    // Écrire les fichiers locaux
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

    if (data.counter) {
      writeFileSync(counterPath, JSON.stringify(data.counter, null, 2), 'utf8');
    }
    if (data.history) {
      writeFileSync(historyPath, JSON.stringify(data.history, null, 2), 'utf8');
    }

    console.info(`[backup] données restaurées depuis Drive (backup du ${data.lastBackupAt})`);
    return true;
  } catch (err) {
    console.warn('[backup] échec restauration :', err instanceof Error ? err.message : err);
    return false;
  }
}
