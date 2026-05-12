/**
 * Batch photos inbox avec demande de date à Thomas.
 *
 * Quand Thomas envoie des photos en mode inbox (pas de workflow actif),
 * au lieu d'uploader immédiatement, on bufferise les photos et on
 * demande la date à appliquer pour le nommage.
 *
 * Raison : Telegram iOS strip les EXIF des photos HEIC en mode "Send as file"
 * (conversion HEIC→JPEG client, perte des métadonnées avant arrivée webhook).
 * Le buffer reçu n'a aucune date de prise de vue extractible.
 *
 * Flow :
 *   1. Photo reçue en inbox → startOrExtendBatch()
 *   2. Fenêtre de groupement 8s (reset à chaque nouvelle photo)
 *   3. Fenêtre fermée → message Telegram "quelle date ?"
 *   4. Thomas répond → handleDateReply() → upload batch → nettoyage
 *   5. Timeout 5 min sans réponse → auto-apply aujourd'hui
 */

import { buildInboxFilename } from '../inbox';
import { uploadToInbox } from '../drive-upload';
import { sendTelegramMessage } from '../telegram';

// ============================================================
// Types
// ============================================================

export interface BatchPhoto {
  /** Base64-encoded image/video data */
  base64: string;
  /** MIME type (image/jpeg, video/mp4, etc.) */
  mimeType: string;
  /** Optional caption from Telegram */
  caption?: string;
}

export interface PhotoBatch {
  /** Photos accumulated in this batch */
  photos: BatchPhoto[];
  /** Timer ID for the 8s grouping window */
  groupingTimerId: ReturnType<typeof setTimeout> | null;
  /** Timer ID for the 5 min timeout */
  timeoutTimerId: ReturnType<typeof setTimeout> | null;
  /** Whether we are waiting for Thomas to reply with a date */
  waitingForDate: boolean;
  /** Chat ID (for timeout handler) */
  chatId: number;
  /** Timestamp of batch creation */
  createdAt: number;
}

// ============================================================
// Constantes
// ============================================================

/** Délai d'attente pour accumuler les photos du batch */
const GROUPING_WINDOW_MS = 8_000;

/** Timeout avant auto-apply "aujourd'hui" */
const DATE_REPLY_TIMEOUT_MS = 5 * 60 * 1_000;

/** Sous-dossier inbox pour les photos */
const INBOX_PHOTOS_SUBFOLDER = 'Photos';

// ============================================================
// Cache globalThis — persiste entre les re-évaluations Next.js
// ============================================================

const BATCH_CACHE_KEY = '__issa_inbox_photo_batch__' as const;

function getBatchCache(): Map<number, PhotoBatch> {
  if (!(BATCH_CACHE_KEY in globalThis)) {
    (globalThis as Record<string, unknown>)[BATCH_CACHE_KEY] = new Map<number, PhotoBatch>();
  }
  return (globalThis as Record<string, unknown>)[BATCH_CACHE_KEY] as Map<number, PhotoBatch>;
}

// ============================================================
// API publique — lecture d'état
// ============================================================

/**
 * Vérifie si un batch photo est en attente de date pour ce chatId.
 */
export function isWaitingForInboxPhotoDate(chatId: number): boolean {
  const cache = getBatchCache();
  const batch = cache.get(chatId);
  return batch?.waitingForDate === true;
}

/**
 * Vérifie si un batch photo est en cours d'accumulation pour ce chatId
 * (fenêtre de groupement active, pas encore en attente de date).
 */
export function hasPendingBatch(chatId: number): boolean {
  const cache = getBatchCache();
  return cache.has(chatId);
}

/**
 * Retourne le nombre de photos dans le batch en cours.
 * Retourne 0 si aucun batch n'existe pour ce chatId.
 */
export function getBatchPhotoCount(chatId: number): number {
  const cache = getBatchCache();
  const batch = cache.get(chatId);
  return batch?.photos.length ?? 0;
}

// ============================================================
// API publique — gestion du batch
// ============================================================

/**
 * Ajoute une photo au batch. Si c'est la première, crée le batch.
 * Reset le timer de groupement à chaque appel.
 *
 * Quand le timer de groupement expire (8s sans nouvelle photo),
 * envoie le message de demande de date à Thomas.
 *
 * Si le batch est déjà en état waitingForDate, ajoute quand même
 * la photo et re-affiche les options de date.
 */
export function startOrExtendBatch(
  chatId: number,
  photo: BatchPhoto,
): void {
  const cache = getBatchCache();
  let batch = cache.get(chatId);

  if (!batch) {
    // Nouveau batch
    batch = {
      photos: [],
      groupingTimerId: null,
      timeoutTimerId: null,
      waitingForDate: false,
      chatId,
      createdAt: Date.now(),
    };
    cache.set(chatId, batch);
  }

  // Ajouter la photo
  batch.photos.push(photo);

  if (batch.waitingForDate) {
    // Déjà en attente de date — on va notifier Thomas depuis le webhook
    // (pas besoin de reset le grouping timer, on est déjà passé)
    return;
  }

  // Reset le timer de groupement
  if (batch.groupingTimerId !== null) {
    clearTimeout(batch.groupingTimerId);
  }

  batch.groupingTimerId = setTimeout(() => {
    void onGroupingWindowClosed(chatId);
  }, GROUPING_WINDOW_MS);
}

