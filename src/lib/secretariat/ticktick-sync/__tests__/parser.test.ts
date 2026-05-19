/**
 * Tests parser markdown → VaultTask.
 */

import { describe, it, expect } from 'vitest';
import { parseTaskLine } from '../parser';
import type { TaskPosition } from '../types';

const POS: TaskPosition = { vaultPath: 'Taches/Todo.md', lineNumber: 1 };

describe('parseTaskLine — basics', () => {
  it('parse une ligne simple sans emojis (défaut = Important)', () => {
    const task = parseTaskLine('- [ ] Appeler Maxime', POS);
    expect(task).not.toBeNull();
    expect(task!.title).toBe('Appeler Maxime');
    expect(task!.status).toBe(0);
    expect(task!.priority).toBe(0);
    expect(task!.tags).toEqual([]);
    // S18.4 : sans emoji priorité → projet "Important" (défaut)
    expect(task!.projectName).toBe('Important');
    expect(task!.isAllDay).toBe(true);
    expect(task!.dueDate).toBeUndefined();
  });

  it('renvoie null pour une ligne sans checkbox', () => {
    expect(parseTaskLine('Pas une tâche', POS)).toBeNull();
    expect(parseTaskLine('# Titre', POS)).toBeNull();
    expect(parseTaskLine('', POS)).toBeNull();
  });

  it('renvoie null pour une checkbox sans description', () => {
    expect(parseTaskLine('- [ ]    ', POS)).toBeNull();
  });
});

describe('parseTaskLine — status', () => {
  it('détecte la complétion [x]', () => {
    const t = parseTaskLine('- [x] terminée', POS);
    expect(t!.status).toBe(2);
  });

  it('accepte [X] majuscule', () => {
    const t = parseTaskLine('- [X] aussi terminée', POS);
    expect(t!.status).toBe(2);
  });
});

describe('parseTaskLine — date et heure', () => {
  it('parse une date 📅', () => {
    const t = parseTaskLine('- [ ] tâche datée 📅 2026-05-19', POS);
    expect(t!.dueDate).toBe('2026-05-19T00:00:00.000Z');
    expect(t!.isAllDay).toBe(true);
    expect(t!.title).toBe('tâche datée');
  });

  it('parse date + heure ⏰', () => {
    const t = parseTaskLine('- [ ] meeting 📅 2026-05-19 ⏰ 09:30', POS);
    expect(t!.dueDate).toBe('2026-05-19T09:30:00.000Z');
    expect(t!.isAllDay).toBe(false);
  });

  it('parse date + heure 🕐 (variante)', () => {
    const t = parseTaskLine('- [ ] dej 📅 2026-05-19 🕐 12:00', POS);
    expect(t!.dueDate).toBe('2026-05-19T12:00:00.000Z');
    expect(t!.isAllDay).toBe(false);
  });
});

describe('parseTaskLine — priorité (S18.4 convention Obsidian Tasks)', () => {
  it('⏫ → priority 5 (high) → Critique', () => {
    const t = parseTaskLine('- [ ] urgent ⏫', POS);
    expect(t!.priority).toBe(5);
    expect(t!.projectName).toBe('Critique');
  });

  it('🔼 → priority 3 (medium) → Important', () => {
    const t = parseTaskLine('- [ ] tâche medium 🔼', POS);
    expect(t!.priority).toBe(3);
    expect(t!.projectName).toBe('Important');
  });

  it('🔽 → priority 1 (low) → Priorité basse', () => {
    const t = parseTaskLine('- [ ] secondaire 🔽', POS);
    expect(t!.priority).toBe(1);
    expect(t!.projectName).toBe('Priorité basse');
  });

  it('⏬ → priority 1 (lowest mappé low) → Priorité basse', () => {
    const t = parseTaskLine('- [ ] vraiment pas urgent ⏬', POS);
    expect(t!.priority).toBe(1);
    expect(t!.projectName).toBe('Priorité basse');
  });

  it('sans emoji → priority 0 → Important (défaut)', () => {
    const t = parseTaskLine('- [ ] normal', POS);
    expect(t!.priority).toBe(0);
    expect(t!.projectName).toBe('Important');
  });

  it('⏫ a priorité sur 🔼 si les deux présents (ordre de test)', () => {
    const t = parseTaskLine('- [ ] mix 🔼 ⏫', POS);
    expect(t!.priority).toBe(5);
  });
});

