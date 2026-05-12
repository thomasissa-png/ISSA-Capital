/**
 * Tests — workflow quittance (machine d'états).
 *
 * Teste les transitions d'état et le cancel.
 * Les appels Drive sont mockés (pas de réseau dans les tests unitaires).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { quittanceWorkflow } from '../../workflows/quittance';

// Mock des dépendances Drive
vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn().mockResolvedValue(null),
  getOrCreateSubfolder: vi.fn().mockResolvedValue(null),
}));

describe('quittanceWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a le type "quittance"', () => {
    expect(quittanceWorkflow.type).toBe('quittance');
  });

  it('a un TTL de 1 heure', () => {
    expect(quittanceWorkflow.ttlMs).toBe(60 * 60 * 1000);
  });

  describe('start', () => {
    it('démarre à l\'étape selecting_locataire', async () => {
      const result = await quittanceWorkflow.start(12345);

      expect(result.newState).not.toBeNull();
      expect(result.newState!.type).toBe('quittance');
      expect(result.newState!.step).toBe('selecting_locataire');
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0]!.text).toContain('locataire');
    });
  });

  describe('cancel', () => {
    it('retourne newState null et un message de confirmation', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'selecting_locataire',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.cancel(12345, state);

      expect(result.newState).toBeNull();
      expect(result.messages[0]!.text).toContain('annulée');
    });
  });

  describe('handlePhoto', () => {
    it('indique que les photos ne sont pas utilisées', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'selecting_locataire',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.handlePhoto(
        12345, state, 'base64data', 'image/jpeg',
      );

      expect(result.newState).toBe(state);
      expect(result.messages[0]!.text).toContain('photos');
    });
  });

  describe('handleVoice', () => {
    it('indique que les vocaux ne sont pas utilisés', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'selecting_locataire',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.handleVoice(
        12345, state, 'base64data', 'audio/ogg',
      );

      expect(result.newState).toBe(state);
      expect(result.messages[0]!.text).toContain('vocaux');
    });
  });

  describe('handleCallback — cancel', () => {
    it('q_cancel annule depuis n\'importe quelle étape', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'confirming_montants',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.handleCallback(12345, state, 'q_cancel');

      expect(result.newState).toBeNull();
      expect(result.messages[0]!.text).toContain('annulée');
    });
  });

  describe('handleMessage — selecting_locataire with Drive unavailable', () => {
    it('signale locataire non trouvé quand Drive inaccessible', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'selecting_locataire',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.handleMessage(12345, state, 'Kenan');

      expect(result.newState).not.toBeNull();
      expect(result.newState!.step).toBe('selecting_locataire');
      expect(result.messages[0]!.text).toContain('non trouvé');
    });
  });
});
