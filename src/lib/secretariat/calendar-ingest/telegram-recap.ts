/**
 * Carte Telegram récap calendar-ingest.
 *
 * Envoyée après chaque cron run si reunionsCreated + reunionsUpdated > 0.
 * Silence si 0 (pas de spam).
 *
 * Format compact aligné sur les cartes existantes (sendTelegramMessage texte
 * brut, pas de inline_keyboard — pure notification).
 */

import { sendTelegramMessage } from '../telegram';
import type { CalendarIngestResult } from './types';

// ============================================================
// API publique
// ============================================================

/**
 * Construit le message texte récap.
 * Affiche : nb total + ligne par réunion (date, sujet, op, contacts).
 *
 * Limite Telegram : 4096 chars → tronque à 8 réunions max.
 */
export function buildRecapMessage(results: CalendarIngestResult[]): string {
  const actionable = results.filter(
    (r) =>
      r.op === 'reunion-created' ||
      r.op === 'reunion-updated' ||
      r.op === 'reunion-cancelled',
  );

  if (actionable.length === 0) return '';

  const lines: string[] = [];
  lines.push('Calendar-ingest');
  lines.push(`${actionable.length} réunion(s) traitée(s) :`);

  const MAX_LINES = 8;
  for (const r of actionable.slice(0, MAX_LINES)) {
    const opLabel = labelForOp(r.op);
    const contactSuffix =
      r.contactsEnriched > 0
        ? `, ${r.contactsEnriched} contact(s) enrichi(s)`
        : '';
    const summaryShort = r.summary.length > 60
      ? `${r.summary.slice(0, 57)}...`
      : r.summary;
    lines.push(`• ${r.date} — ${summaryShort} → ${opLabel}${contactSuffix}`);
  }

  if (actionable.length > MAX_LINES) {
    lines.push(`... et ${actionable.length - MAX_LINES} autre(s)`);
  }

  return lines.join('\n');
}

function labelForOp(op: CalendarIngestResult['op']): string {
  switch (op) {
    case 'reunion-created':
      return 'fiche créée';
    case 'reunion-updated':
      return 'fiche mise à jour';
    case 'reunion-cancelled':
      return 'réunion annulée';
    default:
      return op;
  }
}

/**
 * Envoie la carte récap à Thomas si actionable > 0.
 * Non-bloquant : warn et return false en cas d'erreur Telegram.
 *
 * @returns true si envoyé, false si silence (0 actionable) ou erreur
 */
export async function sendCalendarRecapCard(
  results: CalendarIngestResult[],
): Promise<boolean> {
  const message = buildRecapMessage(results);
  if (!message) return false; // silence

  const chatIdStr = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!chatIdStr) {
    console.warn(
      '[calendar-recap] TELEGRAM_CHAT_ID_THOMAS manquant — pas de carte',
    );
    return false;
  }
  const chatId = parseInt(chatIdStr, 10);
  if (isNaN(chatId)) {
    console.warn(
      `[calendar-recap] TELEGRAM_CHAT_ID_THOMAS invalide : ${chatIdStr}`,
    );
    return false;
  }

  const result = await sendTelegramMessage(chatId, message);
  if (!result.success) {
    console.warn(
      `[calendar-recap] envoi échec : ${result.error ?? 'erreur inconnue'}`,
    );
    return false;
  }
  return true;
}
