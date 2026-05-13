/**
 * Tests label-resolver.ts — résolution nom label → labelId.
 *
 * Mock de listLabels pour simuler les réponses Gmail API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveLabelId,
  resolveTraiteLabel,
  resolveARevoir,
  invalidateLabelCache,
  getLabelCacheSize,
} from '../label-resolver';

// Mock listLabels
vi.mock('../gmail-client', () => ({
  listLabels: vi.fn(),
}));

import { listLabels } from '../gmail-client';
const mockListLabels = vi.mocked(listLabels);

describe('label-resolver', () => {
  beforeEach(() => {
    invalidateLabelCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    invalidateLabelCache();
    vi.restoreAllMocks();
  });

  describe('resolveLabelId', () => {
    it('résout un label par nom exact', async () => {
      mockListLabels.mockResolvedValue([
        { id: 'Label_1', name: 'Anya/traité' },
        { id: 'Label_2', name: 'Anya/à-revoir' },
        { id: 'INBOX', name: 'INBOX' },
      ]);

      const result = await resolveLabelId('Anya/traité');
      expect(result).toBe('Label_1');
    });

    it('résout un label par match case-insensitive', async () => {
      mockListLabels.mockResolvedValue([
        { id: 'Label_1', name: 'Anya/traité' },
      ]);

      const result = await resolveLabelId('anya/traité');
      expect(result).toBe('Label_1');
    });

    it('retourne null si label non trouvé', async () => {
      mockListLabels.mockResolvedValue([
        { id: 'INBOX', name: 'INBOX' },
      ]);

      const result = await resolveLabelId('Anya/inexistant');
      expect(result).toBeNull();
    });

    it('cache les résultats (un seul appel API)', async () => {
      mockListLabels.mockResolvedValue([
        { id: 'Label_1', name: 'Anya/traité' },
        { id: 'Label_2', name: 'Anya/à-revoir' },
      ]);

      await resolveLabelId('Anya/traité');
      await resolveLabelId('Anya/à-revoir');

      // Un seul appel API malgré 2 résolutions
      expect(mockListLabels).toHaveBeenCalledTimes(1);
      expect(getLabelCacheSize()).toBe(2);
    });

    it('invalide le cache correctement', async () => {
      mockListLabels.mockResolvedValue([
        { id: 'Label_1', name: 'Anya/traité' },
      ]);

      await resolveLabelId('Anya/traité');
      expect(getLabelCacheSize()).toBe(1);

      invalidateLabelCache();
      expect(getLabelCacheSize()).toBe(0);

      // Nouvel appel API après invalidation
      mockListLabels.mockResolvedValue([
        { id: 'Label_new', name: 'Anya/traité' },
      ]);
      const result = await resolveLabelId('Anya/traité');
      expect(result).toBe('Label_new');
      expect(mockListLabels).toHaveBeenCalledTimes(2);
    });

    it('gère un listing vide', async () => {
      mockListLabels.mockResolvedValue([]);
      const result = await resolveLabelId('Anya/traité');
      expect(result).toBeNull();
    });
  });

  describe('resolveTraiteLabel', () => {
    it('résout le label traité par défaut', async () => {
      mockListLabels.mockResolvedValue([
        { id: 'Label_1', name: 'Anya/traité' },
      ]);

      const result = await resolveTraiteLabel();
      expect(result).toBe('Label_1');
    });

    it('utilise la variable d\'environnement si définie', async () => {
      process.env.GMAIL_LABEL_TRAITE = 'Custom/Done';
      mockListLabels.mockResolvedValue([
        { id: 'Label_custom', name: 'Custom/Done' },
      ]);

      const result = await resolveTraiteLabel();
      expect(result).toBe('Label_custom');

      delete process.env.GMAIL_LABEL_TRAITE;
    });
  });

  describe('resolveARevoir', () => {
    it('résout le label à-revoir par défaut', async () => {
      mockListLabels.mockResolvedValue([
        { id: 'Label_2', name: 'Anya/à-revoir' },
      ]);

      const result = await resolveARevoir();
      expect(result).toBe('Label_2');
    });

    it('utilise la variable d\'environnement si définie', async () => {
      process.env.GMAIL_LABEL_A_REVOIR = 'Custom/Review';
      mockListLabels.mockResolvedValue([
        { id: 'Label_custom_rev', name: 'Custom/Review' },
      ]);

      const result = await resolveARevoir();
      expect(result).toBe('Label_custom_rev');

      delete process.env.GMAIL_LABEL_A_REVOIR;
    });
  });
});
