/**
 * Tests hot-context staleness (V0) — logique pure.
 */

import { describe, it, expect } from 'vitest';
import { evaluateStaleness, bumpFrontmatter, parisParts, isoWeekString } from '../staleness';

const BODY = `\n# Hot Context — Semaine du 19 mai 2026\n\n## Je bouge sur (cette semaine)\n\n1. **Famille** — solo avec enfants.\n2. Plans architecte.\n\n## Maintenance\n\n- Cible ~500 tokens.\n`;

function fm(semaine: string | null, date: string | null): string {
  const lines = ['---', 'type: hot-context'];
  if (semaine !== null) lines.push(`semaine: ${semaine}`);
  if (date !== null) lines.push(`date_mise_a_jour: ${date}`);
  lines.push('budget_tokens: ~500', '---');
  return lines.join('\n') + BODY;
}

const NOW = new Date('2026-05-27T10:00:00Z'); // mercredi, Paris 12h CEST, ISO 2026-W22

describe('parisParts / isoWeekString', () => {
  it('calcule la semaine ISO + date Paris', () => {
    const p = parisParts(NOW);
    expect(p.dateStr).toBe('2026-05-27');
    expect(p.isoWeekStr).toBe('2026-W22');
    expect(p.weekday).toBe(3); // mercredi
  });

  it('ISO week d’un lundi de début d’année', () => {
    expect(isoWeekString(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-W02');
  });
});

describe('evaluateStaleness', () => {
  it('semaine passée → warn', () => {
    const v = evaluateStaleness(fm('2026-W21', '2026-05-25'), NOW);
    expect(v.weekStale).toBe(true);
    expect(v.severity).toBe('warn');
    expect(v.currentWeek).toBe('2026-W22');
    expect(v.daysSince).toBe(2);
  });

  it('pas touché depuis > 7 j → critical', () => {
    const v = evaluateStaleness(fm('2026-W21', '2026-05-15'), NOW);
    expect(v.severity).toBe('critical');
    expect(v.daysSince).toBe(12);
  });

  it('semaine courante + date récente → fresh', () => {
    const v = evaluateStaleness(fm('2026-W22', '2026-05-27'), NOW);
    expect(v.severity).toBe('fresh');
    expect(v.weekStale).toBe(false);
  });

  it('frontmatter sans semaine NI date valide → invalid (pas de crash)', () => {
    const v = evaluateStaleness(fm(null, null), NOW);
    expect(v.severity).toBe('invalid');
    expect(v.fileWeek).toBeNull();
  });
});

describe('bumpFrontmatter', () => {
  it('met semaine + date à jour sans toucher au corps (bit-parfait)', () => {
    const before = fm('2026-W21', '2026-05-25');
    const after = bumpFrontmatter(before, '2026-W22', '2026-05-27');
    expect(after).toContain('semaine: 2026-W22');
    expect(after).toContain('date_mise_a_jour: 2026-05-27');
    expect(after).not.toContain('2026-W21');
    // Corps strictement identique
    expect(after.slice(after.indexOf('\n# Hot Context'))).toBe(BODY);
  });

  it('idempotent si déjà à jour', () => {
    const c = fm('2026-W22', '2026-05-27');
    expect(bumpFrontmatter(c, '2026-W22', '2026-05-27')).toBe(c);
  });
});
