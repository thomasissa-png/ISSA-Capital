/**
 * Tests unitaires — module inbox-message-router.
 *
 * Vérifie :
 * - Extraction texte → JSON structuré via Claude (mock)
 * - Preview card construction
 * - Callback calendar → Google Calendar API (mock)
 * - Callback task → Todo.md append (mock)
 * - Callback cancel → cache cleanup
 * - Extraction vocale → transcription + JSON (mock)
 * - JSON invalide de Claude → fallback false
 * - Cache expiration → message données expirées
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// Mocks — déclarés AVANT les imports
// ============================================================

const mocks = vi.hoisted(() => ({
  sendTelegramMessageWithButtons: vi.fn().mockResolvedValue({ success: true }),
  sendTypingAction: vi.fn().mockResolvedValue(undefined),
  createCalendarEvent: vi.fn().mockResolvedValue({
    success: true,
    eventId: 'evt_xyz',
    htmlLink: 'https://calendar.google.com/event/evt_xyz',
  }),
  appendToTodoInbox: vi.fn().mockResolvedValue({ success: true }),
  messagesCreate: vi.fn().mockResolvedValue({
    content: [{
      type: 'text',
      text: JSON.stringify({
        titre: 'Sortie enfants Aquaboulevard',
        date: '2026-05-12',
        heure: null,
        lieu: 'Aquaboulevard',
        description: null,
      }),
    }],
  }),
}));

vi.mock('@/lib/secretariat/telegram', () => ({
  sendTelegramMessageWithButtons: mocks.sendTelegramMessageWithButtons,
  sendTypingAction: mocks.sendTypingAction,
}));

vi.mock('@/lib/google/calendar', () => ({
  createCalendarEvent: mocks.createCalendarEvent,
}));

vi.mock('@/lib/secretariat/drive-todo', () => ({
  appendToTodoInbox: mocks.appendToTodoInbox,
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mocks.messagesCreate };
    constructor() {
      // no-op
    }
  },
}));

// ============================================================
// Imports (après mocks)
// ============================================================

import {
  handleInboxMessage,
  handleInboxVoiceMessage,
  handleRouterCallback,
  ROUTER_CALLBACK_PREFIX,
  buildPreviewMessage,
  parseExtractionResult,
} from '../workflows/inbox-message-router';

// ============================================================
// Env setup
// ============================================================

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-key');
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const CHAT_ID = 123456;

// ============================================================
// Tests — parseExtractionResult
// ============================================================

describe('parseExtractionResult', () => {
  it('parse un JSON brut valide', () => {
    const raw = '{"titre":"Sortie enfants","date":"2026-05-12","heure":null,"lieu":"Aquaboulevard","description":null}';
    const result = parseExtractionResult(raw);
    expect(result.success).toBe(true);
    expect(result.data?.titre).toBe('Sortie enfants');
    expect(result.data?.date).toBe('2026-05-12');
    expect(result.data?.lieu).toBe('Aquaboulevard');
  });

  it('parse un bloc ```json``` markdown', () => {
    const raw = 'Voici le résultat :\n```json\n{"titre":"RDV dentiste","date":"2026-05-15","heure":"14:30","lieu":null,"description":null}\n```';
    const result = parseExtractionResult(raw);
    expect(result.success).toBe(true);
    expect(result.data?.titre).toBe('RDV dentiste');
    expect(result.data?.heure).toBe('14:30');
  });

  it('échoue sur texte vide', () => {
    const result = parseExtractionResult('');
    expect(result.success).toBe(false);
  });

  it('échoue si titre manquant', () => {
    const raw = '{"date":"2026-05-12"}';
    const result = parseExtractionResult(raw);
    expect(result.success).toBe(false);
    expect(result.error).toContain('titre');
  });

  it('met date à null si format invalide', () => {
    const raw = '{"titre":"Test","date":"12/05/2026","heure":null,"lieu":null,"description":null}';
    const result = parseExtractionResult(raw);
    expect(result.success).toBe(true);
    expect(result.data?.date).toBeNull();
  });

  it('met heure à null si format invalide', () => {
    const raw = '{"titre":"Test","date":null,"heure":"14h30","lieu":null,"description":null}';
    const result = parseExtractionResult(raw);
    expect(result.success).toBe(true);
    expect(result.data?.heure).toBeNull();
  });

  it('échoue sur JSON cassé', () => {
    const raw = '{"titre":"Test", broken}';
    const result = parseExtractionResult(raw);
    expect(result.success).toBe(false);
    expect(result.error).toContain('JSON invalide');
  });
});

// ============================================================
// Tests — buildPreviewMessage
// ============================================================

describe('buildPreviewMessage', () => {
  // S20.A : format de carte mis à jour pour le pattern 7 boutons.
  // Date/Heure/Lieu sont toujours affichés (avec "—" si null) pour inviter
  // l'édit via ✏️. Footer change : "Modifie un champ ou choisis la destination :".
  it('affiche tous les champs remplis', () => {
    const msg = buildPreviewMessage({
      titre: 'Sortie enfants Aquaboulevard',
      date: '2026-05-12',
      heure: '14:00',
      lieu: 'Aquaboulevard',
      description: 'Avec les enfants',
    });
    expect(msg).toContain('Sortie enfants Aquaboulevard');
    expect(msg).toContain('12/05/2026');
    expect(msg).toContain('14:00');
    expect(msg).toContain('Aquaboulevard');
    expect(msg).toContain('Avec les enfants');
    expect(msg).toContain('Modifie un champ ou choisis la destination');
  });

  it('affiche "—" pour les champs nuls (invite à l\'édit ✏️)', () => {
    const msg = buildPreviewMessage({
      titre: 'Acheter du pain',
      date: null,
      heure: null,
      lieu: null,
      description: null,
    });
    expect(msg).toContain('Acheter du pain');
    // S20.A : tous les champs sont affichés, "—" remplace les null
    expect(msg).toContain('Date : —');
    expect(msg).toContain('Heure : —');
    expect(msg).toContain('Lieu : —');
  });
});

// ============================================================
// Tests — handleInboxMessage
// ============================================================

describe('handleInboxMessage', () => {
  it('extrait les données et envoie la carte preview', async () => {
    const handled = await handleInboxMessage(CHAT_ID, 'sortie enfants aquaboulevard le 12/05/2026');

    expect(handled).toBe(true);
    expect(mocks.sendTypingAction).toHaveBeenCalledWith(CHAT_ID);
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramMessageWithButtons).toHaveBeenCalledTimes(1);

    // Vérifier le contenu du message
    const [chatId, text, buttons] = mocks.sendTelegramMessageWithButtons.mock.calls[0]!;
    expect(chatId).toBe(CHAT_ID);
    expect(text).toContain('Sortie enfants Aquaboulevard');
    expect(text).toContain('12/05/2026');
    expect(text).toContain('Aquaboulevard');

    // Vérifier les boutons
    expect(buttons).toHaveLength(2); // 2 rangées
    expect(buttons[0]).toHaveLength(2); // Calendar + Tâches
    expect(buttons[1]).toHaveLength(1); // Annuler
    expect(buttons[0][0].callback_data).toMatch(/^inbox_router:calendar:/);
    expect(buttons[0][1].callback_data).toMatch(/^inbox_router:task:/);
    expect(buttons[1][0].callback_data).toMatch(/^inbox_router:cancel:/);
  });

  it('retourne false si Claude retourne un JSON invalide', async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Je ne comprends pas ce message.' }],
    });

    const handled = await handleInboxMessage(CHAT_ID, 'blabla');
    expect(handled).toBe(false);
    expect(mocks.sendTelegramMessageWithButtons).not.toHaveBeenCalled();
  });

  it('retourne false si Claude échoue (erreur réseau)', async () => {
    mocks.messagesCreate.mockRejectedValueOnce(new Error('Network error'));

    const handled = await handleInboxMessage(CHAT_ID, 'test');
    expect(handled).toBe(false);
  });
});

// ============================================================
// Tests — handleInboxVoiceMessage
// ============================================================

describe('handleInboxVoiceMessage', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('transcrit via Whisper puis extrait via Haiku', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: 'sortie enfants aquaboulevard' }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const fakeAudio = Buffer.from('fake-audio').toString('base64');
    const handled = await handleInboxVoiceMessage(CHAT_ID, fakeAudio, 'audio/ogg');

    expect(handled).toBe(true);
    expect(mocks.sendTypingAction).toHaveBeenCalledWith(CHAT_ID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toContain('api.openai.com/v1/audio/transcriptions');
    // Haiku appelé sur le texte transcrit
    expect(mocks.messagesCreate).toHaveBeenCalledTimes(1);
    expect(mocks.sendTelegramMessageWithButtons).toHaveBeenCalledTimes(1);
  });

  it('retourne false si Whisper échoue (500)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const handled = await handleInboxVoiceMessage(CHAT_ID, 'fakebase64', 'audio/ogg');
    expect(handled).toBe(false);
  });

  it('retourne false si OPENAI_API_KEY manque', async () => {
    delete process.env.OPENAI_API_KEY;
    const handled = await handleInboxVoiceMessage(CHAT_ID, 'fakebase64', 'audio/ogg');
    expect(handled).toBe(false);
  });
});

// ============================================================
// Tests — handleRouterCallback
// ============================================================

describe('handleRouterCallback', () => {
  // Helper : déclencher handleInboxMessage pour créer un cache entry
  // puis extraire la cacheKey depuis le callback_data envoyé
  async function setupCachedEntry(): Promise<string> {
    await handleInboxMessage(CHAT_ID, 'sortie enfants');
    const callbackData = mocks.sendTelegramMessageWithButtons.mock.calls[0]![2][0][0].callback_data as string;
    const cacheKey = callbackData.replace(`${ROUTER_CALLBACK_PREFIX}calendar:`, '');
    return cacheKey;
  }

  it('callback calendar → crée un événement Google Calendar', async () => {
    const cacheKey = await setupCachedEntry();

    const msg = await handleRouterCallback(CHAT_ID, `${ROUTER_CALLBACK_PREFIX}calendar:${cacheKey}`);

    expect(msg).toContain('Événement créé dans Google Calendar');
    expect(mocks.createCalendarEvent).toHaveBeenCalledWith({
      summary: 'Sortie enfants Aquaboulevard',
      date: '2026-05-12',
      time: undefined,
      location: 'Aquaboulevard',
      description: undefined,
    });
  });

  it('callback task → ajoute à Todo.md', async () => {
    const cacheKey = await setupCachedEntry();

    const msg = await handleRouterCallback(CHAT_ID, `${ROUTER_CALLBACK_PREFIX}task:${cacheKey}`);

    expect(msg).toContain('Ajouté à Todo.md > Inbox');
    expect(mocks.appendToTodoInbox).toHaveBeenCalledWith(
      'Sortie enfants Aquaboulevard',
      '2026-05-12',
      undefined,
    );
  });

  it('callback cancel → nettoyage cache', async () => {
    const cacheKey = await setupCachedEntry();

    const msg = await handleRouterCallback(CHAT_ID, `${ROUTER_CALLBACK_PREFIX}cancel:${cacheKey}`);

    expect(msg).toContain('Annulé');

    // Un second appel avec le même cacheKey doit échouer (cache nettoyé)
    const msg2 = await handleRouterCallback(CHAT_ID, `${ROUTER_CALLBACK_PREFIX}cancel:${cacheKey}`);
    expect(msg2).toContain('expirées');
  });

  it('cache key inexistante → message données expirées', async () => {
    const msg = await handleRouterCallback(CHAT_ID, `${ROUTER_CALLBACK_PREFIX}calendar:nonexistent_key`);
    expect(msg).toContain('expirées');
  });

  it('callback calendar échoue → message erreur', async () => {
    mocks.createCalendarEvent.mockResolvedValueOnce({
      success: false,
      error: 'Google Calendar non autorisé',
    });

    const cacheKey = await setupCachedEntry();
    const msg = await handleRouterCallback(CHAT_ID, `${ROUTER_CALLBACK_PREFIX}calendar:${cacheKey}`);

    expect(msg).toContain('Erreur Calendar');
    expect(msg).toContain('non autorisé');
  });

  it('callback task échoue → message erreur', async () => {
    mocks.appendToTodoInbox.mockResolvedValueOnce({
      success: false,
      error: 'Todo.md introuvable',
    });

    const cacheKey = await setupCachedEntry();
    const msg = await handleRouterCallback(CHAT_ID, `${ROUTER_CALLBACK_PREFIX}task:${cacheKey}`);

    expect(msg).toContain('Erreur Todo.md');
    expect(msg).toContain('introuvable');
  });

  it('texte sans date → Calendar utilise la date du jour', async () => {
    mocks.messagesCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: JSON.stringify({
          titre: 'Acheter du pain',
          date: null,
          heure: null,
          lieu: null,
          description: null,
        }),
      }],
    });

    await handleInboxMessage(CHAT_ID, 'acheter du pain');
    const callbackData = mocks.sendTelegramMessageWithButtons.mock.calls[0]![2][0][0].callback_data as string;
    const cacheKey = callbackData.replace(`${ROUTER_CALLBACK_PREFIX}calendar:`, '');

    const msg = await handleRouterCallback(CHAT_ID, `${ROUTER_CALLBACK_PREFIX}calendar:${cacheKey}`);

    expect(msg).toContain('Événement créé');
    // Vérifie que la date passée est celle du jour (format YYYY-MM-DD)
    const calendarCall = mocks.createCalendarEvent.mock.calls[0]![0];
    expect(calendarCall.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================================
// Tests — Google Calendar createCalendarEvent
// ============================================================

describe('Google Calendar integration (via mock)', () => {
  it('passe le htmlLink dans le message de confirmation', async () => {
    const cacheKey = await setupEntry({
      titre: 'Réunion important',
      date: '2026-05-15',
      heure: '10:00',
      lieu: 'Bureau',
      description: 'Avec Jean',
    });

    const msg = await handleRouterCallback(CHAT_ID, `${ROUTER_CALLBACK_PREFIX}calendar:${cacheKey}`);

    expect(msg).toContain('https://calendar.google.com/event/evt_xyz');
    expect(mocks.createCalendarEvent).toHaveBeenCalledWith({
      summary: 'Réunion important',
      date: '2026-05-15',
      time: '10:00',
      location: 'Bureau',
      description: 'Avec Jean',
    });
  });
});

// ============================================================
// Tests — Todo.md append
// ============================================================

describe('Todo.md integration (via mock)', () => {
  it('passe titre + date + description à appendToTodoInbox', async () => {
    const cacheKey = await setupEntry({
      titre: 'Rappeler le plombier',
      date: '2026-05-14',
      heure: null,
      lieu: null,
      description: 'Fuite cuisine',
    });

    const msg = await handleRouterCallback(CHAT_ID, `${ROUTER_CALLBACK_PREFIX}task:${cacheKey}`);

    expect(msg).toContain('Ajouté à Todo.md > Inbox');
    expect(msg).toContain('14/05/2026');
    expect(mocks.appendToTodoInbox).toHaveBeenCalledWith(
      'Rappeler le plombier',
      '2026-05-14',
      'Fuite cuisine',
    );
  });
});

// ============================================================
// Helper — créer une entrée en cache directement
// ============================================================

async function setupEntry(data: {
  titre: string;
  date: string | null;
  heure: string | null;
  lieu: string | null;
  description: string | null;
}): Promise<string> {
  mocks.messagesCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text: JSON.stringify(data) }],
  });

  await handleInboxMessage(CHAT_ID, 'mock input');
  const callbackData = mocks.sendTelegramMessageWithButtons.mock.calls.at(-1)![2][0][0].callback_data as string;
  return callbackData.replace(`${ROUTER_CALLBACK_PREFIX}calendar:`, '');
}
