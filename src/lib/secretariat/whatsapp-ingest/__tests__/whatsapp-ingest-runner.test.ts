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

const JEAN = {
  prenom: 'Jean',
  nom: 'Dupont',
  titre: '',
  societe: '',
  entitesVisibles: [],
  email: 'jean@exemple.fr',
  telephone: '+33 6 64 85 06 31',
  folderPath: '07. Contacts/03. Pro',
  filename: 'Jean Dupont.md',
};
const mockGetVaultContacts = vi.fn().mockResolvedValue([JEAN]);
vi.mock('../../vault-contacts', () => ({
  getVaultContacts: (...args: unknown[]) => mockGetVaultContacts(...args),
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

// S24 soir — mock telegram-validation pour ne pas charger toute la chaîne
// (pending-store → drive-resolver → fs) ; le runner n'utilise que ces fonctions
// pour la carte no-match WhatsApp.
const mockSaveWhatsappNoMatch = vi.fn().mockResolvedValue(undefined);
const mockSendWhatsappNoMatchCard = vi.fn().mockResolvedValue({ messageId: 12345 });
// S26 — anti-spam : liste des pendings actifs pour ne pas envoyer 2 cartes au
// même chatId (TTL 7j). Par défaut vide (aucune carte pending).
const mockListActiveWhatsappNoMatch = vi.fn().mockResolvedValue([]);
vi.mock('../../telegram-validation', () => ({
  saveWhatsappNoMatch: (...args: unknown[]) => mockSaveWhatsappNoMatch(...args),
  sendWhatsappNoMatchCard: (...args: unknown[]) => mockSendWhatsappNoMatchCard(...args),
  listActiveWhatsappNoMatch: (...args: unknown[]) => mockListActiveWhatsappNoMatch(...args),
}));

// fs : curseur — lecture échoue (null) → premier run ; écriture OK.
vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn().mockRejectedValue(new Error('no cursor')),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

import { runWhatsappIngest, formatPhoneForDisplay, normalizePhone } from '../whatsapp-ingest-runner';

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
  mockGetVaultContacts.mockResolvedValue([JEAN]);
  mockFindContact.mockResolvedValue(null);
  mockAppendProjet.mockResolvedValue({ status: 'enriched' });
  mockCreateDraft.mockResolvedValue({ success: true, draftId: 'd1', gmailUrl: 'https://mail/x' });
  mockSendTelegram.mockResolvedValue({ success: true });
  mockListActiveWhatsappNoMatch.mockResolvedValue([]);
  // S26 — reset mockCallLLM à l'impl par défaut (sinon un test précédent qui
  // fait `.mockRejectedValue(...)` pollue tous les tests suivants).
  mockCallLLM.mockImplementation(async (opts: { task: string }) => {
    if (opts.task === 'email-draft') {
      return { text: JSON.stringify({ body: 'Bonjour,\n\nVoici.\n\nTrès cordialement,\n\nThomas Issa\n06 64 85 06 31' }) };
    }
    return { text: JSON.stringify(nextExtraction) };
  });
});

describe('runWhatsappIngest — V2', () => {
  it('aucun message → curseur écrit, aucune notif', async () => {
    const stats = await runWhatsappIngest();
    expect(stats.newMessages).toBe(0);
    expect(stats.notified).toBe(0);
    expect(mockSendTelegram).not.toHaveBeenCalled();
  });

  it('lecture Beeper échouée → curseur PRÉSERVÉ (pas d’avance) + erreur comptée', async () => {
    const { promises } = await import('node:fs');
    mockListMessages.mockRejectedValue(
      new Error('lecture SQLite Beeper échouée : in prepare, attempt to write a readonly database (8)'),
    );
    const stats = await runWhatsappIngest();
    expect(stats.errors).toBe(1);
    expect(stats.newMessages).toBe(0);
    // Curseur NON avancé : sinon la fenêtre serait sautée définitivement.
    expect(promises.writeFile).not.toHaveBeenCalled();
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

  it('match téléphone (DM) → enrichit la fiche directement, sans findContactByEmail', async () => {
    mockListMessages.mockResolvedValue([msg({ chatId: '33664850631@s.whatsapp.net', chatName: 'Jean' })]);
    nextExtraction = {
      relevant: true,
      summary: 'Jean propose un RDV mardi.',
      contactEmail: null,
      projet: null,
      todos: [],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.contactsByPhone).toBe(1);
    expect(stats.contactsEnriched).toBe(1);
    expect(mockFindContact).not.toHaveBeenCalled();
    const args = mockAppendHistorique.mock.calls[0]!;
    expect(args[0]).toBe('07. Contacts/03. Pro');
    expect(args[1]).toBe('Jean Dupont.md');
    // pas de todo/action → pas de Telegram
    expect(stats.notified).toBe(0);
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

  it('chat groupe NON pertinent → rien (ni vault, ni Telegram, ni carte)', async () => {
    // Cas groupe : pas de carte même si non pertinent (pas d'expéditeur unique).
    mockListMessages.mockResolvedValue([msg({ chatId: '12345@g.us' })]);
    nextExtraction = { relevant: false, summary: '', contactEmail: null, projet: null, todos: [], emailToPrepare: null };
    const stats = await runWhatsappIngest();
    expect(stats.relevantChats).toBe(0);
    expect(stats.noMatchCardsSent).toBe(0);
    expect(mockAppendHistorique).not.toHaveBeenCalled();
    expect(mockAppendProjet).not.toHaveBeenCalled();
    expect(mockSendTelegram).not.toHaveBeenCalled();
  });

  // S26 — Demande Thomas verbatim : « Anya doit me proposer la carte pour tout
  // numéro qu'elle ne connaît pas à compter de maintenant ». Donc même un DM
  // non pertinent (bavardage perso) d'un inconnu DOIT déclencher une carte.
  it('S26 — chat DM NON pertinent + numéro inconnu → carte envoyée quand même (fix Thomas)', async () => {
    mockListMessages.mockResolvedValue([
      msg({ chatId: '33712345678@s.whatsapp.net', chatName: 'Inconnu Perso' }),
    ]);
    nextExtraction = { relevant: false, summary: '', contactEmail: null, projet: null, todos: [], emailToPrepare: null };
    const stats = await runWhatsappIngest();
    expect(stats.relevantChats).toBe(0); // LLM dit non-business
    expect(stats.chatsSkippedNotRelevant).toBe(1); // tracé pour diag
    expect(stats.noMatchCardsSent).toBe(1); // mais carte envoyée quand même !
    expect(mockSendWhatsappNoMatchCard).toHaveBeenCalledTimes(1);
    // Pas d'enrichissement vault ni Telegram action (gates business)
    expect(mockAppendHistorique).not.toHaveBeenCalled();
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

  it('S26 Bug #2 — chat DM pertinent non matché → carte envoyée + compteur sent', async () => {
    mockListMessages.mockResolvedValue([
      msg({ chatId: '33712345678@s.whatsapp.net', chatName: 'Inconnu' }),
    ]);
    nextExtraction = {
      relevant: true,
      summary: 'Demande de RDV mardi pour parler patrimoine.',
      contactEmail: null,
      projet: null,
      todos: [],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.noMatchCardsSent).toBe(1);
    expect(stats.chatsSkippedGroup).toBe(0);
    expect(stats.chatsSkippedNotRelevant).toBe(0);
    expect(stats.chatsSkippedAlreadyMatched).toBe(0);
    expect(stats.chatsSkippedEmptySummary).toBe(0);
    expect(mockSendWhatsappNoMatchCard).toHaveBeenCalledTimes(1);
  });

  it('S26 Bug #2 — chat groupe (@g.us) pertinent non matché → pas de carte, compteur skip:group', async () => {
    mockListMessages.mockResolvedValue([msg({ chatId: '12345@g.us', chatName: 'Projet Versi' })]);
    nextExtraction = {
      relevant: true,
      summary: 'Discussion logistique groupe.',
      contactEmail: null,
      projet: null,
      todos: [],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.noMatchCardsSent).toBe(0);
    expect(stats.chatsSkippedGroup).toBe(1);
    expect(mockSendWhatsappNoMatchCard).not.toHaveBeenCalled();
  });

  it('S26 Bug #2 — chat DM pertinent déjà matché par tél → pas de carte, compteur skip:matched', async () => {
    mockListMessages.mockResolvedValue([
      msg({ chatId: '33664850631@s.whatsapp.net', chatName: 'Jean' }),
    ]);
    nextExtraction = {
      relevant: true,
      summary: 'Confirmation RDV.',
      contactEmail: null,
      projet: null,
      todos: [],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.noMatchCardsSent).toBe(0);
    expect(stats.chatsSkippedAlreadyMatched).toBe(1);
    expect(stats.contactsByPhone).toBe(1);
    expect(mockSendWhatsappNoMatchCard).not.toHaveBeenCalled();
  });

  it('S26 — chat DM inconnu non pertinent → compteur not-relevant++, MAIS carte envoyée (fix Thomas)', async () => {
    mockListMessages.mockResolvedValue([msg({ chatId: '33712345678@s.whatsapp.net' })]);
    nextExtraction = {
      relevant: false,
      summary: '',
      contactEmail: null,
      projet: null,
      todos: [],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.chatsSkippedNotRelevant).toBe(1); // compteur info pour diag
    expect(stats.noMatchCardsSent).toBe(1); // carte envoyée même si non-business
  });

  // S26 — Le test « summary vide → carte évitée » est OBSOLÈTE depuis le fix
  // Thomas : on envoie la carte même avec un summary vide (fallback générique).
  it('S26 — chat DM inconnu + summary vide → carte envoyée avec summary fallback', async () => {
    mockListMessages.mockResolvedValue([msg({ chatId: '33712345678@s.whatsapp.net' })]);
    nextExtraction = {
      relevant: true,
      summary: '   ',
      contactEmail: null,
      projet: null,
      todos: [],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.noMatchCardsSent).toBe(1);
    expect(mockSendWhatsappNoMatchCard).toHaveBeenCalledTimes(1);
    // Le summary du pending doit être le fallback (pas la chaîne vide).
    const pendingArg = mockSendWhatsappNoMatchCard.mock.calls[0]![0];
    expect(pendingArg.summary).toBeTruthy();
    expect(pendingArg.summary.length).toBeGreaterThan(10);
  });

  // S26 — Anti-spam : si une carte est déjà pending pour ce chatId, on n'en
  // envoie pas une 2e (TTL 7j).
  it('S26 — anti-spam : chat DM inconnu mais pending actif déjà → skip:already-pending', async () => {
    mockListMessages.mockResolvedValue([
      msg({ chatId: '33712345678@s.whatsapp.net', chatName: 'Toto' }),
    ]);
    // Pending actif simulé pour ce chatId
    mockListActiveWhatsappNoMatch.mockResolvedValue([
      {
        id: 'old-pending',
        chatId: '33712345678@s.whatsapp.net',
        chatName: 'Toto',
        phone: '712345678',
        summary: 'ancienne carte',
        defaultType: 'pro',
        userContext: null,
        cardMessageId: 999,
        createdAt: new Date().toISOString(),
        existingMatchHints: null,
      },
    ]);
    nextExtraction = {
      relevant: true,
      summary: 'Nouveau message intéressant.',
      contactEmail: null,
      projet: null,
      todos: [],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.noMatchCardsSent).toBe(0);
    expect(stats.chatsSkippedAlreadyPending).toBe(1);
    expect(mockSendWhatsappNoMatchCard).not.toHaveBeenCalled();
  });

  // S26 — Contact « Lié » via alias_telephone doit être reconnu comme matched
  // au prochain run (sinon spam de cartes après chaque Lier).
  it('S26 — contact lié via alias_telephone : reconnu par byPhone, pas de nouvelle carte', async () => {
    // Contact dont le téléphone principal ne matche pas, mais alias_telephone matche.
    const JEAN_WITH_ALIAS = {
      ...JEAN,
      telephone: '+33 6 11 11 11 11', // ne matche pas
      aliasTelephones: ['+33 6 64 85 06 31'], // matche le chatId
    };
    mockGetVaultContacts.mockResolvedValue([JEAN_WITH_ALIAS]);
    mockListMessages.mockResolvedValue([
      msg({ chatId: '33664850631@s.whatsapp.net', chatName: 'Jean' }),
    ]);
    nextExtraction = {
      relevant: true,
      summary: 'Discussion business.',
      contactEmail: null,
      projet: null,
      todos: [],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.chatsSkippedAlreadyMatched).toBe(1); // matché via alias
    expect(stats.contactsByPhone).toBe(1);
    expect(stats.noMatchCardsSent).toBe(0); // pas de carte spam
  });

  // S26 I2 — LLM échec dans extractChat ne doit PAS être compté en NotRelevant.
  it('S26 I2 — extractFailed (LLM error) → compteur chatsSkippedLlmError, pas NotRelevant', async () => {
    mockListMessages.mockResolvedValue([msg({ chatId: '33712345678@s.whatsapp.net' })]);
    // Simule une exception LLM : le retour de extractChat est `{ ...empty, extractFailed: true }`.
    mockCallLLM.mockRejectedValue(new Error('DeepSeek 500'));
    const stats = await runWhatsappIngest();
    expect(stats.chatsSkippedLlmError).toBe(1);
    expect(stats.chatsSkippedNotRelevant).toBe(0); // ne doit PAS être ici
    expect(stats.noMatchCardsSent).toBe(0);
  });

  // S26 I1 — Ordre des conditions : un chat groupe enrichi par email doit
  // compter en `skip:group`, pas en `skip:matched` (ordre `isDM` first).
  it('S26 I1 — chat groupe (@g.us) enrichi par email → skip:group, pas skip:matched', async () => {
    mockListMessages.mockResolvedValue([
      msg({ chatId: '12345@g.us', chatName: 'Groupe Versi' }),
    ]);
    mockFindContact.mockResolvedValue({
      name: 'Jean Dupont',
      folderPath: '07. Contacts/03. Pro',
      emails: [],
      content: '',
      fileId: 'f1',
    });
    nextExtraction = {
      relevant: true,
      summary: 'Action attendue.',
      contactEmail: 'jean@exemple.fr',
      projet: null,
      todos: [],
      emailToPrepare: null,
    };
    const stats = await runWhatsappIngest();
    expect(stats.chatsSkippedGroup).toBe(1);
    expect(stats.chatsSkippedAlreadyMatched).toBe(0); // ordre corrigé
    expect(stats.noMatchCardsSent).toBe(0);
  });
});

describe('formatPhoneForDisplay (S26 Bug #1)', () => {
  it('formate les 9 chiffres FR mobile au format +33 6 XX XX XX XX', () => {
    expect(formatPhoneForDisplay('664850631')).toBe('+33 6 64 85 06 31');
    expect(formatPhoneForDisplay('712345678')).toBe('+33 7 12 34 56 78');
  });

  it('formate les 9 chiffres FR fixe au même schéma', () => {
    expect(formatPhoneForDisplay('123456789')).toBe('+33 1 23 45 67 89');
  });

  it('graceful sur null / undefined / chaîne vide → ""', () => {
    expect(formatPhoneForDisplay(null)).toBe('');
    expect(formatPhoneForDisplay(undefined)).toBe('');
    expect(formatPhoneForDisplay('')).toBe('');
  });

  it('graceful si entrée n\'a pas exactement 9 chiffres → renvoie tel quel', () => {
    expect(formatPhoneForDisplay('12345')).toBe('12345');
    expect(formatPhoneForDisplay('abc')).toBe('abc');
  });

  it('round-trip avec normalizePhone : +33 ... → 9 chiffres → +33 ... cohérent', () => {
    const display = '+33 6 64 85 06 31';
    const normalized = normalizePhone(display);
    expect(normalized).toBe('664850631');
    expect(formatPhoneForDisplay(normalized)).toBe(display);
  });

  // S26 H5 — entrée 11 chiffres préfixés `33` (sans `+`) → normalisée puis formatée.
  it('S26 H5 : 11 digits préfixés 33 (sans +) → +33 6 64 85 06 31', () => {
    expect(formatPhoneForDisplay('33664850631')).toBe('+33 6 64 85 06 31');
  });

  // S26 H3 — numéro international non-FR : ne PAS inventer +33, préserver l'indicatif.
  it('S26 H3 : numéro US "+1 415 555 1234" → préservé, pas re-fabriqué en +33', () => {
    const us = '+1 415 555 1234';
    const out = formatPhoneForDisplay(us);
    expect(out).not.toContain('+33');
    expect(out).toContain('+1');
  });

  it('S26 H3 : numéro UK "+44 20 1234 5678" → préservé', () => {
    const uk = '+44 20 1234 5678';
    const out = formatPhoneForDisplay(uk);
    expect(out).not.toContain('+33');
    expect(out).toContain('+44');
  });

  it('S26 H3 : digits seuls non-FR (US sans +, 11 digits commençant pas 33) → préfixe + ajouté', () => {
    // Ex : 14155551234 (11 chiffres, US sans +) → +14155551234 (pas +33…)
    const out = formatPhoneForDisplay('14155551234');
    expect(out).not.toContain('+33');
    expect(out.startsWith('+1')).toBe(true);
  });
});
