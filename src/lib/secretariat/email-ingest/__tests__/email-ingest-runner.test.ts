/**
 * Tests intégration — pipeline email-ingest runner.
 *
 * Mocks de tous les modules amont :
 * - gmail-source (listUnprocessed, fetchDetail, markProcessed, markFailed)
 * - triage (triageEmail)
 * - pre-filter (isLikelySpamByHeuristic)
 * - contacts-cache (loadKnownContacts)
 * - handlers (handleLocataire, handleAClassifier, handleContactPro, handleApporteur)
 * - telegram-validation (savePending, sendValidationCard)
 * - vault-client/audit-log (writeAuditLog)
 *
 * Vérifie le dispatching, les stats correctes, les cas d'erreur gracieux.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EmailMessage } from '../../gmail-source/types';
import type { TriageResult } from '../../triage/types';

// ============================================================
// Mocks
// ============================================================

const mockListUnprocessed = vi.fn().mockResolvedValue([]);
const mockFetchDetail = vi.fn().mockResolvedValue(null);
const mockMarkProcessed = vi.fn().mockResolvedValue(true);
const mockMarkFailed = vi.fn().mockResolvedValue(true);

vi.mock('../../gmail-source/gmail-source', () => ({
  listUnprocessed: (...args: unknown[]) => mockListUnprocessed(...args),
  fetchDetail: (...args: unknown[]) => mockFetchDetail(...args),
  markProcessed: (...args: unknown[]) => mockMarkProcessed(...args),
  markFailed: (...args: unknown[]) => mockMarkFailed(...args),
}));

const mockTriageEmail = vi.fn().mockResolvedValue(null);

vi.mock('../../triage/triage', () => ({
  triageEmail: (...args: unknown[]) => mockTriageEmail(...args),
}));

const mockIsLikelySpamByHeuristic = vi.fn().mockReturnValue(false);

vi.mock('../pre-filter', () => ({
  isLikelySpamByHeuristic: (...args: unknown[]) => mockIsLikelySpamByHeuristic(...args),
}));

const mockLoadKnownContacts = vi.fn().mockResolvedValue([]);

vi.mock('../contacts-cache', () => ({
  loadKnownContacts: (...args: unknown[]) => mockLoadKnownContacts(...args),
}));

const mockHandleLocataire = vi.fn().mockResolvedValue([]);
const mockHandleAClassifier = vi.fn().mockResolvedValue([]);
const mockHandleContactPro = vi.fn().mockResolvedValue([]);
const mockHandleApporteur = vi.fn().mockResolvedValue([]);
const mockHandleCandidat = vi.fn().mockResolvedValue([]);

vi.mock('../../handlers', () => ({
  handleLocataire: (...args: unknown[]) => mockHandleLocataire(...args),
  handleAClassifier: (...args: unknown[]) => mockHandleAClassifier(...args),
  handleContactPro: (...args: unknown[]) => mockHandleContactPro(...args),
  handleApporteur: (...args: unknown[]) => mockHandleApporteur(...args),
  handleCandidat: (...args: unknown[]) => mockHandleCandidat(...args),
}));

const mockSavePending = vi.fn().mockResolvedValue(undefined);
const mockSendValidationCard = vi.fn().mockResolvedValue({ messageId: 123 });
const mockSaveNoMatch = vi.fn().mockResolvedValue(undefined);
const mockSendNoMatchCard = vi.fn().mockResolvedValue({ messageId: 456 });

vi.mock('../../telegram-validation', () => ({
  savePending: (...args: unknown[]) => mockSavePending(...args),
  sendValidationCard: (...args: unknown[]) => mockSendValidationCard(...args),
  saveNoMatch: (...args: unknown[]) => mockSaveNoMatch(...args),
  sendNoMatchCard: (...args: unknown[]) => mockSendNoMatchCard(...args),
}));

const mockWriteAuditLog = vi.fn().mockResolvedValue(true);

vi.mock('../../vault-client/audit-log', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

// Mock crypto.randomUUID pour des IDs déterministes (incremental)
let uuidCounter = 0;
vi.mock('crypto', () => ({
  randomUUID: () => `test-uuid-${String(++uuidCounter).padStart(4, '0')}`,
}));

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import { runEmailIngest } from '../email-ingest-runner';

// ============================================================
// Fixtures
// ============================================================

function makeEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    source: 'gmail',
    id: 'msg_001',
    from: { email: 'test@example.com', name: 'Test User' },
    to: [{ email: 'thomas@issacapital.com' }],
    cc: [],
    subject: 'Test email',
    bodyPlain: 'Contenu du test.',
    receivedAt: new Date('2026-05-13T10:00:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg_001',
    ...overrides,
  };
}

function makeTriage(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    category: 'a-classifier',
    intent: 'test_intent',
    confidence: 0.8,
    matchedContact: null,
    summary: 'Résumé test.',
    suggestedActions: [],
    ...overrides,
  };
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  uuidCounter = 0;
  mockListUnprocessed.mockResolvedValue([]);
  mockFetchDetail.mockResolvedValue(null);
  mockTriageEmail.mockResolvedValue(null);
  mockIsLikelySpamByHeuristic.mockReturnValue(false);
  mockLoadKnownContacts.mockResolvedValue([]);
  mockSaveNoMatch.mockResolvedValue(undefined);
  mockSendNoMatchCard.mockResolvedValue({ messageId: 456 });
  mockHandleAClassifier.mockResolvedValue([
    { type: 'create_file', target: '05. Notes/A classifier/test.md', payload: {}, description: 'Test' },
  ]);
});

// ============================================================
// Tests
// ============================================================

describe('runEmailIngest', () => {
  it('retourne des stats vides si aucun email non traité', async () => {
    mockListUnprocessed.mockResolvedValue([]);

    const stats = await runEmailIngest();

    expect(stats.totalListed).toBe(0);
    expect(stats.preFilteredSpam).toBe(0);
    expect(stats.haikuSpam).toBe(0);
    expect(stats.pendingCreated).toBe(0);
    expect(stats.errors).toBe(0);
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('gère une erreur de listUnprocessed gracieusement', async () => {
    mockListUnprocessed.mockRejectedValue(new Error('Gmail API down'));

    const stats = await runEmailIngest();

    expect(stats.errors).toBe(1);
    expect(stats.totalListed).toBe(0);
  });

  it('incrémente preFilteredSpam quand le pré-filtre détecte du spam', async () => {
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_spam' }]);
    mockFetchDetail.mockResolvedValue(makeEmail({ id: 'msg_spam' }));
    mockIsLikelySpamByHeuristic.mockReturnValue(true);

    const stats = await runEmailIngest();

    expect(stats.totalListed).toBe(1);
    expect(stats.preFilteredSpam).toBe(1);
    expect(stats.pendingCreated).toBe(0);
    expect(mockMarkProcessed).toHaveBeenCalledWith('msg_spam');
    expect(mockTriageEmail).not.toHaveBeenCalled();
  });

  it('incrémente errors quand fetchDetail retourne null', async () => {
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_bad' }]);
    mockFetchDetail.mockResolvedValue(null);

    const stats = await runEmailIngest();

    expect(stats.totalListed).toBe(1);
    expect(stats.errors).toBe(1);
  });

  it('incrémente errors + markFailed quand triage retourne null', async () => {
    const email = makeEmail({ id: 'msg_triage_fail' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_triage_fail' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(null);

    const stats = await runEmailIngest();

    expect(stats.errors).toBe(1);
    expect(mockMarkFailed).toHaveBeenCalledWith('msg_triage_fail');
  });

  it('incrémente haikuSpam pour spam confidence > 0.9', async () => {
    const email = makeEmail({ id: 'msg_haiku_spam' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_haiku_spam' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(
      makeTriage({ category: 'spam', confidence: 0.95 }),
    );

    const stats = await runEmailIngest();

    expect(stats.haikuSpam).toBe(1);
    expect(stats.pendingCreated).toBe(0);
    expect(mockMarkProcessed).toHaveBeenCalledWith('msg_haiku_spam');
  });

  it('ne bypass PAS le spam Haiku si confidence === 0.9 (seuil non strict)', async () => {
    const email = makeEmail({ id: 'msg_spam_09' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_spam_09' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(
      makeTriage({ category: 'spam', confidence: 0.9 }),
    );

    const stats = await runEmailIngest();

    // confidence 0.9 n'est PAS > 0.9, donc pas auto-spam
    expect(stats.haikuSpam).toBe(0);
    expect(stats.pendingCreated).toBe(1);
  });

  it('dispatch locataire vers handleLocataire', async () => {
    const email = makeEmail({ id: 'msg_loc' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_loc' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'locataire' }));
    mockHandleLocataire.mockResolvedValue([
      { type: 'append_historique', target: 'test', payload: {}, description: 'Test' },
    ]);

    const stats = await runEmailIngest();

    expect(stats.pendingCreated).toBe(1);
    expect(mockHandleLocataire).toHaveBeenCalled();
    expect(mockHandleAClassifier).not.toHaveBeenCalled();
  });

  it('dispatch contact-pro vers handleContactPro', async () => {
    const email = makeEmail({ id: 'msg_pro' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_pro' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));
    mockHandleContactPro.mockResolvedValue([
      { type: 'create_file', target: 'test', payload: {}, description: 'Test' },
    ]);

    await runEmailIngest();

    expect(mockHandleContactPro).toHaveBeenCalled();
  });

  it('dispatch apporteur vers handleApporteur', async () => {
    const email = makeEmail({ id: 'msg_app' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_app' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'apporteur' }));
    mockHandleApporteur.mockResolvedValue([
      { type: 'create_file', target: 'test', payload: {}, description: 'Test' },
    ]);

    await runEmailIngest();

    expect(mockHandleApporteur).toHaveBeenCalled();
  });

  it('dispatch candidat vers handleCandidat (handler dédié depuis Jalon 4D-1)', async () => {
    const email = makeEmail({ id: 'msg_cand' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_cand' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'candidat' }));
    mockHandleCandidat.mockResolvedValue([
      { type: 'create_file', target: 'test', payload: {}, description: 'Test' },
    ]);

    await runEmailIngest();

    expect(mockHandleCandidat).toHaveBeenCalled();
    expect(mockHandleAClassifier).not.toHaveBeenCalled();
  });

  it('dispatch spam confidence ≤ 0.9 vers handleAClassifier + carte Telegram', async () => {
    const email = makeEmail({ id: 'msg_spam_low' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_spam_low' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'spam', confidence: 0.85 }));

    const stats = await runEmailIngest();

    expect(mockHandleAClassifier).toHaveBeenCalled();
    expect(stats.pendingCreated).toBe(1);
    expect(stats.haikuSpam).toBe(0);
  });

  it('appelle savePending + sendValidationCard pour un email catégorisé', async () => {
    const email = makeEmail({ id: 'msg_valid' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_valid' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'a-classifier' }));

    await runEmailIngest();

    expect(mockSavePending).toHaveBeenCalledTimes(1);
    expect(mockSendValidationCard).toHaveBeenCalledTimes(1);

    const pendingArg = mockSavePending.mock.calls[0]![0];
    expect(pendingArg.id).toMatch(/^test-uuid-\d{4}$/);
    expect(pendingArg.triage.category).toBe('a-classifier');
    expect(pendingArg.email.id).toBe('msg_valid');
  });

  it('ne crashe pas si sendValidationCard échoue', async () => {
    const email = makeEmail({ id: 'msg_tg_fail' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_tg_fail' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'a-classifier' }));
    mockSendValidationCard.mockRejectedValue(new Error('Telegram 502'));

    const stats = await runEmailIngest();

    // Le pending est créé même si Telegram échoue
    expect(stats.pendingCreated).toBe(1);
    expect(stats.errors).toBe(0);
    expect(mockSavePending).toHaveBeenCalledTimes(1);
  });

  it('traite plusieurs emails en séquence avec stats correctes', async () => {
    const emails = [
      makeEmail({ id: 'msg_1', from: { email: 'noreply@spam.com' } }),
      makeEmail({ id: 'msg_2' }),
      makeEmail({ id: 'msg_3' }),
    ];

    mockListUnprocessed.mockResolvedValue([
      { id: 'msg_1' },
      { id: 'msg_2' },
      { id: 'msg_3' },
    ]);

    mockFetchDetail
      .mockResolvedValueOnce(emails[0])
      .mockResolvedValueOnce(emails[1])
      .mockResolvedValueOnce(emails[2]);

    // msg_1 : pré-filtré spam
    mockIsLikelySpamByHeuristic
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false);

    // msg_2 : triage échoue
    mockTriageEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeTriage({ category: 'locataire' }));

    mockHandleLocataire.mockResolvedValue([
      { type: 'append_historique', target: 'test', payload: {}, description: 'Test' },
    ]);

    const stats = await runEmailIngest();

    expect(stats.totalListed).toBe(3);
    expect(stats.preFilteredSpam).toBe(1);
    expect(stats.errors).toBe(1); // triage null
    expect(stats.pendingCreated).toBe(1); // locataire
  });

  it('écrit un audit final avec les stats', async () => {
    // Au moins 1 message pour que le run écrive l'audit final
    const email = makeEmail({ id: 'msg_audit' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_audit' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockIsLikelySpamByHeuristic.mockReturnValue(true);

    await runEmailIngest();

    // Le writeAuditLog est appelé pour le pré-filtre + l'audit final
    expect(mockWriteAuditLog).toHaveBeenCalled();
    const lastCall = mockWriteAuditLog.mock.calls.at(-1)![0];
    expect(lastCall.op).toBe('classify_note');
    expect(lastCall.target).toBe('email-ingest-run');
    expect(lastCall.payload).toHaveProperty('totalListed');
  });

  it('charge les contacts via loadKnownContacts avant le traitement', async () => {
    const contacts = [{ name: 'Martin', email: 'martin@test.fr', type: 'locataire' as const }];
    mockLoadKnownContacts.mockResolvedValue(contacts);
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_1' }]);
    mockFetchDetail.mockResolvedValue(makeEmail());
    mockTriageEmail.mockResolvedValue(makeTriage());

    await runEmailIngest();

    expect(mockLoadKnownContacts).toHaveBeenCalledTimes(1);
    // triageEmail reçoit les contacts
    expect(mockTriageEmail).toHaveBeenCalledWith(
      expect.any(Object),
      contacts,
    );
  });

  // --- No-match flow (Jalon 4D-2) ---

  it('envoie 2 cartes Telegram quand le handler retourne prompt_create_contact_choice', async () => {
    const email = makeEmail({ id: 'msg_nomatch' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_nomatch' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));

    // Handler retourne 3 actions dont une prompt_create_contact_choice
    mockHandleContactPro.mockResolvedValue([
      { type: 'create_file', target: '05. Notes/A classifier/test.md', payload: {}, description: 'Dépôt A classifier' },
      {
        type: 'prompt_create_contact_choice',
        target: null,
        payload: {
          emailFrom: 'francois@example.com',
          nameFrom: 'François',
          defaultType: 'pro',
          emailMessageId: 'msg_nomatch',
          emailThreadRef: '(cf. thread Gmail msg_nomatch)',
        },
        description: 'Proposer création fiche',
      },
      { type: 'mark_processed', target: null, payload: { messageId: 'msg_nomatch' }, description: 'Mark processed' },
    ]);

    await runEmailIngest();

    // Carte principale envoyée
    expect(mockSavePending).toHaveBeenCalledTimes(1);
    expect(mockSendValidationCard).toHaveBeenCalledTimes(1);

    // Le pending principal ne contient PAS l'action prompt_create_contact_choice
    const pendingArg = mockSavePending.mock.calls[0]![0];
    const actionTypes = pendingArg.actions.map((a: { type: string }) => a.type);
    expect(actionTypes).not.toContain('prompt_create_contact_choice');
    expect(actionTypes).toContain('create_file');
    expect(actionTypes).toContain('mark_processed');

    // Carte no-match envoyée
    expect(mockSaveNoMatch).toHaveBeenCalledTimes(1);
    expect(mockSendNoMatchCard).toHaveBeenCalledTimes(1);

    // Le NoMatchPending a les bonnes données
    const noMatchArg = mockSaveNoMatch.mock.calls[0]![0];
    expect(noMatchArg.emailFrom).toBe('francois@example.com');
    expect(noMatchArg.nameFrom).toBe('François');
    expect(noMatchArg.defaultType).toBe('pro');
    expect(noMatchArg.parentPendingId).toBe(pendingArg.id);
  });

  it('ne crée PAS de NoMatchPending si le handler ne retourne pas prompt_create_contact_choice', async () => {
    const email = makeEmail({ id: 'msg_normal' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_normal' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));

    // Handler retourne des actions normales (fiche existante)
    mockHandleContactPro.mockResolvedValue([
      { type: 'append_historique', target: 'test', payload: {}, description: 'Append' },
      { type: 'mark_processed', target: null, payload: {}, description: 'Mark' },
    ]);

    await runEmailIngest();

    // Carte principale envoyée
    expect(mockSavePending).toHaveBeenCalledTimes(1);
    expect(mockSendValidationCard).toHaveBeenCalledTimes(1);

    // PAS de carte no-match
    expect(mockSaveNoMatch).not.toHaveBeenCalled();
    expect(mockSendNoMatchCard).not.toHaveBeenCalled();
  });

  it('ne crashe pas si sendNoMatchCard échoue', async () => {
    const email = makeEmail({ id: 'msg_nm_fail' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_nm_fail' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));

    mockHandleContactPro.mockResolvedValue([
      { type: 'create_file', target: 'test', payload: {}, description: 'Test' },
      {
        type: 'prompt_create_contact_choice',
        target: null,
        payload: {
          emailFrom: 'test@test.com',
          nameFrom: null,
          defaultType: 'autres',
          emailMessageId: 'msg_nm_fail',
          emailThreadRef: '(cf. thread Gmail msg_nm_fail)',
        },
        description: 'Prompt',
      },
      { type: 'mark_processed', target: null, payload: {}, description: 'Mark' },
    ]);

    mockSendNoMatchCard.mockRejectedValue(new Error('Telegram 502'));

    const stats = await runEmailIngest();

    // Le pending et le noMatch sont créés même si Telegram échoue
    expect(stats.pendingCreated).toBe(1);
    expect(stats.errors).toBe(0);
    expect(mockSaveNoMatch).toHaveBeenCalledTimes(1);
  });

  it('NoMatchPending a un ID différent du PendingValidation', async () => {
    const email = makeEmail({ id: 'msg_uuid_diff' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_uuid_diff' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));

    mockHandleContactPro.mockResolvedValue([
      { type: 'create_file', target: 'test', payload: {}, description: 'Test' },
      {
        type: 'prompt_create_contact_choice',
        target: null,
        payload: {
          emailFrom: 'test@test.com',
          nameFrom: null,
          defaultType: 'pro',
          emailMessageId: 'msg_uuid_diff',
          emailThreadRef: '(cf. thread Gmail msg_uuid_diff)',
        },
        description: 'Prompt',
      },
      { type: 'mark_processed', target: null, payload: {}, description: 'Mark' },
    ]);

    await runEmailIngest();

    const pendingId = mockSavePending.mock.calls[0]![0].id;
    const noMatchId = mockSaveNoMatch.mock.calls[0]![0].id;
    expect(pendingId).not.toBe(noMatchId);
  });
});
