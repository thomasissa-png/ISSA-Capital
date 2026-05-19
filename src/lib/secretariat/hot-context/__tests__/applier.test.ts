/**
 * Tests applier — application de patches sur AST.
 * Pas d'accès Drive — utilisation de `applyPatchOnAst` (pure function).
 */

import { describe, it, expect } from 'vitest';
import { applyPatchOnAst, renderPatchLine } from '../applier';
import { parseHotContext, serializeHotContext, maintenanceChanged } from '../parser';
import type { Patch } from '../types';

const SAMPLE = `## Je bouge sur (cette semaine)
- [[Item A]]
- [[Item B]]

## J'attends
| Quoi | De qui | Depuis | Note |
| --- | --- | --- | --- |
| [[Signature acte]] | [[Maître X]] | 2026-05-15 | deadline |

## Décisions en arbitrage
- **[[Choix A]]** — contexte X

## Maintenance
- Revue hebdo
- Cap warn 500
`;

function makePatch(p: Partial<Patch>): Patch {
  return {
    patchId: 'pid',
    signalId: 'sid',
    section: 'bouge',
    action: 'add',
    payload: { text: '[[Nouveau item]]' },
    source: 'telegram',
    sourceId: '123',
    proposedAt: '2026-05-19T10:00:00Z',
    rationale: 'test',
    ...p,
  };
}

describe('applyPatchOnAst — add bouge', () => {
  it('ajoute une nouvelle ligne dans la section bouge', () => {
    const ast = parseHotContext(SAMPLE);
    const patch = makePatch({
      section: 'bouge',
      action: 'add',
      payload: { text: '[[Nouveau item]]' },
    });
    const newAst = applyPatchOnAst(ast, patch);
    expect(newAst).not.toBeNull();
    expect(newAst!.bouge.bodyLines.some((l) => l.includes('Nouveau item'))).toBe(true);
  });
});

describe('applyPatchOnAst — remove bouge', () => {
  it('retire une ligne existante', () => {
    const ast = parseHotContext(SAMPLE);
    const patch = makePatch({
      section: 'bouge',
      action: 'remove',
      payload: { text: '[[Item A]]' },
    });
    const newAst = applyPatchOnAst(ast, patch);
    expect(newAst).not.toBeNull();
    expect(newAst!.bouge.bodyLines.some((l) => l.includes('Item A'))).toBe(false);
    expect(newAst!.bouge.bodyLines.some((l) => l.includes('Item B'))).toBe(true);
  });
});

describe('applyPatchOnAst — add attends (tableau)', () => {
  it('insère une nouvelle ligne tableau après la dernière ligne tableau existante', () => {
    const ast = parseHotContext(SAMPLE);
    const patch = makePatch({
      section: 'attends',
      action: 'add',
      payload: {
        quoi: '[[Validation]]',
        deQui: '[[Notaire]]',
        depuis: '2026-05-19',
      },
    });
    const newAst = applyPatchOnAst(ast, patch);
    expect(newAst).not.toBeNull();
    const rendered = renderPatchLine(patch);
    expect(newAst!.attends.bodyLines.some((l) => l.trim() === rendered.trim())).toBe(true);
  });
});

describe('applyPatchOnAst — remove attends', () => {
  it('retire une ligne tableau existante', () => {
    const ast = parseHotContext(SAMPLE);
    const patch = makePatch({
      section: 'attends',
      action: 'remove',
      payload: {
        quoi: '[[Signature acte]]',
        deQui: '[[Maître X]]',
        depuis: '2026-05-15',
        note: 'deadline',
      },
    });
    const newAst = applyPatchOnAst(ast, patch);
    expect(newAst).not.toBeNull();
    expect(newAst!.attends.bodyLines.some((l) => l.includes('Signature acte'))).toBe(false);
  });
});

describe('applyPatchOnAst — add arbitrage', () => {
  it('ajoute une nouvelle décision', () => {
    const ast = parseHotContext(SAMPLE);
    const patch = makePatch({
      section: 'arbitrage',
      action: 'add',
      payload: { sujet: '[[Choix B]]', contexte: 'arbitrage urgent' },
    });
    const newAst = applyPatchOnAst(ast, patch);
    expect(newAst).not.toBeNull();
    expect(newAst!.arbitrage.bodyLines.some((l) => l.includes('Choix B'))).toBe(true);
  });
});

describe('applyPatchOnAst — Maintenance intouchable (red line)', () => {
  it('aucun patch typé "bouge"/"attends"/"arbitrage" ne modifie Maintenance', () => {
    const ast = parseHotContext(SAMPLE);
    const patch = makePatch({
      section: 'bouge',
      action: 'add',
      payload: { text: '[[Nouvel item]]' },
    });
    const newAst = applyPatchOnAst(ast, patch);
    expect(newAst).not.toBeNull();
    expect(maintenanceChanged(ast, newAst!)).toBe(false);
  });

  it('serializeHotContext préserve Maintenance bit-à-bit', () => {
    const ast = parseHotContext(SAMPLE);
    const patch = makePatch({
      section: 'arbitrage',
      action: 'add',
      payload: { sujet: '[[Sujet new]]', contexte: 'ctx' },
    });
    const newAst = applyPatchOnAst(ast, patch);
    const out = serializeHotContext(newAst!);
    expect(out).toContain('Revue hebdo');
    expect(out).toContain('Cap warn 500');
  });
});

describe('applyPatchOnAst — idempotence', () => {
  it('add d\'une ligne déjà présente = no-op', () => {
    const ast = parseHotContext(SAMPLE);
    const patch = makePatch({
      section: 'bouge',
      action: 'add',
      payload: { text: '[[Item A]]' },
    });
    const newAst = applyPatchOnAst(ast, patch);
    expect(newAst).toBe(ast); // référence identique
  });

  it('remove d\'une ligne inexistante = no-op', () => {
    const ast = parseHotContext(SAMPLE);
    const patch = makePatch({
      section: 'bouge',
      action: 'remove',
      payload: { text: '[[Inexistant]]' },
    });
    const newAst = applyPatchOnAst(ast, patch);
    expect(newAst).toBe(ast);
  });
});
