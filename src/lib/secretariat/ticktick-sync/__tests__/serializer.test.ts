/**
 * Tests serializer — round-trip parseTaskLine ↔ serializeTaskToLine.
 *
 * La sérialisation doit être réversible (modulo whitespace cosmétique).
 */

import { describe, it, expect } from 'vitest';
import { parseTaskLine } from '../parser';
import { serializeTaskToLine } from '../serializer';
import type { TaskPosition } from '../types';

const POS: TaskPosition = { vaultPath: 'Taches/Todo.md', lineNumber: 1 };

function roundTrip(line: string) {
  const parsed = parseTaskLine(line, POS);
  if (!parsed) throw new Error(`parse returned null for: ${line}`);
  const serialized = serializeTaskToLine(parsed);
  const reparsed = parseTaskLine(serialized, POS);
  return { parsed, serialized, reparsed };
}

describe('serializeTaskToLine — round-trip', () => {
  it('round-trip ligne simple', () => {
    const { parsed, reparsed } = roundTrip('- [ ] Appeler Maxime');
    expect(reparsed).toEqual(parsed);
  });

  it('round-trip avec date', () => {
    const { parsed, reparsed } = roundTrip('- [ ] datée 📅 2026-05-19');
    expect(reparsed!.title).toBe(parsed.title);
    expect(reparsed!.dueDate).toBe(parsed.dueDate);
    expect(reparsed!.isAllDay).toBe(true);
  });

  it('round-trip avec date + heure', () => {
    const { parsed, reparsed } = roundTrip('- [ ] meeting 📅 2026-05-19 ⏰ 09:30');
    expect(reparsed!.dueDate).toBe(parsed.dueDate);
    expect(reparsed!.isAllDay).toBe(false);
  });

  it('round-trip avec tags + projet (S18.4 : routé par priorité, défaut Important)', () => {
    const { parsed, reparsed } = roundTrip('- [ ] dev #versi #urgent');
    expect(reparsed!.tags).toEqual(parsed.tags);
    // S18.4 : pas d'emoji priorité → défaut "Important"
    expect(reparsed!.projectName).toBe('Important');
  });

  it('round-trip avec priorité haute ⏫ (S18.4)', () => {
    const { parsed, reparsed } = roundTrip('- [ ] urgent ⏫');
    expect(reparsed!.priority).toBe(parsed.priority);
    expect(reparsed!.priority).toBe(5);
    expect(reparsed!.projectName).toBe('Critique');
  });

  it('round-trip avec priorité medium 🔼 (S18.4)', () => {
    const { parsed, reparsed } = roundTrip('- [ ] medium 🔼');
    expect(reparsed!.priority).toBe(parsed.priority);
    expect(reparsed!.priority).toBe(3);
    expect(reparsed!.projectName).toBe('Important');
  });

  it('round-trip avec priorité basse 🔽 (S18.4)', () => {
    const { parsed, reparsed } = roundTrip('- [ ] secondaire 🔽');
    expect(reparsed!.priority).toBe(parsed.priority);
    expect(reparsed!.priority).toBe(1);
    expect(reparsed!.projectName).toBe('Priorité basse');
  });

  it('⏬ (lowest) → sérialisé comme 🔽 (low) — round-trip stable', () => {
    const parsed1 = parseTaskLine('- [ ] vraiment pas urgent ⏬', POS)!;
    expect(parsed1.priority).toBe(1);
    const serialized = serializeTaskToLine(parsed1);
    // Le serializer émet 🔽 (pas ⏬) car priority=1 → "Priorité basse"
    expect(serialized).toContain('🔽');
    expect(serialized).not.toContain('⏬');
    // Re-parse : toujours priority 1
    const reparsed = parseTaskLine(serialized, POS)!;
    expect(reparsed.priority).toBe(1);
  });

  it('round-trip avec récurrence', () => {
    const { parsed, reparsed } = roundTrip('- [ ] check 🔁 weekly');
    expect(reparsed!.repeatFlag).toBe(parsed.repeatFlag);
    expect(reparsed!.repeatFlag).toBe('FREQ=WEEKLY');
  });

  it('round-trip ligne complète (S18.4 : ⏫ = high)', () => {
    const { parsed, reparsed } = roundTrip(
      '- [ ] Préparer pitch 📅 2026-05-19 ⏰ 14:00 #gradient #urgent ⏫ 🔁 weekly',
    );
    expect(reparsed).not.toBeNull();
    expect(reparsed!.title).toBe(parsed.title);
    expect(reparsed!.dueDate).toBe(parsed.dueDate);
    expect(reparsed!.priority).toBe(parsed.priority);
    expect(reparsed!.tags).toEqual(parsed.tags);
    expect(reparsed!.repeatFlag).toBe(parsed.repeatFlag);
  });

  it('round-trip statut completed [x]', () => {
    const { parsed, reparsed } = roundTrip('- [x] fait');
    expect(reparsed!.status).toBe(2);
    expect(reparsed!.status).toBe(parsed.status);
  });
});

describe('serializeTaskToLine — output stable', () => {
  it('format start avec "- [ ]"', () => {
    const parsed = parseTaskLine('- [ ] test', POS)!;
    expect(serializeTaskToLine(parsed)).toMatch(/^- \[ \] /);
  });

  it('format start avec "- [x]" si completed', () => {
    const parsed = parseTaskLine('- [x] done', POS)!;
    expect(serializeTaskToLine(parsed)).toMatch(/^- \[x\] /);
  });

  it('ne contient pas de # dans le titre', () => {
    const parsed = parseTaskLine('- [ ] truc #versi', POS)!;
    const out = serializeTaskToLine(parsed);
    expect(out).toContain('#versi');
    // Le tag a été extrait du titre puis re-ajouté à la fin
    expect(out.startsWith('- [ ] truc')).toBe(true);
  });
});
