/**
 * Tests unitaires — inbox-photo-batch.ts
 *
 * Vérifie le workflow batch photos inbox avec demande de date :
 * - Accumulation de photos avec fenêtre de groupement 8s
 * - Message de demande de date après fermeture de la fenêtre
 * - Parsing des réponses date (raccourcis, formats numériques, français)
 * - Upload du batch avec la date choisie
 * - Timeout 5 min → auto-apply aujourd'hui
 * - Photo pendant état waiting → message "+1 photo"
 * - Annulation du batch via cancelBatch
 *
 * Mock : uploadToInbox, sendTelegramMessage, buildInboxFilename.
 * Timers : vitest fake timers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mocks — déclarés AVANT les imports du module sous test
// ============================================================

vi.mock('../../drive-upload', () => ({
  uploadToInbox: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../telegram', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../inbox', () => ({
  buildInboxFilename: vi.fn(
    (ext: string, caption?: string, _orig?: string, date?: Date) => {
      const d = date ?? new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
      const slug = caption ? `_${caption.replace(/\s+/g, '-').toLowerCase().slice(0, 20)}` : '';
      return `${ts}${slug}.${ext}`;
    },
  ),
}));

// Import APRÈS les mocks
import {
  startOrExtendBatch,
  isWaitingForInboxPhotoDate,
  hasPendingBatch,
  getBatchPhotoCount,
  handleDateReply,
  buildDatePromptMessage,
  cancelBatch,
  parseDateReply,
} from '../inbox-photo-batch';
import { uploadToInbox } from '../../drive-upload';
import { sendTelegramMessage } from '../../telegram';

// ============================================================
// Helpers
// ============================================================

const CHAT_ID = 123456;

function makePhoto(caption?: string) {
  return {
    base64: Buffer.from('fake-photo-data').toString('base64'),
    mimeType: 'image/jpeg' as const,
    caption,
  };
}

function makeVideo() {
  return {
    base64: Buffer.from('fake-video-data').toString('base64'),
    mimeType: 'video/mp4' as const,
  };
}

// ============================================================
// Test suites
// ============================================================

describe('inbox-photo-batch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Nettoyer le batch entre chaque test
    cancelBatch(CHAT_ID);
  });

  afterEach(() => {
    cancelBatch(CHAT_ID);
    vi.useRealTimers();
  });

  // ----------------------------------------------------------
  // Accumulation et fenêtre de groupement
  // ----------------------------------------------------------

  describe('startOrExtendBatch', () => {
    it('crée un batch à la première photo', () => {
      expect(hasPendingBatch(CHAT_ID)).toBe(false);

      startOrExtendBatch(CHAT_ID, makePhoto());

      expect(hasPendingBatch(CHAT_ID)).toBe(true);
      expect(getBatchPhotoCount(CHAT_ID)).toBe(1);
      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(false);
    });

    it('accumule plusieurs photos dans le même batch', () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(CHAT_ID, makePhoto());

      expect(getBatchPhotoCount(CHAT_ID)).toBe(3);
    });

    it('envoie le message de demande de date après 8s sans nouvelle photo', async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());

      // Avancer de 8 secondes
      await vi.advanceTimersByTimeAsync(8_000);

      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledTimes(1);

      const msg = (sendTelegramMessage as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string;
      expect(msg).toContain('1 photo');
      expect(msg).toContain('Quelle date');
      expect(msg).toContain('Aujourd\'hui');
      expect(msg).toContain('Hier');
      expect(msg).toContain('JJ/MM/AAAA');
    });

    it('5 photos en 3s → fusionnées en 1 batch → 1 seul message de demande de date', async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      await vi.advanceTimersByTimeAsync(600);
      startOrExtendBatch(CHAT_ID, makePhoto());
      await vi.advanceTimersByTimeAsync(600);
      startOrExtendBatch(CHAT_ID, makePhoto());
      await vi.advanceTimersByTimeAsync(600);
      startOrExtendBatch(CHAT_ID, makePhoto());
      await vi.advanceTimersByTimeAsync(600);
      startOrExtendBatch(CHAT_ID, makePhoto());

      // Pas encore de message
      expect(sendTelegramMessage).not.toHaveBeenCalled();

      // Avancer les 8s restantes depuis la dernière photo
      await vi.advanceTimersByTimeAsync(8_000);

      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledTimes(1);

      const msg = (sendTelegramMessage as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string;
      expect(msg).toContain('5 photos');
    });

    it('reset le timer à chaque nouvelle photo (photo à 4s ne trigger pas)', async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());

      // Avancer 4s (pas encore 5s)
      await vi.advanceTimersByTimeAsync(4_000);
      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(false);

      // Envoyer une 2e photo — reset le timer
      startOrExtendBatch(CHAT_ID, makePhoto());

      // Avancer 4s de plus (8s total, mais seulement 4s depuis la 2e photo)
      await vi.advanceTimersByTimeAsync(4_000);
      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(false);
      expect(sendTelegramMessage).not.toHaveBeenCalled();

      // Avancer 1s de plus → 5s depuis la dernière photo
      await vi.advanceTimersByTimeAsync(1_000);
      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // Photo pendant l'état waiting_for_date
  // ----------------------------------------------------------

  describe('photo pendant état waitingForDate', () => {
    it('ajoute la photo au batch existant', async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      await vi.advanceTimersByTimeAsync(8_000);
      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(true);
      expect(getBatchPhotoCount(CHAT_ID)).toBe(1);

      // Nouvelle photo pendant l'attente
      startOrExtendBatch(CHAT_ID, makePhoto());
      expect(getBatchPhotoCount(CHAT_ID)).toBe(2);
      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(true);
    });

    it('buildDatePromptMessage affiche le bon count après ajout', async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      await vi.advanceTimersByTimeAsync(8_000);

      startOrExtendBatch(CHAT_ID, makePhoto());
      const count = getBatchPhotoCount(CHAT_ID);
      const msg = buildDatePromptMessage(count);
      expect(msg).toContain('+1 photo');
      expect(msg).toContain('2 photos');
    });
  });

  // ----------------------------------------------------------
  // handleDateReply — parsing et upload
  // ----------------------------------------------------------

  describe('handleDateReply', () => {
    beforeEach(async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(CHAT_ID, makePhoto());
      await vi.advanceTimersByTimeAsync(8_000);
      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(true);
    });

    it('réponse "1" → upload avec date du jour', async () => {
      const result = await handleDateReply(CHAT_ID, '1');

      expect(result.success).toBe(true);
      expect(uploadToInbox).toHaveBeenCalledTimes(2);
      expect(hasPendingBatch(CHAT_ID)).toBe(false);
      // Message de confirmation envoyé par finalizeBatch
      expect(sendTelegramMessage).toHaveBeenCalledTimes(2); // 1 demande date + 1 confirmation
    });

    it('réponse "2" → upload avec date d\'hier', async () => {
      const result = await handleDateReply(CHAT_ID, '2');

      expect(result.success).toBe(true);
      expect(uploadToInbox).toHaveBeenCalledTimes(2);
      expect(hasPendingBatch(CHAT_ID)).toBe(false);
    });

    it('réponse "aujourd\'hui" → upload avec date du jour', async () => {
      const result = await handleDateReply(CHAT_ID, "aujourd'hui");
      expect(result.success).toBe(true);
      expect(uploadToInbox).toHaveBeenCalledTimes(2);
    });

    it('réponse "hier" → upload avec date d\'hier', async () => {
      const result = await handleDateReply(CHAT_ID, 'hier');
      expect(result.success).toBe(true);
      expect(uploadToInbox).toHaveBeenCalledTimes(2);
    });

    it('réponse "12/05/2026" → upload avec cette date', async () => {
      const result = await handleDateReply(CHAT_ID, '12/05/2026');

      expect(result.success).toBe(true);
      expect(uploadToInbox).toHaveBeenCalledTimes(2);

      // Vérifier que la date passée à buildInboxFilename est correcte
      const { buildInboxFilename } = await import('../../inbox');
      const calls = (buildInboxFilename as ReturnType<typeof vi.fn>).mock.calls;
      // Chaque photo appelle buildInboxFilename avec la date parsée
      for (const call of calls) {
        const date = call[3] as Date;
        expect(date.getDate()).toBe(12);
        expect(date.getMonth()).toBe(4); // Mai = 4 (0-based)
        expect(date.getFullYear()).toBe(2026);
      }
    });

    it('réponse invalide → message d\'erreur, état reste actif', async () => {
      const result = await handleDateReply(CHAT_ID, 'nimportequoi');

      expect(result.success).toBe(false);
      expect(result.userMessage).toContain('Format date non reconnu');
      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(true);
      expect(uploadToInbox).not.toHaveBeenCalled();
    });

    it('pas de batch en attente → retourne null userMessage', async () => {
      // Annuler le batch d'abord
      cancelBatch(CHAT_ID);

      const result = await handleDateReply(CHAT_ID, '1');
      expect(result.success).toBe(false);
      expect(result.userMessage).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Timeout 5 min
  // ----------------------------------------------------------

  describe('timeout 5 min', () => {
    it('auto-apply aujourd\'hui après 5 min sans réponse', async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(CHAT_ID, makePhoto());

      // Fermer la fenêtre de groupement
      await vi.advanceTimersByTimeAsync(8_000);
      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(true);
      vi.clearAllMocks();

      // Avancer de 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1_000);

      // Le batch doit avoir été uploadé et nettoyé
      expect(hasPendingBatch(CHAT_ID)).toBe(false);
      expect(uploadToInbox).toHaveBeenCalledTimes(3);

      // Message de timeout envoyé
      expect(sendTelegramMessage).toHaveBeenCalled();
      const lastCall = (sendTelegramMessage as ReturnType<typeof vi.fn>).mock.calls;
      const timeoutMsg = lastCall[lastCall.length - 1]![1] as string;
      expect(timeoutMsg).toContain('Timeout');
      expect(timeoutMsg).toContain('3 photos');
    });
  });

  // ----------------------------------------------------------
  // cancelBatch
  // ----------------------------------------------------------

  describe('cancelBatch', () => {
    it('supprime le batch et nettoie les timers', async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(CHAT_ID, makePhoto());

      expect(hasPendingBatch(CHAT_ID)).toBe(true);

      cancelBatch(CHAT_ID);

      expect(hasPendingBatch(CHAT_ID)).toBe(false);
      expect(getBatchPhotoCount(CHAT_ID)).toBe(0);
    });

    it('ne crash pas si aucun batch', () => {
      expect(() => cancelBatch(CHAT_ID)).not.toThrow();
    });

    it('empêche le timer de groupement de s\'exécuter', async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      cancelBatch(CHAT_ID);

      // Avancer le timer — rien ne devrait se passer
      await vi.advanceTimersByTimeAsync(8_000);
      expect(sendTelegramMessage).not.toHaveBeenCalled();
    });

    it('empêche le timeout de s\'exécuter', async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      await vi.advanceTimersByTimeAsync(8_000);
      vi.clearAllMocks();

      cancelBatch(CHAT_ID);

      // Avancer le timeout — rien ne devrait se passer
      await vi.advanceTimersByTimeAsync(5 * 60 * 1_000);
      expect(uploadToInbox).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // parseDateReply (testé directement)
  // ----------------------------------------------------------

  describe('parseDateReply', () => {
    it('"1" → today', () => {
      const d = parseDateReply('1');
      expect(d).not.toBeNull();
      const now = new Date();
      expect(d!.getDate()).toBe(now.getDate());
      expect(d!.getMonth()).toBe(now.getMonth());
      expect(d!.getFullYear()).toBe(now.getFullYear());
    });

    it('"2" → yesterday', () => {
      const d = parseDateReply('2');
      expect(d).not.toBeNull();
      const yesterday = new Date(Date.now() - 86_400_000);
      expect(d!.getDate()).toBe(yesterday.getDate());
    });

    it('"aujourd\'hui" → today', () => {
      expect(parseDateReply("aujourd'hui")).not.toBeNull();
    });

    it('"auj" → today', () => {
      expect(parseDateReply('auj')).not.toBeNull();
    });

    it('"hier" → yesterday', () => {
      expect(parseDateReply('hier')).not.toBeNull();
    });

    it('"12/05/2026" → 12 mai 2026', () => {
      const d = parseDateReply('12/05/2026');
      expect(d).not.toBeNull();
      expect(d!.getDate()).toBe(12);
      expect(d!.getMonth()).toBe(4);
      expect(d!.getFullYear()).toBe(2026);
    });

    it('"12-05-26" → 12 mai 2026 (année courte)', () => {
      const d = parseDateReply('12-05-26');
      expect(d).not.toBeNull();
      expect(d!.getDate()).toBe(12);
      expect(d!.getMonth()).toBe(4);
      expect(d!.getFullYear()).toBe(2026);
    });

    it('"12 mai 2026" → 12 mai 2026', () => {
      const d = parseDateReply('12 mai 2026');
      expect(d).not.toBeNull();
      expect(d!.getDate()).toBe(12);
      expect(d!.getMonth()).toBe(4);
      expect(d!.getFullYear()).toBe(2026);
    });

    it('"3 décembre 2025" → 3 décembre 2025', () => {
      const d = parseDateReply('3 décembre 2025');
      expect(d).not.toBeNull();
      expect(d!.getDate()).toBe(3);
      expect(d!.getMonth()).toBe(11);
      expect(d!.getFullYear()).toBe(2025);
    });

    it('"31/02/2026" → null (date invalide)', () => {
      expect(parseDateReply('31/02/2026')).toBeNull();
    });

    it('"bonjour" → null', () => {
      expect(parseDateReply('bonjour')).toBeNull();
    });

    it('"" → null (chaîne vide)', () => {
      expect(parseDateReply('')).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // Vidéos dans le batch
  // ----------------------------------------------------------

  describe('vidéos dans le batch', () => {
    it('accepte les vidéos dans le même batch que les photos', async () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(CHAT_ID, makeVideo());

      expect(getBatchPhotoCount(CHAT_ID)).toBe(2);

      await vi.advanceTimersByTimeAsync(8_000);
      expect(isWaitingForInboxPhotoDate(CHAT_ID)).toBe(true);

      const msg = (sendTelegramMessage as ReturnType<typeof vi.fn>).mock.calls[0]![1] as string;
      expect(msg).toContain('2 photos');
    });
  });

  // ----------------------------------------------------------
  // getBatchPhotoCount
  // ----------------------------------------------------------

  describe('getBatchPhotoCount', () => {
    it('retourne 0 si aucun batch', () => {
      expect(getBatchPhotoCount(CHAT_ID)).toBe(0);
    });

    it('retourne le nombre correct après ajout', () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      expect(getBatchPhotoCount(CHAT_ID)).toBe(1);
      startOrExtendBatch(CHAT_ID, makePhoto());
      expect(getBatchPhotoCount(CHAT_ID)).toBe(2);
    });
  });

  // ----------------------------------------------------------
  // buildDatePromptMessage
  // ----------------------------------------------------------

  describe('buildDatePromptMessage', () => {
    it('contient le count et les options', () => {
      const msg = buildDatePromptMessage(5);
      expect(msg).toContain('5 photos');
      expect(msg).toContain('Aujourd\'hui');
      expect(msg).toContain('Hier');
      expect(msg).toContain('JJ/MM/AAAA');
    });

    it('singulier pour 1 photo', () => {
      const msg = buildDatePromptMessage(1);
      // "1 photo" pas "1 photos"
      expect(msg).toMatch(/1 photo[^s]/);
    });
  });

  // ----------------------------------------------------------
  // Isolation entre chatIds
  // ----------------------------------------------------------

  describe('isolation entre chatIds', () => {
    const OTHER_CHAT_ID = 789012;

    afterEach(() => {
      cancelBatch(OTHER_CHAT_ID);
    });

    it('les batchs sont indépendants par chatId', () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(OTHER_CHAT_ID, makePhoto());

      expect(getBatchPhotoCount(CHAT_ID)).toBe(2);
      expect(getBatchPhotoCount(OTHER_CHAT_ID)).toBe(1);
    });

    it('cancel un batch n\'affecte pas l\'autre', () => {
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(OTHER_CHAT_ID, makePhoto());

      cancelBatch(CHAT_ID);

      expect(hasPendingBatch(CHAT_ID)).toBe(false);
      expect(hasPendingBatch(OTHER_CHAT_ID)).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Upload partiel (erreurs)
  // ----------------------------------------------------------

  describe('upload avec erreurs partielles', () => {
    it('message d\'avertissement si certaines photos échouent', async () => {
      const mockUpload = uploadToInbox as ReturnType<typeof vi.fn>;
      mockUpload
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'Drive quota' })
        .mockResolvedValueOnce({ success: true });

      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(CHAT_ID, makePhoto());
      startOrExtendBatch(CHAT_ID, makePhoto());
      await vi.advanceTimersByTimeAsync(8_000);
      vi.clearAllMocks();

      // Re-mock pour l'upload
      mockUpload
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'Drive quota' })
        .mockResolvedValueOnce({ success: true });

      const result = await handleDateReply(CHAT_ID, '1');
      expect(result.success).toBe(true);

      // Le message de confirmation doit mentionner l'erreur partielle
      const calls = (sendTelegramMessage as ReturnType<typeof vi.fn>).mock.calls;
      const confirmMsg = calls[0]![1] as string;
      expect(confirmMsg).toContain('2/3');
      expect(confirmMsg).toContain('Drive quota');
    });
  });
});
