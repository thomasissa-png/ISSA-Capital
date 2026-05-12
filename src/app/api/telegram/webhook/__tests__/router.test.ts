/**
 * Tests unitaires — router 3 niveaux (commandes slash, workflows, inbox).
 *
 * Vérifie le routing des messages selon le mode actif :
 * - /cr → démarrage workflow CR
 * - /inbox → retour mode inbox + clear workflow
 * - /cancel → annulation workflow actif
 * - /status → affichage état
 * - Texte >= 80 chars sans workflow → démarrage CR auto
 * - Texte < 80 chars sans workflow → mode inbox
 * - Workflow expiré (TTL dépassé) → cleanup + retour inbox
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks hoisted
// ============================================================

const mocks = vi.hoisted(() => ({
  // Anthropic
  create: vi.fn(),
  // Telegram
  sendTelegramMessage: vi.fn().mockResolvedValue({ success: true }),
  sendTelegramConfirmation: vi.fn().mockResolvedValue({ success: true }),
  sendTelegramDocument: vi.fn().mockResolvedValue({ success: true }),
  answerCallbackQuery: vi.fn().mockResolvedValue({ success: true }),
  downloadTelegramPhoto: vi.fn().mockResolvedValue({
    success: true,
    base64: 'abc',
    mimeType: 'image/jpeg',
  }),
  downloadTelegramFile: vi.fn().mockResolvedValue({
    success: true,
    base64: 'abc',
    mimeType: 'audio/ogg',
  }),
  sendTypingAction: vi.fn().mockResolvedValue(undefined),
  // PDF generator
  generateCrPdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  // Conversation store
  getConversation: vi.fn().mockReturnValue([]),
  appendMessage: vi.fn(),
  toClaudeMessages: vi.fn().mockReturnValue([]),
  setPendingDraft: vi.fn(),
  getPendingDraft: vi.fn().mockReturnValue(null),
  clearPendingDraft: vi.fn(),
  clearConversation: vi.fn(),
  addPhoto: vi.fn().mockReturnValue(true),
  getPhotos: vi.fn().mockReturnValue([]),
  clearPhotos: vi.fn(),
  getActiveWorkflow: vi.fn().mockReturnValue(null),
  setActiveWorkflow: vi.fn(),
  clearActiveWorkflow: vi.fn(),
  // Reference counter
  getNextReference: vi.fn().mockReturnValue('IC-CR-2026-0001'),
  // Contacts
  formatContactsForPrompt: vi.fn().mockReturnValue('Contacts: Thomas Issa'),
  // Inbox
  handleInboxPhoto: vi.fn().mockResolvedValue({ success: true, userMessage: 'Photo enregistrée' }),
  handleInboxText: vi.fn().mockResolvedValue({ success: true, userMessage: 'Note enregistrée' }),
  handleInboxVoice: vi.fn().mockResolvedValue({ success: true, userMessage: 'Vocal enregistré' }),
  handleInboxDocument: vi.fn().mockResolvedValue({ success: true, userMessage: 'Document enregistré' }),
  handleInboxAlbum: vi.fn().mockResolvedValue({ success: true, userMessage: 'Album enregistré' }),
  // Inbox message router
  handleInboxMessage: vi.fn().mockResolvedValue(false),
  handleInboxVoiceMessage: vi.fn().mockResolvedValue(false),
  handleRouterCallback: vi.fn().mockResolvedValue('Action traitée'),
  // Workflow
  workflowStart: vi.fn().mockResolvedValue({
    newState: {
      type: 'cr', step: 'collecting', data: {},
      startedAt: Date.now(), expiresAt: Date.now() + 86400000,
    },
    messages: [],
  }),
  getWorkflow: vi.fn(),
  // fs
  readFileSync: vi.fn(),
}));

// ============================================================
// vi.mock() — factories
// ============================================================

vi.mock('node:fs', () => ({
  readFileSync: mocks.readFileSync.mockReturnValue(
    [
      '# System prompt',
      '## 2. System prompt complet',
      '```',
      'Tu es un secrétaire administratif expert en fiscalité française. ' +
        'Ce texte doit faire plus de 500 caractères pour passer la validation. ' +
        'Les comptes rendus de réunion sont établis conformément aux dispositions de ' +
        "l'article 39-1 du Code général des impôts. Chaque CR doit documenter " +
        "l'objet professionnel de la réunion, les participants, les points abordés, " +
        'les décisions prises et les suites à donner. Le format est structuré en JSON. ' +
        '[INJECTION_DATABASE_CONTACTS_ICI] ' +
        'Fin du prompt système pour les tests unitaires du router.',
      '```',
    ].join('\n'),
  ),
  existsSync: vi.fn(() => false),
  writeFileSync: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mocks.create },
  })),
}));

vi.mock('@/lib/secretariat/telegram', () => ({
  sendTelegramMessage: mocks.sendTelegramMessage,
  sendTelegramConfirmation: mocks.sendTelegramConfirmation,
  sendTelegramDocument: mocks.sendTelegramDocument,
  answerCallbackQuery: mocks.answerCallbackQuery,
  downloadTelegramPhoto: mocks.downloadTelegramPhoto,
  downloadTelegramFile: mocks.downloadTelegramFile,
  sendTypingAction: mocks.sendTypingAction,
}));

vi.mock('@/lib/secretariat/cr-renderer', () => ({
  renderCrForTelegram: vi.fn().mockReturnValue('COMPTE RENDU DE RÉUNION'),
  buildCraftTitle: vi.fn().mockReturnValue('CR Test'),
}));

vi.mock('@/lib/secretariat/contacts', () => ({
  formatContactsForPrompt: mocks.formatContactsForPrompt,
  addContact: vi.fn(),
}));

vi.mock('@/lib/secretariat/conversation-store', () => ({
  getConversation: mocks.getConversation,
  appendMessage: mocks.appendMessage,
  toClaudeMessages: mocks.toClaudeMessages,
  setPendingDraft: mocks.setPendingDraft,
  getPendingDraft: mocks.getPendingDraft,
  clearPendingDraft: mocks.clearPendingDraft,
  clearConversation: mocks.clearConversation,
  addPhoto: mocks.addPhoto,
  getPhotos: mocks.getPhotos,
  clearPhotos: mocks.clearPhotos,
  getActiveWorkflow: mocks.getActiveWorkflow,
  setActiveWorkflow: mocks.setActiveWorkflow,
  clearActiveWorkflow: mocks.clearActiveWorkflow,
}));

vi.mock('@/lib/secretariat/reference-counter', () => ({
  getNextReference: mocks.getNextReference,
}));

vi.mock('@/lib/secretariat/pdf-generator', () => ({
  generateCrPdf: mocks.generateCrPdf,
}));

vi.mock('@/lib/secretariat/drive-upload', () => ({
  uploadToDrive: vi.fn().mockResolvedValue({ success: false, error: 'test' }),
}));

vi.mock('@/lib/secretariat/cr-history', () => ({
  saveCrToHistory: vi.fn(),
  formatHistoryForPrompt: vi.fn().mockReturnValue(''),
}));

vi.mock('@/lib/secretariat/drive-backup', () => ({
  backupToGoogleDrive: vi.fn().mockResolvedValue(undefined),
  restoreFromGoogleDrive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/secretariat/workflows/registry', () => ({
  getWorkflow: mocks.getWorkflow,
}));

vi.mock('@/lib/secretariat/inbox', () => ({
  handleInboxPhoto: mocks.handleInboxPhoto,
  handleInboxText: mocks.handleInboxText,
  handleInboxVoice: mocks.handleInboxVoice,
  handleInboxDocument: mocks.handleInboxDocument,
  handleInboxAlbum: mocks.handleInboxAlbum,
}));

vi.mock('@/lib/secretariat/workflows/inbox-message-router', () => ({
  handleInboxMessage: mocks.handleInboxMessage,
  handleInboxVoiceMessage: mocks.handleInboxVoiceMessage,
  handleRouterCallback: mocks.handleRouterCallback,
  ROUTER_CALLBACK_PREFIX: 'inbox_router:',
}));

// ============================================================
// Env vars
// ============================================================

vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'test-secret');
vi.stubEnv('TELEGRAM_ALLOWED_CHAT_IDS', '12345');
vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

// ============================================================
// Import (après les mocks)
// ============================================================

import { POST } from '../route';

// ============================================================
// Helpers
// ============================================================

function makeRequest(body: unknown, secret = 'test-secret'): Request {
  return new Request('http://localhost:3000/api/telegram/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-telegram-bot-api-secret-token': secret,
    },
    body: JSON.stringify(body),
  });
}

function textMessage(text: string, chatId = 12345): unknown {
  return {
    update_id: 1,
    message: {
      message_id: 100,
      chat: { id: chatId, type: 'private' as const },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };
}

// ============================================================
// Tests
// ============================================================

describe('Router 3 niveaux', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getConversation.mockReturnValue([]);
    mocks.toClaudeMessages.mockReturnValue([]);
    mocks.getPendingDraft.mockReturnValue(null);
    mocks.getPhotos.mockReturnValue([]);
    mocks.getActiveWorkflow.mockReturnValue(null);
    mocks.sendTelegramMessage.mockResolvedValue({ success: true });
    mocks.getWorkflow.mockReturnValue({
      type: 'cr',
      ttlMs: 86400000,
      start: mocks.workflowStart,
    });
  });

  // ----------------------------------------------------------
  // Commande /cr → démarrage workflow CR
  // ----------------------------------------------------------
  it('/cr démarre le workflow CR', async () => {
    const res = await POST(makeRequest(textMessage('/cr')));
    expect(res.status).toBe(200);

    // Le workflow CR est démarré
    expect(mocks.workflowStart).toHaveBeenCalledWith(12345);
    expect(mocks.setActiveWorkflow).toHaveBeenCalledOnce();

    // Message de confirmation
    const msg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(msg).toContain('Mode CR activé');
  });

  // ----------------------------------------------------------
  // Commande /inbox → retour mode inbox + clear workflow
  // ----------------------------------------------------------
  it('/inbox force le retour en mode inbox et nettoie le workflow', async () => {
    // Simuler un workflow actif
    mocks.getActiveWorkflow.mockReturnValue({
      type: 'cr', step: 'collecting', data: {},
      startedAt: Date.now(), expiresAt: Date.now() + 86400000,
    });

    const res = await POST(makeRequest(textMessage('/inbox')));
    expect(res.status).toBe(200);

    expect(mocks.clearActiveWorkflow).toHaveBeenCalledWith(12345);
    expect(mocks.clearPendingDraft).toHaveBeenCalledWith(12345);
    expect(mocks.clearConversation).toHaveBeenCalledWith(12345);
    expect(mocks.clearPhotos).toHaveBeenCalledWith(12345);

    const msg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(msg).toContain('inbox');
  });

  // ----------------------------------------------------------
  // Commande /cancel → annulation workflow actif
  // ----------------------------------------------------------
  it('/cancel annule le workflow actif', async () => {
    mocks.getActiveWorkflow.mockReturnValue({
      type: 'cr', step: 'collecting', data: {},
      startedAt: Date.now(), expiresAt: Date.now() + 86400000,
    });

    const res = await POST(makeRequest(textMessage('/cancel')));
    expect(res.status).toBe(200);

    expect(mocks.clearActiveWorkflow).toHaveBeenCalledWith(12345);
    expect(mocks.clearPendingDraft).toHaveBeenCalledWith(12345);
    expect(mocks.clearConversation).toHaveBeenCalledWith(12345);

    const msg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(msg).toContain('Annulé');
  });

  // ----------------------------------------------------------
  // Commande /status → affichage état
  // ----------------------------------------------------------
  it('/status affiche le mode inbox quand aucun workflow actif', async () => {
    const res = await POST(makeRequest(textMessage('/status')));
    expect(res.status).toBe(200);

    const msg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(msg).toContain('inbox');
  });

  it('/status affiche le workflow actif', async () => {
    mocks.getActiveWorkflow.mockReturnValue({
      type: 'cr', step: 'collecting', data: {},
      startedAt: Date.now(), expiresAt: Date.now() + 86400000,
    });

    const res = await POST(makeRequest(textMessage('/status')));
    expect(res.status).toBe(200);

    const msg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(msg).toContain('workflow cr');
    expect(msg).toContain('collecting');
  });

  // ----------------------------------------------------------
  // Texte >= 80 chars sans workflow → démarrage CR auto
  // ----------------------------------------------------------
  it('démarre le CR automatiquement pour un texte long (>= 80 chars)', async () => {
    const longText = 'Déjeuner de travail avec Karim Benmoussa au restaurant Le Voltaire pour discuter de la stratégie de diversification';
    mocks.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify({
        status: 'needs_clarification',
        clarification_question: 'Quelle entité ?',
        detected_entite: null,
        detected_type: null,
        cr: null,
      }) }],
    });

    const res = await POST(makeRequest(textMessage(longText)));
    expect(res.status).toBe(200);

    // Le workflow CR est démarré automatiquement
    expect(mocks.workflowStart).toHaveBeenCalled();
    expect(mocks.setActiveWorkflow).toHaveBeenCalledOnce();

    // Claude est appelé
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  // ----------------------------------------------------------
  // Texte < 80 chars sans workflow → mode inbox
  // ----------------------------------------------------------
  it('traite un texte court comme une note inbox', async () => {
    const res = await POST(makeRequest(textMessage('Rappeler Jean-Pierre')));
    expect(res.status).toBe(200);

    // Le texte est envoyé au handler inbox
    expect(mocks.handleInboxText).toHaveBeenCalledWith(12345, 'Rappeler Jean-Pierre');

    // Claude n'est PAS appelé
    expect(mocks.create).not.toHaveBeenCalled();

    // Message de confirmation inbox
    const msg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(msg).toContain('Note enregistrée');
  });

  // ----------------------------------------------------------
  // Workflow expiré → retour inbox automatique
  // ----------------------------------------------------------
  it('traite un workflow expiré comme retour inbox', async () => {
    // getActiveWorkflow retourne null quand le workflow est expiré (auto-cleanup)
    mocks.getActiveWorkflow.mockReturnValue(null);

    const res = await POST(makeRequest(textMessage('ok')));
    expect(res.status).toBe(200);

    // Le texte court va en mode inbox
    expect(mocks.handleInboxText).toHaveBeenCalledWith(12345, 'ok');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // /cancel sans workflow actif → message "rien en cours"
  // ----------------------------------------------------------
  it('/cancel sans workflow actif affiche "rien en cours"', async () => {
    const res = await POST(makeRequest(textMessage('/cancel')));
    expect(res.status).toBe(200);

    const msg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(msg).toContain('Rien en cours');
  });

  // ----------------------------------------------------------
  // Commande inconnue → message d'aide
  // ----------------------------------------------------------
  it('répond aux commandes inconnues avec la liste des commandes', async () => {
    const res = await POST(makeRequest(textMessage('/blah')));
    expect(res.status).toBe(200);

    const msg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(msg).toContain('Commande inconnue');
    expect(msg).toContain('/cr');
    expect(msg).toContain('/inbox');
  });
});
