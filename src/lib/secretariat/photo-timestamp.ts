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
import sharp from 'sharp';

export interface PhotoTimestamp {
  date: Date;
  source: 'exif' | 'telegram' | 'now';
}

/**
 * Détecte un container HEIC/HEIF par signature ISO BMFF.
 * Plus fiable que le MIME type (Telegram peut mentir, iPhone aussi).
 */
function isHeicBuffer(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf.subarray(4, 8).toString('ascii') !== 'ftyp') return false;
  const brand = buf.subarray(8, 12).toString('ascii');
  return ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1', 'hevx'].includes(brand);
}

/**
 * Pour HEIC, exifr lit le thumbnail JPEG embarqué (tags JFIF) et rate
 * les vraies métadonnées EXIF stockées dans les box ISO BMFF du container.
 * Sharp sait lire ces box et extrait le buffer EXIF brut, qu'on passe
 * ensuite à exifr pour parsing.
 */
async function extractExifBuffer(photoBuffer: Buffer): Promise<Buffer> {
  if (!isHeicBuffer(photoBuffer)) {
    return photoBuffer;
  }
  try {
    const metadata = await sharp(photoBuffer).metadata();
    if (metadata.exif && metadata.exif.length > 0) {
      console.warn(`[inbox-photo] HEIC détecté, EXIF extrait via sharp (${metadata.exif.length} bytes)`);
      return metadata.exif;
    }
    console.warn('[inbox-photo] HEIC détecté mais sharp.metadata().exif est absent');
  } catch (err) {
    console.warn(`[inbox-photo] sharp metadata a échoué sur HEIC: ${err instanceof Error ? err.message : String(err)}`);
  }
  return photoBuffer;
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
  // exifr v7 lit bien les JPEG, mais sur HEIC il s'arrête sur le thumbnail JPEG
  // embarqué et rate les vraies métadonnées EXIF du container ISO BMFF.
  // Solution : pour HEIC, on extrait le buffer EXIF brut via sharp d'abord.
  try {
    const bufferToParse = await extractExifBuffer(photoBuffer);
    const exif = await parse(bufferToParse, true);
    if (exif) {
      const tagsFound = Object.keys(exif);
      console.warn(`[inbox-photo] exif tags trouvés (${tagsFound.length}): ${tagsFound.join(', ').slice(0, 200)}`);
    }
    // iPhone HEIC peut utiliser CreateDate, DateTimeOriginal, ou DateCreated selon le firmware.
    const candidate = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateCreated ?? exif?.ModifyDate;
    if (candidate instanceof Date && !isNaN(candidate.getTime())) {
      console.warn(`[inbox-photo] timestamp source: exif → ${candidate.toISOString()}`);
      return { date: candidate, source: 'exif' };
    }
    if (exif) {
      const dtoType = candidate === undefined ? 'absent' : typeof candidate;
      console.warn(`[inbox-photo] exif présent mais date non utilisable (type=${dtoType}, value=${String(candidate).slice(0, 80)})`);
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
