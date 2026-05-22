/**
 * Tests unitaires — POST /api/telegram/webhook
 *
 * Mock de tous les modules externes (Anthropic, Telegram, Craft, fs).
 * Le POST handler est appelé directement avec un objet Request.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// vi.hoisted() — variables mockées accessibles dans vi.mock()
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
  generateCrPdf: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
  // Craft publisher
  publishToCraft: vi.fn().mockResolvedValue({
    success: true,
    craftUrl: 'https://craft.test/doc',
  }),
  // Craft reader
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
  // Contacts (S21.4 — async, lit le vault Drive)
  formatContactsForPrompt: vi.fn().mockResolvedValue('Contacts: Thomas Issa — Président'),
  // Inbox
  handleInboxPhoto: vi.fn().mockResolvedValue({ success: true, userMessage: 'Photo enregistrée' }),
  handleInboxText: vi.fn().mockResolvedValue({ success: true, userMessage: 'Note enregistrée' }),
  handleInboxVoice: vi.fn().mockResolvedValue({ success: true, userMessage: 'Vocal enregistré' }),
  handleInboxDocument: vi.fn().mockResolvedValue({ success: true, userMessage: 'Document enregistré' }),
  handleInboxAlbum: vi.fn().mockResolvedValue({ success: true, userMessage: 'Album enregistré' }),
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
  // Email-ingest validation
  handleEmailValCallback: vi.fn().mockResolvedValue(undefined),
}));

// ============================================================
// vi.mock() — factories hoistées, référencent `mocks`
// ============================================================

vi.mock('node:fs', () => ({
  readFileSync: mocks.readFileSync.mockReturnValue(
    [
      '# System prompt',
      '## 2. System prompt complet',
      '```',
      'Tu es un secrétaire administratif expert en fiscalité française. ' +
        'Ce texte doit faire plus de 500 caractères pour passer la validation de longueur. ' +
        'Les comptes rendus de réunion sont établis conformément aux dispositions de ' +
        "l'article 39-1 du Code général des impôts. Chaque CR doit documenter " +
        "l'objet professionnel de la réunion, les participants, les points abordés, " +
        'les décisions prises et les suites à donner. Le format est structuré en JSON. ' +
        '[INJECTION_DATABASE_CONTACTS_ICI] ' +
        'Fin du prompt système pour les tests unitaires du webhook.',
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

// Craft retiré (session 9) — plus de mock nécessaire

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

// S21.2 — skill-loader vault SOT. On stubs un SkillContext minimal avec
// le placeholder legacy d'injection contacts pour préserver le comportement
// des assertions existantes (le contenu de prompt n'a aucun impact sur les
// tests qui mockent la réponse Claude directement).
vi.mock('@/lib/secretariat/skills/skill-loader', () => ({
  loadSkill: vi.fn().mockResolvedValue({
    name: 'cr-reunion',
    vaultPath: 'TEST',
    loadedAt: new Date(),
    frontmatter: { name: 'cr-reunion' },
    redLines: 'Red lines test — Article 39-1 CGI. [INJECTION_DATABASE_CONTACTS_ICI]',
    decisionTree: 'Arbre de décision test.',
    example: 'Exemple test.',
    recapTemplate: 'Récap test.',
  }),
  invalidateSkillCache: vi.fn(),
}));

// ============================================================
// Env vars
// ============================================================

vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'test-secret');
vi.stubEnv('TELEGRAM_ALLOWED_CHAT_IDS', '12345');
vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import { POST } from '../route';

// ============================================================
// Helpers
// ============================================================

/** Construit un Request avec le header secret et un body JSON. */
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

/** Construit un payload Telegram message texte minimal. */
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

/** Construit un payload Telegram callback_query minimal. */
function callbackQuery(data: string, chatId = 12345): unknown {
  return {
    update_id: 2,
    callback_query: {
      id: 'cb-123',
      from: { id: 999, first_name: 'Thomas' },
      message: {
        message_id: 200,
        chat: { id: chatId, type: 'private' as const },
        date: Math.floor(Date.now() / 1000),
      },
      data,
    },
  };
}

