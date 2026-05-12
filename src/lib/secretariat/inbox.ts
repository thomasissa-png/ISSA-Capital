/**
 * Mode Inbox — upload direct vers Google Drive sans appel Claude.
 *
 * Quand aucun workflow n'est actif, Anya fonctionne en mode inbox :
 * les photos, textes, vocaux et documents sont uploadés directement
 * dans le dossier Drive _Inbox/ avec sous-dossiers par type.
 *
 * Structure Drive :
 *   _Inbox/
 *   ├── Photos/       ← images (jpg, png, webp…)
 *   ├── Notes/        ← textes courts (fichiers .md avec frontmatter YAML)
 *   ├── Voice/        ← messages vocaux (fichiers .ogg)
 *   └── Documents/    ← documents divers (PDF, etc.)
 *
 * Nommage : YYYY-MM-DD_HH-mm-ss_slug.ext
 * Règle CLAUDE.md n°20 : noms de fichiers en ASCII pur (pas d'accents).
 */

import { uploadToInbox } from './drive-upload';
import { resolvePhotoTimestamp } from './photo-timestamp';

// ============================================================
// Constantes
// ============================================================

/** Taille max fichier Telegram Bot API : 20 MB */
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

/** Longueur max du slug dans le nom de fichier */
const MAX_SLUG_LENGTH = 50;

/** Sous-dossiers inbox dans Drive */
const INBOX_SUBFOLDER = {
  PHOTOS: 'Photos',
  NOTES: 'Notes',
  VOICE: 'Voice',
  DOCUMENTS: 'Documents',
} as const;

// ============================================================
// Utilitaires
// ============================================================

/**
 * Convertit un texte en slug ASCII pur (règle CLAUDE.md n°20).
 * Supprime accents, caractères spéciaux, limite la longueur.
 */
export function slugify(text: string): string {
  return text
    // Décomposer les caractères accentués (NFD) puis retirer les diacritiques
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Remplacer les caractères non-ASCII/non-alphanumériques par des tirets
    .replace(/[^a-zA-Z0-9]+/g, '-')
    // Retirer les tirets en début/fin
    .replace(/^-+|-+$/g, '')
    // Tout en minuscules
    .toLowerCase()
    // Limiter la longueur
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * Génère un nom de fichier inbox avec timestamp ISO.
 * Format : YYYY-MM-DD_HH-mm-ss[_slug].ext
 *
 * @param extension Extension du fichier (avec ou sans point)
 * @param caption Légende optionnelle (utilisée comme slug)
 * @param originalName Nom de fichier original (fallback slug)
 * @param date Date à utiliser pour le timestamp (défaut: now)
 */
export function buildInboxFilename(
  extension: string,
  caption?: string,
  originalName?: string,
  date?: Date,
): string {
  const now = date ?? new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');

  const timestamp = [
    now.getFullYear(),
    '-', pad(now.getMonth() + 1),
    '-', pad(now.getDate()),
    '_', pad(now.getHours()),
    '-', pad(now.getMinutes()),
    '-', pad(now.getSeconds()),
  ].join('');

  // Slug optionnel depuis la légende ou le nom original
  const slugSource = caption ?? originalName ?? '';
  const slug = slugify(slugSource);

  const cleanExt = extension.startsWith('.') ? extension : `.${extension}`;

  if (slug.length > 0) {
    return `${timestamp}_${slug}${cleanExt}`;
  }
  return `${timestamp}${cleanExt}`;
}

/**
 * Vérifie la taille du fichier.
 * Retourne un message d'erreur si trop gros, null sinon.
 */
function checkFileSize(fileSize: number | undefined): string | null {
  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
    return `Fichier trop volumineux (${sizeMB} Mo). Limite Telegram : 20 Mo.`;
  }
  return null;
}

// ============================================================
// Handlers inbox par type de contenu
// ============================================================

/**
 * Résultat d'un upload inbox.
 */
export interface InboxResult {
  success: boolean;
  /** Message de confirmation ou d'erreur à envoyer à l'utilisateur */
  userMessage: string;
}

/**
 * Traite une photo en mode inbox → upload vers Drive _Inbox/Photos/
 *
 * Le timestamp du nom de fichier est résolu via la pile de fallback :
 * EXIF DateTimeOriginal → Telegram message.date → now
 *
 * @param telegramMessageDate Timestamp Unix Telegram (secondes) — fallback 2
 */
