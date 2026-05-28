/**
 * Carte Telegram secondaire — contact WhatsApp inconnu (no-match, S24).
 *
 * Symétrique de `no-match-card.ts` (email) : quand un chat WhatsApp pertinent
 * n'a aucun match contact (ni par téléphone ni par email proposé par le LLM),
 * Anya envoie cette carte à Thomas pour qu'il choisisse le type de fiche à
 * créer — Pro / Famille / Amis / Autres / Skip.
 *
 * Préfixe callback distinct (`wa_nomatch:`) pour éviter toute collision avec
 * le flux email (R4 : nouveau préfixe = nouveau handler + dispatch + test).
 *
 * Le champ `userContext` est rempli par PR B (Thomas répond à la carte AVANT
 * de cliquer pour ajouter du contexte ; intégré à la fiche).
 */

import type { TelegramKeyboard } from './telegram-cards';
import { escapeHtml } from './telegram-cards';
import type { ContactType } from './no-match-card';

// ============================================================
// Types
// ============================================================

export interface WhatsappNoMatchPending {
  /** UUID v4 */
  id: string;
  /** chatId WhatsApp (`<phone>@s.whatsapp.net` ou `<groupId>@g.us`) */
  chatId: string;
  /** Nom du chat tel que vu par Beeper (push name WhatsApp si non enregistré) */
  chatName: string;
  /** Téléphone normalisé (9 derniers chiffres) si DM, sinon null */
  phone: string | null;
  /** Résumé du chat produit par le LLM d'ingest (contexte pour Thomas) */
  summary: string;
  /** Catégorie par défaut suggérée (toujours 'pro' pour WhatsApp pour l'instant) */
  defaultType: ContactType;
  /** Texte libre fourni par Thomas via reply Telegram (PR B). null sinon. */
  userContext: string | null;
  /** message_id de la carte Telegram (pour retrouver le pending au reply) */
  cardMessageId: number | null;
  /** Timestamp ISO de création */
  createdAt: string;
}

/** Préfixe callback_data pour les boutons no-match WhatsApp */
export const WA_NOMATCH_CALLBACK_PREFIX = 'wa_nomatch:';

// ============================================================
// Constantes Telegram
// ============================================================

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

// ============================================================
// Construction du message HTML
// ============================================================

/**
 * Construit le texte HTML + clavier inline d'une carte no-match WhatsApp.
 *
 * Affiche : nom du chat, numéro (si DM), résumé court, consigne reply-pour-
 * contexte, puis 5 boutons (3 + 2 + skip).
 */
export function buildWhatsappNoMatchCard(noMatch: WhatsappNoMatchPending): {
  text: string;
  inlineKeyboard: TelegramKeyboard;
} {
  const lines: string[] = [];

  lines.push('\u{1F195} <b>Contact WhatsApp inconnu</b>');
  lines.push('');
  lines.push(`<b>Chat</b> : ${escapeHtml(noMatch.chatName)}`);
  if (noMatch.phone) {
    lines.push(`<b>Numéro</b> : ${escapeHtml(noMatch.phone)}`);
  }
  lines.push('');
  // Résumé du LLM — tronqué pour ne pas exploser la carte.
  const summary = noMatch.summary.length > 400
    ? `${noMatch.summary.slice(0, 400)}…`
    : noMatch.summary;
  lines.push(`<i>${escapeHtml(summary)}</i>`);
  lines.push('');
  lines.push('Veux-tu créer une fiche pour ce contact ? Choisis le type :');
  lines.push('<i>Astuce : réponds à ce message AVANT de cliquer pour ajouter du contexte.</i>');

  const text = lines.join('\n');

  const inlineKeyboard: TelegramKeyboard = [
    [
      { text: '\u{1F4BC} Pro', callback_data: `${WA_NOMATCH_CALLBACK_PREFIX}pro:${noMatch.id}` },
      { text: '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467} Famille', callback_data: `${WA_NOMATCH_CALLBACK_PREFIX}famille:${noMatch.id}` },
    ],
    [
      { text: '\u{1F465} Amis', callback_data: `${WA_NOMATCH_CALLBACK_PREFIX}amis:${noMatch.id}` },
      { text: '\u{1F4CB} Autres', callback_data: `${WA_NOMATCH_CALLBACK_PREFIX}autres:${noMatch.id}` },
    ],
    [
      { text: '\u{23ED}\u{FE0F} Skip', callback_data: `${WA_NOMATCH_CALLBACK_PREFIX}skip:${noMatch.id}` },
    ],
  ];

  return { text, inlineKeyboard };
}

// ============================================================
// Envoi via Telegram API
// ============================================================

export async function sendWhatsappNoMatchCard(
  noMatch: WhatsappNoMatchPending,
): Promise<{ messageId: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    throw new Error('TELEGRAM_BOT_TOKEN manquant ou placeholder');
  }
  const chatId = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID_THOMAS manquant');
  }

  const { text, inlineKeyboard } = buildWhatsappNoMatchCard(noMatch);

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
      const errBody = await response.text().catch(() => '');
      throw new Error(`Telegram API ${response.status} : ${errBody.slice(0, 200)}`);
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
    if (err instanceof Error && err.message.startsWith('Telegram API')) throw err;
    throw new Error(
      `Envoi carte WhatsApp no-match Telegram échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ============================================================
// Parsing callback
// ============================================================

export type WhatsappNoMatchAction = ContactType | 'skip';

export interface ParsedWhatsappNoMatchCallback {
  action: WhatsappNoMatchAction;
  noMatchId: string;
}

/**
 * Parse `wa_nomatch:<type>:<id>` → { action, noMatchId }, ou null si invalide.
 */
export function parseWhatsappNoMatchCallback(
  data: string,
): ParsedWhatsappNoMatchCallback | null {
  if (!data.startsWith(WA_NOMATCH_CALLBACK_PREFIX)) return null;
  const rest = data.slice(WA_NOMATCH_CALLBACK_PREFIX.length);
  const sep = rest.indexOf(':');
  if (sep === -1) return null;
  const action = rest.slice(0, sep) as WhatsappNoMatchAction;
  const noMatchId = rest.slice(sep + 1);
  if (!noMatchId) return null;
  if (!['pro', 'famille', 'amis', 'autres', 'skip'].includes(action)) return null;
  return { action, noMatchId };
}