/** Construit un payload Telegram message avec sticker (pas de texte). */
function stickerMessage(chatId = 12345): unknown {
  return {
    update_id: 3,
    message: {
      message_id: 101,
      chat: { id: chatId, type: 'private' as const },
      date: Math.floor(Date.now() / 1000),
      sticker: { file_id: 'sticker-1', type: 'regular', width: 512, height: 512 },
    },
  };
}

/** Exemple de CRDraft valide pour les tests. */
const VALID_CR_DRAFT = {
  reference_placeholder: '[REF_TO_BE_GENERATED]' as const,
  entite: 'IC' as const,
  type_reunion: 'dejeuner' as const,
  date_reunion: '2026-04-09',
  lieu: 'Le Voltaire, 27 quai Voltaire, 75007 Paris',
  participants: [
    {
      prenom: 'Karim',
      nom: 'Benmoussa',
      titre: 'Directeur général',
      societe: 'Benmoussa Conseil',
      qualite_relation: 'Conseiller stratégique',
    },
  ],
  objet: 'Déjeuner de travail sur la stratégie de diversification immobilière.',
  montant_ttc_eur: 185.5,
  etablissement_nom: 'Le Voltaire',
  section_1_objet_art_39_1:
    "Ce déjeuner s'inscrit dans le cadre de la stratégie de diversification " +
    "immobilière d'ISSA Capital. La rencontre avec Karim Benmoussa vise à évaluer " +
    'les opportunités du marché parisien.',
  section_2_points_abordes:
    'Les points suivants ont été abordés lors de la réunion : analyse du marché ' +
    'immobilier parisien, étude des opportunités de diversification, évaluation ' +
    'des risques et rendements potentiels.',
  section_3_decisions:
    'Décision prise de poursuivre les investigations sur deux biens identifiés.',
  section_4_suites_a_donner: 'Karim enverra les estimations sous 15 jours.',
  annexes_photographiques: null,
};

/** Réponse Claude simulée — needs_clarification. */
function claudeResponseClarification(question: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          status: 'needs_clarification',
          clarification_question: question,
          detected_entite: null,
          detected_type: null,
          cr: null,
        }),
      },
    ],
  };
}

/** Réponse Claude simulée — ready avec CR complet. */
function claudeResponseReady() {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          status: 'ready',
          clarification_question: null,
          detected_entite: 'IC',
          detected_type: 'dejeuner',
          cr: VALID_CR_DRAFT,
        }),
      },
    ],
  };
}

/** Réponse Claude simulée — texte libre (pas de JSON). */
function claudeResponseFreeText(text: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text,
      },
    ],
  };
}

// ============================================================
// Tests
// ============================================================

