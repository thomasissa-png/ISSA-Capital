/**
 * Tests pour le workflow bail — machine d'états + parseur de dates.
 *
 * Couvre :
 * - parseDateInput (ISO, FR chiffres, FR texte)
 * - bailWorkflow.start
 * - Sélection locataire (réutilise parseLocataireSelection)
 * - Étapes date_debut, date_signature, confirmation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseDateInput, bailWorkflow } from '../../workflows/bail';

// ============================================================
// Tests : parseDateInput
// ============================================================

describe('parseDateInput', () => {
  it('parse format ISO YYYY-MM-DD', () => {
    const d = parseDateInput('2026-05-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4); // mai = 4
    expect(d!.getDate()).toBe(15);
  });

  it('parse format FR DD/MM/YYYY', () => {
    const d = parseDateInput('15/05/2026');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(15);
  });

  it('parse format FR texte "15 mai 2026"', () => {
    const d = parseDateInput('15 mai 2026');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(4);
    expect(d!.getDate()).toBe(15);
  });

  it('parse "1er janvier 2026"', () => {
    const d = parseDateInput('1er janvier 2026');
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(1);
    expect(d!.getMonth()).toBe(0);
  });

  it('parse "23 août 2024"', () => {
    const d = parseDateInput('23 août 2024');
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(7); // août = 7
    expect(d!.getDate()).toBe(23);
  });

  it('parse "11 avril 2026"', () => {
    const d = parseDateInput('11 avril 2026');
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(3); // avril = 3
    expect(d!.getDate()).toBe(11);
  });

  it('parse "3 février 2025"', () => {
    const d = parseDateInput('3 février 2025');
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(1);
    expect(d!.getDate()).toBe(3);
  });

  it('gère les accents manquants "fevrier"', () => {
    const d = parseDateInput('3 fevrier 2025');
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(1);
  });

  it('gère "decembre" sans accent', () => {
    const d = parseDateInput('25 decembre 2025');
    expect(d).not.toBeNull();
    expect(d!.getMonth()).toBe(11);
  });

  it('retourne null pour entrée invalide', () => {
    expect(parseDateInput('')).toBeNull();
    expect(parseDateInput('demain')).toBeNull();
    expect(parseDateInput('abc')).toBeNull();
  });

  it('retourne null pour mois invalide', () => {
    expect(parseDateInput('2026-13-01')).toBeNull();
    expect(parseDateInput('01/13/2026')).toBeNull();
  });

  it('retourne null pour jour invalide', () => {
    expect(parseDateInput('2026-05-32')).toBeNull();
  });

  it('parse DD/MM/YYYY avec jours à 1 chiffre', () => {
    const d = parseDateInput('5/3/2026');
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(5);
    expect(d!.getMonth()).toBe(2); // mars
  });
});

// ============================================================
// Tests : bailWorkflow.start
// ============================================================

describe('bailWorkflow', () => {
  describe('start', () => {
    it('démarre à l\'étape selecting_locataire', async () => {
      const result = await bailWorkflow.start(123);
      expect(result.newState).not.toBeNull();
      expect(result.newState!.type).toBe('bail');
      expect(result.newState!.step).toBe('selecting_locataire');
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.messages[0]!.text).toContain('Bail meublé');
    });
  });

  describe('handlePhoto', () => {
    it('refuse les photos', async () => {
      const state = {
        type: 'bail' as const,
        step: 'selecting_locataire',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      const result = await bailWorkflow.handlePhoto(123, state, '', '');
      expect(result.messages[0]!.text).toContain('photos ne sont pas utilisées');
    });
  });

  describe('handleVoice', () => {
    it('refuse les vocaux', async () => {
      const state = {
        type: 'bail' as const,
        step: 'selecting_locataire',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      const result = await bailWorkflow.handleVoice(123, state, '', '');
      expect(result.messages[0]!.text).toContain('vocaux ne sont pas utilisés');
    });
  });

  describe('handleCallback', () => {
    it('annule le workflow sur bail_cancel', async () => {
      const state = {
        type: 'bail' as const,
        step: 'confirming_recap',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      const result = await bailWorkflow.handleCallback(123, state, 'bail_cancel');
      expect(result.newState).toBeNull();
      expect(result.messages[0]!.text).toContain('annulé');
    });

    it('retourne action non reconnue pour callback inconnu', async () => {
      const state = {
        type: 'bail' as const,
        step: 'confirming_recap',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      const result = await bailWorkflow.handleCallback(123, state, 'unknown');
      expect(result.messages[0]!.text).toContain('non reconnue');
    });
  });

  describe('cancel', () => {
    it('annule proprement', async () => {
      const state = {
        type: 'bail' as const,
        step: 'selecting_locataire',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      const result = await bailWorkflow.cancel(123, state);
      expect(result.newState).toBeNull();
      expect(result.messages[0]!.text).toContain('annulé');
    });
  });

  describe('handleMessage — selecting_locataire with Drive unavailable', () => {
    it('signale locataire non trouvé quand Drive inaccessible', async () => {
      const state = {
        type: 'bail' as const,
        step: 'selecting_locataire',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      const result = await bailWorkflow.handleMessage(123, state, 'Quelqu\'un');
      expect(result.messages[0]!.text).toContain('non trouvé');
    });

    it('refuse "tous" pour le bail', async () => {
      const state = {
        type: 'bail' as const,
        step: 'selecting_locataire',
        data: { locatairesDisponibles: [{ nom: 'Test', adresse: '' }] },
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };
      const result = await bailWorkflow.handleMessage(123, state, 'tous');
      expect(result.messages[0]!.text).toContain('un seul locataire');
    });
  });
});
