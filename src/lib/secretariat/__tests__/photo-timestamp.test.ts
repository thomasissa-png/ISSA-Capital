/**
 * Tests unitaires — resolvePhotoTimestamp
 *
 * Vérifie la pile de 3 fallback :
 *   1. EXIF DateTimeOriginal → source 'exif'
 *   2. Telegram message.date → source 'telegram'
 *   3. new Date() → source 'now'
 *
 * Note : Telegram en mode "photo" (pas "fichier") supprime les EXIF.
 * Les tests focalisent donc sur les fallbacks 2 et 3 (les plus fréquents en pratique)
 * et mock exifr pour le fallback 1.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mocks
// ============================================================

const mocks = vi.hoisted(() => ({
  exifrParse: vi.fn(),
}));

vi.mock('exifr', () => ({
  parse: mocks.exifrParse,
}));

// ============================================================
// Import (après les mocks)
// ============================================================

import { resolvePhotoTimestamp } from '../photo-timestamp';

// ============================================================
// Tests
// ============================================================

describe('resolvePhotoTimestamp', () => {
  const fakeBuffer = Buffer.from('not a real photo');

  beforeEach(() => {
    vi.clearAllMocks();
    // Silence console.log in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns EXIF DateTimeOriginal when available', async () => {
    const exifDate = new Date('2025-03-14T10:23:45.000Z');
    mocks.exifrParse.mockResolvedValue({ DateTimeOriginal: exifDate });

    const result = await resolvePhotoTimestamp(fakeBuffer, 1700000000);

    expect(result.source).toBe('exif');
    expect(result.date).toEqual(exifDate);
  });

  it('returns EXIF CreateDate when DateTimeOriginal is absent', async () => {
    const createDate = new Date('2025-01-20T08:00:00.000Z');
    mocks.exifrParse.mockResolvedValue({ CreateDate: createDate });

    const result = await resolvePhotoTimestamp(fakeBuffer, 1700000000);

    expect(result.source).toBe('exif');
    expect(result.date).toEqual(createDate);
  });

  it('prefers DateTimeOriginal over CreateDate', async () => {
    const dto = new Date('2025-03-14T10:00:00.000Z');
    const cd = new Date('2025-03-14T09:00:00.000Z');
    mocks.exifrParse.mockResolvedValue({ DateTimeOriginal: dto, CreateDate: cd });

    const result = await resolvePhotoTimestamp(fakeBuffer);

    expect(result.source).toBe('exif');
    expect(result.date).toEqual(dto);
  });

  it('falls back to Telegram message.date when EXIF is absent', async () => {
    mocks.exifrParse.mockResolvedValue(null);

    // 1700000000 = 2023-11-14T22:13:20.000Z
    const result = await resolvePhotoTimestamp(fakeBuffer, 1700000000);

    expect(result.source).toBe('telegram');
    expect(result.date.toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });

  it('falls back to Telegram when exifr throws', async () => {
    mocks.exifrParse.mockRejectedValue(new Error('Invalid JPEG'));

    const result = await resolvePhotoTimestamp(fakeBuffer, 1700000000);

    expect(result.source).toBe('telegram');
    expect(result.date.toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });

  it('falls back to now when no EXIF and no Telegram date', async () => {
    mocks.exifrParse.mockResolvedValue(null);
    const before = Date.now();

    const result = await resolvePhotoTimestamp(fakeBuffer);

    const after = Date.now();
    expect(result.source).toBe('now');
    expect(result.date.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.date.getTime()).toBeLessThanOrEqual(after);
  });

  it('falls back to now when Telegram date is 0', async () => {
    mocks.exifrParse.mockResolvedValue(null);

    const result = await resolvePhotoTimestamp(fakeBuffer, 0);

    expect(result.source).toBe('now');
  });

  it('falls back to now when Telegram date is negative', async () => {
    mocks.exifrParse.mockResolvedValue(null);

    const result = await resolvePhotoTimestamp(fakeBuffer, -100);

    expect(result.source).toBe('now');
  });

  it('ignores invalid EXIF date (NaN)', async () => {
    mocks.exifrParse.mockResolvedValue({ DateTimeOriginal: new Date('invalid') });

    const result = await resolvePhotoTimestamp(fakeBuffer, 1700000000);

    expect(result.source).toBe('telegram');
  });

  it('ignores non-Date EXIF values', async () => {
    mocks.exifrParse.mockResolvedValue({ DateTimeOriginal: 'not a date' });

    const result = await resolvePhotoTimestamp(fakeBuffer, 1700000000);

    expect(result.source).toBe('telegram');
  });
});