describe('POST /api/telegram/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset defaults
    mocks.getConversation.mockReturnValue([]);
    mocks.toClaudeMessages.mockReturnValue([]);
    mocks.getPendingDraft.mockReturnValue(null);
    mocks.getPhotos.mockReturnValue([]);
    mocks.getActiveWorkflow.mockReturnValue(null);
    mocks.getWorkflow.mockReturnValue({
      type: 'cr',
      ttlMs: 86400000,
      start: vi.fn().mockResolvedValue({
        newState: { type: 'cr', step: 'collecting', data: {}, startedAt: Date.now(), expiresAt: Date.now() + 86400000 },
        messages: [],
      }),
    });
    mocks.publishToCraft.mockResolvedValue({
      success: true,
      craftUrl: 'https://craft.test/doc',
    });
    mocks.sendTelegramMessage.mockResolvedValue({ success: true });
    mocks.sendTelegramConfirmation.mockResolvedValue({ success: true });
    mocks.sendTelegramDocument.mockResolvedValue({ success: true });
    mocks.answerCallbackQuery.mockResolvedValue({ success: true });
    mocks.fetchRecentCRs.mockResolvedValue('');
    mocks.generateCrPdf.mockResolvedValue(Buffer.from('fake-pdf-content'));
  });

  // ----------------------------------------------------------
  // 1. Sans header secret → 200 + ignored
  // ----------------------------------------------------------
  it('retourne 200 + ignored si le header secret est absent', async () => {
    const req = new Request('http://localhost:3000/api/telegram/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(textMessage('hello')),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ignored).toBe('invalid_secret');
  });

  // ----------------------------------------------------------
  // 2. Mauvais secret → 200 + ignored
  // ----------------------------------------------------------
  it('retourne 200 + ignored si le secret est incorrect', async () => {
    const res = await POST(makeRequest(textMessage('hello'), 'wrong-secret'));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ignored).toBe('invalid_secret');
  });

  // ----------------------------------------------------------
  // 3. Body invalide → 200 + ignored
  // ----------------------------------------------------------
  it('retourne 200 + ignored pour un payload Telegram invalide', async () => {
    const res = await POST(makeRequest({ not_a_valid: 'telegram_update' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ignored).toBe('invalid_payload');
  });

  // ----------------------------------------------------------
  // 4. chat_id non whitelisté → 200 silencieux
  // ----------------------------------------------------------
  it('retourne 200 silencieux si le chat_id est non autorisé', async () => {
    const res = await POST(makeRequest(textMessage('hello', 99999)));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.ignored).toBeUndefined();
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // 5. /start → message de bienvenue
  // ----------------------------------------------------------
  it('répond avec un message de bienvenue pour /start', async () => {
    const res = await POST(makeRequest(textMessage('/start')));
    expect(res.status).toBe(200);

    expect(mocks.sendTelegramMessage).toHaveBeenCalledOnce();
    const args = mocks.sendTelegramMessage.mock.calls[0] as [number, string];
    expect(args[0]).toBe(12345);
    expect(args[1]).toContain('prêt');
  });

  // ----------------------------------------------------------
  // 6. "annule" → clearConversation appelé
  // ----------------------------------------------------------
  it('annule la conversation quand le message est "annule"', async () => {
    // Simuler un workflow CR actif + une conversation en cours
    mocks.getActiveWorkflow.mockReturnValue({
      type: 'cr', step: 'collecting', data: {},
      startedAt: Date.now(), expiresAt: Date.now() + 86400000,
    });
    mocks.getConversation.mockReturnValue([
      { role: 'user', content: 'Déjeuner avec Karim', timestamp: Date.now() },
    ]);
    mocks.getPendingDraft.mockReturnValue(null);

    const res = await POST(makeRequest(textMessage('annule')));
    expect(res.status).toBe(200);

    expect(mocks.clearActiveWorkflow).toHaveBeenCalledWith(12345);
    expect(mocks.clearConversation).toHaveBeenCalledWith(12345);
    expect(mocks.clearPendingDraft).toHaveBeenCalledWith(12345);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledOnce();
    const msg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(msg).toContain('annulée');
  });

  // ----------------------------------------------------------
  // 7. "stop" → clearConversation appelé
  // ----------------------------------------------------------
  it('annule la conversation quand le message est "stop"', async () => {
    // Simuler un workflow CR actif + un draft en attente
    mocks.getActiveWorkflow.mockReturnValue({
      type: 'cr', step: 'pending_photos', data: {},
      startedAt: Date.now(), expiresAt: Date.now() + 86400000,
    });
    mocks.getPendingDraft.mockReturnValue({
      cr: VALID_CR_DRAFT,
      previewText: 'aperçu',
      createdAt: Date.now(),
    });

    const res = await POST(makeRequest(textMessage('stop')));
    expect(res.status).toBe(200);

    expect(mocks.clearActiveWorkflow).toHaveBeenCalledWith(12345);
    expect(mocks.clearConversation).toHaveBeenCalledWith(12345);
    expect(mocks.clearPendingDraft).toHaveBeenCalledWith(12345);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledOnce();
    const msg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(msg).toContain('annulée');
  });

  // ----------------------------------------------------------
  // 8. Message texte → Claude needs_clarification → question renvoyée
  // ----------------------------------------------------------
  it('renvoie la question de clarification quand Claude demande des précisions', async () => {
    // Simuler un workflow CR actif (réponse à une clarification)
    mocks.getActiveWorkflow.mockReturnValue({
      type: 'cr', step: 'collecting', data: {},
      startedAt: Date.now(), expiresAt: Date.now() + 86400000,
    });
    mocks.create.mockResolvedValueOnce(
      claudeResponseClarification('Avec quelle entité ce déjeuner a-t-il eu lieu ?'),
    );

    const res = await POST(makeRequest(textMessage('Déjeuner avec Karim hier')));
    expect(res.status).toBe(200);

    // Vérifie que le message utilisateur est sauvegardé dans l'historique
    expect(mocks.appendMessage).toHaveBeenCalledWith(12345, 'user', 'Déjeuner avec Karim hier');

    // Vérifie que la question de clarification est envoyée
    // (peut être précédée d'un accusé de réception si premier message)
    const textCalls = mocks.sendTelegramMessage.mock.calls as Array<[number, string]>;
    const clarificationCall = textCalls.find(([, msg]) => msg.includes('entité'));
    expect(clarificationCall).toBeDefined();

    // Vérifie que la réponse assistant est sauvegardée dans l'historique
    expect(mocks.appendMessage).toHaveBeenCalledWith(
      12345,
      'assistant',
      expect.stringContaining('entité'),
    );

    // Pas de boutons de confirmation envoyés
    expect(mocks.sendTelegramConfirmation).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // 8.bis (S21.4) — Le system prompt inclut le bloc contacts vault
  // ----------------------------------------------------------
  it('S21.4 — injecte le bloc contacts vault live dans le system prompt CR', async () => {
    mocks.getActiveWorkflow.mockReturnValue({
      type: 'cr', step: 'collecting', data: {},
      startedAt: Date.now(), expiresAt: Date.now() + 86400000,
    });
    mocks.formatContactsForPrompt.mockResolvedValueOnce(
      '- Maxime Lemoine — Co-fondateur, Gradient One (entités visibles : [GO])',
    );
    mocks.create.mockResolvedValueOnce(
      claudeResponseClarification('Avec quelle entité ?'),
    );

    await POST(makeRequest(textMessage('Déjeuner avec Maxime hier')));

    // Le system prompt envoyé à Claude doit contenir le bloc contacts vault
    expect(mocks.create).toHaveBeenCalled();
    const createCall = mocks.create.mock.calls[0] as Array<{ system?: unknown }>;
    const systemArg = createCall[0]?.system;
    // system peut être string ou Array<{type, text, cache_control?}>
    const systemText = typeof systemArg === 'string'
      ? systemArg
      : Array.isArray(systemArg)
        ? (systemArg as Array<{ text?: string }>).map((b) => b.text ?? '').join('\n')
        : '';
    expect(systemText).toContain('Contacts récurrents (vault Drive)');
    expect(systemText).toContain('Maxime Lemoine');
  });

  // ----------------------------------------------------------
  // 9. Message texte → Claude ready → aperçu + boutons
  // ----------------------------------------------------------
  it('stocke le draft et demande les photos quand Claude génère un CR complet', async () => {
    // Simuler un workflow CR actif
    mocks.getActiveWorkflow.mockReturnValue({
      type: 'cr', step: 'collecting', data: {},
      startedAt: Date.now(), expiresAt: Date.now() + 86400000,
    });
    mocks.create.mockResolvedValueOnce(claudeResponseReady());

    const res = await POST(makeRequest(textMessage('Déjeuner avec Karim Benmoussa au Voltaire')));
    expect(res.status).toBe(200);

    // Le draft est stocké en attente de validation
    expect(mocks.setPendingDraft).toHaveBeenCalledWith(
      12345,
      VALID_CR_DRAFT,
      expect.stringContaining('COMPTE RENDU'),
    );

    // Anya demande s'il y a des photos (nouveau flow)
    expect(mocks.sendTelegramMessage).toHaveBeenCalled();
    const lastCall = mocks.sendTelegramMessage.mock.calls[mocks.sendTelegramMessage.mock.calls.length - 1] as [number, string];
    expect(lastCall[1]).toContain('photos');

    // Pas encore de sendTelegramConfirmation (on attend la réponse "non" de Thomas)
    expect(mocks.sendTelegramConfirmation).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // 10. Message texte → Claude texte libre (pas JSON) → clarification
  // ----------------------------------------------------------
  it('traite une réponse Claude en texte libre comme une clarification', async () => {
    // Simuler un workflow CR actif
    mocks.getActiveWorkflow.mockReturnValue({
      type: 'cr', step: 'collecting', data: {},
      startedAt: Date.now(), expiresAt: Date.now() + 86400000,
    });
    mocks.create.mockResolvedValueOnce(
      claudeResponseFreeText(
        "Je ne trouve pas d'information sur ce restaurant. Peux-tu me donner l'adresse exacte ?",
      ),
    );

    const res = await POST(makeRequest(textMessage('Déjeuner au restaurant machin')));
    expect(res.status).toBe(200);

    // Le texte libre est traité comme clarification et envoyé
    const textCalls = mocks.sendTelegramMessage.mock.calls as Array<[number, string]>;
    const clarificationCall = textCalls.find(([, msg]) => msg.includes('adresse exacte'));
    expect(clarificationCall).toBeDefined();

    // Pas de boutons de confirmation
    expect(mocks.sendTelegramConfirmation).not.toHaveBeenCalled();
    // Pas de draft stocké
    expect(mocks.setPendingDraft).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // 11. Callback "validate" avec draft → publishToCraft + confirmation
  // ----------------------------------------------------------
  it('publie sur Craft et confirme quand le callback "validate" est reçu avec un draft', async () => {
    mocks.getPendingDraft.mockReturnValue({
      cr: VALID_CR_DRAFT,
      previewText: 'Aperçu du CR',
      createdAt: Date.now(),
    });

    const res = await POST(makeRequest(callbackQuery('validate')));
    expect(res.status).toBe(200);

    // Le callback est acquitté
    expect(mocks.answerCallbackQuery).toHaveBeenCalledWith('cb-123');

    // La référence séquentielle est générée
    expect(mocks.getNextReference).toHaveBeenCalledWith('IC');

    // Le PDF est généré
    expect(mocks.generateCrPdf).toHaveBeenCalledOnce();
    const pdfArgs = mocks.generateCrPdf.mock.calls[0] as [{ cr: typeof VALID_CR_DRAFT; reference: string; dateEtablissement: string }];
    expect(pdfArgs[0].reference).toBe('IC-CR-2026-0001');
    expect(pdfArgs[0].cr).toEqual(VALID_CR_DRAFT);

    // Le PDF est envoyé sur Telegram
    expect(mocks.sendTelegramDocument).toHaveBeenCalledOnce();
    const docArgs = mocks.sendTelegramDocument.mock.calls[0] as [number, Buffer, string, string];
    expect(docArgs[0]).toBe(12345);
    expect(docArgs[2]).toBe('IC-CR-2026-0001.pdf');

    // Publication Craft retirée (session 9) — Drive uniquement

    // Message de confirmation envoyé (peut être précédé d'un message d'erreur Drive)
    const textCalls = mocks.sendTelegramMessage.mock.calls as Array<[number, string]>;
    const confirmCall = textCalls.find(([, msg]) => msg.includes('IC-CR-2026-0001') && msg.includes('validé'));
    expect(confirmCall).toBeDefined();

    // Nettoyage conversation + draft + workflow
    expect(mocks.clearActiveWorkflow).toHaveBeenCalledWith(12345);
    expect(mocks.clearPendingDraft).toHaveBeenCalledWith(12345);
    expect(mocks.clearConversation).toHaveBeenCalledWith(12345);
  });

  // ----------------------------------------------------------
  // 12. Callback "validate" sans draft → message "aucun CR en attente"
  // ----------------------------------------------------------
  it('envoie un message si "validate" est reçu sans draft en attente', async () => {
    mocks.getPendingDraft.mockReturnValue(null);

    const res = await POST(makeRequest(callbackQuery('validate')));
    expect(res.status).toBe(200);

    expect(mocks.answerCallbackQuery).toHaveBeenCalledWith('cb-123');

    // Pas de publication
    expect(mocks.publishToCraft).not.toHaveBeenCalled();

    // Message d'info
    expect(mocks.sendTelegramMessage).toHaveBeenCalledOnce();
    const sentMsg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(sentMsg).toContain('Aucun CR en attente');
  });

  // ----------------------------------------------------------
  // 13. Callback "modify" → clearPendingDraft + message
  // ----------------------------------------------------------
  it('sauvegarde le CR précédent dans l\'historique et invite à modifier quand le callback "modify" est reçu', async () => {
    mocks.getPendingDraft.mockReturnValue({
      cr: VALID_CR_DRAFT,
      previewText: 'Aperçu',
      createdAt: Date.now(),
    });

    const res = await POST(makeRequest(callbackQuery('modify')));
    expect(res.status).toBe(200);

    expect(mocks.answerCallbackQuery).toHaveBeenCalledWith('cb-123');

    // Le CR précédent est sauvegardé dans l'historique de conversation
    // pour que Claude ait le contexte lors de la modification
    expect(mocks.appendMessage).toHaveBeenCalledWith(
      12345,
      'assistant',
      expect.stringContaining('Aperçu'),
    );

    expect(mocks.clearPendingDraft).toHaveBeenCalledWith(12345);

    expect(mocks.sendTelegramMessage).toHaveBeenCalledOnce();
    const sentMsg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(sentMsg).toContain('Que veux-tu modifier');

    // La conversation n'est PAS effacée (l'utilisateur peut continuer)
    expect(mocks.clearConversation).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------
  // 14. Callback "cancel" → clearConversation + message "annulé"
  // ----------------------------------------------------------
  it('efface tout et confirme l\'annulation quand le callback "cancel" est reçu', async () => {
    mocks.getPendingDraft.mockReturnValue({
      cr: VALID_CR_DRAFT,
      previewText: 'Aperçu',
      createdAt: Date.now(),
    });

    const res = await POST(makeRequest(callbackQuery('cancel')));
    expect(res.status).toBe(200);

    expect(mocks.answerCallbackQuery).toHaveBeenCalledWith('cb-123');
    expect(mocks.clearPendingDraft).toHaveBeenCalledWith(12345);
    expect(mocks.clearConversation).toHaveBeenCalledWith(12345);

    expect(mocks.sendTelegramMessage).toHaveBeenCalledOnce();
    const sentMsg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(sentMsg).toContain('annulé');
  });

  // ----------------------------------------------------------
  // 15. Message non-texte (sticker) → message "envoie en texte"
  // ----------------------------------------------------------
  it('demande un message texte quand un sticker est envoyé', async () => {
    const res = await POST(makeRequest(stickerMessage()));
    expect(res.status).toBe(200);

    expect(mocks.sendTelegramMessage).toHaveBeenCalledOnce();
    const sentMsg = (mocks.sendTelegramMessage.mock.calls[0] as [number, string])[1];
    expect(sentMsg).toContain('texte');
  });

  // ----------------------------------------------------------
  // 16. Document image (mime_type image/*) → routé vers handleInboxPhoto
  // ----------------------------------------------------------
  // REGRESSION: les images envoyées en mode "fichier" (Send as file) dans Telegram
  // ont un payload message.document avec mime_type image/jpeg (pas message.photo).
  // Avant le fix c15ed66, elles étaient routées vers handleInboxDocument qui ne
  // résout pas le timestamp EXIF. Le fix route mime_type image/* vers handleInboxPhoto
  // pour que resolvePhotoTimestamp soit appelé (EXIF préservé). — fixé le 2026-05-12
  it('route un document avec mime_type image/jpeg vers startOrExtendBatch (pas handleInboxDocument)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const telegramDate = 1715508000; // 2024-05-12T14:00:00Z
    const documentImagePayload = {
      update_id: 99,
      message: {
        message_id: 500,
        chat: { id: 12345, type: 'private' as const },
        date: telegramDate,
        document: {
          file_id: 'doc-img-file-id',
          file_unique_id: 'doc-img-unique',
          file_size: 524288, // 512 Ko
          mime_type: 'image/jpeg',
          file_name: 'IMG_20240512.jpg',
        },
        caption: 'Photo terrasse',
      },
    };

    const res = await POST(makeRequest(documentImagePayload));
    expect(res.status).toBe(200);

    // startOrExtendBatch est appelé (nouveau workflow batch S13)
    expect(mocks.startOrExtendBatch).toHaveBeenCalledOnce();

    // handleInboxDocument n'est PAS appelé
    expect(mocks.handleInboxDocument).not.toHaveBeenCalled();

    // Vérification des arguments de startOrExtendBatch
    const batchArgs = mocks.startOrExtendBatch.mock.calls[0] as [number, { base64: string; mimeType: string; caption?: string }];
    expect(batchArgs[0]).toBe(12345);           // chatId
    expect(batchArgs[1].base64).toBe('abc');    // base64 (mock downloadTelegramFile)
    expect(batchArgs[1].mimeType).toBe('image/jpeg'); // mimeType
    expect(batchArgs[1].caption).toBe('Photo terrasse'); // caption

    // Le console.warn de routage est émis
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('média en document détecté'),
    );

    warnSpy.mockRestore();
  });

  // ── Tests vidéo (session 12 — traiter les vidéos comme des photos) ──

  it('route message.video vers startOrExtendBatch (même dossier Photos)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const telegramDate = 1715508000; // 2024-05-12T10:00:00Z
    const videoPayload = {
      update_id: 100,
      message: {
        message_id: 600,
        chat: { id: 12345, type: 'private' as const },
        date: telegramDate,
        video: {
          file_id: 'video-file-id',
          file_unique_id: 'video-unique',
          width: 1920,
          height: 1080,
          duration: 15,
          mime_type: 'video/mp4',
          file_size: 2_000_000, // 2 Mo
        },
        caption: 'Visite appartement',
      },
    };

    const res = await POST(makeRequest(videoPayload));
    expect(res.status).toBe(200);

    // startOrExtendBatch est appelé (nouveau workflow batch S13)
    expect(mocks.startOrExtendBatch).toHaveBeenCalledOnce();

    // handleInboxDocument n'est PAS appelé
    expect(mocks.handleInboxDocument).not.toHaveBeenCalled();

    // Vérification des arguments de startOrExtendBatch
    const batchArgs = mocks.startOrExtendBatch.mock.calls[0] as [number, { base64: string; mimeType: string; caption?: string }];
    expect(batchArgs[0]).toBe(12345);                // chatId
    expect(batchArgs[1].base64).toBe('abc');         // base64 (mock downloadTelegramFile)
    expect(batchArgs[1].mimeType).toBe('video/mp4'); // mimeType
    expect(batchArgs[1].caption).toBe('Visite appartement'); // caption

    // Le console.warn de routage vidéo est émis
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('message.video'),
    );

    warnSpy.mockRestore();
  });

  it('route un document avec mime_type video/quicktime vers startOrExtendBatch (extension du fix c15ed66)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const telegramDate = 1715508000;
    const documentVideoPayload = {
      update_id: 101,
      message: {
        message_id: 601,
        chat: { id: 12345, type: 'private' as const },
        date: telegramDate,
        document: {
          file_id: 'doc-video-file-id',
          file_unique_id: 'doc-video-unique',
          file_size: 5_000_000, // 5 Mo
          mime_type: 'video/quicktime',
          file_name: 'IMG_1234.MOV',
        },
        caption: 'Vidéo terrasse',
      },
    };

    const res = await POST(makeRequest(documentVideoPayload));
    expect(res.status).toBe(200);

    // startOrExtendBatch est appelé (pas handleInboxDocument)
    expect(mocks.startOrExtendBatch).toHaveBeenCalledOnce();
    expect(mocks.handleInboxDocument).not.toHaveBeenCalled();

    // Vérification des arguments
    const batchArgs = mocks.startOrExtendBatch.mock.calls[0] as [number, { base64: string; mimeType: string; caption?: string }];
    expect(batchArgs[0]).toBe(12345);
    expect(batchArgs[1].mimeType).toBe('video/quicktime');
    expect(batchArgs[1].caption).toBe('Vidéo terrasse');

    warnSpy.mockRestore();
  });

  it('rejette une vidéo > 20 Mo avec un message utilisateur', async () => {
    const videoTooLargePayload = {
      update_id: 102,
      message: {
        message_id: 602,
        chat: { id: 12345, type: 'private' as const },
        date: Math.floor(Date.now() / 1000),
        video: {
          file_id: 'big-video-file-id',
          file_unique_id: 'big-video-unique',
          width: 3840,
          height: 2160,
          duration: 120,
          mime_type: 'video/mp4',
          file_size: 25 * 1024 * 1024, // 25 Mo
        },
      },
    };

    const res = await POST(makeRequest(videoTooLargePayload));
    expect(res.status).toBe(200);

    // Le message de rejet est envoyé
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(
      12345,
      expect.stringContaining('trop volumineuse'),
    );

    // handleInboxPhoto n'est PAS appelé
    expect(mocks.handleInboxPhoto).not.toHaveBeenCalled();
  });

  it('ignore silencieusement message.video si chat_id non autorisé', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const videoUnauthorizedPayload = {
      update_id: 103,
      message: {
        message_id: 603,
        chat: { id: 99999, type: 'private' as const },
        date: Math.floor(Date.now() / 1000),
        video: {
          file_id: 'unauth-video-file-id',
          file_unique_id: 'unauth-video-unique',
          width: 1280,
          height: 720,
          duration: 10,
          mime_type: 'video/mp4',
          file_size: 1_000_000,
        },
      },
    };

    const res = await POST(makeRequest(videoUnauthorizedPayload));
    expect(res.status).toBe(200);

    // Aucun handler n'est appelé
    expect(mocks.handleInboxPhoto).not.toHaveBeenCalled();
    expect(mocks.handleInboxDocument).not.toHaveBeenCalled();
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('dispatch les callbacks email_val: vers handleEmailValCallback', async () => {
    const payload = callbackQuery('email_val:valider:uuid-123');
    const res = await POST(makeRequest(payload));

    expect(res.status).toBe(200);
    expect(mocks.handleEmailValCallback).toHaveBeenCalledTimes(1);
    expect(mocks.handleEmailValCallback).toHaveBeenCalledWith({
      callback_query_id: 'cb-123',
      data: 'email_val:valider:uuid-123',
      message_id: 200,
      chat_id: 12345,
    });
  });
});
