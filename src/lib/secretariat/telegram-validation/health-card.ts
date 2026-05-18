/**
 * Carte Telegram health-monitor — construit un message d'alerte santé Anya.
 *
 * Utilisé par cron-health-check pour envoyer des alertes
 * quand un item surveillé atteint un seuil (warn/critical).
 *
 * Jalon S15.5E — Task C.
 */

import type { MonitoredItemStatus } from '../health-monitor/types';
import type { TelegramKeyboard } from './telegram-cards';
import { escapeHtml } from './telegram-cards';

// ============================================================
// API publique
// ============================================================

/**
 * Construit une carte d'alerte santé pour un MonitoredItemStatus.
 *
 * @returns text (HTML Telegram) + buttons (inline keyboard)
 */
export function buildHealthAlertCard(status: MonitoredItemStatus): {
  text: string;
  buttons: TelegramKeyboard;
} {
  const stateLabel = formatState(status.state);
  const daysInfo = formatDaysInfo(status);

  const lines: string[] = [];

  lines.push('[ALERTE] <b>Alerte santé Anya</b>');
  lines.push(`<b>Item</b> : ${escapeHtml(status.label)}`);
  lines.push(`<b>État</b> : ${stateLabel} (${escapeHtml(daysInfo)})`);
  lines.push(`<b>Catégorie</b> : ${escapeHtml(status.category)}`);

  if (status.renewalInstructions) {
    lines.push('');
    lines.push(escapeHtml(status.renewalInstructions));
  }

  const text = lines.join('\n');

  // Boutons
  const buttons: TelegramKeyboard = [
    [
      { text: 'Marqué comme renouvelé', callback_data: `health_renewed:${status.itemId}` },
      { text: 'Rappeler dans 7 jours', callback_data: `health_snooze:${status.itemId}` },
    ],
  ];

  // Ligne 2 : lien renouvellement si disponible
  if (status.renewalUrl) {
    buttons.push([
      { text: 'Ouvrir page renouvellement', url: status.renewalUrl },
    ]);
  }

  return { text, buttons };
}

// ============================================================
// Helpers
// ============================================================

function formatState(state: MonitoredItemStatus['state']): string {
  switch (state) {
    case 'ok': return 'OK';
    case 'warn': return 'WARN';
    case 'critical': return 'CRITICAL';
    case 'unknown': return 'INCONNU';
  }
}

function formatDaysInfo(status: MonitoredItemStatus): string {
  if (status.daysRemaining !== null) {
    if (status.daysRemaining < 0) {
      return `expiré depuis ${Math.abs(status.daysRemaining)}j`;
    }
    return `${status.daysRemaining}j restants`;
  }
  if (status.reason) {
    return status.reason;
  }
  return 'aucune info';
}

// ============================================================
// Envoi de la carte via Telegram API
// ============================================================

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

/**
 * Envoie une carte d'alerte santé à Thomas via Telegram.
 *
 * @param chatId Chat ID de Thomas
 * @param status Le MonitoredItemStatus à afficher
 * @returns messageId du message envoyé
 * @throws Error si l'envoi échoue
 */
export async function sendHealthAlertCard(
  chatId: number | string,
  status: MonitoredItemStatus,
): Promise<{ messageId: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    throw new Error('TELEGRAM_BOT_TOKEN manquant ou placeholder');
  }

  const { text, buttons } = buildHealthAlertCard(status);

  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: buttons },
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
      `Envoi carte santé Telegram échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
