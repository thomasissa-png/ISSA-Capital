/**
 * Tests unitaires — router 3 niveaux (commandes slash, workflows, inbox).
 *
 * Vérifie le routing des messages selon le mode actif :
 * - /cr → démarrage workflow CR
 * - /inbox → retour mode inbox + clear workflow
 * - /cancel → annulation workflow actif
 * - /status → affichage état
 * - Texte >= 100 chars sans workflow → démarrage CR auto
 * - Texte < 100 chars sans workflow → mode inbox
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
  // Inbox message router (S20.2 — handleInboxVoiceMessage @deprecated, plus
  // appelé sur vocal ; transcribeWithWhisper utilisé directement par webhook).
  handleInboxVoiceMessage: vi.fn().mockResolvedValue(false),
  handleRouterCallback: vi.fn().mockResolvedValue('Action traitée'),
  transcribeWithWhisper: vi.fn().mockResolvedValue({ success: true, text: 'transcript test' }),
  // S20.1 → S20.2 — Telegram → TickTick PREVIEW flow (mocks neutres)
  parseAddTaskFromText: vi.fn(),
  previewAddTaskFromTelegram: vi.fn().mockResolvedValue({ status: 'preview_sent', pendingId: 'pid-test' }),
  patchAndPreviewAddTaskFromInstruction: vi.fn().mockResolvedValue({ status: 'preview_sent', pendingId: 'pid-test-2' }),
  looksLikeTask: vi.fn(),
  findLatestAwaitingEditForChat: vi.fn().mockReturnValue(null),
  handleTaskCallback: vi.fn().mockResolvedValue({ status: 'unknown_action' }),
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
  handleInboxVoiceMessage: mocks.handleInboxVoiceMessage,
  handleRouterCallback: mocks.handleRouterCallback,
  ROUTER_CALLBACK_PREFIX: 'inbox_router:',
  transcribeWithWhisper: mocks.transcribeWithWhisper,
}));

// S20.1 → S20.2 — mocks pour PREVIEW flow Telegram → TickTick + store pendings
vi.mock('@/lib/secretariat/handlers/todo-from-telegram', () => ({
  parseAddTaskFromText: mocks.parseAddTaskFromText,
  previewAddTaskFromTelegram: mocks.previewAddTaskFromTelegram,
  patchAndPreviewAddTaskFromInstruction: mocks.patchAndPreviewAddTaskFromInstruction,
  looksLikeTask: mocks.looksLikeTask,
}));

vi.mock('@/lib/secretariat/handlers/task', () => ({
  handleTaskCallback: mocks.handleTaskCallback,
  TASK_CALLBACK_PREFIX: 'task_',
}));

vi.mock('@/lib/secretariat/task-pending-store', () => ({
  findLatestAwaitingEditForChat: mocks.findLatestAwaitingEditForChat,
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

/** Construit un payload Telegram avec un message vocal (Fix 1 — S20.2). */
function voiceMessage(chatId = 12345): unknown {
  return {
    update_id: 1,
    message: {
      message_id: 100,
      chat: { id: chatId, type: 'private' as const },
      date: Math.floor(Date.now() / 1000),
      voice: {
        file_id: 'voice-file-id-1',
        file_unique_id: 'voice-uid-1',
        duration: 5,
        mime_type: 'audio/ogg',
        file_size: 12345,
      },
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
  // Texte >= 100 chars sans workflow → démarrage CR auto
  // ----------------------------------------------------------
  it('démarre le CR automatiquement pour un texte long (>= 100 chars)', async () => {
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
  // S20.1 — Texte court intent-tâche → preview TickTick (Bug 2 fix)
  // ----------------------------------------------------------
  it('texte court tâche-like ("Rappeler X") → preview TickTick (Bug 2 fix)', async () => {
    mocks.parseAddTaskFromText.mockResolvedValueOnce({
      intent: 'add_task',
      title: 'Rappeler Jean-Pierre',
    });
    mocks.looksLikeTask.mockReturnValueOnce(true);

    const res = await POST(makeRequest(textMessage('Rappeler Jean-Pierre')));
    expect(res.status).toBe(200);

    // Le texte est routé vers le preview TickTick, PAS vers note Drive
    expect(mocks.previewAddTaskFromTelegram).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 12345 }),
    );
    expect(mocks.handleInboxText).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // S20.1 — Texte court non-tâche → fallback note Drive
  // ----------------------------------------------------------
  it('texte court non-tâche ("ok") → fallback note Drive (Bug 2 fix)', async () => {
    mocks.getActiveWorkflow.mockReturnValue(null);
    mocks.parseAddTaskFromText.mockResolvedValueOnce({
      intent: 'add_task',
      title: 'ok',
    });
    mocks.looksLikeTask.mockReturnValueOnce(false);

    const res = await POST(makeRequest(textMessage('ok')));
    expect(res.status).toBe(200);

    // Pas de preview (looksLikeTask=false) → fallback note inbox
    expect(mocks.previewAddTaskFromTelegram).not.toHaveBeenCalled();
    expect(mocks.handleInboxText).toHaveBeenCalledWith(12345, 'ok');
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

  // ----------------------------------------------------------
  // Fix 1 (S20.2) — Vocal Telegram → preview TickTick
  // ----------------------------------------------------------
  it('Fix 1 — vocal task-like → transcribeWithWhisper + previewAddTaskFromTelegram (PAS handleInboxVoiceMessage)', async () => {
    mocks.transcribeWithWhisper.mockResolvedValueOnce({
      success: true,
      text: 'appeler Martin demain matin',
    });
    mocks.parseAddTaskFromText.mockResolvedValueOnce({
      intent: 'add_task',
      title: 'appeler Martin demain matin',
    });
    mocks.looksLikeTask.mockReturnValueOnce(true);

    const res = await POST(makeRequest(voiceMessage()));
    expect(res.status).toBe(200);

    expect(mocks.transcribeWithWhisper).toHaveBeenCalledOnce();
    expect(mocks.previewAddTaskFromTelegram).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: 12345 }),
    );
    // Anti-régression : l'ancien router Calendar/Todo.md ne doit JAMAIS être appelé.
    expect(mocks.handleInboxVoiceMessage).not.toHaveBeenCalled();
    // Pas de fallback note Drive non plus (puisque c'est une tâche valide).
    expect(mocks.handleInboxVoice).not.toHaveBeenCalled();
  });

  it('Fix 1 — vocal non-task (ack "ok merci") → fallback note Drive (handleInboxVoice)', async () => {
    mocks.transcribeWithWhisper.mockResolvedValueOnce({
      success: true,
      text: 'ok merci',
    });
    mocks.parseAddTaskFromText.mockResolvedValueOnce({
      intent: 'add_task',
      title: 'ok merci',
    });
    mocks.looksLikeTask.mockReturnValueOnce(false);

    const res = await POST(makeRequest(voiceMessage()));
    expect(res.status).toBe(200);

    expect(mocks.transcribeWithWhisper).toHaveBeenCalledOnce();
    expect(mocks.previewAddTaskFromTelegram).not.toHaveBeenCalled();
    // Fallback note Drive.
    expect(mocks.handleInboxVoice).toHaveBeenCalled();
    // Pas de router Calendar/Todo.md.
    expect(mocks.handleInboxVoiceMessage).not.toHaveBeenCalled();
  });

  it('Fix 1 — vocal Whisper KO → fallback note Drive (comportement préservé)', async () => {
    mocks.transcribeWithWhisper.mockResolvedValueOnce({
      success: false,
      error: 'OPENAI_API_KEY missing',
    });

    const res = await POST(makeRequest(voiceMessage()));
    expect(res.status).toBe(200);

    expect(mocks.transcribeWithWhisper).toHaveBeenCalledOnce();
    // Whisper KO → on n'essaie même pas parseAddTaskFromText.
    expect(mocks.parseAddTaskFromText).not.toHaveBeenCalled();
    expect(mocks.previewAddTaskFromTelegram).not.toHaveBeenCalled();
    // Fallback : upload direct Drive.
    expect(mocks.handleInboxVoice).toHaveBeenCalled();
    expect(mocks.handleInboxVoiceMessage).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // Fix 2 (S20.2) — Modify intelligent : webhook dispatch vers patchAndPreview
  // ----------------------------------------------------------
  it('Fix 2 — pending awaiting_edit + nouveau texte → patchAndPreviewAddTaskFromInstruction (PAS reparse complet)', async () => {
    // Simule un pending en phase awaiting_edit (Thomas a cliqué ✏️ Modifier).
    mocks.findLatestAwaitingEditForChat.mockReturnValueOnce({
      pendingId: 'pid-abc',
      phase: 'awaiting_edit',
      parsed: { intent: 'add_task', title: 'appeler Martin' },
      projectName: null,
      projectId: null,
      taskId: null,
      chatId: 12345,
      messageId: 100,
      createdAt: Date.now(),
    });

    const res = await POST(makeRequest(textMessage('à 15h')));
    expect(res.status).toBe(200);

    // Le webhook dispatche vers patchAndPreviewAddTaskFromInstruction avec
    // l'instruction "à 15h" — JAMAIS vers parseAddTaskFromText (re-parse complet
    // que Thomas a explicitement banni en S20.2).
    expect(mocks.patchAndPreviewAddTaskFromInstruction).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 12345,
        instruction: 'à 15h',
        pending: expect.objectContaining({ pendingId: 'pid-abc' }),
      }),
    );
    // Pas de fallback note Drive (le pending awaiting_edit a la priorité).
    expect(mocks.handleInboxText).not.toHaveBeenCalled();
  });
});
