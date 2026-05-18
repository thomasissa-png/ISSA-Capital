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
const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
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
export async function getAccessToken(): Promise<string | null> {
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

// ============================================================
// Inbox upload — sous-dossiers créés à la volée dans _Inbox
// ============================================================

/**
 * Mapping sous-dossier name → env var contenant l'ID Drive pré-configuré.
 * Si l'env var est définie, on skip la recherche/création et on utilise l'ID directement.
 * Cela résout le problème de doublons sur cold start serverless (le cache globalThis
 * est perdu entre invocations, et le scope drive.file peut ne pas voir les dossiers
 * créés par une instance précédente si le refresh token a été régénéré).
 */
const SUBFOLDER_ENV_MAP: Record<string, string> = {
  Photos: 'DRIVE_INBOX_PHOTOS_FOLDER_ID',
  Notes: 'DRIVE_INBOX_NOTES_FOLDER_ID',
  Voice: 'DRIVE_INBOX_VOICE_FOLDER_ID',
  Documents: 'DRIVE_INBOX_DOCUMENTS_FOLDER_ID',
};

/** Cache globalThis : sous-dossier name → Drive folder ID */
const INBOX_CACHE_KEY = '__issa_inbox_folder_cache__' as const;

function getInboxFolderCache(): Map<string, string> {
  if (!(INBOX_CACHE_KEY in globalThis)) {
    (globalThis as Record<string, unknown>)[INBOX_CACHE_KEY] = new Map<string, string>();
  }
  return (globalThis as Record<string, unknown>)[INBOX_CACHE_KEY] as Map<string, string>;
}

/**
 * Récupère ou crée un sous-dossier dans le dossier Inbox Drive.
 *
 * Ordre de résolution :
 *   1. Env var pré-configurée (DRIVE_INBOX_PHOTOS_FOLDER_ID, etc.) → skip search/create
 *   2. Cache globalThis (survit dans la même instance serverless)
 *   3. Recherche via files.list (scope drive.file — ne voit que les fichiers créés par l'app)
 *   4. Création via files.create si non trouvé
 *
 * Fix session 11 : ajout logs explicites sur search, supportsAllDrives, escape quotes.
 */
export async function getOrCreateSubfolder(
  accessToken: string,
  parentFolderId: string,
  subfolderName: string,
): Promise<string | null> {
  // 1. Vérifier si une env var pré-configurée existe pour ce sous-dossier
  const envKey = SUBFOLDER_ENV_MAP[subfolderName];
  if (envKey) {
    const envValue = process.env[envKey];
    if (envValue) {
      console.log(`[drive] sous-dossier ${subfolderName} : ID pré-configuré via ${envKey}`);
      return envValue;
    }
  }

  // 2. Vérifier le cache globalThis
  const cache = getInboxFolderCache();
  const cacheKey = `${parentFolderId}/${subfolderName}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[drive] sous-dossier ${subfolderName} : ID trouvé en cache (${cached})`);
    return cached;
  }

  try {
    // 3. Chercher si le sous-dossier existe déjà via files.list
    const escapedName = subfolderName.replace(/'/g, "\\'");
    const query = encodeURIComponent(
      `name='${escapedName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    );
    const searchUrl = `${DRIVE_FILES_API}?q=${query}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    console.log(`[drive] recherche sous-dossier ${subfolderName} dans parent ${parentFolderId}`);

    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      const errorBody = await searchResponse.text().catch(() => '(lecture body impossible)');
      console.error(
        `[drive] search sous-dossier ${subfolderName} ECHOUEE : HTTP ${searchResponse.status} — ${errorBody.slice(0, 300)}`,
      );
      // Ne pas abandonner — tenter la création quand même (le dossier sera peut-être dupliqué,
      // mais c'est mieux que de refuser l'upload)
    } else {
      const searchData = (await searchResponse.json()) as { files?: Array<{ id: string; name: string }> };
      const filesCount = searchData.files?.length ?? 0;
      console.log(`[drive] search sous-dossier ${subfolderName} : ${filesCount} résultat(s)`);

      if (searchData.files && searchData.files.length > 0 && searchData.files[0]) {
        const folderId = searchData.files[0].id;
        console.log(`[drive] sous-dossier ${subfolderName} trouvé : ${folderId}`);
        cache.set(cacheKey, folderId);
        return folderId;
      }
    }

    // 4. Créer le sous-dossier
    console.log(`[drive] création sous-dossier ${subfolderName} dans parent ${parentFolderId}`);

    const createResponse = await fetch(`${DRIVE_FILES_API}?supportsAllDrives=true`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: subfolderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
    });

    if (createResponse.ok) {
      const createData = (await createResponse.json()) as { id?: string };
      if (createData.id) {
        console.log(`[drive] sous-dossier ${subfolderName} créé : ${createData.id}`);
        cache.set(cacheKey, createData.id);
        return createData.id;
      }
    }

    const errorText = await createResponse.text().catch(() => '');
    console.error(`[drive] erreur création sous-dossier ${subfolderName} : HTTP ${createResponse.status} — ${errorText.slice(0, 200)}`);
    return null;
  } catch (err) {
    console.error('[drive] erreur getOrCreateSubfolder :', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Upload un fichier vers le dossier Inbox Drive.
 *
 * Le dossier parent est lu depuis DRIVE_INBOX_FOLDER_ID (env var).
 * Les sous-dossiers (Photos, Notes, Voice, Documents) sont créés à la volée.
 *
 * @param buffer Contenu du fichier
 * @param filename Nom du fichier (ASCII pur)
 * @param subfolder Nom du sous-dossier (Photos, Notes, Voice, Documents)
 * @param mimeType Type MIME du fichier
 */
// ============================================================
// PATCH in-place — édition fichier existant (R5 P0 #99)
// ============================================================

/**
 * Met à jour le contenu d'un fichier Drive existant via PATCH in-place.
 *
 * RÈGLE R5 (P0 #99) — JAMAIS create+delete : casse fileId, wikilinks Obsidian,
 * partages. Toujours PATCH le contenu sur le fileId existant.
 *
 * Endpoint : PATCH /upload/drive/v3/files/{fileId}?uploadType=media
 * Préserve : fileId, mimeType (si non spécifié), partages, wikilinks.
 *
 * @param fileId ID Drive du fichier à mettre à jour
 * @param content Nouveau contenu raw (string ou Buffer)
 * @param mimeType Content-Type du body (ex: "text/markdown")
 * @returns DriveUploadResult avec fileId préservé
 */
export async function updateFileContent(
  fileId: string,
  content: string | Buffer,
  mimeType: string,
): Promise<DriveUploadResult> {
  // Validation inputs
  if (!fileId || typeof fileId !== 'string' || fileId.trim().length === 0) {
    return { success: false, error: 'fileId manquant ou invalide' };
  }
  if (!mimeType || typeof mimeType !== 'string' || mimeType.trim().length === 0) {
    return { success: false, error: 'mimeType manquant ou invalide' };
  }
  if (content === undefined || content === null) {
    return { success: false, error: 'content manquant' };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      error: 'PATCH Drive désactivé — credentials OAuth2 manquants (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)',
    };
  }

  try {
    const bodyBuffer = typeof content === 'string'
      ? Buffer.from(content, 'utf-8')
      : content;

    const url = `${DRIVE_API}/${encodeURIComponent(fileId)}?uploadType=media&fields=id,webViewLink&supportsAllDrives=true`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType,
        'Content-Length': String(bodyBuffer.length),
      },
      body: bodyBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        success: false,
        error: `Drive PATCH ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as { id?: string; webViewLink?: string };
    return {
      success: true,
      fileId: data.id ?? fileId,
      webViewLink: data.webViewLink,
    };
  } catch (err) {
    return {
      success: false,
      error: `Erreur Drive PATCH : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function uploadToInbox(
  buffer: Buffer,
  filename: string,
  subfolder: string,
  mimeType: string,
): Promise<DriveUploadResult> {
  const inboxFolderId = process.env.DRIVE_INBOX_FOLDER_ID;
  if (!inboxFolderId) {
    return {
      success: false,
      error: 'DRIVE_INBOX_FOLDER_ID manquant dans les variables d\'environnement',
    };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      error: 'Upload Inbox désactivé — credentials OAuth2 manquants',
    };
  }

  // Récupérer ou créer le sous-dossier
  const targetFolderId = await getOrCreateSubfolder(accessToken, inboxFolderId, subfolder);
  if (!targetFolderId) {
    return {
      success: false,
      error: `Impossible de créer le sous-dossier ${subfolder} dans Drive`,
    };
  }

  try {
    // Upload multipart (metadata JSON + contenu fichier)
    const metadata = JSON.stringify({
      name: filename,
      parents: [targetFolderId],
      mimeType,
    });

    const boundary = '===issa_inbox_boundary===';
    const body =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      metadata + '\r\n' +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`;
    const footer = `\r\n--${boundary}--`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      buffer,
      Buffer.from(footer, 'utf-8'),
    ]);

    const response = await fetch(`${DRIVE_API}?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`, {
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
      error: `Erreur Drive Inbox : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
