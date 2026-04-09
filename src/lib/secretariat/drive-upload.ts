/**
 * Upload PDF vers Google Drive — Secrétariat ISSA Capital.
 *
 * Upload automatique des CR validés dans le dossier Drive partagé.
 * Utilise un Google Service Account (clé JSON dans env GOOGLE_SERVICE_ACCOUNT_JSON).
 *
 * Env vars :
 *   GOOGLE_SERVICE_ACCOUNT_JSON — contenu JSON complet de la clé service account
 *   GOOGLE_DRIVE_FOLDER_ID — ID du dossier Drive cible (défaut : celui de Gradient One)
 */

import { google } from 'googleapis';
import { Readable } from 'node:stream';

/**
 * Mapping entité → dossier Google Drive.
 * Chaque entité a son propre dossier de CR.
 */
const DRIVE_FOLDERS: Record<string, string> = {
  IC: '1AUUB3Kx2hOil0GNIC858dD_ndUQ4VAOx', // ISSA Capital
  GO: '1dapRQ5ZPeEIlTLEm5h0yGaMiuH5HYYJ0', // Gradient One
  VI: '1loe-NKbuXm6t3_OMt8ILt_l2dW7IspIA', // Versi Immobilier
  VV: '1mge-P2u54V3qApXKkQNi2YHb5b8K50iN', // Versi Invest
};

const DEFAULT_FOLDER_ID = DRIVE_FOLDERS['IC'];

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  error?: string;
}

/**
 * Upload un PDF vers Google Drive.
 *
 * @param pdfBuffer Buffer du PDF à uploader
 * @param filename Nom du fichier (ex: "GO-CR-2026-0001.pdf")
 * @param title Titre du document dans Drive
 */
/**
 * @param entiteCode Code entité (IC, GO, VI, VV) — détermine le dossier Drive cible
 */
export async function uploadToDrive(
  pdfBuffer: Buffer,
  filename: string,
  entiteCode?: string,
  title?: string,
): Promise<DriveUploadResult> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson || serviceAccountJson === '__TO_FILL__') {
    return {
      success: false,
      error: 'Upload Drive désactivé — GOOGLE_SERVICE_ACCOUNT_JSON non configuré',
    };
  }

  // Sélectionner le dossier Drive selon l'entité du CR
  const folderId = (entiteCode && DRIVE_FOLDERS[entiteCode]) ?? DEFAULT_FOLDER_ID;

  try {
    // Parser la clé JSON du service account
    const credentials = JSON.parse(serviceAccountJson) as {
      client_email: string;
      private_key: string;
    };

    // Authentification via JWT
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Convertir le Buffer en stream lisible
    const stream = new Readable();
    stream.push(pdfBuffer);
    stream.push(null);

    // Upload du fichier
    const response = await drive.files.create({
      requestBody: {
        name: filename,
        description: title ?? filename,
        parents: [folderId],
        mimeType: 'application/pdf',
      },
      media: {
        mimeType: 'application/pdf',
        body: stream,
      },
      fields: 'id,webViewLink',
    } as unknown as Parameters<typeof drive.files.create>[0]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (response as any).data as { id?: string; webViewLink?: string } | undefined;
    const fileId = data?.id ?? undefined;
    const webViewLink = data?.webViewLink ?? undefined;

    if (!fileId) {
      return { success: false, error: 'Drive n\'a pas retourné d\'ID de fichier' };
    }

    return {
      success: true,
      fileId,
      webViewLink,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[drive-upload] erreur :', message);
    return {
      success: false,
      error: `Erreur Drive : ${message.slice(0, 200)}`,
    };
  }
}
