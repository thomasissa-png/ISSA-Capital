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
  // Note : on n'utilise plus { pick: [...] } qui en exifr v7 peut renvoyer null
  // même quand les tags existent (limitation des segments lus par le parser optimisé).
  // Le coût CPU d'un parse complet sur un buffer EXIF de quelques Ko est négligeable.
  try {
    const exif = await parse(photoBuffer, { tiff: true, exif: true, translateValues: true, reviveValues: true });
    if (exif) {
      // Dump all tags found so we can see in Replit Logs what's actually in the buffer.
      const tagsFound = Object.keys(exif);
      console.warn(`[inbox-photo] exif tags trouvés (${tagsFound.length}): ${tagsFound.join(', ').slice(0, 200)}`);
    }
    const candidate = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (candidate instanceof Date && !isNaN(candidate.getTime())) {
      console.warn(`[inbox-photo] timestamp source: exif → ${candidate.toISOString()}`);
      return { date: candidate, source: 'exif' };
    }
    if (exif) {
      const dtoType = candidate === undefined ? 'absent' : typeof candidate;
      console.warn(`[inbox-photo] exif présent mais DateTimeOriginal/CreateDate non utilisable (type=${dtoType}, value=${String(candidate).slice(0, 80)})`);
    } else {
      console.warn('[inbox-photo] exif absent dans le buffer (image envoyée en mode photo Telegram, ou re-encodage)');
    }
  } catch (err) {
    // exifr can throw on non-image buffers or images without EXIF — log explicitly
    console.warn(`[inbox-photo] exif parse threw: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Telegram message.date (Unix timestamp in seconds)
  if (telegramMessageDate && telegramMessageDate > 0) {
    const date = new Date(telegramMessageDate * 1000);
    if (!isNaN(date.getTime())) {
      console.warn(`[inbox-photo] timestamp source: telegram → ${date.toISOString()}`);
      return { date, source: 'telegram' };
    }
  }

  // 3. Fallback: now
  const now = new Date();
  console.warn(`[inbox-photo] timestamp source: now → ${now.toISOString()}`);
  return { date: now, source: 'now' };
}
