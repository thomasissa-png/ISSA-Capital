/**
 * Carte Telegram secondaire — contact inconnu (no-match).
 *
 * Envoyée APRÈS la carte principale de validation quand un email
 * provient d'un expéditeur sans fiche dans le vault.
 * Thomas choisit le type de fiche à créer via 5 boutons inline :
 *   Pro / Famille / Amis / Autres / Skip
 *
 * Jalon 4D-2 : UX no-match contacts.
 */

import type { TelegramKeyboard } from './telegram-cards';
import { escapeHtml } from './telegram-cards';

// ============================================================
// Types
// ============================================================

export interface NoMatchPending {
  /** UUID v4, distinct du pendingId principal */
  id: string;
  /** Référence à la PendingValidation principale */
  parentPendingId: string;
  /** Adresse email de l'expéditeur */
  emailFrom: string;
  /** Nom de l'expéditeur (peut être null) */
  nameFrom: string | null;
  /** Catégorie par défaut suggérée par le triage */
  defaultType: 'pro' | 'famille' | 'amis' | 'autres';
  /** ID du message email source */
  emailMessageId: string;
  /** Référence email pour la section Historique */
  emailThreadRef: string;
  /** Timestamp ISO de création */
  createdAt: string;
  /** message_id de la carte Telegram (pour retrouver le pending au reply, S24 soir). Optionnel pour rétro-compatibilité des pendings déjà en store. */
  cardMessageId?: number | null;
  /** Texte libre fourni par Thomas via reply Telegram AVANT son clic (S24 soir). Optionnel. */
  userContext?: string | null;
}

/** Types de contact valides pour la création de fiche */
export type ContactType = 'pro' | 'famille' | 'amis' | 'autres';

/** Préfixe callback_data pour les boutons no-match */
export const NOMATCH_CALLBACK_PREFIX = 'email_nomatch:';

// ============================================================
// Constantes Telegram
// ============================================================

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

// ============================================================
// Construction du message HTML
// ============================================================

/**
 * Construit le message HTML et le inline keyboard pour une carte no-match.
 *
 * Format visuel :
 * - Icône + titre "Contact inconnu détecté"
 * - De : nom + email
 * - Suggestion triage : defaultType
 * - Question + 5 boutons inline (3x2)
 */
export function buildNoMatchCard(noMatch: NoMatchPending): {
  text: string;
  inlineKeyboard: TelegramKeyboard;
} {
  const lines: string[] = [];

  // En-tête
  lines.push('\u{1F195} <b>Contact inconnu détecté</b>');
  lines.push('');

  // Expéditeur
  const fromDisplay = noMatch.nameFrom
    ? `${escapeHtml(noMatch.nameFrom)} &lt;${escapeHtml(noMatch.emailFrom)}&gt;`
    : escapeHtml(noMatch.emailFrom);
  lines.push(`<b>De</b> : ${fromDisplay}`);

  // Suggestion triage
  lines.push(`<b>Suggestion triage</b> : ${escapeHtml(noMatch.defaultType)}`);
  lines.push('');

  // Question + astuce contexte (S24 soir)
  lines.push('Veux-tu créer une fiche pour ce contact ? Choisis le type :');
  lines.push('<i>Astuce : réponds à ce message AVANT de cliquer pour ajouter du contexte.</i>');

  const text = lines.join('\n');

  // Inline keyboard 3x2 (5 boutons + skip)
  const inlineKeyboard: TelegramKeyboard = [
    [
      { text: '\u{1F4BC} Pro', callback_data: `${NOMATCH_CALLBACK_PREFIX}pro:${noMatch.id}` },
      { text: '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467} Famille', callback_data: `${NOMATCH_CALLBACK_PREFIX}famille:${noMatch.id}` },
    ],
    [
      { text: '\u{1F465} Amis', callback_data: `${NOMATCH_CALLBACK_PREFIX}amis:${noMatch.id}` },
      { text: '\u{1F4CB} Autres', callback_data: `${NOMATCH_CALLBACK_PREFIX}autres:${noMatch.id}` },
    ],
    [
      { text: '\u{23ED}\u{FE0F} Skip', callback_data: `${NOMATCH_CALLBACK_PREFIX}skip:${noMatch.id}` },
    ],
  ];

  return { text, inlineKeyboard };
}

// ============================================================
// Envoi via Telegram API
// ============================================================

/**
 * Envoie une carte no-match à Thomas via Telegram.
 *
 * @param noMatch Le NoMatchPending à afficher
 * @returns Le message_id du message envoyé (pour edit ultérieur)
 * @throws Error si l'envoi échoue
 */
export async function sendNoMatchCard(
  noMatch: NoMatchPending,
): Promise<{ messageId: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    throw new Error('TELEGRAM_BOT_TOKEN manquant ou placeholder');
  }

  const chatId = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID_THOMAS manquant');
  }

  const { text, inlineKeyboard } = buildNoMatchCard(noMatch);

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: inlineKeyboard },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `Telegram API ${response.status} : ${errorBody.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as {
      ok: boolean;
      result?: { message_id?: number };
    };

    if (!data.ok || !data.result?.message_id) {
      throw new Error('Telegram API : message_id absent dans la réponse');
    }

    return { messageId: data.result.message_id };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.message.startsWith('Telegram API')) {
      throw err;
    }
    throw new Error(
      `Envoi carte no-match Telegram échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