/**
 * Traite la réponse de Thomas à la demande de date.
 *
 * Retourne un objet { success, userMessage } :
 * - success=true + userMessage de confirmation → date parsée, batch uploadé
 * - success=false + userMessage d'erreur → format invalide, batch intact
 * - success=false + userMessage=null → pas de batch en attente
 */
export async function handleDateReply(
  chatId: number,
  text: string,
): Promise<{ success: boolean; userMessage: string | null }> {
  const cache = getBatchCache();
  const batch = cache.get(chatId);

  if (!batch || !batch.waitingForDate) {
    return { success: false, userMessage: null };
  }

  const parsed = parseDateReply(text);

  if (!parsed) {
    return {
      success: false,
      userMessage: 'Format date non reconnu. Essaie JJ/MM/AAAA, "1", "2" ou "aujourd\'hui".',
    };
  }

  // Date validée — upload le batch
  await finalizeBatch(chatId, parsed);
  return { success: true, userMessage: null };
}

/**
 * Annule le batch en cours (appelé par /cancel, /inbox).
 */
export function cancelBatch(chatId: number): void {
  const cache = getBatchCache();
  const batch = cache.get(chatId);

  if (!batch) return;

  if (batch.groupingTimerId !== null) {
    clearTimeout(batch.groupingTimerId);
  }
  if (batch.timeoutTimerId !== null) {
    clearTimeout(batch.timeoutTimerId);
  }

  cache.delete(chatId);
  console.warn(`[inbox-photo-batch] batch annulé pour chatId=${chatId} (${batch.photos.length} photos supprimées)`);
}

// ============================================================
// Interne — parsing date
// ============================================================

/**
 * Parse la réponse de Thomas pour extraire une date.
 *
 * Formats acceptés :
 * - "1" ou "aujourd'hui" ou "auj" → aujourd'hui
 * - "2" ou "hier" → hier
 * - JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA (séparateurs flexibles)
 * - JJ/MM/AA (année courte)
 * - "JJ mois AAAA" (ex: "12 mai 2026")
 */
export function parseDateReply(text: string): Date | null {
  const trimmed = text.trim().toLowerCase();

  // Raccourcis
  if (trimmed === '1' || trimmed === "aujourd'hui" || trimmed === 'aujourdhui' || trimmed === 'auj') {
    return today();
  }
  if (trimmed === '2' || trimmed === 'hier') {
    return yesterday();
  }

  // Format JJ/MM/AAAA ou JJ-MM-AAAA ou JJ.MM.AAAA
  const numericMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1]!, 10);
    const month = parseInt(numericMatch[2]!, 10);
    let year = parseInt(numericMatch[3]!, 10);

    // Année courte → ajouter 2000
    if (year < 100) {
      year += 2000;
    }

    if (isValidDate(day, month, year)) {
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    return null;
  }

  // Format "JJ mois AAAA" (ex: "12 mai 2026")
  const frenchMonths: Record<string, number> = {
    'janvier': 1, 'février': 2, 'fevrier': 2, 'mars': 3, 'avril': 4,
    'mai': 5, 'juin': 6, 'juillet': 7, 'août': 8, 'aout': 8,
    'septembre': 9, 'octobre': 10, 'novembre': 11, 'décembre': 12, 'decembre': 12,
  };

  const frenchMatch = trimmed.match(/^(\d{1,2})\s+([a-zéûô]+)\s+(\d{4})$/);
  if (frenchMatch) {
    const day = parseInt(frenchMatch[1]!, 10);
    const monthName = frenchMatch[2]!;
    const year = parseInt(frenchMatch[3]!, 10);
    const month = frenchMonths[monthName];

    if (month && isValidDate(day, month, year)) {
      return new Date(year, month - 1, day, 12, 0, 0);
    }
    return null;
  }

  return null;
}

function isValidDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 2020 || year > 2100) return false;

  // Vérification fine via Date
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
}

function yesterday(): Date {
  const now = new Date();
  const y = new Date(now.getTime() - 86_400_000);
  return new Date(y.getFullYear(), y.getMonth(), y.getDate(), 12, 0, 0);
}

// ============================================================
// Interne — fermeture fenêtre groupement
// ============================================================

/**
 * Appelé quand le timer de groupement (8s) expire.
 * Envoie le message de demande de date à Thomas et active le timeout 5 min.
 */
