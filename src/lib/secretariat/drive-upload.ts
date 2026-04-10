/**
 * Google Drive upload via OAuth2 refresh token.
 *
 * Le Service Account ne fonctionne pas sur les Drives personnels (quota).
 * On utilise OAuth2 avec un refresh token obtenu une seule fois par Thomas.
 *
 * Setup :
 *   1. Thomas crée des credentials OAuth2 dans Google Cloud Console
 *   2. Thomas lance le script /api/drive-auth pour autoriser et obtenir le refresh token
 *   3. Le refresh token est stocké dans GOOGLE_REFRESH_TOKEN (Replit Secret)
 *   4. À chaque upload, on utilise le refresh token pour obtenir un access token frais
 *
 * Env vars :
 *   GOOGLE_CLIENT_ID — OAuth2 Client ID
 *   GOOGLE_CLIENT_SECRET — OAuth2 Client Secret
 *   GOOGLE_REFRESH_TOKEN — Refresh token (obtenu une fois via /api/drive-auth)
 */

const DRIVE_API = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Mapping entité → dossier Google Drive.
 */
const DRIVE_FOLDERS: Record<string, string> = {
  IC: '1AUUB3Kx2hOil0GNIC858dD_ndUQ4VAOx',
  GO: '1dapRQ5ZPeEIlTLEm5h0yGaMiuH5HYYJ0',
  VI: '1loe-NKbuXm6t3_OMt8ILt_l2dW7IspIA',
  VV: '1mge-P2u54V3qApXKkQNi2YHb5b8K50iN',
};

const DEFAULT_FOLDER_ID = DRIVE_FOLDERS['IC']!;

export interface DriveUploadResult {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  error?: string;
}

/**
 * Obtient un access token frais via le refresh token.
 */
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

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

    if (!response.ok) {
      const error = await response.text();
      console.error('[drive] erreur refresh token :', error.slice(0, 200));
      return null;
    }

    const data = (await response.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (err) {
    console.error('[drive] erreur obtention token :', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Upload un PDF vers Google Drive via OAuth2.
 */
export async function uploadToDrive(
  pdfBuffer: Buffer,
  filename: string,
  entiteCode?: string,
  title?: string,
): Promise<DriveUploadResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      error: 'Upload Drive désactivé — credentials OAuth2 manquants (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)',
    };
  }

  const folderId = (entiteCode && DRIVE_FOLDERS[entiteCode]) ?? DEFAULT_FOLDER_ID;

  try {
    // Metadata du fichier
    const metadata = JSON.stringify({
      name: filename,
      description: title ?? filename,
      parents: [folderId],
      mimeType: 'application/pdf',
    });

    // Upload multipart (metadata JSON + contenu PDF)
    const boundary = '===issa_upload_boundary===';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata + '\r\n' +
      `--${boundary}\r\n` +
      'Content-Type: application/pdf\r\n\r\n';
    const footer = `\r\n--${boundary}--`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      pdfBuffer,
      Buffer.from(footer, 'utf-8'),
    ]);

    const response = await fetch(`${DRIVE_API}?uploadType=multipart&fields=id,webViewLink`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': String(bodyBuffer.length),
      },
      body: bodyBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Drive API ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as { id?: string; webViewLink?: string };
    return {
      success: true,
      fileId: data.id,
      webViewLink: data.webViewLink,
    };
  } catch (err) {
    return {
      success: false,
      error: `Erreur Drive : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
