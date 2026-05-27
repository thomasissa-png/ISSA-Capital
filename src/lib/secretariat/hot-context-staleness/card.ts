/**
 * Carte Telegram « hot-context périmé » (V0). Mirroir de health-card.ts.
 *
 * Boutons : Bumper (callback `hcstale:bump`), Ouvrir dans Drive (url directe),
 * Snooze 24h (callback `hcstale:snooze`).
 */

import { escapeHtml } from '../telegram-validation/telegram-cards';
import type { StalenessVerdict } from './staleness';

export const HOT_CONTEXT_STALE_CALLBACK_PREFIX = 'hcstale:';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const TIMEOUT_MS = 10_000;

interface InlineBtn {
  text: string;
  callback_data?: string;
  url?: string;
}

export function buildStalenessCard(
  verdict: StalenessVerdict,
  driveUrl: string | null,
): { text: string; buttons: InlineBtn[][] } {
  const lines: string[] = [];

  if (verdict.severity === 'critical') {
    lines.push('🔥 <b>Hot context — pas touché depuis longtemps</b>');
  } else if (verdict.severity === 'invalid') {
    lines.push('🔥 <b>Hot context — frontmatter illisible</b>');
  } else {
    lines.push('🔥 <b>Hot context périmé</b>');
  }

  lines.push(
    `Frontmatter : ${escapeHtml(verdict.fileWeek ?? '—')}, MAJ ${escapeHtml(verdict.fileDate ?? '—')}`,
  );
  lines.push(`Aujourd'hui : ${escapeHtml(verdict.currentWeek)} (${escapeHtml(verdict.currentDate)})`);
  if (verdict.daysSince !== null) {
    lines.push(`Pas mis à jour depuis <b>${verdict.daysSince} jour(s)</b>.`);
  }
  if (verdict.severity === 'invalid') {
    lines.push('⚠️ Champ <code>semaine</code> absent/illisible — à vérifier manuellement.');
  }

  const buttons: InlineBtn[][] = [
    [{ text: '✅ Bumper à aujourd\'hui', callback_data: `${HOT_CONTEXT_STALE_CALLBACK_PREFIX}bump` }],
  ];
  if (driveUrl) {
    buttons.push([{ text: '📝 Ouvrir dans Drive', url: driveUrl }]);
  }
  buttons.push([{ text: '💤 Snooze 24h', callback_data: `${HOT_CONTEXT_STALE_CALLBACK_PREFIX}snooze` }]);

  return { text: lines.join('\n'), buttons };
}

/** Envoie la carte. Retourne le message_id (pour édition au callback). */
export async function sendStalenessCard(
  chatId: number | string,
  verdict: StalenessVerdict,
  driveUrl: string | null,
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === '__TO_FILL__') {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN manquant' };
  }
  const { text, buttons } = buildStalenessCard(verdict, driveUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      return { ok: false, error: `Telegram ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}` };
    }
    const data = (await r.json()) as { ok?: boolean; result?: { message_id?: number } };
    return { ok: true, messageId: data.result?.message_id };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
