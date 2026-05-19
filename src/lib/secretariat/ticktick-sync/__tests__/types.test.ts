/**
 * Tests types — emptyState, positionKey, resolveProjectName.
 */

import { describe, it, expect } from 'vitest';
import {
  emptyState,
  emptyStats,
  positionKey,
  resolveProjectName,
  PROJECT_NAMES,
  PROJECT_TAG_MAPPING,
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

describe('resolveProjectName', () => {
  it('mappe famille → Personnel', () => {
    expect(resolveProjectName(['famille'])).toBe('Personnel');
  });

  it('mappe versi → Versi', () => {
    expect(resolveProjectName(['versi'])).toBe('Versi');
  });

  it('mappe gradient-one → Gradient One', () => {
    expect(resolveProjectName(['gradient-one'])).toBe('Gradient One');
  });

  it('mappe gradient (alias) → Gradient One', () => {
    expect(resolveProjectName(['gradient'])).toBe('Gradient One');
  });

  it('case-insensitive', () => {
    expect(resolveProjectName(['VERSI'])).toBe('Versi');
  });

  it('fallback Inbox si tag inconnu', () => {
    expect(resolveProjectName(['unknown-xyz'])).toBe('Inbox');
  });

  it('fallback Inbox si pas de tag', () => {
    expect(resolveProjectName([])).toBe('Inbox');
  });

  it('multi-tags : premier match gagne', () => {
    expect(resolveProjectName(['xyz', 'versi', 'issa'])).toBe('Versi');
  });
});

describe('PROJECT_NAMES', () => {
  it('contient les 7 projets dans le bon ordre', () => {
    expect(PROJECT_NAMES).toEqual([
      'Personnel',
      'Versi',
      'ISSA',
      'Gradient One',
      'Immobilier',
      'Sarani',
      'Inbox',
    ]);
  });

  it('Inbox est le fallback (pas de tags mappés)', () => {
    expect(PROJECT_TAG_MAPPING.Inbox).toEqual([]);
  });
});
