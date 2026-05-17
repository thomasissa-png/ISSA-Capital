/**
 * Tests unitaires — no-match-card.
 *
 * Vérifie :
 * - Format HTML de la carte (titre, expéditeur, suggestion, question)
 * - 5 boutons inline (Pro/Famille/Amis/Autres/Skip)
 * - Layout 3x2 (2+2+1)
 * - Préfixe callback_data = "email_nomatch:"
 * - Échappement HTML dans le nom et l'email
 * - Nom absent → affichage email seul
 * - sendNoMatchCard : envoi via fetch Telegram
 * - sendNoMatchCard : erreur TELEGRAM_BOT_TOKEN manquant
 * - sendNoMatchCard : erreur TELEGRAM_CHAT_ID_THOMAS manquant
 * - sendNoMatchCard : erreur HTTP Telegram
 *
 * Jalon 4D-2.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NoMatchPending } from '../no-match-card';
import { buildNoMatchCard, sendNoMatchCard, NOMATCH_CALLBACK_PREFIX } from '../no-match-card';

// ============================================================
// Fixtures
// ============================================================

function makeNoMatch(overrides: Partial<NoMatchPending> = {}): NoMatchPending {
  return {
    id: 'nomatch-uuid-1',
    parentPendingId: 'parent-uuid-1',
    emailFrom: 'francois@exemple.com',
    nameFrom: 'François Lambert',
    defaultType: 'pro',
    emailMessageId: 'msg-nm-001',
    emailThreadRef: '(cf. thread Gmail msg-nm-001)',
    createdAt: '2026-05-17T10:00:00Z',
    ...overrides,
  };
}

// ============================================================
// Tests — buildNoMatchCard
// ============================================================

describe('buildNoMatchCard', () => {
  it('contient le titre "Contact inconnu détecté"', () => {
    const { text } = buildNoMatchCard(makeNoMatch());
    expect(text).toContain('Contact inconnu détecté');
    expect(text).toContain('<b>Contact inconnu détecté</b>');
  });

  it('affiche le nom et l\'email de l\'expéditeur', () => {
    const { text } = buildNoMatchCard(makeNoMatch());
    expect(text).toContain('François Lambert');
    expect(text).toContain('francois@exemple.com');
  });

  it('affiche la suggestion triage (defaultType)', () => {
    const { text } = buildNoMatchCard(makeNoMatch({ defaultType: 'autres' }));
    expect(text).toContain('Suggestion triage');
    expect(text).toContain('autres');
  });

  it('contient la question "Veux-tu créer une fiche"', () => {
    const { text } = buildNoMatchCard(makeNoMatch());
    expect(text).toContain('Veux-tu créer une fiche pour ce contact');
  });

  it('affiche uniquement l\'email si nameFrom est null', () => {
    const { text } = buildNoMatchCard(makeNoMatch({ nameFrom: null }));
    expect(text).toContain('francois@exemple.com');
    expect(text).not.toContain('&lt;');
  });

  it('échappe les caractères HTML dans le nom', () => {
    const { text } = buildNoMatchCard(makeNoMatch({ nameFrom: 'Test <script>' }));
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
  });

  it('retourne 5 boutons en layout 3x2 (2+2+1)', () => {
    const { inlineKeyboard } = buildNoMatchCard(makeNoMatch());

    expect(inlineKeyboard).toHaveLength(3);
    expect(inlineKeyboard[0]).toHaveLength(2); // Pro + Famille
    expect(inlineKeyboard[1]).toHaveLength(2); // Amis + Autres
    expect(inlineKeyboard[2]).toHaveLength(1); // Skip
  });

  it('les boutons utilisent le préfixe email_nomatch:', () => {
    const { inlineKeyboard } = buildNoMatchCard(makeNoMatch());

    const allButtons = inlineKeyboard.flat();
    for (const button of allButtons) {
      const cbData = 'callback_data' in button ? button.callback_data : '';
      expect(cbData.startsWith(NOMATCH_CALLBACK_PREFIX)).toBe(true);
    }
  });

  it('les callback_data contiennent le bon type et noMatchId', () => {
    const { inlineKeyboard } = buildNoMatchCard(makeNoMatch({ id: 'test-id-42' }));

    const allButtons = inlineKeyboard.flat();
    const cb = (i: number) => {
      const btn = allButtons[i]!;
      return 'callback_data' in btn ? btn.callback_data : '';
    };

    expect(cb(0)).toBe('email_nomatch:pro:test-id-42');
    expect(cb(1)).toBe('email_nomatch:famille:test-id-42');
    expect(cb(2)).toBe('email_nomatch:amis:test-id-42');
    expect(cb(3)).toBe('email_nomatch:autres:test-id-42');
    expect(cb(4)).toBe('email_nomatch:skip:test-id-42');
  });

  it('les boutons ont les bons labels avec emojis', () => {
    const { inlineKeyboard } = buildNoMatchCard(makeNoMatch());

    const allButtons = inlineKeyboard.flat();
    expect(allButtons[0]!.text).toContain('Pro');
    expect(allButtons[1]!.text).toContain('Famille');
    expect(allButtons[2]!.text).toContain('Amis');
    expect(allButtons[3]!.text).toContain('Autres');
    expect(allButtons[4]!.text).toContain('Skip');
  });
});

// ============================================================
// Tests — sendNoMatchCard
// ============================================================

describe('sendNoMatchCard', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-bot-token');
    vi.stubEnv('TELEGRAM_CHAT_ID_THOMAS', '12345');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('envoie la carte via Telegram API et retourne le messageId', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
      text: async () => '',
    });

    const result = await sendNoMatchCard(makeNoMatch());
    expect(result.messageId).toBe(42);

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const url = callArgs[0] as string;
    expect(url).toContain('sendMessage');
    expect(url).toContain('test-bot-token');

    const body = JSON.parse((callArgs[1] as RequestInit).body as string);
    expect(body.chat_id).toBe('12345');
    expect(body.parse_mode).toBe('HTML');
    expect(body.text).toContain('Contact inconnu');
  });

  it('lance une erreur si TELEGRAM_BOT_TOKEN manquant', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');

    await expect(sendNoMatchCard(makeNoMatch())).rejects.toThrow('TELEGRAM_BOT_TOKEN');
  });

  it('lance une erreur si TELEGRAM_CHAT_ID_THOMAS manquant', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID_THOMAS', '');

    await expect(sendNoMatchCard(makeNoMatch())).rejects.toThrow('TELEGRAM_CHAT_ID_THOMAS');
  });

  it('lance une erreur sur HTTP non-ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    });

    await expect(sendNoMatchCard(makeNoMatch())).rejects.toThrow('Telegram API 400');
  });
});
