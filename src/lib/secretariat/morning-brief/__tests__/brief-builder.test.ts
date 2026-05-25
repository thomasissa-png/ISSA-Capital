/**
 * Tests `brief-builder.ts` — assemblage 3 sections indépendantes, résilience
 * (une section down ≠ brief manqué), citation optionnelle. Collecteurs mockés.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  collectTickTick: vi.fn(),
  collectCalendar: vi.fn(),
  pickDailyCitation: vi.fn(),
}));

vi.mock('../collect-ticktick', () => ({ collectTickTick: mocks.collectTickTick }));
vi.mock('../collect-calendar', () => ({ collectCalendar: mocks.collectCalendar }));
vi.mock('../citation', () => ({ pickDailyCitation: mocks.pickDailyCitation }));

import { buildMorningBrief } from '../brief-builder';

const NOW = new Date('2026-07-15T05:00:00Z'); // 07:00 Paris été

describe('buildMorningBrief', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scénario A : 2 tâches + 1 réunion + citation → 3 sections complètes', async () => {
    mocks.collectTickTick.mockResolvedValue({
      today: {
        total: 2,
        groups: [
          {
            projectName: 'Pro',
            tasks: [
              { title: 'Relire le contrat', overdue: false },
              { title: 'Rappeler Martin', overdue: true },
            ],
          },
        ],
      },
      upcoming: {
        total: 1,
        groups: [
          {
            projectName: 'Pro',
            tasks: [{ title: 'RDV Jennifer', dueIso: '2026-07-17T07:30:00.000Z', overdue: false }],
          },
        ],
      },
    });
    mocks.collectCalendar.mockResolvedValue({
      events: [{ time: '10:00', title: 'Point équipe', attendees: ['Alice'], allDay: false }],
    });
    mocks.pickDailyCitation.mockResolvedValue({
      text: 'Petits gains, grands effets.',
      book: 'Atomic Habits',
    });

    const { message, sections } = await buildMorningBrief(NOW);

    expect(sections).toEqual({ ticktick: 'ok', calendar: 'ok', citation: 'ok' });
    expect(message).toContain('📋 Tâches du jour (2)');
    expect(message).toContain('⚠️ Rappeler Martin');
    expect(message).toContain('🔜 À venir (7 j)');
    expect(message).toContain('RDV Jennifer');
    expect(message).toContain('🗓️ Agenda du jour');
    expect(message).toContain('10:00 — Point équipe (Alice)');
    expect(message).toContain('💬 Citation du jour');
    expect(message).toContain('Petits gains, grands effets.');
    expect(message).toContain('— Atomic Habits');
  });

  it('scénario B : TickTick down → brief part avec agenda + citation, section TickTick sobre', async () => {
    mocks.collectTickTick.mockRejectedValue(new Error('TickTick API 500'));
    mocks.collectCalendar.mockResolvedValue({
      events: [{ time: '09:00', title: 'Standup', attendees: [], allDay: false }],
    });
    mocks.pickDailyCitation.mockResolvedValue({ text: 'Insight.', book: 'Deep Work' });

    const { message, sections } = await buildMorningBrief(NOW);

    expect(sections.ticktick).toBe('error');
    expect(sections.calendar).toBe('ok');
    expect(sections.citation).toBe('ok');
    expect(message).toContain('📋 Tâches du jour');
    expect(message).toContain('momentanément indisponible');
    expect(message).toContain('🗓️ Agenda du jour'); // agenda quand même là
    expect(message).toContain('09:00 — Standup');
    expect(message).toContain('💬 Citation du jour'); // citation quand même là
  });

  it('scénario C : aucune fiche → brief sans section citation', async () => {
    mocks.collectTickTick.mockResolvedValue({
      today: { total: 0, groups: [] },
      upcoming: { total: 0, groups: [] },
    });
    mocks.collectCalendar.mockResolvedValue({ events: [] });
    mocks.pickDailyCitation.mockResolvedValue(null);

    const { message, sections } = await buildMorningBrief(NOW);

    expect(sections.citation).toBe('empty');
    expect(message).not.toContain('💬');
    expect(message).toContain('Rien d’urgent aujourd’hui');
    expect(message).toContain('Aucune réunion aujourd’hui');
  });

  it('citation qui throw → section error, reste du brief intact', async () => {
    mocks.collectTickTick.mockResolvedValue({
      today: { total: 0, groups: [] },
      upcoming: { total: 0, groups: [] },
    });
    mocks.collectCalendar.mockResolvedValue({ events: [] });
    mocks.pickDailyCitation.mockRejectedValue(new Error('boom'));

    const { message, sections } = await buildMorningBrief(NOW);
    expect(sections.citation).toBe('error');
    expect(message).not.toContain('💬');
    expect(message).toContain('Bonjour Thomas');
  });

  it('en-tête contient la date Paris', async () => {
    mocks.collectTickTick.mockResolvedValue({
      today: { total: 0, groups: [] },
      upcoming: { total: 0, groups: [] },
    });
    mocks.collectCalendar.mockResolvedValue({ events: [] });
    mocks.pickDailyCitation.mockResolvedValue(null);
    const { message } = await buildMorningBrief(NOW);
    expect(message).toContain('2026-07-15');
  });
});
