/**
 * Tests pour callback-handler — traitement des callbacks Telegram de validation.
 *
 * Mocks : vault-client, gmail-source, pending-store, telegram, fetch global.
 * telegram-cards est utilisé réellement (fonctions pures) sauf les fonctions
 * qui font des appels réseau (editMessageText, sendSimpleMessage) — mockées via fetch.
 *
 * Fix Jalon 4D-2 : ajout tests pour dispatch email_nomatch: (5 boutons contact).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PendingValidation } from '../telegram-cards';
import type { NoMatchPending } from '../no-match-card';
import type { TelegramCallback } from '../callback-handler';
import { handleTelegramCallback } from '../callback-handler';

// ============================================================
// Mocks
// ============================================================

const mockGetPending = vi.fn();
const mockDeletePending = vi.fn().mockResolvedValue(undefined);
const mockGetNoMatch = vi.fn();
const mockDeleteNoMatch = vi.fn().mockResolvedValue(undefined);

vi.mock('../pending-store', () => ({
  getPending: (...args: unknown[]) => mockGetPending(...args),
  deletePending: (...args: unknown[]) => mockDeletePending(...args),
  getNoMatch: (...args: unknown[]) => mockGetNoMatch(...args),
  deleteNoMatch: (...args: unknown[]) => mockDeleteNoMatch(...args),
}));

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

const mockMarkProcessed = vi.fn().mockResolvedValue(true);

vi.mock('../../gmail-source/gmail-source', () => ({
  markProcessed: (...args: unknown[]) => mockMarkProcessed(...args),
}));

const mockAnswerCallbackQuery = vi.fn().mockResolvedValue({ success: true });

vi.mock('../../telegram', () => ({
  answerCallbackQuery: (...args: unknown[]) => mockAnswerCallbackQuery(...args),
}));

const mockWriteAuditLog = vi.fn().mockResolvedValue(true);

vi.mock('../../vault-client/audit-log', () => ({
  writeAuditLog: (...args: unknown[]) => mockWriteAuditLog(...args),
}));

// ============================================================
// Mock fetch for Telegram API (editMessageText, sendSimpleMessage)
// ============================================================

const originalFetch = globalThis.fetch;

/** Capture les appels fetch vers l'API Telegram */
const telegramFetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];

function setupFetchMock(): void {
  telegramFetchCalls.length = 0;
  globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = String(url);

    if (urlStr.includes('api.telegram.org')) {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      telegramFetchCalls.push({ url: urlStr, body });

      return {
        ok: true,
        json: async () => ({
          ok: true,
          result: { message_id: 99 },
        }),
        text: async () => '',
      };
    }

    return { ok: false, status: 500 };
  });
}

// ============================================================
// Fixtures
// ============================================================

function makePending(overrides: Partial<PendingValidation> = {}): PendingValidation {
  return {
    id: 'pending-abc123',
    triage: {
      category: 'contact-pro',
      intent: 'validation_bail',
      confidence: 0.92,
      matchedContact: 'Martin Yhuel',
      summary: 'Validation clause bail',
      suggestedActions: [],
    },
    actions: [
      {
        type: 'append_historique',
        target: '07. Contacts/01. Pro/Martin Yhuel.md',
        payload: { title: '2026-05-12 — Bail', content: 'Détails' },
        description: 'Append historique',
      },
      {
        type: 'update_frontmatter',
        target: '07. Contacts/01. Pro/Martin Yhuel.md',
        payload: { fields: { date_dernière_interaction: '2026-05-12' } },
        description: 'Update frontmatter',
      },
    ],
    email: {
      source: 'gmail',
      id: 'msg-12345',
      from: { email: 'martin@test.com', name: 'Martin Yhuel' },
      to: [{ email: 'thomas@issa.com' }],
      cc: [],
      subject: 'Bail clause',
      bodyPlain: 'Bonjour Thomas, voici le détail du bail...',
      receivedAt: new Date('2026-05-12T10:00:00Z'),
      attachments: [],
      rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg-12345',
    },
    createdAt: '2026-05-12T10:05:00Z',
    ...overrides,
  };
}

