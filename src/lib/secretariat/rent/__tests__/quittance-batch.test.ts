/**
 * Tests — parseurs batch quittance (sélection locataires + période)
 * et workflow batch (machine d'états).
 *
 * Tests purement unitaires : aucun appel réseau, mocks Drive.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseLocataireSelection,
  parsePeriodeSelection,
  buildNumberedListMessage,
  quittanceWorkflow,
} from '../../workflows/quittance';

// Mock des dépendances Drive
vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn().mockResolvedValue(null),
  getOrCreateSubfolder: vi.fn().mockResolvedValue(null),
}));

// ============================================================
// parseLocataireSelection
// ============================================================

describe('parseLocataireSelection', () => {
  const total = 12;

  describe('"tous" variants', () => {
    it('"tous" → all', () => {
      expect(parseLocataireSelection('tous', total)).toEqual({ type: 'all' });
    });

    it('"*" → all', () => {
      expect(parseLocataireSelection('*', total)).toEqual({ type: 'all' });
    });

    it('"all" → all', () => {
      expect(parseLocataireSelection('all', total)).toEqual({ type: 'all' });
    });

    it('"tout" → all', () => {
      expect(parseLocataireSelection('tout', total)).toEqual({ type: 'all' });
    });

    it('"TOUS" case-insensitive → all', () => {
      expect(parseLocataireSelection('TOUS', total)).toEqual({ type: 'all' });
    });
  });

  describe('numeric indices', () => {
    it('"1,3,5" → indices [1,3,5]', () => {
      const result = parseLocataireSelection('1,3,5', total);
      expect(result).toEqual({ type: 'indices', indices: [1, 3, 5] });
    });

    it('"1-5" → indices [1,2,3,4,5]', () => {
      const result = parseLocataireSelection('1-5', total);
      expect(result).toEqual({ type: 'indices', indices: [1, 2, 3, 4, 5] });
    });

    it('"1, 3-5, 8" → indices [1,3,4,5,8] (mixed)', () => {
      const result = parseLocataireSelection('1, 3-5, 8', total);
      expect(result).toEqual({ type: 'indices', indices: [1, 3, 4, 5, 8] });
    });

    it('deduplicates and sorts', () => {
      const result = parseLocataireSelection('5,3,5,1', total);
      expect(result).toEqual({ type: 'indices', indices: [1, 3, 5] });
    });

    it('"0,5" → error (0 is invalid)', () => {
      const result = parseLocataireSelection('0,5', total);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('0');
      }
    });

    it('"1,15" → error (15 hors range)', () => {
      const result = parseLocataireSelection('1,15', total);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('15');
      }
    });

    it('"5-3" → error (start > end)', () => {
      const result = parseLocataireSelection('5-3', total);
      expect('error' in result).toBe(true);
    });

    it('single number "7" → indices [7]', () => {
      const result = parseLocataireSelection('7', total);
      expect(result).toEqual({ type: 'indices', indices: [7] });
    });
  });

  describe('text search', () => {
    it('"Hella" → search', () => {
      const result = parseLocataireSelection('Hella', total);
      expect(result).toEqual({ type: 'search', query: 'Hella' });
    });

    it('"Jean Pierre" → search', () => {
      const result = parseLocataireSelection('Jean Pierre', total);
      expect(result).toEqual({ type: 'search', query: 'Jean Pierre' });
    });
  });

  describe('edge cases', () => {
    it('empty string → error', () => {
      const result = parseLocataireSelection('', total);
      expect('error' in result).toBe(true);
    });

    it('whitespace only → error', () => {
      const result = parseLocataireSelection('   ', total);
      expect('error' in result).toBe(true);
    });
  });
});

// ============================================================
// parsePeriodeSelection
// ============================================================

describe('parsePeriodeSelection', () => {
  const today = new Date(2026, 4, 12); // 12 mai 2026 (month is 0-indexed)

  describe('single month formats', () => {
    it('"2026-04" → avril 2026', () => {
      const result = parsePeriodeSelection('2026-04', today);
      expect(result).toEqual({ mois: [{ year: 2026, month: 4 }] });
    });

    it('"avril 2026" → avril 2026', () => {
      const result = parsePeriodeSelection('avril 2026', today);
      expect(result).toEqual({ mois: [{ year: 2026, month: 4 }] });
    });

    it('"Avril 2026" (capitalized) → avril 2026', () => {
      const result = parsePeriodeSelection('Avril 2026', today);
      expect(result).toEqual({ mois: [{ year: 2026, month: 4 }] });
    });

    it('"05/2026" → mai 2026', () => {
      const result = parsePeriodeSelection('05/2026', today);
      expect(result).toEqual({ mois: [{ year: 2026, month: 5 }] });
    });
  });

  describe('relative months', () => {
    it('"mois en cours" → mai 2026', () => {
      const result = parsePeriodeSelection('mois en cours', today);
      expect(result).toEqual({ mois: [{ year: 2026, month: 5 }] });
    });

    it('"ce mois" → mai 2026', () => {
      const result = parsePeriodeSelection('ce mois', today);
      expect(result).toEqual({ mois: [{ year: 2026, month: 5 }] });
    });

    it('"mois précédent" → avril 2026', () => {
      const result = parsePeriodeSelection('mois précédent', today);
      expect(result).toEqual({ mois: [{ year: 2026, month: 4 }] });
    });

    it('"mois dernier" → avril 2026', () => {
      const result = parsePeriodeSelection('mois dernier', today);
      expect(result).toEqual({ mois: [{ year: 2026, month: 4 }] });
    });

    it('"mois précédent" en janvier → décembre année précédente', () => {
      const jan = new Date(2026, 0, 15); // 15 janvier 2026
      const result = parsePeriodeSelection('mois précédent', jan);
      expect(result).toEqual({ mois: [{ year: 2025, month: 12 }] });
    });
  });

  describe('multiple months (comma)', () => {
    it('"2026-04,2026-05,2026-06" → 3 mois', () => {
      const result = parsePeriodeSelection('2026-04,2026-05,2026-06', today);
      expect(result).toEqual({
        mois: [
          { year: 2026, month: 4 },
          { year: 2026, month: 5 },
          { year: 2026, month: 6 },
        ],
      });
    });
  });

  describe('range', () => {
    it('"2026-04 à 2026-08" → 5 mois (inclus-inclus)', () => {
      const result = parsePeriodeSelection('2026-04 à 2026-08', today);
      expect('mois' in result).toBe(true);
      if ('mois' in result) {
        expect(result.mois).toHaveLength(5);
        expect(result.mois[0]).toEqual({ year: 2026, month: 4 });
        expect(result.mois[4]).toEqual({ year: 2026, month: 8 });
      }
    });

    it('"avril 2026 à août 2026" → 5 mois', () => {
      const result = parsePeriodeSelection('avril 2026 à août 2026', today);
      expect('mois' in result).toBe(true);
      if ('mois' in result) {
        expect(result.mois).toHaveLength(5);
      }
    });

    it('cross-year range "2025-11 à 2026-02" → 4 mois', () => {
      const result = parsePeriodeSelection('2025-11 à 2026-02', today);
      expect('mois' in result).toBe(true);
      if ('mois' in result) {
        expect(result.mois).toHaveLength(4);
        expect(result.mois[0]).toEqual({ year: 2025, month: 11 });
        expect(result.mois[3]).toEqual({ year: 2026, month: 2 });
      }
    });

    it('reversed range → error', () => {
      const result = parsePeriodeSelection('2026-08 à 2026-04', today);
      expect('error' in result).toBe(true);
    });
  });

  describe('trimestre', () => {
    it('"T1 2026" → jan-fev-mar', () => {
      const result = parsePeriodeSelection('T1 2026', today);
      expect(result).toEqual({
        mois: [
          { year: 2026, month: 1 },
          { year: 2026, month: 2 },
          { year: 2026, month: 3 },
        ],
      });
    });

    it('"T2 2026" → avr-mai-jun', () => {
      const result = parsePeriodeSelection('T2 2026', today);
      expect(result).toEqual({
        mois: [
          { year: 2026, month: 4 },
          { year: 2026, month: 5 },
          { year: 2026, month: 6 },
        ],
      });
    });

    it('"T4 2026" → oct-nov-dec', () => {
      const result = parsePeriodeSelection('T4 2026', today);
      expect(result).toEqual({
        mois: [
          { year: 2026, month: 10 },
          { year: 2026, month: 11 },
          { year: 2026, month: 12 },
        ],
      });
    });
  });

  describe('année complète', () => {
    it('"2026" → 12 mois', () => {
      const result = parsePeriodeSelection('2026', today);
      expect('mois' in result).toBe(true);
      if ('mois' in result) {
        expect(result.mois).toHaveLength(12);
        expect(result.mois[0]).toEqual({ year: 2026, month: 1 });
        expect(result.mois[11]).toEqual({ year: 2026, month: 12 });
      }
    });
  });

  describe('max batch limit (24 mois)', () => {
    it('3 years range → error', () => {
      const result = parsePeriodeSelection('2024-01 à 2026-12', today);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('24');
      }
    });
  });

  describe('edge cases', () => {
    it('empty string → error', () => {
      const result = parsePeriodeSelection('', today);
      expect('error' in result).toBe(true);
    });

    it('invalid format → error', () => {
      const result = parsePeriodeSelection('foobar', today);
      expect('error' in result).toBe(true);
    });

    it('invalid month 13 → error', () => {
      const result = parsePeriodeSelection('2026-13', today);
      expect('error' in result).toBe(true);
    });
  });
});

// ============================================================
// buildNumberedListMessage
// ============================================================

describe('buildNumberedListMessage', () => {
  it('builds a numbered list with aligned numbers', () => {
    const names = ['Alice', 'Bob', 'Charlie'];
    const result = buildNumberedListMessage(names);
    expect(result).toBe('  1. Alice\n  2. Bob\n  3. Charlie');
  });

  it('aligns numbers for 10+ items', () => {
    const names = Array.from({ length: 12 }, (_, i) => `Locataire ${i + 1}`);
    const result = buildNumberedListMessage(names);
    expect(result).toContain(' 1. Locataire 1');
    expect(result).toContain('12. Locataire 12');
  });

  it('handles single item', () => {
    const result = buildNumberedListMessage(['Seul']);
    expect(result).toBe('  1. Seul');
  });
});

// ============================================================
// quittanceWorkflow — machine d'états batch
// ============================================================

describe('quittanceWorkflow (batch)', () => {
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
    it('démarre à l\'étape selecting_locataires', async () => {
      const result = await quittanceWorkflow.start(12345);

      expect(result.newState).not.toBeNull();
      expect(result.newState!.type).toBe('quittance');
      expect(result.newState!.step).toBe('selecting_locataires');
      expect(result.messages.length).toBeGreaterThan(0);
      // Should mention locataire or selection instructions
      expect(result.messages[0]!.text).toMatch(/locataire/i);
    });
  });

  describe('cancel', () => {
    it('retourne newState null', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'selecting_locataires',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.cancel(12345, state);

      expect(result.newState).toBeNull();
      expect(result.messages[0]!.text).toContain('annulée');
    });
  });

  describe('handleCallback — cancel', () => {
    it('q_cancel annule depuis n\'importe quelle étape', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'confirming_recap',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.handleCallback(12345, state, 'q_cancel');

      expect(result.newState).toBeNull();
      expect(result.messages[0]!.text).toContain('annulée');
    });
  });

  describe('handleCallback — launch_batch', () => {
    it('quittance:launch_batch transitions to generating', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'confirming_recap',
        data: { selectedLocataires: [], selectedMois: [] },
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.handleCallback(12345, state, 'quittance:launch_batch');

      expect(result.newState).not.toBeNull();
      expect(result.newState!.step).toBe('generating');
      expect(result.messages[0]!.text).toContain('Génération');
    });

    it('quittance:launch_batch ignored if not in confirming_recap', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'selecting_locataires',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.handleCallback(12345, state, 'quittance:launch_batch');

      // Should NOT transition to generating
      expect(result.newState!.step).toBe('selecting_locataires');
    });
  });

  describe('handlePhoto', () => {
    it('indique que les photos ne sont pas utilisées', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'selecting_locataires',
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
        step: 'selecting_locataires',
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

  describe('handleMessage — selecting_locataires (Drive unavailable)', () => {
    it('signale locataire non trouvé quand Drive inaccessible', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'selecting_locataires',
        data: {},
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.handleMessage(12345, state, 'Kenan');

      expect(result.newState).not.toBeNull();
      expect(result.newState!.step).toBe('selecting_locataires');
      expect(result.messages[0]!.text).toContain('non trouvé');
    });
  });

  describe('handleMessage — selecting_periode', () => {
    it('parses "2026-04 à 2026-05" and moves to confirming_recap', async () => {
      const mockLocataire = {
        nomFichier: 'Test User',
        nomAffiche: 'Test User',
        civilite: null,
        email: null,
        adresseBien: '1 rue test',
        montantLoyer: 500,
        montantCharges: 50,
        dateEntreeBail: null,
        dateFinBail: null,
        moyenPaiement: 'Virement bancaire',
      };

      const state = {
        type: 'quittance' as const,
        step: 'selecting_periode',
        data: {
          selectedLocataires: [mockLocataire],
        } as Record<string, unknown>,
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.handleMessage(12345, state, '2026-04 à 2026-05');

      expect(result.newState).not.toBeNull();
      expect(result.newState!.step).toBe('confirming_recap');
      expect(result.messages[0]!.text).toContain('Récapitulatif');
      expect(result.messages[0]!.text).toContain('2');
      expect(result.messages[0]!.showConfirmation).toBe(true);
    });

    it('rejects invalid period format', async () => {
      const state = {
        type: 'quittance' as const,
        step: 'selecting_periode',
        data: {
          selectedLocataires: [],
        } as Record<string, unknown>,
        startedAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      };

      const result = await quittanceWorkflow.handleMessage(12345, state, 'foobar');

      expect(result.newState!.step).toBe('selecting_periode');
      expect(result.messages[0]!.text).toContain('❌');
    });
  });
});
