/**
 * Client Telegram Bot API — version allégée pour le webhook Next.js.
 *
 * Fonctionnalités :
 * - Envoi de messages texte (sendMessage)
 * - Envoi de messages avec boutons inline (inline_keyboard)
 * - Acquittement des callback_query
 *
 * Timeout explicite 10s, retry simple (1 retry sur 5xx).
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

export interface TelegramSendResult {
  success: boolean;
  error?: string;
  /** message_id Telegram du message envoyé (présent en cas de succès). */
  messageId?: number;
}

/**
 * Envoie un message texte à un chat Telegram.
 * Tronque à 4096 caractères (limite Telegram).
 */
export async function sendTelegramMessage(
  chatId: number,
  text: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  }

  const safeText =
    text.length > 4096 ? `${text.slice(0, 4084)}… [tronqué]` : text;

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: safeText,
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        return { success: true };
      }

      // Retry uniquement sur 5xx et si c'est la première tentative
      if (response.status >= 500 && attempt === 1) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        error: `Telegram API ${response.status}: ${errorBody.slice(0, 200)}`,
      };
    } catch (err) {
      clearTimeout(timer);

      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { success: false, error: 'Échec après 2 tentatives' };
}

/**
 * Résultat du téléchargement d'une photo Telegram.
 */
export interface TelegramPhotoResult {
  success: boolean;
  /** Image encodée en base64 pour l'API Claude */
  base64?: string;
  /** Type MIME de l'image (image/jpeg par défaut) */
  mimeType?: string;
  error?: string;
}

/**
 * Télécharge une photo Telegram via l'API Bot (getFile + download).
 *
 * Flow :
 * 1. GET getFile → récupère file_path
 * 2. GET file/{file_path} → récupère le binaire
 * 3. Convertit en base64 pour l'API Claude multimodale
 *
 * @param fileId Le file_id de la photo (prendre le dernier du tableau photo[] pour la meilleure résolution)
 */
export async function downloadTelegramPhoto(
  fileId: string,
): Promise<TelegramPhotoResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  }

  // Étape 1 : récupérer le file_path via getFile
  const getFileUrl = `${TELEGRAM_API_BASE}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`;

  const controller1 = new AbortController();
  const timer1 = setTimeout(() => controller1.abort(), TIMEOUT_MS);

  let filePath: string;
  try {
    const response = await fetch(getFileUrl, { signal: controller1.signal });
    clearTimeout(timer1);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        error: `Telegram getFile ${response.status}: ${errorBody.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as {
      ok: boolean;
      result?: { file_path?: string };
    };

    if (!data.ok || !data.result?.file_path) {
      return { success: false, error: 'Telegram getFile : file_path absent' };
    }

    filePath = data.result.file_path;
  } catch (err) {
    clearTimeout(timer1);
    return {
      success: false,
      error: `getFile erreur : ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Étape 2 : télécharger le fichier binaire
  const downloadUrl = `${TELEGRAM_API_BASE}/file/bot${token}/${filePath}`;

  const controller2 = new AbortController();
  const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(downloadUrl, { signal: controller2.signal });
    clearTimeout(timer2);

    if (!response.ok) {
      return {
        success: false,
        error: `Telegram download ${response.status}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Déduire le type MIME depuis l'extension
    let mimeType = 'image/jpeg';
    if (filePath.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (filePath.endsWith('.gif')) {
      mimeType = 'image/gif';
    } else if (filePath.endsWith('.webp')) {
      mimeType = 'image/webp';
    }

    return { success: true, base64, mimeType };
  } catch (err) {
    clearTimeout(timer2);
    return {
      success: false,
      error: `download erreur : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Envoie un aperçu de CR avec boutons inline Valider/Modifier/Annuler.
 *
 * Utilise l'inline keyboard Telegram :
 * https://core.telegram.org/bots/api#inlinekeyboardmarkup
 *
 * @param chatId ID du chat Telegram
 * @param previewText Texte d'aperçu du CR (sera tronqué à 4096 chars)
 */
export async function sendTelegramConfirmation(
  chatId: number,
  previewText: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  }

  const safeText =
    previewText.length > 4096
      ? `${previewText.slice(0, 4084)}… [tronqué]`
      : previewText;

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: safeText,
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Valider', callback_data: 'validate' },
          { text: '✏️ Modifier', callback_data: 'modify' },
          { text: '❌ Annuler', callback_data: 'cancel' },
        ],
      ],
    },
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        return { success: true };
      }

      if (response.status >= 500 && attempt === 1) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        error: `Telegram API ${response.status}: ${errorBody.slice(0, 200)}`,
      };
    } catch (err) {
      clearTimeout(timer);

      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { success: false, error: 'Échec après 2 tentatives' };
}

/**
 * Envoie un document (PDF, etc.) à un chat Telegram via sendDocument.
 *
 * Utilise multipart/form-data pour transmettre le fichier binaire.
 * Timeout explicite 15s (fichiers plus lourds que du texte).
 *
 * @param chatId ID du chat Telegram
 * @param pdfBuffer Buffer contenant le fichier à envoyer
 * @param filename Nom du fichier (ex: "IC-CR-2026-0003.pdf")
 * @param caption Légende optionnelle (max 1024 chars, tronquée si nécessaire)
 */
