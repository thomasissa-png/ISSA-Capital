/**
 * Tests unitaires — intégration TickTick ← email-ingest.
 *
 * Mock du client TickTick et OAuth. Vérifie la création de tâches
 * selon la catégorie de triage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EmailMessage } from '../../gmail-source/types';
import type { TriageResult } from '../../triage/types';

// ============================================================
// Mocks
// ============================================================

const mockGetTickTickAccessToken = vi.fn().mockResolvedValue('mock-token');
const mockCreateTask = vi.fn().mockResolvedValue({ id: 'task-new', projectId: 'p1', title: 'x', priority: 0, status: 0 });

vi.mock('../../ticktick/oauth', () => ({
  getTickTickAccessToken: (...args: unknown[]) => mockGetTickTickAccessToken(...args),
}));

vi.mock('../../ticktick/ticktick-client', () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
}));

// ============================================================
// Import du module testé
// ============================================================

import { createTickTickTaskForEmail } from '../ticktick-integration';

// ============================================================
// Fixtures
// ============================================================

function makeEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    source: 'gmail',
    id: 'msg_test',
    from: { email: 'locataire@test.com', name: 'Jean Dupont' },
    to: [{ email: 'thomas@issa-capital.com' }],
    cc: [],
    subject: 'Problème de plomberie',
    bodyPlain: 'Le robinet fuit.',
    receivedAt: new Date('2026-05-17T10:00:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg_test',
    ...overrides,
  };
}

function makeTriage(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    category: 'locataire',
    intent: 'demande_reparation',
    confidence: 0.92,
    matchedContact: 'Jean Dupont',
    summary: 'Fuite robinet cuisine, demande intervention plombier.',
    suggestedActions: [],
    ...overrides,
  };
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTickTickAccessToken.mockResolvedValue('mock-token');
  mockCreateTask.mockResolvedValue({ id: 'task-new', projectId: 'p1', title: 'x', priority: 0, status: 0 });
});

// ============================================================
// Tests
// ============================================================

describe('createTickTickTaskForEmail', () => {
  it('crée une tâche TickTick pour un email locataire', async () => {
    await createTickTickTaskForEmail(makeEmail(), makeTriage());

    expect(mockCreateTask).toHaveBeenCalledTimes(1);
    const [input] = mockCreateTask.mock.calls[0] as [Record<string, unknown>];
    expect(input.title).toBe('[Email] Problème de plomberie');
    expect(input.priority).toBe(5); // locataire = haute priorité
    expect(input.tags).toEqual(['anya-locataire']);
  });

  it('inclut le résumé du triage et le lien Gmail dans la description', async () => {
    await createTickTickTaskForEmail(makeEmail(), makeTriage());

    const [input] = mockCreateTask.mock.calls[0] as [Record<string, unknown>];
    const desc = input.desc as string;
    expect(desc).toContain('Fuite robinet cuisine');
    expect(desc).toContain('Jean Dupont <locataire@test.com>');
    expect(desc).toContain('https://mail.google.com/mail/u/0/#inbox/msg_test');
    expect(desc).toContain('Catégorie : locataire');
    expect(desc).toContain('Confiance : 92%');
  });

  it('mappe la priorité correctement selon la catégorie', async () => {
    const categories: Array<[string, number]> = [
      ['locataire', 5],
      ['candidat', 3],
      ['contact-pro', 3],
      ['apporteur', 3],
      ['a-classifier', 1],
    ];

    for (const [category, expectedPriority] of categories) {
      vi.clearAllMocks();
      mockGetTickTickAccessToken.mockResolvedValue('mock-token');
      mockCreateTask.mockResolvedValue({ id: 'x', projectId: 'p', title: 'x', priority: 0, status: 0 });

      await createTickTickTaskForEmail(makeEmail(), makeTriage({ category: category as TriageResult['category'] }));

      const [input] = mockCreateTask.mock.calls[0] as [Record<string, unknown>];
      expect(input.priority).toBe(expectedPriority);
    }
  });

  it('skip silencieusement si catégorie spam', async () => {
    await createTickTickTaskForEmail(makeEmail(), makeTriage({ category: 'spam' }));

    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('skip silencieusement si TickTick non configuré (token null)', async () => {
    mockGetTickTickAccessToken.mockResolvedValue(null);

    await createTickTickTaskForEmail(makeEmail(), makeTriage());

    expect(mockCreateTask).not.toHaveBeenCalled();
  });

  it('gère l\'email sans nom d\'expéditeur', async () => {
    const email = makeEmail({ from: { email: 'anon@test.com' } });
    await createTickTickTaskForEmail(email, makeTriage());

    const [input] = mockCreateTask.mock.calls[0] as [Record<string, unknown>];
    const desc = input.desc as string;
    expect(desc).toContain('anon@test.com');
  });

  it('propage l\'erreur createTask (le caller doit catch)', async () => {
    mockCreateTask.mockRejectedValue(new Error('TickTick API erreur'));

    await expect(
      createTickTickTaskForEmail(makeEmail(), makeTriage()),
    ).rejects.toThrow('TickTick API erreur');
  });
});
