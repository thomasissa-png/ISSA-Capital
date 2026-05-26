/**
 * Tests unitaires — draft-composer (Jalon 5B).
 *
 * Mocks : vault-reader (findContactCached, readVaultFile),
 * gmail-client (createDraft), Anthropic SDK, vault-client/frontmatter.
 *
 * Vérifie : skip catégories, tonalité tu/vous, fallback tonalité,
 * création draft Gmail, gestion erreurs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EmailMessage } from '../../gmail-source/types';
import type { TriageResult } from '../../triage/types';

// ============================================================
// Mocks
// ============================================================

const mockFindContactCached = vi.fn().mockResolvedValue(null);
const mockReadVaultFile = vi.fn().mockResolvedValue({ success: false });

vi.mock('../../vault-reader', () => ({
  findContactCached: (...args: unknown[]) => mockFindContactCached(...args),
  readVaultFile: (...args: unknown[]) => mockReadVaultFile(...args),
}));

const mockCreateDraft = vi.fn().mockResolvedValue({ success: false, error: 'mock' });

vi.mock('../../gmail-source/gmail-client', () => ({
  createDraft: (...args: unknown[]) => mockCreateDraft(...args),
}));

// S22 — rédaction de brouillon routée via callLLM (task:'email-draft', DeepSeek).
// Mock du dispatcher : retourne { text } comme le site migré le consomme.
const mockCallLLM = vi.fn().mockResolvedValue({
  text: 'Bonjour, merci pour votre message.\n\nCordialement,\nThomas Issa',
  networkRetries: 0,
});

vi.mock('../../llm/client', () => ({
  callLLM: (...args: unknown[]) => mockCallLLM(...args),
}));

// S21.2 — skill-loader vault SOT (draft-email). Stub SkillContext minimal.
const mockLoadSkill = vi.fn().mockResolvedValue({
  name: 'draft-email',
  vaultPath: 'TEST',
  loadedAt: new Date(),
  frontmatter: { name: 'draft-email' },
  redLines: 'Ne JAMAIS inventer dates ou montants. Marqueur [À COMPLÉTER] si info manquante. Signature : "Thomas Issa". Texte brut, pas de HTML.',
  decisionTree: 'Registre : tu si tutoiement, vous sinon.',
  example: '',
  recapTemplate: '',
});

vi.mock('../../skills/skill-loader', () => ({
  loadSkill: (...args: unknown[]) => mockLoadSkill(...args),
  invalidateSkillCache: vi.fn(),
}));

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import { composeDraft, shouldComposeDraft } from '../draft-composer';

// ============================================================
// Fixtures
// ============================================================

function makeEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    source: 'gmail',
    id: 'msg_001',
    from: { email: 'martin@example.com', name: 'Martin Dupont' },
    to: [{ email: 'thomas@issacapital.com' }],
    cc: [],
    subject: 'Quittance avril',
    bodyPlain: 'Bonjour, pourriez-vous m\'envoyer la quittance d\'avril ? Merci.',
    receivedAt: new Date('2026-05-17T10:00:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg_001',
    ...overrides,
  };
}

function makeTriage(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    category: 'locataire',
    intent: 'demande_quittance_avril',
    confidence: 0.98,
    matchedContact: 'Martin Dupont',
    summary: 'Martin Dupont demande sa quittance de loyer d\'avril.',
    suggestedActions: [],
    ...overrides,
  };
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  // Ré-appliquer les implémentations par défaut (clearAllMocks ne les reset pas)
  mockFindContactCached.mockResolvedValue(null);
  mockReadVaultFile.mockResolvedValue({ success: false });
  mockCreateDraft.mockResolvedValue({ success: false, error: 'mock' });
  mockCallLLM.mockResolvedValue({
    text: 'Bonjour, merci pour votre message.\n\nCordialement,\nThomas Issa',
    networkRetries: 0,
  });
  // Env par défaut
  process.env['ANTHROPIC_API_KEY'] = 'test-api-key';
  process.env['GMAIL_USER_EMAIL'] = 'thomas@issacapital.com';
});

// ============================================================
// Tests
// ============================================================

describe('shouldComposeDraft', () => {
  it('retourne true pour locataire', () => {
    expect(shouldComposeDraft('locataire')).toBe(true);
  });

  it('retourne true pour contact-pro', () => {
    expect(shouldComposeDraft('contact-pro')).toBe(true);
  });

  it('retourne true pour apporteur', () => {
    expect(shouldComposeDraft('apporteur')).toBe(true);
  });

  it('retourne true pour a-classifier', () => {
    expect(shouldComposeDraft('a-classifier')).toBe(true);
  });

  it('retourne false pour spam', () => {
    expect(shouldComposeDraft('spam')).toBe(false);
  });

  it('retourne false pour candidat', () => {
    expect(shouldComposeDraft('candidat')).toBe(false);
  });
});

describe('composeDraft', () => {
  it('skip les emails spam', async () => {
    const result = await composeDraft(
      makeEmail(),
      makeTriage({ category: 'spam' }),
    );

    expect(result.success).toBe(false);
    expect(result.skipReason).toContain('spam');
    expect(mockCallLLM).not.toHaveBeenCalled();
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });

  it('skip les emails candidat', async () => {
    const result = await composeDraft(
      makeEmail(),
      makeTriage({ category: 'candidat' }),
    );

    expect(result.success).toBe(false);
    expect(result.skipReason).toContain('candidat');
  });

  it('génère un brouillon et crée le draft Gmail pour un locataire', async () => {
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-abc',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts?compose=abc',
    });

    const result = await composeDraft(makeEmail(), makeTriage());

    expect(result.success).toBe(true);
    expect(result.draftId).toBe('draft-abc');
    expect(result.gmailUrl).toContain('drafts');
    expect(result.preview).toBeTruthy();

    // Le LLM a été appelé pour la tâche email-draft
    expect(mockCallLLM).toHaveBeenCalledTimes(1);
    const [createArgs] = mockCallLLM.mock.calls[0]!;
    expect(createArgs.task).toBe('email-draft');

    // createDraft a été appelé avec le bon destinataire et sujet
    expect(mockCreateDraft).toHaveBeenCalledTimes(1);
    const draftArgs = mockCreateDraft.mock.calls[0]![0];
    expect(draftArgs.to).toBe('martin@example.com');
    expect(draftArgs.subject).toBe('Re: Quittance avril');
  });

  it('ajoute Re: au sujet si absent', async () => {
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-re',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(
      makeEmail({ subject: 'Question loyer' }),
      makeTriage(),
    );

    const draftArgs = mockCreateDraft.mock.calls[0]![0];
    expect(draftArgs.subject).toBe('Re: Question loyer');
  });

  it('ne duplique pas Re: si déjà présent', async () => {
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-re2',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(
      makeEmail({ subject: 'Re: Question loyer' }),
      makeTriage(),
    );

    const draftArgs = mockCreateDraft.mock.calls[0]![0];
    expect(draftArgs.subject).toBe('Re: Question loyer');
  });

  it('utilise le vouvoiement par défaut si pas de fiche contact', async () => {
    mockFindContactCached.mockResolvedValue(null);
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-vous',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(makeEmail(), makeTriage());

    // Vérifier que le system prompt contient "Vouvoiement"
    const [createArgs] = mockCallLLM.mock.calls[0]!;
    const systemText = createArgs.system as string;
    expect(systemText).toContain('Vouvoiement');
  });

  it('utilise le tutoiement si la fiche contact a tutoiement: true', async () => {
    mockFindContactCached.mockResolvedValue({
      name: 'Martin Dupont',
      folderPath: '07. Contacts/05. Locataires/01. Actuels',
      emails: ['martin@example.com'],
      content: '---\nnom: Dupont\nprenom: Martin\ntutoiement: true\n---\n',
      fileId: 'file-martin',
    });
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-tu',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(makeEmail(), makeTriage());

    const [createArgs] = mockCallLLM.mock.calls[0]!;
    const systemText = createArgs.system as string;
    expect(systemText).toContain('Tutoiement');
  });

  it('charge la tonalité depuis la fiche Thomas Issa.md si disponible', async () => {
    mockReadVaultFile.mockResolvedValue({
      success: true,
      content: '---\nnom: Issa\n---\n\n## Tonalité\n\nTon direct et bienveillant. Pas de blabla.\n\n## Autre section\n\nAutre contenu.',
    });
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-ton',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(makeEmail(), makeTriage());

    const [createArgs] = mockCallLLM.mock.calls[0]!;
    const systemText = createArgs.system as string;
    expect(systemText).toContain('Ton direct et bienveillant');
  });

  it('utilise le fallback tonalité si fiche Thomas indisponible', async () => {
    mockReadVaultFile.mockResolvedValue({ success: false });
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-fallback',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(makeEmail(), makeTriage());

    const [createArgs] = mockCallLLM.mock.calls[0]!;
    const systemText = createArgs.system as string;
    expect(systemText).toContain('Vouvoiement systématique');
    expect(systemText).toContain('Thomas Issa');
  });

  it('retourne erreur si le LLM ne retourne rien', async () => {
    mockCallLLM.mockResolvedValue({ text: '', networkRetries: 0 });

    const result = await composeDraft(makeEmail(), makeTriage());

    expect(result.success).toBe(false);
    expect(result.error).toContain('contenu');
  });

  it('S23 : garde corps-vide — corps trop court → PAS de brouillon', async () => {
    // « Bonjour » seul (< 40 caractères) = échec de génération.
    mockCallLLM.mockResolvedValue({ text: 'Bonjour', networkRetries: 0 });

    const result = await composeDraft(makeEmail(), makeTriage());

    expect(result.success).toBe(false);
    expect(result.error).toContain('trop court');
    // Aucun brouillon n'est créé dans Gmail.
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });

  it('S23 : garde corps-vide — corps de whitespace → PAS de brouillon', async () => {
    mockCallLLM.mockResolvedValue({ text: '   \n\n   ', networkRetries: 0 });

    const result = await composeDraft(makeEmail(), makeTriage());

    expect(result.success).toBe(false);
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });

  it('S23 : maxTokens porté à 2048 pour ne pas tronquer le brouillon', async () => {
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-tok',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(makeEmail(), makeTriage());

    const [createArgs] = mockCallLLM.mock.calls[0]!;
    expect(createArgs.maxTokens).toBe(2048);
  });

  it('S23 : rattache le brouillon au fil (threadId + In-Reply-To)', async () => {
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-thread',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(
      makeEmail({ threadId: 'thread-42', messageIdHeader: '<orig@mail.gmail.com>' }),
      makeTriage(),
    );

    const draftArgs = mockCreateDraft.mock.calls[0]![0];
    expect(draftArgs.threadId).toBe('thread-42');
    expect(draftArgs.inReplyTo).toBe('<orig@mail.gmail.com>');
  });

  it('S23 : sans threadId/Message-ID, le brouillon est créé sans threading (undefined)', async () => {
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-nothread',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(makeEmail(), makeTriage());

    const draftArgs = mockCreateDraft.mock.calls[0]![0];
    expect(draftArgs.threadId).toBeUndefined();
    expect(draftArgs.inReplyTo).toBeUndefined();
  });

  it('retourne erreur si la création du brouillon échoue', async () => {
    mockCreateDraft.mockResolvedValue({
      success: false,
      error: 'HTTP 403: Insufficient permissions',
    });

    const result = await composeDraft(makeEmail(), makeTriage());

    expect(result.success).toBe(false);
    expect(result.error).toContain('Création brouillon');
    expect(result.error).toContain('403');
  });

  it('tronque le body email à 2000 caractères dans le prompt', async () => {
    const longBody = 'A'.repeat(3000);
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-trunc',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(
      makeEmail({ bodyPlain: longBody }),
      makeTriage(),
    );

    const [createArgs] = mockCallLLM.mock.calls[0]!;
    const userMsg = createArgs.messages[0].content;
    expect(userMsg).toContain('[... tronqué]');
    // Le message ne devrait pas contenir les 3000 caractères complets
    expect(userMsg.length).toBeLessThan(3000);
  });

  it('passe un system prompt string au dispatcher (route DeepSeek)', async () => {
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-cache',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(makeEmail(), makeTriage());

    const [createArgs] = mockCallLLM.mock.calls[0]!;
    // S22 — le cache_control est géré côté wrapper Anthropic uniquement ;
    // la tâche email-draft route vers DeepSeek avec un system prompt string.
    expect(typeof createArgs.system).toBe('string');
    expect(createArgs.task).toBe('email-draft');
  });

  it('ne crashe pas si findContactCached throw', async () => {
    mockFindContactCached.mockRejectedValue(new Error('Vault reader down'));
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-err',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    const result = await composeDraft(makeEmail(), makeTriage());

    // Le draft est quand même créé avec le fallback tonalité
    expect(result.success).toBe(true);
  });

  it('inclut le nom du contact identifié dans le prompt utilisateur', async () => {
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-name',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(
      makeEmail(),
      makeTriage({ matchedContact: 'Martin Dupont' }),
    );

    const [createArgs] = mockCallLLM.mock.calls[0]!;
    const userMsg = createArgs.messages[0].content;
    expect(userMsg).toContain('Martin Dupont');
  });
});
