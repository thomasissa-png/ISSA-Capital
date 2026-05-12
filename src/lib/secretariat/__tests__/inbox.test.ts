/**
 * Tests unitaires — module inbox (upload Drive sans API Claude).
 *
 * Vérifie :
 * - Photo unique → upload Drive _Inbox/Photos/
 * - Texte court → upload Drive _Inbox/Notes/ avec frontmatter
 * - Vocal → upload Drive _Inbox/Voice/
 * - Document → upload Drive _Inbox/Documents/
 * - Album → naming séquentiel _01, _02, _03
 * - File > 20 Mo → message d'erreur
 * - slugify → ASCII pur
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks
// ============================================================

const mocks = vi.hoisted(() => ({
  uploadToInbox: vi.fn().mockResolvedValue({
    success: true,
    fileId: 'test-file-id',
    webViewLink: 'https://drive.google.com/test',
  }),
}));

vi.mock('@/lib/secretariat/drive-upload', () => ({
  uploadToInbox: mocks.uploadToInbox,
}));

// ============================================================
// Imports (après les mocks)
// ============================================================

import {
  handleInboxPhoto,
  handleInboxText,
  handleInboxVoice,
  handleInboxDocument,
  handleInboxAlbum,
  slugify,
  buildInboxFilename,
} from '../inbox';

// ============================================================
// Tests
// ============================================================

describe('slugify', () => {
  it('convertit les accents en ASCII', () => {
    expect(slugify('Réunion à la café')).toBe('reunion-a-la-cafe');
  });

  it('remplace les caractères spéciaux par des tirets', () => {
    expect(slugify('Hello World! @#$%')).toBe('hello-world');
  });

  it('retire les tirets en début et fin', () => {
    expect(slugify('---hello---')).toBe('hello');
  });

  it('limite la longueur à 50 caractères', () => {
    const longText = 'a'.repeat(100);
    expect(slugify(longText).length).toBeLessThanOrEqual(50);
  });

  it('retourne une chaîne vide pour un texte sans caractères valides', () => {
    expect(slugify('!!!@@@###')).toBe('');
  });

  it('gère les cédilles et trémas', () => {
    expect(slugify('Français naïf')).toBe('francais-naif');
  });
});

describe('buildInboxFilename', () => {
  it('génère un nom avec timestamp et extension', () => {
    const filename = buildInboxFilename('jpg');
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.jpg$/);
  });

  it('ajoute un slug depuis la légende', () => {
    const filename = buildInboxFilename('jpg', 'Photo du restaurant');
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_photo-du-restaurant\.jpg$/);
  });

  it('utilise le nom original si pas de légende', () => {
    const filename = buildInboxFilename('pdf', undefined, 'Contrat_2026.pdf');
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_contrat-2026-pdf\.pdf$/);
  });

  it('ajoute le point si extension sans point', () => {
    const filename = buildInboxFilename('png');
    expect(filename).toContain('.png');
  });
});

describe('handleInboxPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadToInbox.mockResolvedValue({
      success: true,
      fileId: 'test-file-id',
      webViewLink: 'https://drive.google.com/test',
    });
  });

  it('upload une photo vers Drive _Inbox/Photos/', async () => {
    const result = await handleInboxPhoto(12345, 'base64data', 'image/jpeg');

    expect(result.success).toBe(true);
    expect(result.userMessage).toContain('Photo enregistrée');

    expect(mocks.uploadToInbox).toHaveBeenCalledOnce();
    const [, filename, subfolder, mimeType] = mocks.uploadToInbox.mock.calls[0] as [Buffer, string, string, string];
    expect(subfolder).toBe('Photos');
    expect(mimeType).toBe('image/jpeg');
    expect(filename).toMatch(/\.jpg$/);
  });

  it('inclut la légende dans le message de confirmation', async () => {
    const result = await handleInboxPhoto(12345, 'base64data', 'image/jpeg', 'Terrasse du restaurant');

    expect(result.success).toBe(true);
    expect(result.userMessage).toContain('Terrasse du restaurant');
  });

  it('retourne une erreur si le fichier est trop gros', async () => {
    const result = await handleInboxPhoto(12345, 'base64data', 'image/jpeg', undefined, 25 * 1024 * 1024);

    expect(result.success).toBe(false);
    expect(result.userMessage).toContain('trop volumineux');
    expect(mocks.uploadToInbox).not.toHaveBeenCalled();
  });

  it('retourne une erreur si l\'upload Drive échoue', async () => {
    mocks.uploadToInbox.mockResolvedValue({ success: false, error: 'Drive API 500' });

    const result = await handleInboxPhoto(12345, 'base64data', 'image/jpeg');

    expect(result.success).toBe(false);
    expect(result.userMessage).toContain('Erreur upload photo');
  });

  it('mappe correctement les extensions depuis le MIME type', async () => {
    await handleInboxPhoto(12345, 'base64data', 'image/png');
    const filename1 = (mocks.uploadToInbox.mock.calls[0] as [Buffer, string, string, string])[1];
    expect(filename1).toMatch(/\.png$/);

    mocks.uploadToInbox.mockClear();
    await handleInboxPhoto(12345, 'base64data', 'image/webp');
    const filename2 = (mocks.uploadToInbox.mock.calls[0] as [Buffer, string, string, string])[1];
    expect(filename2).toMatch(/\.webp$/);
  });
});

describe('handleInboxText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadToInbox.mockResolvedValue({
      success: true,
      fileId: 'test-file-id',
    });
  });

  it('upload un texte comme note Markdown vers Drive _Inbox/Notes/', async () => {
    const result = await handleInboxText(12345, 'Rappeler Jean-Pierre demain');

    expect(result.success).toBe(true);
    expect(result.userMessage).toBe('Note enregistrée');

    expect(mocks.uploadToInbox).toHaveBeenCalledOnce();
    const [buffer, filename, subfolder, mimeType] = mocks.uploadToInbox.mock.calls[0] as [Buffer, string, string, string];
    expect(subfolder).toBe('Notes');
    expect(mimeType).toBe('text/markdown');
    expect(filename).toMatch(/\.md$/);

    // Vérifier le contenu Markdown avec frontmatter
    const content = buffer.toString('utf-8');
    expect(content).toContain('---');
    expect(content).toContain('source: telegram');
    expect(content).toContain('chat_id: 12345');
    expect(content).toContain('Rappeler Jean-Pierre demain');
  });
});

describe('handleInboxVoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadToInbox.mockResolvedValue({
      success: true,
      fileId: 'test-file-id',
    });
  });

  it('upload un vocal vers Drive _Inbox/Voice/', async () => {
    const result = await handleInboxVoice(12345, 'audio-base64', 'audio/ogg', 15);

    expect(result.success).toBe(true);
    expect(result.userMessage).toContain('Vocal enregistré');
    expect(result.userMessage).toContain('15s');

    expect(mocks.uploadToInbox).toHaveBeenCalledOnce();
    const [, filename, subfolder, mimeType] = mocks.uploadToInbox.mock.calls[0] as [Buffer, string, string, string];
    expect(subfolder).toBe('Voice');
    expect(mimeType).toBe('audio/ogg');
    expect(filename).toMatch(/\.ogg$/);
  });

  it('retourne une erreur si le fichier est trop gros', async () => {
    const result = await handleInboxVoice(12345, 'audio-base64', 'audio/ogg', 300, 25 * 1024 * 1024);

    expect(result.success).toBe(false);
    expect(result.userMessage).toContain('trop volumineux');
  });
});

describe('handleInboxDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadToInbox.mockResolvedValue({
      success: true,
      fileId: 'test-file-id',
    });
  });

  it('upload un document vers Drive _Inbox/Documents/', async () => {
    const result = await handleInboxDocument(12345, 'pdf-base64', 'application/pdf', 'Contrat.pdf');

    expect(result.success).toBe(true);
    expect(result.userMessage).toContain('Document enregistré');
    expect(result.userMessage).toContain('Contrat.pdf');

    expect(mocks.uploadToInbox).toHaveBeenCalledOnce();
    const [, filename, subfolder, mimeType] = mocks.uploadToInbox.mock.calls[0] as [Buffer, string, string, string];
    expect(subfolder).toBe('Documents');
    expect(mimeType).toBe('application/pdf');
    expect(filename).toMatch(/\.pdf$/);
  });

  it('retourne une erreur si le fichier est trop gros', async () => {
    const result = await handleInboxDocument(12345, 'data', 'application/pdf', 'huge.pdf', 25 * 1024 * 1024);

    expect(result.success).toBe(false);
    expect(result.userMessage).toContain('trop volumineux');
  });

  it('utilise .bin comme extension par défaut si pas de nom de fichier', async () => {
    await handleInboxDocument(12345, 'data', 'application/octet-stream');

    const filename = (mocks.uploadToInbox.mock.calls[0] as [Buffer, string, string, string])[1];
    expect(filename).toMatch(/\.bin$/);
  });
});

describe('handleInboxAlbum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploadToInbox.mockResolvedValue({
      success: true,
      fileId: 'test-file-id',
    });
  });

  it('upload un album de 3 photos avec naming séquentiel', async () => {
    const photos = [
      { base64: 'photo1', mimeType: 'image/jpeg' },
      { base64: 'photo2', mimeType: 'image/jpeg' },
      { base64: 'photo3', mimeType: 'image/png' },
    ];

    const result = await handleInboxAlbum(12345, photos, 'Visite appartement');

    expect(result.success).toBe(true);
    expect(result.userMessage).toContain('Album enregistré');
    expect(result.userMessage).toContain('3 photos');

    expect(mocks.uploadToInbox).toHaveBeenCalledTimes(3);

    // Vérifier le naming séquentiel
    const filenames = mocks.uploadToInbox.mock.calls.map((call: unknown[]) => (call as [Buffer, string, string, string])[1]);
    expect(filenames[0]).toMatch(/_01\.jpg$/);
    expect(filenames[1]).toMatch(/_02\.jpg$/);
    expect(filenames[2]).toMatch(/_03\.png$/);

    // Vérifier que le slug de la légende est dans le nom
    expect(filenames[0]).toContain('visite-appartement');
  });

  it('retourne une erreur pour un album vide', async () => {
    const result = await handleInboxAlbum(12345, []);

    expect(result.success).toBe(false);
    expect(result.userMessage).toContain('Album vide');
  });

  it('gère l\'upload partiel (certaines photos échouent)', async () => {
    mocks.uploadToInbox
      .mockResolvedValueOnce({ success: true, fileId: 'id1' })
      .mockResolvedValueOnce({ success: false, error: 'timeout' })
      .mockResolvedValueOnce({ success: true, fileId: 'id3' });

    const photos = [
      { base64: 'photo1', mimeType: 'image/jpeg' },
      { base64: 'photo2', mimeType: 'image/jpeg' },
      { base64: 'photo3', mimeType: 'image/jpeg' },
    ];

    const result = await handleInboxAlbum(12345, photos);

    expect(result.success).toBe(true);
    expect(result.userMessage).toContain('partiellement');
    expect(result.userMessage).toContain('2/3');
  });
});
