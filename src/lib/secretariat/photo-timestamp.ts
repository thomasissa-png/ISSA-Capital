/**
 * Résolution du timestamp d'une photo pour le nommage des fichiers inbox.
 *
 * Pile de 3 fallback (premier succès gagne) :
 *   1. EXIF DateTimeOriginal / CreateDate (date de prise de vue)
 *   2. Telegram message.date (timestamp d'envoi du message)
 *   3. new Date() (dernier recours)
 *
 * Session 11 — Fix : les photos étaient nommées avec la date d'upload
 * au lieu de la date de prise de vue.
 */

import { parse } from 'exifr';

export interface PhotoTimestamp {
  date: Date;
  source: 'exif' | 'telegram' | 'now';
}

/**
 * Détermine la meilleure date possible pour une photo.
 *
 * @param photoBuffer Buffer de la photo (lecture EXIF)
 * @param telegramMessageDate Timestamp Unix Telegram (en secondes)
 * @returns Date + source utilisée
 */
export async function resolvePhotoTimestamp(
  photoBuffer: Buffer,
  telegramMessageDate?: number,
): Promise<PhotoTimestamp> {
  // 1. EXIF DateTimeOriginal ou CreateDate
  try {
    const exif = await parse(photoBuffer, { pick: ['DateTimeOriginal', 'CreateDate'] });
    const candidate = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (candidate instanceof Date && !isNaN(candidate.getTime())) {
      console.log(`[inbox-photo] timestamp source: exif → ${candidate.toISOString()}`);
      return { date: candidate, source: 'exif' };
    }
  } catch {
    // exifr can throw on non-image buffers or images without EXIF — silently fall through
  }

  // 2. Telegram message.date (Unix timestamp in seconds)
  if (telegramMessageDate && telegramMessageDate > 0) {
    const date = new Date(telegramMessageDate * 1000);
    if (!isNaN(date.getTime())) {
      console.log(`[inbox-photo] timestamp source: telegram → ${date.toISOString()}`);
      return { date, source: 'telegram' };
    }
  }

  // 3. Fallback: now
  const now = new Date();
  console.log(`[inbox-photo] timestamp source: now → ${now.toISOString()}`);
  return { date: now, source: 'now' };
}