function makeNoMatchPending(overrides: Partial<NoMatchPending> = {}): NoMatchPending {
  return {
    id: 'nomatch-abc123',
    parentPendingId: 'pending-abc123',
    emailFrom: 'francois@exemple.com',
    nameFrom: 'François Lambert',
    defaultType: 'pro',
    emailMessageId: 'msg-nm-001',
    emailThreadRef: '(cf. thread Gmail msg-nm-001)',
    createdAt: '2026-05-17T10:00:00Z',
    ...overrides,
  };
}

function makeCallback(action: string, pendingId = 'pending-abc123'): TelegramCallback {
  return {
    callback_query_id: 'cq-001',
    data: `email_val:${action}:${pendingId}`,
    message_id: 42,
    chat_id: 123456,
  };
}

function makeNoMatchCallback(type: string, noMatchId = 'nomatch-abc123'): TelegramCallback {
  return {
    callback_query_id: 'cq-nm-001',
    data: `email_nomatch:${type}:${noMatchId}`,
    message_id: 55,
    chat_id: 123456,
  };
}

// ============================================================
// Setup / Teardown
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
  mockGetPending.mockResolvedValue(makePending());
  mockDeletePending.mockResolvedValue(undefined);
  mockGetNoMatch.mockResolvedValue(makeNoMatchPending());
  mockDeleteNoMatch.mockResolvedValue(undefined);
  mockAppendToHistorique.mockResolvedValue(true);
  mockUpdateFrontmatter.mockResolvedValue(true);
  mockCreateVaultFile.mockResolvedValue(true);
  mockAppendToTodoInbox.mockResolvedValue({ success: true });
  mockMarkProcessed.mockResolvedValue(true);
  setupFetchMock();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

// ============================================================
// Tests — Validation principale (email_val:)
// ============================================================