describe('parseTaskLine — tags et projets (S18.4)', () => {
  it('extrait les tags sans # (informatif depuis S18.4)', () => {
    const t = parseTaskLine('- [ ] task #versi #urgent', POS);
    expect(t!.tags).toEqual(['versi', 'urgent']);
    expect(t!.title).toBe('task');
  });

  it('S18.4 : les tags ne routent PLUS le projet — défaut Important', () => {
    // #versi ne mappe plus rien (mapping par tag supprimé)
    const t = parseTaskLine('- [ ] dev fonctionnalité #versi', POS);
    expect(t!.projectName).toBe('Important');
    expect(t!.tags).toEqual(['versi']);
  });

  it('S18.4 : tag + priorité → projet déterminé par priorité', () => {
    const t = parseTaskLine('- [ ] dev #gradient ⏫', POS);
    expect(t!.projectName).toBe('Critique');
    expect(t!.tags).toEqual(['gradient']);
  });
});

describe('parseTaskLine — recurrence', () => {
  it('🔁 weekly → FREQ=WEEKLY', () => {
    const t = parseTaskLine('- [ ] check 📅 2026-05-19 🔁 weekly', POS);
    expect(t!.repeatFlag).toBe('FREQ=WEEKLY');
  });

  it('🔁 daily → FREQ=DAILY', () => {
    const t = parseTaskLine('- [ ] daily 🔁 daily', POS);
    expect(t!.repeatFlag).toBe('FREQ=DAILY');
  });

  it('🔁 monthly → FREQ=MONTHLY', () => {
    const t = parseTaskLine('- [ ] monthly 🔁 monthly', POS);
    expect(t!.repeatFlag).toBe('FREQ=MONTHLY');
  });
});

describe('parseTaskLine — red line #hide-tcw', () => {
  it('skip toute ligne avec #hide-tcw', () => {
    expect(parseTaskLine('- [ ] privé #hide-tcw', POS)).toBeNull();
  });

  it('skip même si autres tags présents', () => {
    expect(parseTaskLine('- [ ] confidentiel #versi #hide-tcw', POS)).toBeNull();
  });
});

describe('parseTaskLine — combinaisons', () => {
  it('ligne complète : tous les emojis (S18.4 : ⏫ = high)', () => {
    const line =
      '- [ ] Préparer pitch 📅 2026-05-19 ⏰ 14:00 #gradient #urgent ⏫ 🔁 weekly';
    const t = parseTaskLine(line, POS);
    expect(t).not.toBeNull();
    expect(t!.title).toBe('Préparer pitch');
    expect(t!.dueDate).toBe('2026-05-19T14:00:00.000Z');
    expect(t!.isAllDay).toBe(false);
    expect(t!.priority).toBe(5);
    expect(t!.tags).toEqual(['gradient', 'urgent']);
    // S18.4 : projet routé par priorité (⏫ → Critique)
    expect(t!.projectName).toBe('Critique');
    expect(t!.repeatFlag).toBe('FREQ=WEEKLY');
  });

  it('préserve la position', () => {
    const pos: TaskPosition = { vaultPath: 'Reunions/x.md', lineNumber: 42 };
    const t = parseTaskLine('- [ ] hello', pos);
    expect(t!.position).toEqual(pos);
  });

  it('tolère indentation et différents marqueurs', () => {
    expect(parseTaskLine('  - [ ] indenté', POS)).not.toBeNull();
    expect(parseTaskLine('* [ ] étoile', POS)).not.toBeNull();
    expect(parseTaskLine('+ [ ] plus', POS)).not.toBeNull();
  });
});
