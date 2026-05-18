/**
 * Tests E2E dispatch G33 — health_renewed / health_snooze callbacks.
 *
 * Vérifie que les callbacks Telegram avec préfixes health_renewed:
 * et health_snooze: sont dispatchés vers les bons handlers.
 *
 * G33 BLOQUANT : tout callback Telegram doit avoir dispatch correct.
 *
 * Jalon S15.5E — Task C.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// vi.hoisted() — variables mockées accessibles dans vi.mock()
// ============================================================

const mocks = vi.hoisted(() => ({
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
  // Anthropic
  create: vi.fn(),
  // PDF generator
  generateCrPdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  // Craft
  publishToCraft: vi.fn().mockResolvedValue({ success: true, craftUrl: 'https://craft.test/doc' }),
  fetchRecentCRs: vi.fn().mockResolvedValue(''),
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
  formatContactsForPrompt: vi.fn().mockReturnValue('Contacts: Thomas'),
  // Inbox
  handleInboxPhoto: vi.fn().mockResolvedValue({ success: true, userMessage: 'Photo' }),
  handleInboxText: vi.fn().mockResolvedValue({ success: true, userMessage: 'Note' }),
  handleInboxVoice: vi.fn().mockResolvedValue({ success: true, userMessage: 'Vocal' }),
  handleInboxDocument: vi.fn().mockResolvedValue({ success: true, userMessage: 'Doc' }),
  handleInboxAlbum: vi.fn().mockResolvedValue({ success: true, userMessage: 'Album' }),
  // Inbox photo batch
  startOrExtendBatch: vi.fn(),
  isWaitingForInboxPhotoDate: vi.fn().mockReturnValue(false),
  hasPendingBatch: vi.fn().mockReturnValue(false),
  getBatchPhotoCount: vi.fn().mockReturnValue(0),
  handleDateReply: vi.fn().mockResolvedValue({ success: true, userMessage: null }),
  buildDatePromptMessage: vi.fn().mockReturnValue('Quelle date ?'),
  cancelBatch: vi.fn(),
  // Workflow registry
  getWorkflow: vi.fn().mockReturnValue({
    type: 'cr',
    ttlMs: 86400000,
    start: vi.fn().mockResolvedValue({
      newState: { type: 'cr', step: 'collecting', data: {}, startedAt: Date.now(), expiresAt: Date.now() + 86400000 },
      messages: [],
    }),
  }),
  // fs
  readFileSync: vi.fn(),
  // Email-ingest
  handleEmailValCallback: vi.fn().mockResolvedValue(undefined),
  // Health handlers (les cibles de ce test G33)
  handleHealthRenewed: vi.fn().mockResolvedValue(undefined),
  handleHealthSnooze: vi.fn().mockResolvedValue(undefined),
}));

// ============================================================
// vi.mock() — factories hoistées
// ============================================================

vi.mock('node:fs', () => ({
  readFileSync: mocks.readFileSync.mockReturnValue(
    [
      '# System prompt',
      '## 2. System prompt complet',
      '```',
      'Tu es un secrétaire administratif expert. ' +
        'Ce texte doit faire plus de 500 caractères pour passer la validation. ' +
        'Les comptes rendus de réunion sont établis conformément aux dispositions. ' +
        "l'article 39-1 du Code général des impôts. Chaque CR doit documenter " +
        "l'objet professionnel de la réunion, les participants, les points abordés, " +
        'les décisions prises et les suites à donner. Le format est structuré en JSON. ' +
        '[INJECTION_DATABASE_CONTACTS_ICI] ' +
        'Fin du prompt système pour les tests.',
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

vi.mock('@/lib/secretariat/pdf-generator', () => ({
  generateCrPdf: mocks.generateCrPdf,
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

vi.mock('@/lib/secretariat/workflows/inbox-photo-batch', () => ({
  startOrExtendBatch: mocks.startOrExtendBatch,
  isWaitingForInboxPhotoDate: mocks.isWaitingForInboxPhotoDate,
  hasPendingBatch: mocks.hasPendingBatch,
  getBatchPhotoCount: mocks.getBatchPhotoCount,
  handleDateReply: mocks.handleDateReply,
  buildDatePromptMessage: mocks.buildDatePromptMessage,
  cancelBatch: mocks.cancelBatch,
}));

vi.mock('@/lib/secretariat/reference-counter', () => ({
  getNextReference: mocks.getNextReference,
}));

vi.mock('@/lib/secretariat/contacts', () => ({
  formatContactsForPrompt: mocks.formatContactsForPrompt,
}));

vi.mock('@/lib/secretariat/telegram-validation', () => ({
  handleTelegramCallback: mocks.handleEmailValCallback,
}));

vi.mock('@/lib/secretariat/telegram-validation/handlers/health-renewed', () => ({
  handleHealthRenewed: mocks.handleHealthRenewed,
}));

vi.mock('@/lib/secretariat/telegram-validation/handlers/health-snooze', () => ({
  handleHealthSnooze: mocks.handleHealthSnooze,
}));

// ============================================================
// Env vars
// ============================================================

vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'test-secret');
vi.stubEnv('TELEGRAM_ALLOWED_CHAT_IDS', '12345');
vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

// ============================================================
// Import du module testé (APRES les mocks)
// ============================================================

import { POST } from '../route';

// ============================================================
// Helpers
// ============================================================

function makeRequest(body: unknown, secret = 'test-secret'): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (secret) {
    headers['x-telegram-bot-api-secret-token'] = secret;
  }
  return new Request('http://localhost:3000/api/telegram/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function callbackQuery(data: string, chatId = 12345): unknown {
  return {
    update_id: 2,
    callback_query: {
      id: 'cb-health-test',
      from: { id: 999, first_name: 'Thomas' },
      message: {
        message_id: 500,
        chat: { id: chatId, type: 'private' as const },
        date: Math.floor(Date.now() / 1000),
      },
      data,
    },
  };
}

// ============================================================
// Tests G33 — dispatch health callbacks
// ============================================================

describe('G33 — Health monitor callback dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveWorkflow.mockReturnValue(null);
    mocks.getPendingDraft.mockReturnValue(null);
  });

  it('dispatch health_renewed: vers handleHealthRenewed', async () => {
    const payload = callbackQuery('health_renewed:ticktick_access_token');
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mocks.handleHealthRenewed).toHaveBeenCalledTimes(1);
    expect(mocks.handleHealthRenewed).toHaveBeenCalledWith({
      callbackQueryId: 'cb-health-test',
      callbackData: 'health_renewed:ticktick_access_token',
      chatId: 12345,
      messageId: 500,
    });
    // Ne doit PAS passer par email_val ou autre handler
    expect(mocks.handleEmailValCallback).not.toHaveBeenCalled();
  });

  it('dispatch health_snooze: vers handleHealthSnooze', async () => {
    const payload = callbackQuery('health_snooze:domain_renewal');
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mocks.handleHealthSnooze).toHaveBeenCalledTimes(1);
    expect(mocks.handleHealthSnooze).toHaveBeenCalledWith({
      callbackQueryId: 'cb-health-test',
      callbackData: 'health_snooze:domain_renewal',
      chatId: 12345,
      messageId: 500,
    });
    // Ne doit PAS passer par email_val ou autre handler
    expect(mocks.handleEmailValCallback).not.toHaveBeenCalled();
  });

  it('ne crash pas sur un callback inconnu health_xxx:', async () => {
    // Un préfixe "health_xxx:" n'existe pas — le webhook ne doit pas crash,
    // il doit tomber dans le fallback normal (pas de pending draft)
    const payload = callbackQuery('health_xxx:something');
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    // Ni health_renewed ni health_snooze ne doivent être appelés
    expect(mocks.handleHealthRenewed).not.toHaveBeenCalled();
    expect(mocks.handleHealthSnooze).not.toHaveBeenCalled();
  });
});