describe('handleTelegramCallback — validation principale', () => {
  it('valider : exécute toutes les actions + markProcessed + delete pending', async () => {
    await handleTelegramCallback(makeCallback('valider'));

    // appendToHistorique appelé pour la première action
    expect(mockAppendToHistorique).toHaveBeenCalledOnce();
    expect(mockAppendToHistorique.mock.calls[0]![0]).toBe('07. Contacts/01. Pro');
    expect(mockAppendToHistorique.mock.calls[0]![1]).toBe('Martin Yhuel.md');

    // updateFrontmatter appelé pour la deuxième action
    expect(mockUpdateFrontmatter).toHaveBeenCalledOnce();

    // markProcessed appelé (pas dans les actions, donc auto)
    expect(mockMarkProcessed).toHaveBeenCalledWith('msg-12345');

    // Message Telegram édité (editMessageText via fetch)
    const editCall = telegramFetchCalls.find((c) => c.url.includes('editMessageText'));
    expect(editCall).toBeDefined();
    expect(editCall!.body['chat_id']).toBe(123456);
    expect(editCall!.body['message_id']).toBe(42);
    expect((editCall!.body['text'] as string)).toContain('Validé à');

    // Pending supprimé
    expect(mockDeletePending).toHaveBeenCalledWith('pending-abc123');

    // answerCallbackQuery toujours appelé
    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith('cq-001');
  });

  it('valider : audit chaque action', async () => {
    await handleTelegramCallback(makeCallback('valider'));

    // 2 actions dans le pending → 2 appels audit
    expect(mockWriteAuditLog).toHaveBeenCalledTimes(2);

    const firstAudit = mockWriteAuditLog.mock.calls[0]![0];
    expect(firstAudit.trigger).toContain('valider');
    expect(firstAudit.trigger).toContain('append_historique');
    expect(firstAudit.status).toBe('success');

    const secondAudit = mockWriteAuditLog.mock.calls[1]![0];
    expect(secondAudit.trigger).toContain('update_frontmatter');
    expect(secondAudit.status).toBe('success');
  });

  it('skip : ne touche pas au vault, markProcessed + delete pending', async () => {
    await handleTelegramCallback(makeCallback('skip'));

    // Pas d'appel vault
    expect(mockAppendToHistorique).not.toHaveBeenCalled();
    expect(mockUpdateFrontmatter).not.toHaveBeenCalled();
    expect(mockCreateVaultFile).not.toHaveBeenCalled();

    // markProcessed appelé
    expect(mockMarkProcessed).toHaveBeenCalledWith('msg-12345');

    // Message édité avec "Skippé"
    const editCall = telegramFetchCalls.find((c) => c.url.includes('editMessageText'));
    expect(editCall).toBeDefined();
    expect((editCall!.body['text'] as string)).toContain('Skippé');

    // Pending supprimé
    expect(mockDeletePending).toHaveBeenCalledWith('pending-abc123');

    // answerCallbackQuery
    expect(mockAnswerCallbackQuery).toHaveBeenCalled();
  });

  it('voir : envoie le body de l\'email, garde le pending actif', async () => {
    await handleTelegramCallback(makeCallback('voir'));

    // Nouveau message envoyé avec le body (sendSimpleMessage via fetch → sendMessage)
    const sendCalls = telegramFetchCalls.filter((c) => c.url.includes('sendMessage'));
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);

    const sendCall = sendCalls[0]!;
    expect((sendCall.body['text'] as string)).toContain('Corps de l\'email');
    expect((sendCall.body['text'] as string)).toContain('Bonjour Thomas');

    // Le pending n'est PAS supprimé
    expect(mockDeletePending).not.toHaveBeenCalled();

    // Pas de modification du vault
    expect(mockAppendToHistorique).not.toHaveBeenCalled();

    // answerCallbackQuery
    expect(mockAnswerCallbackQuery).toHaveBeenCalled();
  });

  it('modifier : envoie message "non implémenté", garde le pending actif', async () => {
    await handleTelegramCallback(makeCallback('modifier'));

    const sendCalls = telegramFetchCalls.filter((c) => c.url.includes('sendMessage'));
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);

    const sendCall = sendCalls[0]!;
    expect((sendCall.body['text'] as string)).toContain('non implémentée en V1');
    expect((sendCall.body['text'] as string)).toContain('Skip');

    // Pending reste actif
    expect(mockDeletePending).not.toHaveBeenCalled();

    // answerCallbackQuery
    expect(mockAnswerCallbackQuery).toHaveBeenCalled();
  });

  it('pending inexistant : envoie message "expiré"', async () => {
    mockGetPending.mockResolvedValue(null);

    await handleTelegramCallback(makeCallback('valider', 'inexistant-id'));

    const sendCalls = telegramFetchCalls.filter((c) => c.url.includes('sendMessage'));
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);
    expect((sendCalls[0]!.body['text'] as string)).toContain('expiré ou introuvable');

    // Pas d'action vault
    expect(mockAppendToHistorique).not.toHaveBeenCalled();

    // answerCallbackQuery
    expect(mockAnswerCallbackQuery).toHaveBeenCalled();
  });

  it('action vault échoue : audit "error" + continue les autres', async () => {
    // La première action échoue
    mockAppendToHistorique.mockResolvedValueOnce(false);

    await handleTelegramCallback(makeCallback('valider'));

    // Les 2 actions sont tentées
    expect(mockAppendToHistorique).toHaveBeenCalledOnce();
    expect(mockUpdateFrontmatter).toHaveBeenCalledOnce();

    // L'audit de la première action reflète l'erreur
    const firstAudit = mockWriteAuditLog.mock.calls[0]![0];
    expect(firstAudit.status).toBe('error');

    // Le message final mentionne des erreurs
    const editCall = telegramFetchCalls.find((c) => c.url.includes('editMessageText'));
    expect(editCall).toBeDefined();
    expect((editCall!.body['text'] as string)).toContain('certaines actions en erreur');

    // Le pending est quand même supprimé
    expect(mockDeletePending).toHaveBeenCalled();
  });

  it('answerCallbackQuery est toujours appelé, même en cas d\'erreur getPending', async () => {
    mockGetPending.mockRejectedValue(new Error('Drive timeout'));

    await handleTelegramCallback(makeCallback('valider'));

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith('cq-001');
  });

  it('callback data invalide : log un warning et acquitte', async () => {
    await handleTelegramCallback({
      callback_query_id: 'cq-002',
      data: 'invalid-data',
      message_id: 42,
      chat_id: 123456,
    });

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith('cq-002');
    expect(mockAppendToHistorique).not.toHaveBeenCalled();
  });

  it('valider avec action create_file', async () => {
    mockGetPending.mockResolvedValue(
      makePending({
        actions: [
          {
            type: 'create_file',
            target: '07. Contacts/01. Pro/Nouveau Contact.md',
            payload: { content: '---\nname: Nouveau\n---' },
            description: 'Créer fiche contact',
          },
        ],
      }),
    );

    await handleTelegramCallback(makeCallback('valider'));

    expect(mockCreateVaultFile).toHaveBeenCalledOnce();
    expect(mockCreateVaultFile.mock.calls[0]![0]).toBe('07. Contacts/01. Pro');
    expect(mockCreateVaultFile.mock.calls[0]![1]).toBe('Nouveau Contact.md');
  });

  it('valider avec action add_todo', async () => {
    mockGetPending.mockResolvedValue(
      makePending({
        actions: [
          {
            type: 'add_todo',
            target: null,
            payload: { title: 'Relancer Martin', date: '2026-05-15' },
            description: 'Ajouter tâche Todo.md',
          },
        ],
      }),
    );

    await handleTelegramCallback(makeCallback('valider'));

    expect(mockAppendToTodoInbox).toHaveBeenCalledOnce();
    expect(mockAppendToTodoInbox.mock.calls[0]![0]).toBe('Relancer Martin');
    expect(mockAppendToTodoInbox.mock.calls[0]![1]).toBe('2026-05-15');
  });

  it('valider avec action mark_processed dans les actions : pas de double appel', async () => {
    mockGetPending.mockResolvedValue(
      makePending({
        actions: [
          {
            type: 'mark_processed',
            target: null,
            payload: {},
            description: 'Marquer email comme traité',
          },
        ],
      }),
    );

    await handleTelegramCallback(makeCallback('valider'));

    // markProcessed appelé une seule fois (dans executeAction, pas en double)
    expect(mockMarkProcessed).toHaveBeenCalledOnce();
  });

  it('valider avec action target sans slash : retourne erreur audit', async () => {
    mockGetPending.mockResolvedValue(
      makePending({
        actions: [
          {
            type: 'append_historique',
            target: 'fichier-sans-dossier.md',
            payload: {},
            description: 'Action invalide',
          },
        ],
      }),
    );

    await handleTelegramCallback(makeCallback('valider'));

    // L'action doit être auditée en erreur
    const auditCall = mockWriteAuditLog.mock.calls[0]![0];
    expect(auditCall.status).toBe('error');
  });

  it('voir : tronque le body à 1500 caractères', async () => {
    const longBody = 'A'.repeat(2000);
    mockGetPending.mockResolvedValue(
      makePending({
        email: {
          ...makePending().email,
          bodyPlain: longBody,
        },
      }),
    );

    await handleTelegramCallback(makeCallback('voir'));

    const sendCalls = telegramFetchCalls.filter((c) => c.url.includes('sendMessage'));
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);
    const msgText = sendCalls[0]!.body['text'] as string;
    // Le body brut dans le <pre> devrait être tronqué (pas les 2000 A complets)
    const aCount = (msgText.match(/A/g) ?? []).length;
    expect(aCount).toBeLessThanOrEqual(1500);
  });
});

