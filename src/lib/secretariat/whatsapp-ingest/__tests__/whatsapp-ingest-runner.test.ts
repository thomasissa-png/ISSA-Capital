/**
 * Tests intégration — pipeline WhatsApp-ingest V2.
 *
 * Mocks de tous les modules amont (beeper, LLM, vault, gmail, telegram, fs).
 * Vérifie les invariants clés :
 *  - enrichissement vault SILENCIEUX (contact + projet) quand cohérent ;
 *  - Telegram UNIQUEMENT s'il y a une todo ou une action (pas pour un simple
 *    enrichissement pertinent) ;
 *  - préparation d'un brouillon d'email (jamais d'envoi).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BeeperMessage } from '../../beeper-source/beeper-client';

// ============================================================
// Mocks
// ============================================================

const mockListMessages = vi.fn().mockResolvedValue([] as BeeperMessage[]);
vi.mock('../../beeper-source/beeper-client', () => ({
  listTextMessagesSince: (...args: unknown[]) => mockListMessages(...args),
}));

// callLLM : branche sur le task (extraction vs rédaction email).
let nextExtraction: Record<string, unknown> = { relevant: false };
const mockCallLLM = vi.fn(async (opts: { task: string }) => {
  if (opts.task === 'email-draft') {
    return { text: JSON.stringify({ body: 'Bonjour,\n\nVoici.\n\nTrès cordialement,\n\nThomas Issa\n06 64 85 06 31' }) };
  }
  return { text: JSON.stringify(nextExtraction) };
});
vi.mock('../../llm/client', () => ({
  callLLM: (...args: unknown[]) => mockCallLLM(...(args as [{ task: string }])),
}));

const mockSendTelegram = vi.fn().mockResolvedValue({ success: true });
vi.mock('../../telegram', () => ({
  sendTelegramMessage: (...args: unknown[]) => mockSendTelegram(...args),
}));

const mockLoadKnownContacts = vi.fn().mockResolvedValue([
  { name: 'Jean Dupont', email: 'jean@exemple.fr', type: 'pro' },
]);
vi.mock('../../email-ingest/contacts-cache', () => ({
  loadKnownContacts: (...args: unknown[]) => mockLoadKnownContacts(...args),
}));

const mockFindContact = vi.fn().mockResolvedValue(null);
const mockAppendHistorique = vi.fn().mockResolvedValue(true);
vi.mock('../../vault-client', () => ({
  findContactByEmail: (...args: unknown[]) => mockFindContact(...args),
  appendToHistorique: (...args: unknown[]) => mockAppendHistorique(...args),
}));

const mockAppendProjet = vi.fn().mockResolvedValue({ status: 'enriched' });
vi.mock('../../calendar-ingest/projet-enricher', () => ({
  appendProjetHistoriqueLine: (...args: unknown[]) => mockAppendProjet(...args),
}));

const mockCreateDraft = vi.fn().mockResolvedValue({ success: true, draftId: 'd1', gmailUrl: 'https://mail/x' });
vi.mock('../../gmail-source/gmail-client', () => ({
  createDraft: (...args: unknown[]) => mockCreateDraft(...args),
}));

// fs : curseur — lecture échoue (null) → premier run ; écriture OK.
vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn().mockRejectedValue(new Error('no cursor')),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import { runWhatsappIngest } from '../whatsapp-ingest-runner';

function msg(overrides: Partial<BeeperMessage> = {}): BeeperMessage {
  return {
    roomID: '!room1:beeper.local',
    chatId: '123@g.us',
    chatName: 'Projet Versi',
    senderContactID: 'c1',
    timestamp: Date.now(),
    text: 'Salut, on se cale demain ?',
    isSender: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_CHAT_ID_THOMAS = '999';
  nextExtraction = { relevant: false };
  mockListMessages.mockResolvedValue([]);
  mockFindContact.mockResolvedValue(null);
  mockAppendProjet.mockResolvedValue({ status: 'enriched' });
  mockCreateDraft.mockResolvedValue({ success: true, draftId: 'd1', gmailUrl: 'https://mail/x' });
  mockSendTelegram.mockResolvedValue({ success: true });
});

describe('runWhatsappIngest — V2', () => {
  it('aucun message → curseur écrit, aucune notif', async () => {
    const stats = await runWhatsappIngest();
    expect(stats.newMessages).toBe(0);
    expect(stats.notified).toBe(0);
    expect(mockSendTelegram).not.toHaveBeenCalled();
  });

  it('chat pertinent SANS todo ni action → enrichit le vault en SILENCE (pas de Telegram)', async () => {
    mockListMessages.mockResolvedValue([msg()]);
    mockFindContact.mockResolvedValue({ name: 'Jean Dupont', folderPath: '07. Contacts/01. Pro', emails: [], content: '', fileId: 'f1' });
    nextExtraction = {
      relevant: true,
      summary: 'Jean confirme le RDV de demain.',
      contactEmail: 'jean@exemple.fr',
      projet: 'VI',
      todos: [],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.relevantChats).toBe(1);
    expect(stats.contactsEnriched).toBe(1);
    expect(stats.projetsEnriched).toBe(1);
    expect(mockAppendHistorique).toHaveBeenCalledTimes(1);
    expect(mockAppendProjet).toHaveBeenCalledTimes(1);
    // Constraint clé : pas de todo/action → pas de Telegram.
    expect(stats.notified).toBe(0);
    expect(mockSendTelegram).not.toHaveBeenCalled();
  });

  it('chat avec todo → notifie Thomas sur Telegram', async () => {
    mockListMessages.mockResolvedValue([msg()]);
    nextExtraction = {
      relevant: true,
      summary: 'Discussion logistique.',
      contactEmail: null,
      projet: null,
      todos: ['Rappeler le notaire avant vendredi'],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.notified).toBe(1);
    expect(mockSendTelegram).toHaveBeenCalledTimes(1);
    const body = mockSendTelegram.mock.calls[0]![1] as string;
    expect(body).toContain('Rappeler le notaire');
  });

  it('emailToPrepare → prépare un brouillon Gmail (jamais envoyé) + notifie', async () => {
    mockListMessages.mockResolvedValue([msg()]);
    nextExtraction = {
      relevant: true,
      summary: 'Il faut envoyer le devis à Jean.',
      contactEmail: null,
      projet: null,
      todos: [],
      emailToPrepare: { to: 'jean@exemple.fr', subject: 'Devis', intent: 'Envoyer le devis demandé' },
    };
    const stats = await runWhatsappIngest();
    expect(mockCreateDraft).toHaveBeenCalledTimes(1);
    expect(stats.draftsPrepared).toBe(1);
    expect(stats.notified).toBe(1);
    // Invariant sécurité : on crée un BROUILLON, jamais d'envoi.
    const draftArg = mockCreateDraft.mock.calls[0]![0] as { to: string; subject: string; body: string };
    expect(draftArg.to).toBe('jean@exemple.fr');
    expect(draftArg.body).toContain('Thomas Issa');
  });

  it('chat NON pertinent → rien (ni vault, ni Telegram)', async () => {
    mockListMessages.mockResolvedValue([msg()]);
    nextExtraction = { relevant: false, summary: '', contactEmail: null, projet: null, todos: [], emailToPrepare: null };
    const stats = await runWhatsappIngest();
    expect(stats.relevantChats).toBe(0);
    expect(mockAppendHistorique).not.toHaveBeenCalled();
    expect(mockAppendProjet).not.toHaveBeenCalled();
    expect(mockSendTelegram).not.toHaveBeenCalled();
  });

  it('email inventé sans @ → pas de brouillon', async () => {
    mockListMessages.mockResolvedValue([msg()]);
    nextExtraction = {
      relevant: true,
      summary: 'x',
      contactEmail: null,
      projet: null,
      todos: [],
      emailToPrepare: { to: 'pas-un-email', subject: 's', intent: 'i' },
    };
    const stats = await runWhatsappIngest();
    expect(mockCreateDraft).not.toHaveBeenCalled();
    expect(stats.draftsPrepared).toBe(0);
  });
});
