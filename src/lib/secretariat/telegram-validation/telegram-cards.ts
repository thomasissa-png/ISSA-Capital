/**
 * Telegram validation cards — sérialisation d'un état pending en message Telegram.
 *
 * Construit le message HTML + inline keyboard pour demander à Thomas
 * de valider, skip, voir ou modifier les actions proposées par email-ingest.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md section Jalon 4B.
 */

import type { ActionProposal } from '../handlers/types';
import type { TriageResult } from '../triage/types';
import type { EmailMessage } from '../gmail-source/types';

// ============================================================
// Types
// ============================================================

export interface PendingValidation {
  /** UUID v4 identifiant unique du pending */
  id: string;
  /** Résultat du triage LLM */
  triage: TriageResult;
  /** Actions proposées par le handler */
  actions: ActionProposal[];
  /** Email source normalisé */
  email: EmailMessage;
  /** Timestamp ISO de création */
  createdAt: string;
}

/** Structure inline keyboard Telegram (tableau de rangées de boutons) */
export type TelegramKeyboard = Array<
  Array<{ text: string; callback_data: string }>
>;

// ============================================================
// Constantes
// ============================================================

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

/** Préfixe callback_data pour les boutons de validation email */
export const VALIDATION_CALLBACK_PREFIX = 'email_val:';

// ============================================================
// Échappement HTML Telegram
// ============================================================

/**
 * Échappe les caractères HTML pour Telegram parse_mode=HTML.
 * Telegram HTML supporte uniquement un sous-ensemble restreint de tags.
 * Les caractères <, >, & doivent être échappés dans le texte libre.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
// Formatage date
// ============================================================

function formatDateFr(date: Date): string {
  const day = date.getDate();
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  const month = months[date.getMonth()]!;
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// ============================================================
// Construction du message HTML
// ============================================================

/**
 * Construit le message HTML et le inline keyboard pour une PendingValidation.
 *
 * Format visuel cible :
 * - En-tête avec expéditeur, objet, date
 * - Catégorie + confidence + intent + résumé du triage
 * - Liste des actions proposées
 * - Inline keyboard 2x2 : Valider / Skip / Voir / Modifier
 */
export function buildValidationCard(pending: PendingValidation): {
  text: string;
  inlineKeyboard: TelegramKeyboard;
} {
  const { triage, actions, email } = pending;

  // Formater l'expéditeur
  const fromDisplay = email.from.name
    ? `${escapeHtml(email.from.name)} &lt;${escapeHtml(email.from.email)}&gt;`
    : escapeHtml(email.from.email);

  // Formater la date
  const dateFr = formatDateFr(
    email.receivedAt instanceof Date ? email.receivedAt : new Date(email.receivedAt),
  );

  // Construire les lignes du message
  const lines: string[] = [];

  // En-tête email
  lines.push('\u{1F4E7} <b>Email reçu</b>');
  lines.push(`<b>De</b> : ${fromDisplay}`);
  lines.push(`<b>Objet</b> : ${escapeHtml(email.subject)}`);
  lines.push(`<b>Date</b> : ${dateFr}`);
  lines.push('');

  // Triage
  lines.push(
    `\u{1F3F7}\u{FE0F} <b>Catégorie</b> : ${escapeHtml(triage.category)} <i>(confidence ${triage.confidence.toFixed(2)})</i>`,
  );
  lines.push(`\u{1F3AF} <b>Intent</b> : ${escapeHtml(triage.intent)}`);
  lines.push(`\u{1F4DD} <b>Résumé</b> : ${escapeHtml(triage.summary)}`);
  lines.push('');

  // Actions proposées
  if (actions.length > 0) {
    lines.push('\u{1F527} <b>Actions proposées</b> :');
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]!;
      lines.push(`${i + 1}. ${escapeHtml(action.description)}`);
    }
  }

  const text = lines.join('\n');

  // Inline keyboard 2x2
  const inlineKeyboard: TelegramKeyboard = [
    [
      { text: '\u{2705} Valider', callback_data: `${VALIDATION_CALLBACK_PREFIX}valider:${pending.id}` },
      { text: '\u{23ED}\u{FE0F} Skip', callback_data: `${VALIDATION_CALLBACK_PREFIX}skip:${pending.id}` },
    ],
    [
      { text: '\u{1F441}\u{FE0F} Voir', callback_data: `${VALIDATION_CALLBACK_PREFIX}voir:${pending.id}` },
      { text: '\u{270F}\u{FE0F} Modifier', callback_data: `${VALIDATION_CALLBACK_PREFIX}modifier:${pending.id}` },
    ],
  ];

  return { text, inlineKeyboard };
}

// ============================================================
// Envoi via Telegram API
// ============================================================

/**
 * Envoie une carte de validation à Thomas via Telegram.
 *
 * @param pending La PendingValidation à afficher
 * @returns Le message_id du message envoyé (pour edit ultérieur)
 * @throws Error si l'envoi échoue
 */
export async function sendValidationCard(
  pending: PendingValidation,
): Promise<{ messageId: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    throw new Error('TELEGRAM_BOT_TOKEN manquant ou placeholder');
  }

  const chatId = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!chatId) {
    throw new Error('TELEGRAM_CHAT_ID_THOMAS manquant');
  }

  const { text, inlineKeyboard } = buildValidationCard(pending);

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
      `Envoi carte Telegram échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ============================================================
// Édition de message Telegram (après validation/skip)
// ============================================================

/**
 * Modifie le texte d'un message Telegram et retire le inline keyboard.
 * Utilisé pour ajouter le statut final (ex: "Valide a HH:MM").
 */
export async function editMessageText(
  chatId: number | string,
  messageId: number,
  newText: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') return false;

  const url = `${TELEGRAM_API_BASE}/bot${token}/editMessageText`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: newText,
        parse_mode: 'HTML',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}

/**
 * Envoie un message texte simple dans un chat Telegram (pour "Voir" et "Modifier").
 * Retourne le message_id envoyé.
 */
export async function sendSimpleMessage(
  chatId: number | string,
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML',
): Promise<{ success: boolean; messageId?: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { success: false };
  }

  const safeText =
    text.length > 4096 ? `${text.slice(0, 4084)}… [tronqué]` : text;

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: safeText,
        parse_mode: parseMode,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return { success: false };

    const data = (await response.json()) as {
      ok: boolean;
      result?: { message_id?: number };
    };

    return {
      success: data.ok,
      messageId: data.result?.message_id,
    };
  } catch {
    clearTimeout(timer);
    return { success: false };
  }
}