async function onGroupingWindowClosed(chatId: number): Promise<void> {
  const cache = getBatchCache();
  const batch = cache.get(chatId);

  if (!batch) return;

  batch.groupingTimerId = null;
  batch.waitingForDate = true;

  // Démarrer le timeout 5 min
  batch.timeoutTimerId = setTimeout(() => {
    void onDateReplyTimeout(chatId);
  }, DATE_REPLY_TIMEOUT_MS);

  // Envoyer le message de demande de date
  const count = batch.photos.length;
  const mediaLabel = count === 1 ? 'photo' : 'photos';
  const todayStr = formatDateFR(today());
  const yesterdayStr = formatDateFR(yesterday());

  const message = [
    `\u{1F4F7} J'ai reçu ${count} ${mediaLabel}. Quelle date appliquer pour le nommage ?`,
    `1️⃣ Aujourd'hui (${todayStr})`,
    `2️⃣ Hier (${yesterdayStr})`,
    `3️⃣ Autre date (réponds avec JJ/MM/AAAA)`,
  ].join('\n');

  await sendTelegramMessage(chatId, message);
}

/**
 * Appelé quand Thomas ne répond pas après 5 min.
 * Auto-apply la date d'aujourd'hui.
 */
async function onDateReplyTimeout(chatId: number): Promise<void> {
  const cache = getBatchCache();
  const batch = cache.get(chatId);

  if (!batch || !batch.waitingForDate) return;

  const count = batch.photos.length;
  const dateToday = today();

  await finalizeBatch(chatId, dateToday);

  const todayStr = formatDateFR(dateToday);
  const mediaLabel = count === 1 ? 'photo' : 'photos';
  await sendTelegramMessage(
    chatId,
    `⏰ Timeout — ${count} ${mediaLabel} enregistrée${count > 1 ? 's' : ''} à la date du jour (${todayStr}).`,
  );
}

// ============================================================
// Interne — upload du batch
// ============================================================

/**
 * Upload toutes les photos du batch avec la date choisie.
 * Envoie le message de confirmation et nettoie le batch.
 */
async function finalizeBatch(chatId: number, date: Date): Promise<void> {
  const cache = getBatchCache();
  const batch = cache.get(chatId);

  if (!batch) return;

  // Nettoyer les timers
  if (batch.groupingTimerId !== null) {
    clearTimeout(batch.groupingTimerId);
  }
  if (batch.timeoutTimerId !== null) {
    clearTimeout(batch.timeoutTimerId);
  }

  const count = batch.photos.length;
  let successCount = 0;
  let lastError: string | undefined;

  // Extension mapping (même que inbox.ts)
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

  for (let i = 0; i < batch.photos.length; i++) {
    const photo = batch.photos[i]!;
    const isVideo = photo.mimeType.startsWith('video/');
    const ext = extMap[photo.mimeType] ?? (isVideo ? 'mp4' : 'jpg');
    const filename = buildInboxFilename(ext, photo.caption, undefined, date);

    const buffer = Buffer.from(photo.base64, 'base64');
    const result = await uploadToInbox(buffer, filename, INBOX_PHOTOS_SUBFOLDER, photo.mimeType);

    if (result.success) {
      successCount++;
    } else {
      lastError = result.error;
      console.warn(`[inbox-photo-batch] erreur upload photo ${i + 1}/${count} : ${result.error ?? 'inconnue'}`);
    }
  }

  // Supprimer le batch
  cache.delete(chatId);

  // Message de confirmation
  const dateStr = formatDateFR(date);
  const mediaLabel = count === 1 ? 'photo' : 'photos';

  if (successCount === count) {
    await sendTelegramMessage(
      chatId,
      `✅ ${successCount} ${mediaLabel} enregistrée${count > 1 ? 's' : ''} avec la date ${dateStr}.`,
    );
  } else if (successCount > 0) {
    await sendTelegramMessage(
      chatId,
      `⚠️ ${successCount}/${count} ${mediaLabel} enregistrée${successCount > 1 ? 's' : ''} (date ${dateStr}). Dernière erreur : ${lastError ?? 'inconnue'}`,
    );
  } else {
    await sendTelegramMessage(
      chatId,
      `❌ Erreur : aucune photo n'a pu être enregistrée. Dernière erreur : ${lastError ?? 'inconnue'}`,
    );
  }
}

// ============================================================
// Utilitaire format date
// ============================================================

function formatDateFR(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Génère le message de demande de date pour l'afficher depuis le webhook.
 * Utilisé quand une photo arrive pendant l'état waitingForDate
 * (le webhook doit envoyer le message, pas le module).
 */
export function buildDatePromptMessage(photoCount: number): string {
  const mediaLabel = photoCount === 1 ? 'photo' : 'photos';
  const todayStr = formatDateFR(today());
  const yesterdayStr = formatDateFR(yesterday());

  return [
    `\u{1F4F7} +1 photo, le batch fait maintenant ${photoCount} ${mediaLabel}. Quelle date ?`,
    `1️⃣ Aujourd'hui (${todayStr})`,
    `2️⃣ Hier (${yesterdayStr})`,
    `3️⃣ Autre date (réponds avec JJ/MM/AAAA)`,
  ].join('\n');
}
