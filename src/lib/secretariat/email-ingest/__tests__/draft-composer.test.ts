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

// Mock Anthropic SDK
const mockMessagesCreate = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Bonjour, merci pour votre message.\n\nCordialement,\nThomas Issa' }],
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: (...args: unknown[]) => mockMessagesCreate(...args) };
  },
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
  mockMessagesCreate.mockResolvedValue({
    content: [{ type: 'text', text: 'Bonjour, merci pour votre message.\n\nCordialement,\nThomas Issa' }],
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
    expect(mockMessagesCreate).not.toHaveBeenCalled();
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

    // Sonnet a été appelé
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    const [createArgs] = mockMessagesCreate.mock.calls[0]!;
    expect(createArgs.model).toContain('sonnet');

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
    const [createArgs] = mockMessagesCreate.mock.calls[0]!;
    const systemText = createArgs.system[0].text;
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

    const [createArgs] = mockMessagesCreate.mock.calls[0]!;
    const systemText = createArgs.system[0].text;
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

    const [createArgs] = mockMessagesCreate.mock.calls[0]!;
    const systemText = createArgs.system[0].text;
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

    const [createArgs] = mockMessagesCreate.mock.calls[0]!;
    const systemText = createArgs.system[0].text;
    expect(systemText).toContain('Vouvoiement systématique');
    expect(systemText).toContain('Thomas Issa');
  });

  it('retourne erreur si Sonnet ne retourne rien', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '' }],
    });

    const result = await composeDraft(makeEmail(), makeTriage());

    expect(result.success).toBe(false);
    expect(result.error).toContain('contenu');
  });

  it('retourne erreur si Gmail API échoue', async () => {
    mockCreateDraft.mockResolvedValue({
      success: false,
      error: 'HTTP 403: Insufficient permissions',
    });

    const result = await composeDraft(makeEmail(), makeTriage());

    expect(result.success).toBe(false);
    expect(result.error).toContain('Gmail API');
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

    const [createArgs] = mockMessagesCreate.mock.calls[0]!;
    const userMsg = createArgs.messages[0].content;
    expect(userMsg).toContain('[... tronqué]');
    // Le message ne devrait pas contenir les 3000 caractères complets
    expect(userMsg.length).toBeLessThan(3000);
  });

  it('utilise cache_control ephemeral sur le system prompt', async () => {
    mockCreateDraft.mockResolvedValue({
      success: true,
      draftId: 'draft-cache',
      gmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });

    await composeDraft(makeEmail(), makeTriage());

    const [createArgs] = mockMessagesCreate.mock.calls[0]!;
    expect(createArgs.system[0].cache_control).toEqual({ type: 'ephemeral' });
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

    const [createArgs] = mockMessagesCreate.mock.calls[0]!;
    const userMsg = createArgs.messages[0].content;
    expect(userMsg).toContain('Martin Dupont');
  });
});
