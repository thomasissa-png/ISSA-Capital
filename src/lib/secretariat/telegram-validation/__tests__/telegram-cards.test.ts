/**
 * Tests pour telegram-cards — construction des cartes de validation Telegram.
 *
 * Couvre :
 * - buildValidationCard : format HTML, inline keyboard, échappement
 * - sendValidationCard : appel API Telegram, retour message_id, erreurs
 * - escapeHtml : caractères spéciaux
 * - Différentes catégories de triage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PendingValidation } from '../telegram-cards';
import {
  buildValidationCard,
  sendValidationCard,
  escapeHtml,
  VALIDATION_CALLBACK_PREFIX,
} from '../telegram-cards';

// ============================================================
// Fixtures
// ============================================================

function makePending(overrides: Partial<PendingValidation> = {}): PendingValidation {
  return {
    id: 'test-uuid-1234',
    triage: {
      category: 'contact-pro',
      intent: 'validation_juridique_bail',
      confidence: 0.92,
      matchedContact: 'Martin Yhuel',
      summary: 'Avocat demande validation clause bail spécifique',
      suggestedActions: [],
    },
    actions: [
      {
        type: 'append_historique',
        target: '07. Contacts/01. Pro/Martin Yhuel.md',
        payload: { title: '2026-05-12 — Bail clause', content: 'Détails...' },
        description: 'Append historique : 07. Contacts/01. Pro/Martin Yhuel.md',
      },
      {
        type: 'update_frontmatter',
        target: '07. Contacts/01. Pro/Martin Yhuel.md',
        payload: { fields: { date_dernière_interaction: '2026-05-12' } },
        description: 'Update date_dernière_interaction',
      },
    ],
    email: {
      source: 'gmail',
      id: 'msg-12345',
      from: { email: 'martin@pnmavocats.law', name: 'Martin Yhuel' },
      to: [{ email: 'thomas@issa-capital.com' }],
      cc: [],
      subject: 'Bail 25 rue de la Paix - clause à valider',
      bodyPlain: 'Bonjour Thomas, je vous contacte au sujet du bail...',
      receivedAt: new Date('2026-05-12T10:30:00Z'),
      attachments: [],
      rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg-12345',
    },
    createdAt: '2026-05-12T10:35:00Z',
    ...overrides,
  };
}

// ============================================================
// Mock fetch global
// ============================================================

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-bot-token');
  vi.stubEnv('TELEGRAM_CHAT_ID_THOMAS', '123456');
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

// ============================================================
// escapeHtml
// ============================================================

describe('escapeHtml', () => {
  it('échappe les chevrons et esperluettes', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;',
    );
  });

  it('échappe les & isolés', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('laisse le texte normal intact', () => {
    expect(escapeHtml('Bonjour Thomas')).toBe('Bonjour Thomas');
  });

  it('gère les accents UTF-8', () => {
    expect(escapeHtml('Résumé à valider')).toBe('Résumé à valider');
  });
});

// ============================================================
// buildValidationCard
// ============================================================

describe('buildValidationCard', () => {
  it('construit le HTML avec les infos email', () => {
    const pending = makePending();
    const { text } = buildValidationCard(pending);

    expect(text).toContain('<b>Email reçu</b>');
    expect(text).toContain('Martin Yhuel');
    expect(text).toContain('martin@pnmavocats.law');
    expect(text).toContain('Bail 25 rue de la Paix - clause à valider');
    expect(text).toContain('12 mai 2026');
  });

  it('affiche la catégorie et la confidence', () => {
    const pending = makePending();
    const { text } = buildValidationCard(pending);

    expect(text).toContain('contact-pro');
    expect(text).toContain('0.92');
    expect(text).toContain('<b>Catégorie</b>');
  });

  it('affiche l\'intent et le résumé', () => {
    const pending = makePending();
    const { text } = buildValidationCard(pending);

    expect(text).toContain('validation_juridique_bail');
    expect(text).toContain('Avocat demande validation clause bail spécifique');
  });

  it('affiche les actions proposées numérotées', () => {
    const pending = makePending();
    const { text } = buildValidationCard(pending);

    expect(text).toContain('<b>Actions proposées</b>');
    expect(text).toContain('1. Append historique');
    expect(text).toContain('2. Update date_dernière_interaction');
  });

  it('construit un inline keyboard 2x2', () => {
    const pending = makePending();
    const { inlineKeyboard } = buildValidationCard(pending);

    expect(inlineKeyboard).toHaveLength(2);
    expect(inlineKeyboard[0]).toHaveLength(2);
    expect(inlineKeyboard[1]).toHaveLength(2);

    // Vérifier les textes des boutons
    expect(inlineKeyboard[0]![0]!.text).toContain('Valider');
    expect(inlineKeyboard[0]![1]!.text).toContain('Skip');
    expect(inlineKeyboard[1]![0]!.text).toContain('Voir');
    expect(inlineKeyboard[1]![1]!.text).toContain('Modifier');
  });

  it('utilise le format callback_data correct', () => {
    const pending = makePending({ id: 'abc-123' });
    const { inlineKeyboard } = buildValidationCard(pending);

    // Les boutons d'action utilisent callback_data (pas url)
    const btn = (row: number, col: number) => {
      const button = inlineKeyboard[row]![col]!;
      return 'callback_data' in button ? button.callback_data : '';
    };

    expect(btn(0, 0)).toBe(`${VALIDATION_CALLBACK_PREFIX}valider:abc-123`);
    expect(btn(0, 1)).toBe(`${VALIDATION_CALLBACK_PREFIX}skip:abc-123`);
    expect(btn(1, 0)).toBe(`${VALIDATION_CALLBACK_PREFIX}voir:abc-123`);
    expect(btn(1, 1)).toBe(`${VALIDATION_CALLBACK_PREFIX}modifier:abc-123`);
  });

  it('échappe les caractères HTML dans le subject', () => {
    const pending = makePending({
      email: {
        ...makePending().email,
        subject: 'Test <b>bold</b> & "quotes"',
      },
    });
    const { text } = buildValidationCard(pending);

    expect(text).toContain('Test &lt;b&gt;bold&lt;/b&gt; &amp; "quotes"');
    expect(text).not.toContain('<b>bold</b>');
  });

  it('gère un email sans nom d\'expéditeur', () => {
    const pending = makePending({
      email: {
        ...makePending().email,
        from: { email: 'no-name@example.com' },
      },
    });
    const { text } = buildValidationCard(pending);

    expect(text).toContain('no-name@example.com');
  });

  it('gère la catégorie locataire', () => {
    const pending = makePending({
      triage: {
        ...makePending().triage,
        category: 'locataire',
        intent: 'demande_quittance',
        confidence: 0.87,
        summary: 'Locataire demande sa quittance de mai',
      },
    });
    const { text } = buildValidationCard(pending);

    expect(text).toContain('locataire');
    expect(text).toContain('0.87');
    expect(text).toContain('demande_quittance');
  });

  it('gère la catégorie a-classifier', () => {
    const pending = makePending({
      triage: {
        ...makePending().triage,
        category: 'a-classifier',
        confidence: 0.45,
        summary: 'Email non classifiable automatiquement',
      },
    });
    const { text } = buildValidationCard(pending);

    expect(text).toContain('a-classifier');
    expect(text).toContain('0.45');
  });

  it('gère un pending sans actions', () => {
    const pending = makePending({ actions: [] });
    const { text } = buildValidationCard(pending);

    expect(text).not.toContain('Actions proposées');
  });

  it('gère la date receivedAt sous forme de string ISO', () => {
    const pending = makePending({
      email: {
        ...makePending().email,
        // Simuler un pending désérialisé depuis JSON (Date → string)
        receivedAt: '2026-05-12T10:30:00Z' as unknown as Date,
      },
    });
    const { text } = buildValidationCard(pending);

    expect(text).toContain('12 mai 2026');
  });

  // --- Draft Gmail (Jalon 5B) ---

  it('ajoute une 3ème rangée avec bouton "Voir dans Gmail" si draftGmailUrl est présent', () => {
    const pending = makePending({
      draftGmailUrl: 'https://mail.google.com/mail/u/0/#drafts?compose=abc',
      draftPreview: 'Bonjour Martin, merci pour votre message.',
    });
    const { text, inlineKeyboard } = buildValidationCard(pending);

    // 3 rangées au lieu de 2
    expect(inlineKeyboard).toHaveLength(3);

    // La 3ème rangée a un bouton URL
    const draftButton = inlineKeyboard[2]![0]!;
    expect(draftButton.text).toContain('Voir dans Gmail');
    expect('url' in draftButton).toBe(true);
    if ('url' in draftButton) {
      expect(draftButton.url).toBe('https://mail.google.com/mail/u/0/#drafts?compose=abc');
    }

    // Le texte contient la preview
    expect(text).toContain('Brouillon de réponse prêt');
    expect(text).toContain('Bonjour Martin, merci pour votre message.');
  });

  it('ne montre PAS le bouton draft si draftGmailUrl est absent', () => {
    const pending = makePending(); // pas de draftGmailUrl
    const { text, inlineKeyboard } = buildValidationCard(pending);

    expect(inlineKeyboard).toHaveLength(2);
    expect(text).not.toContain('Brouillon de réponse prêt');
  });

  it('affiche le bouton draft sans preview si draftPreview est absent', () => {
    const pending = makePending({
      draftGmailUrl: 'https://mail.google.com/mail/u/0/#drafts',
    });
    const { text, inlineKeyboard } = buildValidationCard(pending);

    expect(inlineKeyboard).toHaveLength(3);
    expect(text).toContain('Brouillon de réponse prêt');
    // Pas de preview italic — vérifier qu'aucune ligne ne commence par <i> (la preview serait sur sa propre ligne)
    expect(text).not.toMatch(/^\s*<i>/m);
  });
});

// ============================================================
// sendValidationCard
// ============================================================

describe('sendValidationCard', () => {
  it('envoie le message et retourne message_id', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        result: { message_id: 42 },
      }),
    });

    const pending = makePending();
    const result = await sendValidationCard(pending);

    expect(result.messageId).toBe(42);
    expect(globalThis.fetch).toHaveBeenCalledOnce();

    // Vérifier la structure de l'appel
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const url = callArgs[0] as string;
    expect(url).toContain('/bot');
    expect(url).toContain('/sendMessage');

    const body = JSON.parse((callArgs[1] as { body: string }).body);
    expect(body.parse_mode).toBe('HTML');
    // 2 rangées standard (pas de draft dans ce pending)
    expect(body.reply_markup.inline_keyboard).toHaveLength(2);
  });

  it('throw sur erreur API Telegram', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden: bot was blocked by the user',
    });

    const pending = makePending();
    await expect(sendValidationCard(pending)).rejects.toThrow('Telegram API 403');
  });

  it('throw si TELEGRAM_BOT_TOKEN manquant', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    const pending = makePending();
    await expect(sendValidationCard(pending)).rejects.toThrow('TELEGRAM_BOT_TOKEN');
  });

  it('throw si TELEGRAM_CHAT_ID_THOMAS manquant', async () => {
    vi.stubEnv('TELEGRAM_CHAT_ID_THOMAS', '');
    const pending = makePending();
    await expect(sendValidationCard(pending)).rejects.toThrow('TELEGRAM_CHAT_ID_THOMAS');
  });

  it('throw si message_id absent de la réponse', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
    });

    const pending = makePending();
    await expect(sendValidationCard(pending)).rejects.toThrow('message_id absent');
  });
});
