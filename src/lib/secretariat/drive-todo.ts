/**
 * Google Drive — lecture et append du fichier Todo.md dans le vault.
 *
 * Cherche le fichier Todo.md dans le vault Drive de Thomas (dossier racine
 * configuré via DRIVE_VAULT_ROOT_ID ou DRIVE_TODO_FILE_ID pour accès direct).
 *
 * Append une tâche dans la section ## Inbox du fichier Todo.md.
 * Format : `- [ ] {titre} {emoji date}{YYYY-MM-DD}`
 *
 * Règle CLAUDE.md n°23 : "liste tous les enfants + filtre côté code"
 * (Google Drive peut retourner silencieusement 0 résultat si scope insuffisant).
 */

import { getAccessToken } from './drive-upload';

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const TIMEOUT_MS = 10_000;

export interface TodoAppendResult {
  success: boolean;
  error?: string;
}

/**
 * Récupère le contenu texte d'un fichier Google Drive par ID.
 *
 * Si le fichier est au format Google Docs, exporte en text/plain.
 * Si c'est un fichier binaire (ex: .md uploadé), télécharge directement.
 */
async function getFileContent(
  accessToken: string,
  fileId: string,
): Promise<{ success: boolean; content?: string; mimeType?: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // D'abord récupérer les métadonnées pour connaître le mimeType
    const metaResponse = await fetch(
      `${DRIVE_FILES_API}/${fileId}?fields=mimeType,name`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      },
    );

    if (!metaResponse.ok) {
      clearTimeout(timer);
      return { success: false, error: `Drive meta ${metaResponse.status}` };
    }

    const meta = (await metaResponse.json()) as { mimeType?: string; name?: string };
    const fileMimeType = meta.mimeType ?? '';

    let downloadUrl: string;
    if (fileMimeType === 'application/vnd.google-apps.document') {
      // Google Docs → exporter en texte brut
      downloadUrl = `${DRIVE_FILES_API}/${fileId}/export?mimeType=text/plain`;
    } else {
      // Fichier classique (.md, .txt) → télécharger directement
      downloadUrl = `${DRIVE_FILES_API}/${fileId}?alt=media`;
    }

    const contentResponse = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!contentResponse.ok) {
      return { success: false, error: `Drive download ${contentResponse.status}` };
    }

    const content = await contentResponse.text();
    return { success: true, content, mimeType: fileMimeType };
  } catch (err) {
    clearTimeout(timer);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Met à jour le contenu d'un fichier Google Drive par ID.
 *
 * Si le fichier est un Google Doc, utilise l'API media upload
 * avec conversion. Si c'est un fichier classique (.md), upload direct.
 */
async function updateFileContent(
  accessToken: string,
  fileId: string,
  content: string,
  mimeType?: string,
): Promise<{ success: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;

    const response = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType === 'application/vnd.google-apps.document'
          ? 'text/plain'
          : 'text/markdown',
      },
      body: content,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Drive update ${response.status}: ${errorText.slice(0, 200)}` };
    }

    return { success: true };
  } catch (err) {
    clearTimeout(timer);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Recherche le fichier Todo.md dans le vault Drive.
 *
 * Ordre de résolution :
 *   1. DRIVE_TODO_FILE_ID (env var directe) → skip search
 *   2. Recherche par nom "Todo.md" dans DRIVE_VAULT_ROOT_ID
 *   3. Recherche par nom "Todo.md" dans tout le Drive (fallback)
 *
 * Règle CLAUDE.md n°23 : liste-puis-filtre-local pour diagnostic scope.
 */
async function findTodoFileId(
  accessToken: string,
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  // 1. Env var directe
  const directId = process.env.DRIVE_TODO_FILE_ID;
  if (directId) {
    console.warn(`[drive-todo] Todo.md : ID direct via DRIVE_TODO_FILE_ID (${directId})`);
    return { success: true, fileId: directId };
  }

  // 2. Recherche dans le vault root
  const vaultRootId = process.env.DRIVE_VAULT_ROOT_ID;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let query: string;
    if (vaultRootId) {
      query = `name='Todo.md' and '${vaultRootId}' in parents and trashed=false`;
    } else {
      query = `name='Todo.md' and trashed=false`;
    }

    const searchUrl = `${DRIVE_FILES_API}?q=${encodeURIComponent(query)}&fields=files(id,name,parents)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    const response = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return { success: false, error: `Drive search ${response.status}` };
    }

    const data = (await response.json()) as {
      files?: Array<{ id: string; name: string; parents?: string[] }>;
    };

    const files = data.files ?? [];
    console.warn(`[drive-todo] recherche Todo.md : ${files.length} résultat(s) — ${files.map(f => `${f.name} (${f.id})`).join(', ')}`);

    if (files.length === 0) {
      return { success: false, error: 'Todo.md introuvable dans le vault Drive' };
    }

    // Prendre le premier résultat
    return { success: true, fileId: files[0]!.id };
  } catch (err) {
    clearTimeout(timer);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Ajoute une tâche dans la section ## Inbox du fichier Todo.md sur Drive.
 *
 * Format de la ligne ajoutée :
 *   `- [ ] {titre} 📅 {YYYY-MM-DD}`
 *   ou `- [ ] {titre}` si pas de date
 *
 * Si la section ## Inbox n'existe pas, on l'ajoute en fin de fichier.
 */
export async function appendToTodoInbox(
  title: string,
  date?: string,
  description?: string,
): Promise<TodoAppendResult> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      success: false,
      error: 'Drive désactivé — credentials OAuth2 manquants',
    };
  }

  // Trouver le fichier Todo.md
  const findResult = await findTodoFileId(accessToken);
  if (!findResult.success || !findResult.fileId) {
    return {
      success: false,
      error: findResult.error ?? 'Todo.md introuvable',
    };
  }

  // Lire le contenu actuel
  const readResult = await getFileContent(accessToken, findResult.fileId);
  if (!readResult.success || readResult.content === undefined) {
    return {
      success: false,
      error: `Lecture Todo.md échouée : ${readResult.error ?? 'inconnue'}`,
    };
  }

  // Construire la ligne de tâche
  let taskLine = `- [ ] ${title}`;
  if (date) {
    taskLine += ` \u{1F4C5} ${date}`;
  }
  if (description) {
    taskLine += ` — ${description}`;
  }

  // Trouver la section ## Inbox et insérer après
  const content = readResult.content;
  const inboxHeaderRegex = /^## Inbox\s*$/m;
  const inboxMatch = inboxHeaderRegex.exec(content);

  let updatedContent: string;

  if (inboxMatch) {
    // Insérer juste après le header ## Inbox (après le saut de ligne)
    const insertPos = inboxMatch.index + inboxMatch[0].length;
    const afterHeader = content.slice(insertPos);

    // Si le header est suivi d'un saut de ligne, on insère après
    if (afterHeader.startsWith('\n')) {
      updatedContent = content.slice(0, insertPos) + '\n' + taskLine + afterHeader;
    } else {
      updatedContent = content.slice(0, insertPos) + '\n' + taskLine + '\n' + afterHeader;
    }
  } else {
    // Pas de section ## Inbox → ajouter en fin de fichier
    console.warn('[drive-todo] section ## Inbox non trouvée dans Todo.md — ajout en fin de fichier');
    updatedContent = content.trimEnd() + '\n\n## Inbox\n' + taskLine + '\n';
  }

  // Écrire le contenu mis à jour
  const updateResult = await updateFileContent(
    accessToken,
    findResult.fileId,
    updatedContent,
    readResult.mimeType,
  );

  if (!updateResult.success) {
    return {
      success: false,
      error: `Écriture Todo.md échouée : ${updateResult.error ?? 'inconnue'}`,
    };
  }

  console.warn(`[drive-todo] tâche ajoutée à Todo.md > Inbox : ${taskLine}`);
  return { success: true };
}
