/**
 * Résolution du timestamp d'une photo pour le nommage des fichiers inbox.
 *
 * Pile de 3 fallback (premier succès gagne) :
 *   1. EXIF DateTimeOriginal / CreateDate (date de prise de vue)
 *   2. Telegram message.date (timestamp d'envoi du message)
 *   3. new Date() (dernier recours)
 *
 * Implémentation différenciée HEIC vs autres formats :
 *   - HEIC (iPhone par défaut) : exifr ne sait pas lire ce format ("Unknown file
 *     format"), on utilise ExifReader qui sait parser les box ISO BMFF.
 *   - JPEG/PNG/WebP/etc. : exifr fonctionne très bien.
 *
 * Détection HEIC par signature de bytes (ftyp + brand), pas par MIME : Telegram
 * et iPhone mentent tous les deux (file_name=IMG_XXXX.JPG, mime=image/heic).
 */

import { parse } from 'exifr';
import ExifReader from 'exifreader';

export interface PhotoTimestamp {
  date: Date;
  source: 'exif' | 'telegram' | 'now';
}

function isHeicBuffer(buf: Buffer, mimeType?: string): boolean {
  // Si le MIME est connu et explicite, faire confiance (Telegram nous le donne)
  if (mimeType && /^image\/(heic|heif|avif)$/i.test(mimeType)) {
    return true;
  }
  if (buf.length < 24) return false;
  if (buf.subarray(4, 8).toString('ascii') !== 'ftyp') return false;
  // Le ftyp box contient le major brand (bytes 8-11) puis les compatible brands.
  // iPhone utilise différents brands selon firmware (heic, heix, mif1, mif2, msf1, ...).
  // Scan des 24 premiers bytes (couvre major brand + 3-4 compatible brands).
  const ftypBox = buf.subarray(8, 24).toString('ascii');
  return /heic|heix|hevc|heim|heis|mif1|msf1|mif2|hevx|avif|heif/i.test(ftypBox);
}

/**
 * Parse une date au format EXIF "YYYY:MM:DD HH:MM:SS" en Date JS.
 */
function parseExifDate(s: string | undefined): Date | null {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`);
  return isNaN(date.getTime()) ? null : date;
}

async function readHeicExifDate(photoBuffer: Buffer): Promise<Date | null> {
  try {
    const tags = ExifReader.load(photoBuffer);
    console.warn(`[inbox-photo] HEIC ExifReader: ${Object.keys(tags).length} tags trouvés`);
    const candidates = [
      tags.DateTimeOriginal?.description,
      tags.CreateDate?.description,
      tags.DateCreated?.description,
      tags.DateTime?.description,
      tags.ModifyDate?.description,
    ];
    for (const c of candidates) {
      const d = parseExifDate(c as string | undefined);
      if (d) return d;
    }
    console.warn('[inbox-photo] HEIC: aucune date utilisable dans les tags');
  } catch (err) {
    console.warn(`[inbox-photo] HEIC ExifReader threw: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

async function readGenericExifDate(photoBuffer: Buffer): Promise<Date | null> {
  try {
    const exif = await parse(photoBuffer, true);
    if (exif) {
      console.warn(`[inbox-photo] exif tags trouvés (${Object.keys(exif).length})`);
    } else {
      console.warn('[inbox-photo] exif absent dans le buffer');
    }
    const candidate = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateCreated ?? exif?.ModifyDate;
    if (candidate instanceof Date && !isNaN(candidate.getTime())) {
      return candidate;
    }
    if (exif && candidate !== undefined) {
      console.warn(`[inbox-photo] exif présent mais date non utilisable (type=${typeof candidate}, value=${String(candidate).slice(0, 80)})`);
    }
  } catch (err) {
    console.warn(`[inbox-photo] exif parse threw: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

export async function resolvePhotoTimestamp(
  photoBuffer: Buffer,
  telegramMessageDate?: number,
  mimeType?: string,
): Promise<PhotoTimestamp> {
  const isHeic = isHeicBuffer(photoBuffer, mimeType);
  console.warn(`[inbox-photo] isHeicBuffer=${isHeic} (mime=${mimeType ?? 'n/a'}, first12=${photoBuffer.subarray(0, 12).toString('ascii').replace(/\0/g, '.').slice(0, 12)})`);
  const exifDate = isHeic
    ? await readHeicExifDate(photoBuffer)
    : await readGenericExifDate(photoBuffer);

  if (exifDate) {
    console.warn(`[inbox-photo] timestamp source: exif → ${exifDate.toISOString()}`);
    return { date: exifDate, source: 'exif' };
  }

  if (telegramMessageDate && telegramMessageDate > 0) {
    const date = new Date(telegramMessageDate * 1000);
    if (!isNaN(date.getTime())) {
      console.warn(`[inbox-photo] timestamp source: telegram → ${date.toISOString()}`);
      return { date, source: 'telegram' };
    }
  }

  const now = new Date();
  console.warn(`[inbox-photo] timestamp source: now → ${now.toISOString()}`);
  return { date: now, source: 'now' };
}