export async function handleInboxPhoto(
  _chatId: number,
  photoBase64: string,
  mimeType: string,
  caption?: string,
  fileSize?: number,
  telegramMessageDate?: number,
  telegramSourceType?: 'photo' | 'document' | 'video',
): Promise<InboxResult> {
  // Vérification taille
  const sizeError = checkFileSize(fileSize);
  if (sizeError) {
    return { success: false, userMessage: sizeError };
  }

  // Extension depuis le MIME type (images + vidéos — même dossier Photos)
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/webm': 'webm',
  };
  const isVideo = mimeType.startsWith('video/');
  const ext = extMap[mimeType] ?? (isVideo ? 'mp4' : 'jpg');
  console.warn(`[handleInboxPhoto] reçu: mime=${mimeType} source=${telegramSourceType ?? 'unknown'} size=${fileSize ?? 'n/a'} ext_choisie=${ext}`);

  const buffer = Buffer.from(photoBase64, 'base64');

  // Résoudre le timestamp via EXIF → Telegram → now
  const { date, source } = await resolvePhotoTimestamp(buffer, telegramMessageDate, mimeType);
  const filename = buildInboxFilename(ext, caption, undefined, date);

  const result = await uploadToInbox(buffer, filename, INBOX_SUBFOLDER.PHOTOS, mimeType);

  const mediaLabel = isVideo ? 'Vidéo' : 'Photo';

  if (result.success) {
    const captionInfo = caption ? ` (${caption.slice(0, 30)})` : '';
    const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const sourceLabel =
      source === 'exif'
        ? 'date EXIF de prise de vue'
        : source === 'telegram'
          ? 'date d’envoi Telegram (EXIF absent)'
          : 'date du jour (aucune source fiable)';
    const sourceTypeLabel =
      telegramSourceType === 'document'
        ? 'mode fichier (EXIF préservé)'
        : telegramSourceType === 'photo'
          ? 'mode photo (EXIF supprimé par Telegram)'
          : telegramSourceType === 'video'
            ? 'vidéo (pas d’EXIF)'
            : 'mode inconnu';
    return {
      success: true,
      userMessage: `${mediaLabel} enregistrée${captionInfo}\nReçu en : ${sourceTypeLabel}\nDate utilisée : ${dateStr} (${sourceLabel})`,
    };
  }

  return {
    success: false,
    userMessage: `Erreur upload ${mediaLabel.toLowerCase()} : ${result.error ?? 'inconnue'}`,
  };
}

/**
 * Traite un texte court en mode inbox → upload vers Drive _Inbox/Notes/
 * Le texte est wrappé dans un fichier Markdown avec frontmatter YAML.
 */
export async function handleInboxText(
  chatId: number,
  text: string,
): Promise<InboxResult> {
  const now = new Date();
  const dateIso = now.toISOString();

  // Frontmatter YAML + contenu
  const markdown = [
    '---',
    `date: "${dateIso}"`,
    `source: telegram`,
    `chat_id: ${String(chatId)}`,
    '---',
    '',
    text,
    '',
  ].join('\n');

  const filename = buildInboxFilename('md', text);
  const buffer = Buffer.from(markdown, 'utf-8');

  const result = await uploadToInbox(buffer, filename, INBOX_SUBFOLDER.NOTES, 'text/markdown');

  if (result.success) {
    return {
      success: true,
      userMessage: `Note enregistrée`,
    };
  }

  return {
    success: false,
    userMessage: `Erreur upload note : ${result.error ?? 'inconnue'}`,
  };
}

/**
 * Traite un message vocal en mode inbox → upload vers Drive _Inbox/Voice/
 */
export async function handleInboxVoice(
  _chatId: number,
  audioBase64: string,
  audioMimeType: string,
  duration?: number,
  fileSize?: number,
): Promise<InboxResult> {
  const sizeError = checkFileSize(fileSize);
  if (sizeError) {
    return { success: false, userMessage: sizeError };
  }

  // Extension depuis le MIME type
  const extMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
  };
  const ext = extMap[audioMimeType] ?? 'ogg';

  const durationLabel = duration ? `${duration}s` : undefined;
  const filename = buildInboxFilename(ext, durationLabel);
  const buffer = Buffer.from(audioBase64, 'base64');

  const result = await uploadToInbox(buffer, filename, INBOX_SUBFOLDER.VOICE, audioMimeType);

  if (result.success) {
    const durationInfo = duration ? ` (${duration}s)` : '';
    return {
      success: true,
      userMessage: `Vocal enregistré${durationInfo}`,
    };
  }

  return {
    success: false,
    userMessage: `Erreur upload vocal : ${result.error ?? 'inconnue'}`,
  };
}

