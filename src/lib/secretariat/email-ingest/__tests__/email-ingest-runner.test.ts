/**
 * Tests intégration — pipeline email-ingest runner.
 *
 * Mocks de tous les modules amont :
 * - gmail-source (listUnprocessed, fetchDetail, markProcessed, markFailed)
 * - triage (triageEmail)
 * - pre-filter (isLikelySpamByHeuristic)
 * - contacts-cache (loadKnownContacts)
 * - handlers (handleLocataire, handleAClassifier, handleContactPro, handleApporteur)
 * - draft-composer (composeDraft) — Jalon 5B
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
// S23 — détection « déjà répondu ». Défaut : pas répondu (brouillon créé).
const mockHasReplyFromMe = vi.fn().mockResolvedValue(false);
// S24 — garde « destinataire direct ». Défaut [] = propriétaire inconnu →
// fail-open (brouillon créé), neutre vis-à-vis des tests brouillon existants.
const mockGetSelfAddresses = vi.fn().mockResolvedValue([]);

vi.mock('../../gmail-source/gmail-source', () => ({
  listUnprocessed: (...args: unknown[]) => mockListUnprocessed(...args),
  fetchDetail: (...args: unknown[]) => mockFetchDetail(...args),
  markProcessed: (...args: unknown[]) => mockMarkProcessed(...args),
  markFailed: (...args: unknown[]) => mockMarkFailed(...args),
  hasReplyFromMe: (...args: unknown[]) => mockHasReplyFromMe(...args),
  getSelfAddresses: (...args: unknown[]) => mockGetSelfAddresses(...args),
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

const mockComposeDraft = vi.fn().mockResolvedValue({ success: false, skipReason: 'mock skip' });

vi.mock('../draft-composer', () => ({
  composeDraft: (...args: unknown[]) => mockComposeDraft(...args),
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

// S18.5 : mock vault-client pour les auto-executions
const mockAppendToHistorique = vi.fn().mockResolvedValue(true);
const mockUpdateFrontmatter = vi.fn().mockResolvedValue(true);
const mockCreateVaultFile = vi.fn().mockResolvedValue(true);

vi.mock('../../vault-client', () => ({
  appendToHistorique: (...args: unknown[]) => mockAppendToHistorique(...args),
  updateFrontmatter: (...args: unknown[]) => mockUpdateFrontmatter(...args),
  createVaultFile: (...args: unknown[]) => mockCreateVaultFile(...args),
}));

const mockAppendToTodoInbox = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../drive-todo', () => ({
  appendToTodoInbox: (...args: unknown[]) => mockAppendToTodoInbox(...args),
}));

const mockCreateTickTickTaskForEmail = vi.fn().mockResolvedValue(undefined);

vi.mock('../ticktick-integration', () => ({
  createTickTickTaskForEmail: (...args: unknown[]) => mockCreateTickTickTaskForEmail(...args),
}));

// S23 — actions de cohérence (mock par défaut : aucune action, comportement
// existant inchangé). Les tests S23 surchargent mockBuildCoherenceActions.
const mockBuildCoherenceActions = vi.fn().mockResolvedValue([]);

vi.mock('../coherence-actions', () => ({
  buildCoherenceActions: (...args: unknown[]) => mockBuildCoherenceActions(...args),
}));

const mockAppendProjetHistoriqueLine = vi.fn().mockResolvedValue({ code: 'VI', status: 'enriched' });

vi.mock('../../calendar-ingest/projet-enricher', () => ({
  appendProjetHistoriqueLine: (...args: unknown[]) => mockAppendProjetHistoriqueLine(...args),
}));

const mockSendHotContextPatchCard = vi.fn().mockResolvedValue(123);

vi.mock('../../telegram-validation/handlers/hot-context-patch', () => ({
  sendHotContextPatchCard: (...args: unknown[]) => mockSendHotContextPatchCard(...args),
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
  mockHasReplyFromMe.mockResolvedValue(false);
  mockComposeDraft.mockResolvedValue({ success: false, skipReason: 'mock skip' });
  mockSaveNoMatch.mockResolvedValue(undefined);
  mockSendNoMatchCard.mockResolvedValue({ messageId: 456 });
  mockCreateTickTickTaskForEmail.mockResolvedValue(undefined);
  mockBuildCoherenceActions.mockResolvedValue([]);
  mockAppendProjetHistoriqueLine.mockResolvedValue({ code: 'VI', status: 'enriched' });
  mockSendHotContextPatchCard.mockResolvedValue(123);
  mockHandleAClassifier.mockResolvedValue([
    { type: 'create_file', target: '05. Notes/A classifier/test.md', payload: {}, description: 'Test' },
  ]);
  mockAppendToHistorique.mockResolvedValue(true);
  mockUpdateFrontmatter.mockResolvedValue(true);
  mockCreateVaultFile.mockResolvedValue(true);
  mockAppendToTodoInbox.mockResolvedValue({ success: true });
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

  it('S23 : traite un email catégorisé en silence — AUCUNE carte de validation', async () => {
    const email = makeEmail({ id: 'msg_valid' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_valid' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'a-classifier' }));

    const stats = await runEmailIngest();

    // Plus de carte de validation générique (décision verrouillée S23).
    expect(mockSavePending).not.toHaveBeenCalled();
    expect(mockSendValidationCard).not.toHaveBeenCalled();
    // Le traitement (documentation + tentative brouillon) a bien eu lieu.
    expect(stats.pendingCreated).toBe(1);
    expect(mockComposeDraft).toHaveBeenCalledTimes(1);
  });

  it('S23 : la documentation (actions du handler) s\'exécute en silence', async () => {
    const email = makeEmail({ id: 'msg_doc' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_doc' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'a-classifier' }));
    mockHandleAClassifier.mockResolvedValue([
      { type: 'create_file', target: '05. Notes/A classifier/doc.md', payload: { content: 'x' }, description: 'Dépôt' },
    ]);

    await runEmailIngest();

    // L'action de documentation est exécutée directement (createVaultFile),
    // sans passer par une carte de validation.
    expect(mockCreateVaultFile).toHaveBeenCalledTimes(1);
    expect(mockSavePending).not.toHaveBeenCalled();
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

  it('S23 : contact inconnu → SEULE la carte de création de contact (pas de carte de validation)', async () => {
    const email = makeEmail({ id: 'msg_nomatch' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_nomatch' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));

    // Handler retourne 3 actions dont une prompt_create_contact_choice
    mockHandleContactPro.mockResolvedValue([
      { type: 'create_file', target: '05. Notes/A classifier/test.md', payload: { content: 'x' }, description: 'Dépôt A classifier' },
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

    const stats = await runEmailIngest();

    // Plus AUCUNE carte de validation générique
    expect(mockSavePending).not.toHaveBeenCalled();
    expect(mockSendValidationCard).not.toHaveBeenCalled();

    // SEULE la carte no-match (création de contact) est envoyée
    // S24 soir : saveNoMatch est appelé 2 fois (init + re-save avec cardMessageId).
    expect(mockSaveNoMatch).toHaveBeenCalledTimes(2);
    expect(mockSendNoMatchCard).toHaveBeenCalledTimes(1);
    expect(stats.contactCardsSent).toBe(1);

    // Le NoMatchPending a les bonnes données
    const noMatchArg = mockSaveNoMatch.mock.calls[0]![0];
    expect(noMatchArg.emailFrom).toBe('francois@example.com');
    expect(noMatchArg.nameFrom).toBe('François');
    expect(noMatchArg.defaultType).toBe('pro');
    // Plus de pending parent : on référence directement le message.
    expect(noMatchArg.parentPendingId).toBe('msg_nomatch');

    // La documentation (create_file) a été exécutée en silence
    expect(mockCreateVaultFile).toHaveBeenCalledTimes(1);
    // Un brouillon est tenté (contact inconnu, pas répondu)
    expect(mockComposeDraft).toHaveBeenCalledTimes(1);
  });

  it('S23 : ne crée PAS de carte de contact si le handler ne retourne pas prompt_create_contact_choice', async () => {
    const email = makeEmail({ id: 'msg_normal' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_normal' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));

    // Handler retourne des actions normales (fiche existante, non-auto pour ce test)
    mockHandleContactPro.mockResolvedValue([
      { type: 'append_historique', target: 'test', payload: {}, description: 'Append' },
      { type: 'mark_processed', target: null, payload: {}, description: 'Mark' },
    ]);

    await runEmailIngest();

    // Plus aucune carte
    expect(mockSavePending).not.toHaveBeenCalled();
    expect(mockSendValidationCard).not.toHaveBeenCalled();
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

    // Le noMatch est sauvegardé même si l'envoi de la carte échoue
    expect(stats.pendingCreated).toBe(1);
    expect(stats.errors).toBe(0);
    // S24 soir : si l'envoi a échoué, on n'a que le save initial (pas de re-save
    // avec cardMessageId — la valeur n'est jamais disponible).
    expect(mockSaveNoMatch).toHaveBeenCalledTimes(1);
    // L'envoi a échoué → la carte n'est pas comptée comme envoyée
    expect(stats.contactCardsSent).toBe(0);
  });

  it('S23 : le NoMatchPending référence le messageId (plus de pending parent)', async () => {
    const email = makeEmail({ id: 'msg_uuid_diff' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_uuid_diff' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));

    mockHandleContactPro.mockResolvedValue([
      { type: 'create_file', target: 'test', payload: { content: 'x' }, description: 'Test' },
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

    const noMatchArg = mockSaveNoMatch.mock.calls[0]![0];
    // ID propre généré, parent = messageId (plus de carte de validation parente)
    expect(noMatchArg.id).toMatch(/^test-uuid-\d{4}$/);
    expect(noMatchArg.parentPendingId).toBe('msg_uuid_diff');
  });

  // --- Draft composer integration (Jalon 5B) ---

  it('appelle composeDraft après le handler et incrémente draftsCreated', async () => {
    const email = makeEmail({ id: 'msg_draft' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_draft' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'locataire' }));
    mockHandleLocataire.mockResolvedValue([
      { type: 'append_historique', target: 'test', payload: {}, description: 'Test' },
    ]);
    mockComposeDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-123',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts?compose=abc',
      preview: 'Bonjour, merci pour votre message.',
    });

    const stats = await runEmailIngest();

    expect(stats.draftsCreated).toBe(1);
    expect(stats.draftsSkipped).toBe(0);
    expect(stats.draftsFailed).toBe(0);
    expect(mockComposeDraft).toHaveBeenCalledWith(
      email,
      expect.objectContaining({ category: 'locataire' }),
      expect.any(Function),
    );
  });

  it('incrémente draftsSkipped quand composeDraft retourne skipReason', async () => {
    const email = makeEmail({ id: 'msg_draft_skip' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_draft_skip' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'a-classifier' }));
    mockComposeDraft.mockResolvedValue({
      success: false,
      skipReason: 'Catégorie a-classifier — pas éligible',
    });

    const stats = await runEmailIngest();

    expect(stats.draftsSkipped).toBe(1);
    expect(stats.draftsCreated).toBe(0);
  });

  it('incrémente draftsFailed quand composeDraft échoue (erreur)', async () => {
    const email = makeEmail({ id: 'msg_draft_fail' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_draft_fail' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'locataire' }));
    mockHandleLocataire.mockResolvedValue([
      { type: 'append_historique', target: 'test', payload: {}, description: 'Test' },
    ]);
    mockComposeDraft.mockResolvedValue({
      success: false,
      error: 'Sonnet timeout',
    });

    const stats = await runEmailIngest();

    expect(stats.draftsFailed).toBe(1);
    expect(stats.pendingCreated).toBe(1); // le pending est quand même créé
  });

  it('S23 : le brouillon est créé en silence (pas de carte) à partir de l\'email complet', async () => {
    const email = makeEmail({ id: 'msg_draft_url', threadId: 'thread_xyz', messageIdHeader: '<abc@mail>' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_draft_url' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'locataire' }));
    mockHandleLocataire.mockResolvedValue([
      { type: 'append_historique', target: '07. Contacts/Loc/x.md', payload: { title: 't', content: 'c' }, description: 'Test' },
    ]);
    mockComposeDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-456',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts?compose=xyz',
      preview: 'Bonjour Martin,',
    });

    const stats = await runEmailIngest();

    // Brouillon créé sans carte (le threading est géré dans draft-composer
    // à partir de email.threadId / email.messageIdHeader exposés par gmail-source).
    expect(stats.draftsCreated).toBe(1);
    expect(mockSavePending).not.toHaveBeenCalled();
    expect(mockComposeDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg_draft_url', threadId: 'thread_xyz', messageIdHeader: '<abc@mail>' }),
      expect.objectContaining({ category: 'locataire' }),
      expect.any(Function),
    );
  });

  it('ne crashe pas si composeDraft throw une exception', async () => {
    const email = makeEmail({ id: 'msg_draft_throw' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_draft_throw' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'locataire' }));
    mockHandleLocataire.mockResolvedValue([
      { type: 'append_historique', target: 'test', payload: {}, description: 'Test' },
    ]);
    mockComposeDraft.mockRejectedValue(new Error('ANTHROPIC_API_KEY manquant'));

    const stats = await runEmailIngest();

    expect(stats.draftsFailed).toBe(1);
    expect(stats.pendingCreated).toBe(1); // pipeline continue malgré l'erreur draft
    expect(stats.errors).toBe(0); // pas une erreur pipeline, juste un draft échoué
  });

  it('ne compose PAS de draft pour les emails spam auto-filtrés', async () => {
    const email = makeEmail({ id: 'msg_no_draft_spam' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_no_draft_spam' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(
      makeTriage({ category: 'spam', confidence: 0.95 }),
    );

    const stats = await runEmailIngest();

    expect(stats.haikuSpam).toBe(1);
    expect(mockComposeDraft).not.toHaveBeenCalled();
  });

  // --- TickTick integration (Jalon 5C) ---

  it('appelle createTickTickTaskForEmail pour un email catégorisé', async () => {
    const email = makeEmail({ id: 'msg_tt' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_tt' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'locataire' }));
    mockHandleLocataire.mockResolvedValue([
      { type: 'append_historique', target: 'test', payload: {}, description: 'Test' },
    ]);

    await runEmailIngest();

    expect(mockCreateTickTickTaskForEmail).toHaveBeenCalledTimes(1);
    expect(mockCreateTickTickTaskForEmail).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'msg_tt' }),
      expect.objectContaining({ category: 'locataire' }),
    );
  });

  it('ne crashe pas si createTickTickTaskForEmail throw', async () => {
    const email = makeEmail({ id: 'msg_tt_fail' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_tt_fail' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));
    mockHandleContactPro.mockResolvedValue([
      { type: 'create_file', target: 'test', payload: {}, description: 'Test' },
    ]);
    mockCreateTickTickTaskForEmail.mockRejectedValue(new Error('TickTick API down'));

    const stats = await runEmailIngest();

    // Pipeline continue normalement malgré l'erreur TickTick
    expect(stats.pendingCreated).toBe(1);
    expect(stats.errors).toBe(0);
  });

  it('ne crée PAS de tâche TickTick pour les emails spam auto-filtrés', async () => {
    const email = makeEmail({ id: 'msg_tt_spam' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_tt_spam' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(
      makeTriage({ category: 'spam', confidence: 0.95 }),
    );

    await runEmailIngest();

    expect(mockCreateTickTickTaskForEmail).not.toHaveBeenCalled();
  });

  // --- S18.5 : auto-execute pour contact existant + filtre emails système ---

  it('S23 : contact existant (actions auto) → documentation silencieuse + brouillon, aucune carte', async () => {
    const email = makeEmail({ id: 'msg_auto_existing' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_auto_existing' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));

    // Simule le retour d'un contact existant : 3 actions toutes autoExecute=true
    mockHandleContactPro.mockResolvedValue([
      {
        type: 'append_historique',
        target: '07. Contacts/03. Pro/Martin Yhuel.md',
        payload: {
          title: '### 2026-05-13 — suivi_dossier',
          content: 'Résumé.',
        },
        description: 'Append histo',
        autoExecute: true,
      },
      {
        type: 'update_frontmatter',
        target: '07. Contacts/03. Pro/Martin Yhuel.md',
        payload: { date_derniere_interaction: '2026-05-13' },
        description: 'Update date',
        autoExecute: true,
      },
      {
        type: 'mark_processed',
        target: null,
        payload: { messageId: 'msg_auto_existing' },
        description: 'Mark',
        autoExecute: true,
      },
    ]);
    mockComposeDraft.mockResolvedValue({ success: true, draftId: 'd1', gmailUrl: 'url', preview: 'Bonjour Martin,' });

    const stats = await runEmailIngest();

    // Aucune carte (ni validation, ni no-match)
    expect(mockSavePending).not.toHaveBeenCalled();
    expect(mockSendValidationCard).not.toHaveBeenCalled();
    expect(mockSaveNoMatch).not.toHaveBeenCalled();
    expect(mockSendNoMatchCard).not.toHaveBeenCalled();

    // Documentation appliquée en silence (le bug #1a est corrigé : plus de return anticipé)
    expect(mockAppendToHistorique).toHaveBeenCalledTimes(1);
    expect(mockUpdateFrontmatter).toHaveBeenCalledTimes(1);

    // BROUILLON désormais créé (correction du bug : un contact connu non répondu
    // doit avoir un brouillon, ce qui n'arrivait jamais avant S23)
    expect(mockComposeDraft).toHaveBeenCalledTimes(1);
    expect(stats.draftsCreated).toBe(1);

    // C'est un email intéressant traité → pendingCreated, pas autoExecuted (système)
    expect(stats.pendingCreated).toBe(1);
    expect(stats.systemEmailsFiltered).toBe(0);
  });

  it('S23 : contact existant DÉJÀ répondu → documentation seule, PAS de brouillon', async () => {
    const email = makeEmail({ id: 'msg_replied' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_replied' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));
    mockHasReplyFromMe.mockResolvedValue(true);
    mockHandleContactPro.mockResolvedValue([
      {
        type: 'append_historique',
        target: '07. Contacts/03. Pro/Martin Yhuel.md',
        payload: { title: 't', content: 'Résumé.' },
        description: 'Append histo',
        autoExecute: true,
      },
    ]);

    const stats = await runEmailIngest();

    // Documentation faite
    expect(mockAppendToHistorique).toHaveBeenCalledTimes(1);
    // Pas de brouillon (déjà répondu)
    expect(mockComposeDraft).not.toHaveBeenCalled();
    expect(stats.draftsSkippedAlreadyReplied).toBe(1);
    expect(stats.draftsCreated).toBe(0);
    expect(stats.pendingCreated).toBe(1);
  });

  it('S18.5 : email système (noreply) → autoExecuted + systemEmailsFiltered incrémentés', async () => {
    const email = makeEmail({
      id: 'msg_sys_noreply',
      from: { email: 'noreply@stripe.com' },
    });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_sys_noreply' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));

    // handler retourne uniquement mark_processed avec reason=system-email
    mockHandleContactPro.mockResolvedValue([
      {
        type: 'mark_processed',
        target: null,
        payload: { messageId: 'msg_sys_noreply', reason: 'system-email' },
        description: 'Email système — marqué traité',
        autoExecute: true,
      },
    ]);

    const stats = await runEmailIngest();

    expect(mockSavePending).not.toHaveBeenCalled();
    expect(mockSendValidationCard).not.toHaveBeenCalled();
    expect(stats.autoExecuted).toBe(1);
    expect(stats.systemEmailsFiltered).toBe(1);
    expect(stats.pendingCreated).toBe(0);
  });

  it('S23 : actions mixtes (auto + non-auto) → toutes exécutées en silence, aucune carte', async () => {
    const email = makeEmail({ id: 'msg_mixed' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_mixed' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));

    // 1 action auto + 1 non-auto → les DEUX sont exécutées (documentation),
    // plus de distinction « flux carte » vs « auto » (S23).
    mockHandleContactPro.mockResolvedValue([
      {
        type: 'append_historique',
        target: '07. Contacts/03. Pro/Martin.md',
        payload: { title: 't', content: 'c' },
        description: 'Auto',
        autoExecute: true,
      },
      {
        type: 'create_file',
        target: '05. Notes/A classifier/note.md',
        payload: { content: 'x' },
        description: 'Pas auto',
      },
    ]);

    const stats = await runEmailIngest();

    expect(mockSavePending).not.toHaveBeenCalled();
    expect(mockSendValidationCard).not.toHaveBeenCalled();
    // Les deux actions de documentation ont été exécutées directement
    expect(mockAppendToHistorique).toHaveBeenCalledTimes(1);
    expect(mockCreateVaultFile).toHaveBeenCalledTimes(1);
    expect(stats.pendingCreated).toBe(1);
  });

  it('S18.5 : audit log auto-execute contient auto:true et reason', async () => {
    const email = makeEmail({ id: 'msg_audit_auto', from: { email: 'martin@example.com' } });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_audit_auto' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));
    mockHandleContactPro.mockResolvedValue([
      {
        type: 'mark_processed',
        target: null,
        payload: { messageId: 'msg_audit_auto' },
        description: 'Mark',
        autoExecute: true,
      },
    ]);

    await runEmailIngest();

    // Trouver l'appel audit pour l'auto-action
    const autoCalls = mockWriteAuditLog.mock.calls.filter((call) => {
      const entry = call[0] as { trigger?: string; payload?: { auto?: boolean } };
      return entry.trigger?.startsWith('email_ingest:auto:') && entry.payload?.auto === true;
    });

    expect(autoCalls.length).toBeGreaterThan(0);
    const firstAutoCall = autoCalls[0]![0] as { payload: { auto: boolean; reason: string } };
    expect(firstAutoCall.payload.auto).toBe(true);
    expect(['system-email', 'contact-existing']).toContain(firstAutoCall.payload.reason);
  });
});

// ============================================================
// S23 — actions de cohérence (historique projet, copie PJ, hot-context)
// ============================================================

describe('runEmailIngest — actions de cohérence S23', () => {
  it('S24 : plus de carte hotcontext: (voie inline supprimée — le hot-context vit seul)', async () => {
    const email = makeEmail({ id: 'msg_hc', from: { email: 'avocat@cabinet.fr' } });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_hc' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));
    mockHandleContactPro.mockResolvedValue([
      { type: 'create_file', target: '05. Notes/x.md', payload: {}, description: 'note' },
    ]);
    // Même si un producteur legacy renvoyait un update_hot_context, aucune carte hot-context n'est envoyée.
    const patch = { patchId: 'p1', section: 'attends', action: 'add', payload: {}, source: 'email', sourceId: 'msg_hc', proposedAt: 'x', rationale: 'r', signalId: 's1' };
    mockBuildCoherenceActions.mockResolvedValue([
      { type: 'update_hot_context', target: null, payload: { patch }, description: 'hc', autoExecute: false },
    ]);

    await runEmailIngest();

    expect(mockSendHotContextPatchCard).not.toHaveBeenCalled();
    expect(mockSendValidationCard).not.toHaveBeenCalled();
  });

  it('S23 : copie PJ → exclue de la documentation auto (à traiter séparément), aucune carte', async () => {
    const email = makeEmail({ id: 'msg_pj', from: { email: 'compta@cabinet.fr' } });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_pj' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro' }));
    mockHandleContactPro.mockResolvedValue([
      { type: 'create_file', target: '05. Notes/x.md', payload: { content: 'x' }, description: 'note' },
    ]);
    mockBuildCoherenceActions.mockResolvedValue([
      {
        type: 'copy_attachment',
        target: '02. Projets/02. Pro/Documents/facture.pdf',
        payload: { messageId: 'msg_pj', attachmentId: 'att1' },
        description: 'Copier facture.pdf',
        autoExecute: false,
      },
    ]);

    const stats = await runEmailIngest();

    // Plus de carte de validation : la copie PJ n'est pas exécutée en auto.
    expect(mockSavePending).not.toHaveBeenCalled();
    expect(mockSendValidationCard).not.toHaveBeenCalled();
    // La documentation (create_file) reste exécutée
    expect(mockCreateVaultFile).toHaveBeenCalledTimes(1);
    expect(stats.errors).toBe(0);
  });

  it('histo projet auto + email contact connu → documentation silencieuse + brouillon, pas de carte', async () => {
    const email = makeEmail({ id: 'msg_auto', from: { email: 'martin@example.com' } });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_auto' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'contact-pro', projet: 'VI' }));
    // Handler contact connu → action auto silencieuse
    mockHandleContactPro.mockResolvedValue([
      { type: 'append_historique', target: '07. Contacts/01. Pro/Martin.md', payload: { title: 't', content: 'c' }, description: 'histo', autoExecute: true },
    ]);
    // Coherence : histo projet (auto)
    mockBuildCoherenceActions.mockResolvedValue([
      {
        type: 'append_projet_historique',
        target: null,
        payload: { projetCode: 'VI', title: '2026-05-25 — Email : Test', content: 'résumé' },
        description: 'histo projet VI',
        autoExecute: true,
      },
    ]);

    const stats = await runEmailIngest();

    // Aucune carte email
    expect(mockSavePending).not.toHaveBeenCalled();
    expect(mockSendValidationCard).not.toHaveBeenCalled();
    // L'historique projet a été appliqué silencieusement
    expect(mockAppendProjetHistoriqueLine).toHaveBeenCalledWith(
      'VI',
      expect.objectContaining({ title: expect.stringContaining('Email :') }),
    );
    // Brouillon tenté (pas répondu)
    expect(mockComposeDraft).toHaveBeenCalledTimes(1);
    expect(stats.pendingCreated).toBe(1);
  });

  it('coherence-actions throw → ne bloque pas le traitement de l email', async () => {
    const email = makeEmail({ id: 'msg_err' });
    mockListUnprocessed.mockResolvedValue([{ id: 'msg_err' }]);
    mockFetchDetail.mockResolvedValue(email);
    mockTriageEmail.mockResolvedValue(makeTriage({ category: 'a-classifier' }));
    mockBuildCoherenceActions.mockRejectedValue(new Error('coherence down'));

    const stats = await runEmailIngest();

    // Le traitement continue malgré l'échec coherence (pas de crash, pas de carte)
    expect(stats.errors).toBe(0);
    expect(mockSavePending).not.toHaveBeenCalled();
    expect(stats.pendingCreated).toBe(1);
  });
});
