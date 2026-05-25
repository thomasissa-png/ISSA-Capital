/**
 * Carte Telegram récap calendar-ingest (refonte S23).
 *
 * Envoyée après chaque cron run s'il y a au moins un event traité OU une erreur.
 * Silence sinon (pas de spam quand tout est `no-change`).
 *
 * Récap : contacts enrichis + historiques projet + todos créés + désambiguïsations
 * + erreurs détaillées (logging #2). Texte brut, pas d'inline_keyboard.
 */

import { sendTelegramMessage } from '../telegram';
import type { CalendarIngestResult } from './types';

// ============================================================
// API publique
// ============================================================

/**
 * Construit le message texte récap.
 * Affiche : ligne par event traité (date, sujet, ce qui a été fait) + erreurs.
 *
 * Limite Telegram : 4096 chars → tronque à 8 events + 8 erreurs.
 */
export function buildRecapMessage(results: CalendarIngestResult[]): string {
  const actionable = results.filter((r) => r.op === 'processed');
  const errored = results.filter((r) => r.errors.length > 0);

  if (actionable.length === 0 && errored.length === 0) return '';

  const lines: string[] = [];
  lines.push('Calendar-ingest');

  const MAX_LINES = 8;
  if (actionable.length > 0) {
    lines.push(`${actionable.length} réunion(s) traitée(s) :`);
    for (const r of actionable.slice(0, MAX_LINES)) {
      const summaryShort =
        r.summary.length > 50 ? `${r.summary.slice(0, 47)}...` : r.summary;
      const parts: string[] = [];
      if (r.contactsEnriched > 0) {
        parts.push(`${r.contactsEnriched} contact(s)`);
      }
      if (r.projectsEnriched.length > 0) {
        parts.push(`projet ${r.projectsEnriched.join('/')}`);
      }
      if (r.projectAmbiguous) parts.push('projet à confirmer');
      if (r.todoCreated) parts.push('todo CR');
      const detail = parts.length > 0 ? ` → ${parts.join(', ')}` : ' → rien';
      lines.push(`• ${r.date} — ${summaryShort}${detail}`);
    }
    if (actionable.length > MAX_LINES) {
      lines.push(`... et ${actionable.length - MAX_LINES} autre(s)`);
    }
  }

  if (errored.length > 0) {
    lines.push('');
    lines.push(`${errored.length} erreur(s) :`);
    for (const r of errored.slice(0, MAX_LINES)) {
      const summaryShort =
        r.summary.length > 40 ? `${r.summary.slice(0, 37)}...` : r.summary;
      lines.push(`• ${summaryShort} : ${r.errors.join(' ; ').slice(0, 120)}`);
    }
    if (errored.length > MAX_LINES) {
      lines.push(`... et ${errored.length - MAX_LINES} autre(s) erreur(s)`);
    }
  }

  return lines.join('\n');
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
