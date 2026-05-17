/**
 * Tests unitaires — export iCal (RFC 5545) pour tâches TickTick.
 */

import { describe, it, expect } from 'vitest';
import type { TickTickTask } from '../types';
import { generateICalFromTasks } from '../ical-export';

// ============================================================
// Fixtures
// ============================================================

function makeTask(overrides: Partial<TickTickTask> = {}): TickTickTask {
  return {
    id: 'task-001',
    projectId: 'proj-1',
    title: 'Rappeler le locataire',
    priority: 3,
    status: 0,
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('generateICalFromTasks', () => {
  it('génère un VCALENDAR valide avec VTODO', () => {
    const tasks = [makeTask()];
    const ical = generateICalFromTasks(tasks);

    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('END:VCALENDAR');
    expect(ical).toContain('BEGIN:VTODO');
    expect(ical).toContain('END:VTODO');
    expect(ical).toContain('VERSION:2.0');
  });

  it('inclut le nom du calendrier dans X-WR-CALNAME', () => {
    const ical = generateICalFromTasks([makeTask()], 'Mon Calendrier');

    expect(ical).toContain('X-WR-CALNAME:Mon Calendrier');
  });

  it('génère un UID unique par tâche', () => {
    const ical = generateICalFromTasks([makeTask({ id: 'abc-123' })]);

    expect(ical).toContain('UID:ticktick-abc-123@anya.issa-capital.com');
  });

  it('inclut le titre dans SUMMARY', () => {
    const ical = generateICalFromTasks([makeTask({ title: 'Envoyer le bail' })]);

    expect(ical).toContain('SUMMARY:Envoyer le bail');
  });

  it('inclut la description dans DESCRIPTION', () => {
    const ical = generateICalFromTasks([makeTask({ desc: 'Détails importants' })]);

    expect(ical).toContain('DESCRIPTION:Détails importants');
  });

  it('utilise content comme fallback si desc est vide', () => {
    const ical = generateICalFromTasks([makeTask({ content: 'Contenu fallback' })]);

    expect(ical).toContain('DESCRIPTION:Contenu fallback');
  });

  it('inclut DTSTART et DUE si les dates sont définies', () => {
    const ical = generateICalFromTasks([
      makeTask({
        startDate: '2026-05-20T09:00:00.000+0000',
        dueDate: '2026-05-20T17:00:00.000+0000',
      }),
    ]);

    expect(ical).toContain('DTSTART:');
    expect(ical).toContain('DUE:');
  });

  it('mappe la priorité TickTick vers iCal correctement', () => {
    // High (5) → 1
    let ical = generateICalFromTasks([makeTask({ priority: 5 })]);
    expect(ical).toContain('PRIORITY:1');

    // Medium (3) → 5
    ical = generateICalFromTasks([makeTask({ priority: 3 })]);
    expect(ical).toContain('PRIORITY:5');

    // Low (1) → 9
    ical = generateICalFromTasks([makeTask({ priority: 1 })]);
    expect(ical).toContain('PRIORITY:9');

    // None (0) → 0
    ical = generateICalFromTasks([makeTask({ priority: 0 })]);
    expect(ical).toContain('PRIORITY:0');
  });

  it('mappe le statut complété', () => {
    const ical = generateICalFromTasks([makeTask({ status: 2 })]);

    expect(ical).toContain('STATUS:COMPLETED');
  });

  it('mappe le statut actif', () => {
    const ical = generateICalFromTasks([makeTask({ status: 0 })]);

    expect(ical).toContain('STATUS:NEEDS-ACTION');
  });

  it('inclut COMPLETED si completedTime est défini', () => {
    const ical = generateICalFromTasks([
      makeTask({ status: 2, completedTime: '2026-05-18T14:30:00.000+0000' }),
    ]);

    expect(ical).toContain('COMPLETED:');
  });

  it('inclut les tags comme CATEGORIES', () => {
    const ical = generateICalFromTasks([makeTask({ tags: ['anya-locataire', 'urgent'] })]);

    expect(ical).toContain('CATEGORIES:anya-locataire,urgent');
  });

  it('escape les caractères spéciaux iCal', () => {
    const ical = generateICalFromTasks([makeTask({ title: 'Test; avec, spéciaux\\n' })]);

    expect(ical).toContain('SUMMARY:Test\\; avec\\, spéciaux\\\\n');
  });

  it('génère un calendrier vide pour une liste vide', () => {
    const ical = generateICalFromTasks([]);

    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('END:VCALENDAR');
    expect(ical).not.toContain('BEGIN:VTODO');
  });

  it('gère plusieurs tâches', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Tâche 1' }),
      makeTask({ id: 't2', title: 'Tâche 2' }),
      makeTask({ id: 't3', title: 'Tâche 3' }),
    ];
    const ical = generateICalFromTasks(tasks);

    const vtodoCount = (ical.match(/BEGIN:VTODO/g) || []).length;
    expect(vtodoCount).toBe(3);
  });

  it('utilise CRLF comme séparateur de lignes', () => {
    const ical = generateICalFromTasks([makeTask()]);

    // Vérifier que les sauts de ligne sont bien \r\n
    expect(ical).toContain('\r\n');
  });
});
