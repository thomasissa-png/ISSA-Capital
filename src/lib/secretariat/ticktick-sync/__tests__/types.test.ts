/**
 * Tests types — emptyState, positionKey, priorityToProjectName, PROJECT_NAMES.
 *
 * Refacto S18.4 : remplace `resolveProjectName(tags)` par
 * `priorityToProjectName(priority)`. Décision Thomas (S18) : 3 projets par
 * priorité au lieu de 7 par tag.
 */

import { describe, it, expect } from 'vitest';
import {
  emptyState,
  emptyStats,
  positionKey,
  priorityToProjectName,
  PROJECT_NAMES,
} from '../types';

describe('emptyState', () => {
  it('produit un state vide avec version 1', () => {
    const s = emptyState();
    expect(s.version).toBe(1);
    expect(s.tasks).toEqual({});
    expect(s.projects).toEqual({});
    expect(typeof s.lastFullSyncAt).toBe('string');
  });
});

describe('emptyStats', () => {
  it('renvoie un compteur à zéro', () => {
    const s = emptyStats();
    expect(s.scanned).toBe(0);
    expect(s.created).toBe(0);
    expect(s.updated).toBe(0);
    expect(s.completed).toBe(0);
    expect(s.deleted).toBe(0);
    expect(s.skipped).toBe(0);
    expect(s.errors).toBe(0);
    expect(s.errorMessages).toEqual([]);
  });
});

describe('positionKey', () => {
  it('construit "{path}:L{n}"', () => {
    expect(positionKey({ vaultPath: 'Taches/Todo.md', lineNumber: 42 })).toBe(
      'Taches/Todo.md:L42',
    );
  });
});

describe('priorityToProjectName (S18.4)', () => {
  it('5 (⏫ high) → Critique', () => {
    expect(priorityToProjectName(5)).toBe('Critique');
  });

  it('3 (🔼 medium) → Important', () => {
    expect(priorityToProjectName(3)).toBe('Important');
  });

  it('0 (aucun emoji, défaut) → Important', () => {
    expect(priorityToProjectName(0)).toBe('Important');
  });

  it('1 (🔽/⏬ low) → Priorité basse', () => {
    expect(priorityToProjectName(1)).toBe('Priorité basse');
  });
});

describe('PROJECT_NAMES (S18.4)', () => {
  it('contient les 3 projets dans le bon ordre (priorité décroissante)', () => {
    expect(PROJECT_NAMES).toEqual([
      'Critique',
      'Important',
      'Priorité basse',
    ]);
  });

  it('utilise des caractères UTF-8 réels (pas d\'escapes)', () => {
    // Le "é" de "Priorité" doit être un vrai caractère, pas é
    expect(PROJECT_NAMES[2]).toContain('é');
    expect(PROJECT_NAMES[2]?.length).toBe('Priorité basse'.length);
  });
});
