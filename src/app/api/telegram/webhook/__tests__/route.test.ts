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
  answerCallbackQuery: vi.fn().mockResolvedValue({ success: true }),
  downloadTelegramPhoto: vi.fn().mockResolvedValue({
    success: true,
    base64: 'abc',
    mimeType: 'image/jpeg',
  }),
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
  // Reference counter
  getNextReference: vi.fn().mockReturnValue('IC-CR-2026-0001'),
  // Contacts
  formatContactsForPrompt: vi.fn().mockReturnValue('Contacts: Thomas Issa — Président'),
  // fs
  readFileSync: vi.fn(),
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
  answerCallbackQuery: mocks.answerCallbackQuery,
  downloadTelegramPhoto: mocks.downloadTelegramPhoto,
}));

vi.mock('@/lib/secretariat/craft-publisher', () => ({
  publishToCraft: mocks.publishToCraft,
}));

vi.mock('@/lib/secretariat/craft-reader', () => ({
  fetchRecentCRs: mocks.fetchRecentCRs,
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
}));

vi.mock('@/lib/secretariat/reference-counter', () => ({
  getNextReference: mocks.getNextReference,
}));

vi.mock('@/lib/secretariat/contacts', () => ({
  formatContactsForPrompt: mocks.formatContactsForPrompt,
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
    mocks.publishToCraft.mockResolvedValue({
      success: true,
      craftUrl: 'https://craft.test/doc',
    });
    mocks.sendTelegramMessage.mockResolvedValue({ success: true });
    mocks.sendTelegramConfirmation.mockResolvedValue({ success: true });
    mocks.answerCallbackQuery.mockResolvedValue({ success: true });
    mocks.fetchRecentCRs.mockResolvedValue('');
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
});