export async function sendTelegramDocument(
  chatId: number,
  pdfBuffer: Buffer,
  filename: string,
  caption?: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  }

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendDocument`;

  // Construire le FormData multipart
  const formData = new FormData();
  formData.append('chat_id', String(chatId));

  // Créer un Blob à partir du Buffer pour l'API fetch
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('document', blob, filename);

  if (caption) {
    const safeCaption = caption.length > 1024 ? `${caption.slice(0, 1012)}… [tronqué]` : caption;
    formData.append('caption', safeCaption);
  }

  const DOCUMENT_TIMEOUT_MS = 15_000;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOCUMENT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        return { success: true };
      }

      if (response.status >= 500 && attempt === 1) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        error: `Telegram sendDocument ${response.status}: ${errorBody.slice(0, 200)}`,
      };
    } catch (err) {
      clearTimeout(timer);

      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { success: false, error: 'Échec sendDocument après 2 tentatives' };
}

/**
 * Envoie un indicateur "typing" (saisie en cours) sur Telegram.
 * Appelé avant chaque appel Claude pour que l'utilisateur voie que le bot traite.
 * L'indicateur disparaît automatiquement après ~5s ou quand un message est envoyé.
 */
export async function sendTypingAction(chatId: number): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') return;

  await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  }).catch(() => {
    // Best effort — ne jamais bloquer le flow principal
  });
}

/**
 * Télécharge un fichier Telegram via l'API Bot (getFile + download).
 *
 * Fonctionne pour tous les types de fichiers (photos, audio, documents).
 * Flow identique à downloadTelegramPhoto mais avec un MIME type générique.
 *
 * @param fileId Le file_id du fichier Telegram
 */
export async function downloadTelegramFile(
  fileId: string,
): Promise<TelegramPhotoResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  }

  // Étape 1 : récupérer le file_path via getFile
  const getFileUrl = `${TELEGRAM_API_BASE}/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`;

  const controller1 = new AbortController();
  const timer1 = setTimeout(() => controller1.abort(), TIMEOUT_MS);

  let filePath: string;
  try {
    const response = await fetch(getFileUrl, { signal: controller1.signal });
    clearTimeout(timer1);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        error: `Telegram getFile ${response.status}: ${errorBody.slice(0, 200)}`,
      };
    }

    const data = (await response.json()) as {
      ok: boolean;
      result?: { file_path?: string };
    };

    if (!data.ok || !data.result?.file_path) {
      return { success: false, error: 'Telegram getFile : file_path absent' };
    }

    filePath = data.result.file_path;
  } catch (err) {
    clearTimeout(timer1);
    return {
      success: false,
      error: `getFile erreur : ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Étape 2 : télécharger le fichier binaire
  const downloadUrl = `${TELEGRAM_API_BASE}/file/bot${token}/${filePath}`;

  const controller2 = new AbortController();
  const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(downloadUrl, { signal: controller2.signal });
    clearTimeout(timer2);

    if (!response.ok) {
      return {
        success: false,
        error: `Telegram download ${response.status}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Déduire le type MIME depuis l'extension
    let mimeType = 'application/octet-stream';
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    } else if (filePath.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (filePath.endsWith('.gif')) {
      mimeType = 'image/gif';
    } else if (filePath.endsWith('.webp')) {
      mimeType = 'image/webp';
    } else if (filePath.endsWith('.ogg') || filePath.endsWith('.oga')) {
      mimeType = 'audio/ogg';
    } else if (filePath.endsWith('.mp3')) {
      mimeType = 'audio/mpeg';
    } else if (filePath.endsWith('.m4a')) {
      mimeType = 'audio/mp4';
    }

    return { success: true, base64, mimeType };
  } catch (err) {
    clearTimeout(timer2);
    return {
      success: false,
      error: `download erreur : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Acquitte un callback_query Telegram (retire le spinner du bouton).
 */
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  }

  const url = `${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text ?? '',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (response.ok) {
      return { success: true };
    }
    return {
      success: false,
      error: `Telegram API ${response.status}`,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================
// Envoi de message avec boutons inline personnalisés
// ============================================================

export interface InlineButton {
  text: string;
  callback_data: string;
}

/**
 * Envoie un message texte avec des boutons inline personnalisés.
 *
 * Contrairement à sendTelegramConfirmation (boutons Valider/Modifier/Annuler hardcodés),
 * cette fonction accepte un layout de boutons arbitraire.
 *
 * @param chatId ID du chat Telegram
 * @param text Texte du message
 * @param buttons Tableau de rangées de boutons (chaque rangée = tableau de InlineButton)
 */
export async function sendTelegramMessageWithButtons(
  chatId: number,
  text: string,
  buttons: InlineButton[][],
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  }

  const safeText =
    text.length > 4096
      ? `${text.slice(0, 4084)}… [tronqué]`
      : text;

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: safeText,
    reply_markup: {
      inline_keyboard: buttons,
    },
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (response.ok) {
        // Extraire message_id pour usage édit conversationnel (S20.A inbox-router).
        try {
          const data = (await response.json()) as {
            ok?: boolean;
            result?: { message_id?: number };
          };
          const messageId = data.result?.message_id;
          return messageId !== undefined
            ? { success: true, messageId }
            : { success: true };
        } catch {
          return { success: true };
        }
      }

      if (response.status >= 500 && attempt === 1) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      const errorBody = await response.text().catch(() => '');
      return {
        success: false,
        error: `Telegram API ${response.status}: ${errorBody.slice(0, 200)}`,
      };
    } catch (err) {
      clearTimeout(timer);

      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 1_000));
        continue;
      }

      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { success: false, error: 'Échec après 2 tentatives' };
}
