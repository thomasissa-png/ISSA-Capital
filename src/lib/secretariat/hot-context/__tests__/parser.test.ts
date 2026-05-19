/**
 * Tests parser hot-context.md → AST.
 */

import { describe, it, expect } from 'vitest';
import { parseHotContext, serializeHotContext, maintenanceChanged } from '../parser';

const SAMPLE_FULL = `---
budget_tokens: ~500
updated_at: 2026-05-19
---

# Hot context

Préambule libre.

## Je bouge sur (cette semaine)
- Finaliser [[Pacte associés]]
- Préparer [[CR 2026-05-19]]

## J'attends
| Quoi | De qui | Depuis | Note |
| --- | --- | --- | --- |
| Signature acte | [[Maître Dupont]] | 2026-05-15 | deadline 22/05 |

## Décisions en arbitrage
- **Choix fournisseur A/B** — arbitrage avant fin mai

## Maintenance
- Revue hebdo dimanche
- Cap warn 500 tokens
`;

describe('parseHotContext', () => {
  it('détecte les 4 sections et préserve le frontmatter', () => {
    const ast = parseHotContext(SAMPLE_FULL);
    expect(ast.frontmatter).toContain('budget_tokens');
    expect(ast.bouge.heading).toBe('## Je bouge sur (cette semaine)');
    expect(ast.attends.heading).toBe("## J'attends");
    expect(ast.arbitrage.heading).toBe('## Décisions en arbitrage');
    expect(ast.maintenance.heading).toBe('## Maintenance');
  });

  it('préserve le contenu Maintenance bit-à-bit (red line)', () => {
    const ast = parseHotContext(SAMPLE_FULL);
    expect(ast.maintenance.bodyLines.some((l) => l.includes('Revue hebdo'))).toBe(true);
    expect(ast.maintenance.bodyLines.some((l) => l.includes('Cap warn 500'))).toBe(true);
  });

  it('tolère les sections manquantes (fournit des heading par défaut)', () => {
    const content = `# Hot context\n\n## Je bouge sur (cette semaine)\n- item\n`;
    const ast = parseHotContext(content);
    expect(ast.bouge.bodyLines.some((l) => l.includes('item'))).toBe(true);
    expect(ast.attends.heading).toBeTruthy(); // default
    expect(ast.arbitrage.heading).toBeTruthy();
    expect(ast.maintenance.heading).toBeTruthy();
  });

  it("préserve l'ordre des sections via la sérialisation", () => {
    const ast = parseHotContext(SAMPLE_FULL);
    const out = serializeHotContext(ast);
    const bougeIdx = out.indexOf('## Je bouge sur');
    const attendsIdx = out.indexOf("## J'attends");
    const arbitrageIdx = out.indexOf('## Décisions en arbitrage');
    const maintenanceIdx = out.indexOf('## Maintenance');
    expect(bougeIdx).toBeGreaterThan(-1);
    expect(attendsIdx).toBeGreaterThan(bougeIdx);
    expect(arbitrageIdx).toBeGreaterThan(attendsIdx);
    expect(maintenanceIdx).toBeGreaterThan(arbitrageIdx);
  });

  it('préserve UTF-8 (accents) dans les headings et le corps', () => {
    const ast = parseHotContext(SAMPLE_FULL);
    expect(ast.arbitrage.heading).toContain('Décisions');
    expect(ast.bouge.bodyLines.join('\n')).toContain('Finaliser');
  });

  it('parse un fichier vide sans crash', () => {
    const ast = parseHotContext('');
    expect(ast.frontmatter).toBe('');
    expect(ast.bouge.bodyLines).toEqual([]);
    expect(ast.attends.bodyLines).toEqual([]);
  });
});

describe('maintenanceChanged', () => {
  it('retourne false si Maintenance identique', () => {
    const a = parseHotContext(SAMPLE_FULL);
    const b = parseHotContext(SAMPLE_FULL);
    expect(maintenanceChanged(a, b)).toBe(false);
  });

  it('retourne true si une ligne Maintenance change', () => {
    const a = parseHotContext(SAMPLE_FULL);
    const b = parseHotContext(SAMPLE_FULL);
    b.maintenance.bodyLines.push('- Nouvelle ligne intruse');
    expect(maintenanceChanged(a, b)).toBe(true);
  });
});