/**
 * Traite un document en mode inbox → upload vers Drive _Inbox/Documents/
 */
export async function handleInboxDocument(
  _chatId: number,
  fileBase64: string,
  mimeType: string,
  originalFilename?: string,
  fileSize?: number,
): Promise<InboxResult> {
  const sizeError = checkFileSize(fileSize);
  if (sizeError) {
    return { success: false, userMessage: sizeError };
  }

  // Extraire l'extension du nom de fichier original ou utiliser une valeur par défaut
  let ext = 'bin';
  if (originalFilename) {
    const dotIdx = originalFilename.lastIndexOf('.');
    if (dotIdx > 0) {
      ext = originalFilename.slice(dotIdx + 1).toLowerCase();
    }
  }

  const filename = buildInboxFilename(ext, undefined, originalFilename);
  const buffer = Buffer.from(fileBase64, 'base64');

  const result = await uploadToInbox(buffer, filename, INBOX_SUBFOLDER.DOCUMENTS, mimeType);

  if (result.success) {
    const nameInfo = originalFilename ? ` (${originalFilename.slice(0, 40)})` : '';
    return {
      success: true,
      userMessage: `Document enregistré${nameInfo}`,
    };
  }

  return {
    success: false,
    userMessage: `Erreur upload document : ${result.error ?? 'inconnue'}`,
  };
}

/**
 * Traite un album de photos (media_group_id) → batch upload vers Drive _Inbox/Photos/
 * Les photos sont nommées avec un suffixe séquentiel : _01, _02, _03…
 *
 * Le timestamp est résolu via la première photo de l'album (EXIF → Telegram → now).
 * Toutes les photos de l'album partagent le même timestamp de base.
 *
 * @param telegramMessageDate Timestamp Unix Telegram (secondes) — fallback 2
 */
export async function handleInboxAlbum(
  _chatId: number,
  photos: Array<{ base64: string; mimeType: string }>,
  commonCaption?: string,
  telegramMessageDate?: number,
): Promise<InboxResult> {
  if (photos.length === 0) {
    return { success: false, userMessage: 'Album vide.' };
  }

  // Résoudre le timestamp via la première photo de l'album
  const firstBuffer = Buffer.from(photos[0]!.base64, 'base64');
  const { date: resolvedDate } = await resolvePhotoTimestamp(firstBuffer, telegramMessageDate, photos[0]!.mimeType);

  const pad = (n: number): string => String(n).padStart(2, '0');

  const timestamp = [
    resolvedDate.getFullYear(),
    '-', pad(resolvedDate.getMonth() + 1),
    '-', pad(resolvedDate.getDate()),
    '_', pad(resolvedDate.getHours()),
    '-', pad(resolvedDate.getMinutes()),
    '-', pad(resolvedDate.getSeconds()),
  ].join('');

  const slug = commonCaption ? `_${slugify(commonCaption)}` : '';
  let successCount = 0;
  let lastError: string | undefined;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]!;
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const ext = extMap[photo.mimeType] ?? 'jpg';
    const seqSuffix = `_${pad(i + 1)}`;
    const filename = `${timestamp}${slug}${seqSuffix}.${ext}`;
    const buffer = Buffer.from(photo.base64, 'base64');

    const result = await uploadToInbox(buffer, filename, INBOX_SUBFOLDER.PHOTOS, photo.mimeType);
    if (result.success) {
      successCount++;
    } else {
      lastError = result.error;
    }
  }

  if (successCount === photos.length) {
    return {
      success: true,
      userMessage: `Album enregistré (${successCount} photos)`,
    };
  }

  if (successCount > 0) {
    return {
      success: true,
      userMessage: `Album partiellement enregistré (${successCount}/${photos.length} photos). Dernière erreur : ${lastError ?? 'inconnue'}`,
    };
  }

  return {
    success: false,
    userMessage: `Erreur upload album : ${lastError ?? 'inconnue'}`,
  };
}