// ============================================================
// Tests — No-match dispatch (email_nomatch:) — Jalon 4D-2
// ============================================================

describe('handleTelegramCallback — no-match dispatch', () => {
  it('email_nomatch:pro crée une fiche dans 07. Contacts/03. Pro/', async () => {
    await handleTelegramCallback(makeNoMatchCallback('pro'));

    expect(mockCreateVaultFile).toHaveBeenCalledOnce();
    expect(mockCreateVaultFile.mock.calls[0]![0]).toBe('07. Contacts/03. Pro');
    expect(mockCreateVaultFile.mock.calls[0]![1]).toBe('Francois Lambert.md');

    const content = mockCreateVaultFile.mock.calls[0]![2] as string;
    expect(content).toContain('categorie: pro');
    expect(content).toContain('email: francois@exemple.com');
    expect(content).toContain('# François Lambert');
  });

  it('email_nomatch:famille crée une fiche dans 07. Contacts/01. Famille/', async () => {
    await handleTelegramCallback(makeNoMatchCallback('famille'));

    expect(mockCreateVaultFile).toHaveBeenCalledOnce();
    expect(mockCreateVaultFile.mock.calls[0]![0]).toBe('07. Contacts/01. Famille');
  });

  it('email_nomatch:amis crée une fiche dans 07. Contacts/02. Amis/', async () => {
    await handleTelegramCallback(makeNoMatchCallback('amis'));

    expect(mockCreateVaultFile).toHaveBeenCalledOnce();
    expect(mockCreateVaultFile.mock.calls[0]![0]).toBe('07. Contacts/02. Amis');
  });

  it('email_nomatch:autres crée une fiche dans 07. Contacts/04. Autres/', async () => {
    await handleTelegramCallback(makeNoMatchCallback('autres'));

    expect(mockCreateVaultFile).toHaveBeenCalledOnce();
    expect(mockCreateVaultFile.mock.calls[0]![0]).toBe('07. Contacts/04. Autres');
  });

  it('email_nomatch:skip supprime le noMatch sans créer de fiche', async () => {
    await handleTelegramCallback(makeNoMatchCallback('skip'));

    expect(mockCreateVaultFile).not.toHaveBeenCalled();
    expect(mockDeleteNoMatch).toHaveBeenCalledWith('nomatch-abc123');
  });

  it('no-match skip : édite le message avec "Skippé"', async () => {
    await handleTelegramCallback(makeNoMatchCallback('skip'));

    const editCall = telegramFetchCalls.find((c) => c.url.includes('editMessageText'));
    expect(editCall).toBeDefined();
    expect((editCall!.body['text'] as string)).toContain('Skippé');
  });

  it('no-match create : supprime le noMatch pending après création', async () => {
    await handleTelegramCallback(makeNoMatchCallback('pro'));

    expect(mockDeleteNoMatch).toHaveBeenCalledWith('nomatch-abc123');
  });

  it('no-match create : édite le message avec "Fiche créée"', async () => {
    await handleTelegramCallback(makeNoMatchCallback('pro'));

    const editCall = telegramFetchCalls.find((c) => c.url.includes('editMessageText'));
    expect(editCall).toBeDefined();
    expect((editCall!.body['text'] as string)).toContain('Fiche créée');
    expect((editCall!.body['text'] as string)).toContain('07. Contacts/03. Pro');
  });

  it('no-match create : audit JSONL', async () => {
    await handleTelegramCallback(makeNoMatchCallback('pro'));

    expect(mockWriteAuditLog).toHaveBeenCalled();
    const auditCall = mockWriteAuditLog.mock.calls[0]![0];
    expect(auditCall.trigger).toContain('nomatch_create');
    expect(auditCall.status).toBe('success');
  });

  it('no-match expiré : envoie message "expirée"', async () => {
    mockGetNoMatch.mockResolvedValue(null);

    await handleTelegramCallback(makeNoMatchCallback('pro', 'expired-id'));

    const sendCalls = telegramFetchCalls.filter((c) => c.url.includes('sendMessage'));
    expect(sendCalls.length).toBeGreaterThanOrEqual(1);
    expect((sendCalls[0]!.body['text'] as string)).toContain('expirée ou introuvable');

    expect(mockCreateVaultFile).not.toHaveBeenCalled();
  });

  it('no-match callback invalide (type inconnu) : pas de crash', async () => {
    await handleTelegramCallback({
      callback_query_id: 'cq-nm-bad',
      data: 'email_nomatch:invalid_type:some-id',
      message_id: 55,
      chat_id: 123456,
    });

    expect(mockCreateVaultFile).not.toHaveBeenCalled();
    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith('cq-nm-bad');
  });

  it('no-match sans nameFrom utilise le local-part email comme nom', async () => {
    mockGetNoMatch.mockResolvedValue(makeNoMatchPending({ nameFrom: null }));

    await handleTelegramCallback(makeNoMatchCallback('pro'));

    expect(mockCreateVaultFile).toHaveBeenCalledOnce();
    // "francois@exemple.com" → local-part "francois" → "Francois"
    expect(mockCreateVaultFile.mock.calls[0]![1]).toBe('Francois.md');

    const content = mockCreateVaultFile.mock.calls[0]![2] as string;
    expect(content).toContain('# Francois');
  });

  it('answerCallbackQuery est toujours appelé pour no-match', async () => {
    await handleTelegramCallback(makeNoMatchCallback('pro'));

    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith('cq-nm-001');
  });
});
