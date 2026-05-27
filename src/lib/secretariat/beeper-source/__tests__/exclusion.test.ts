/**
 * Tests exclusion/inclusion des chats WhatsApp (Beeper).
 * Invariant clé : la liste d'inclusion PRIME sur l'exclusion.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { isExcludedChat } from '../beeper-client';

beforeEach(() => {
  delete process.env.BEEPER_EXCLUDE;
  delete process.env.BEEPER_INCLUDE;
});

describe('isExcludedChat (défauts : exclude=sarani,ubi ; include=reprise sarani)', () => {
  it('exclut un chat « Sarani » standard', () => {
    expect(isExcludedChat('Sarani - Anne-Laure')).toBe(true);
  });

  it('exclut un chat « ubi » (case-insensitive)', () => {
    expect(isExcludedChat('10K Tunnel - Sarani x UBI')).toBe(true);
  });

  it('GARDE « Reprise Sarani » (inclusion prime sur exclusion)', () => {
    expect(isExcludedChat('Reprise Sarani')).toBe(false);
    expect(isExcludedChat('REPRISE SARANI - équipe')).toBe(false);
  });

  it('ne touche pas un chat neutre', () => {
    expect(isExcludedChat('Projet Versi')).toBe(false);
    expect(isExcludedChat('Notaire Henri Barbusse')).toBe(false);
  });
});
