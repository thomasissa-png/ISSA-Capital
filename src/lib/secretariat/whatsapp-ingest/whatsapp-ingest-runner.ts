/**
 * Ingestion WhatsApp (Beeper) — V1 : surface le pertinent à Thomas via Telegram.
 *
 * Lit les nouveaux messages texte (depuis un curseur) des chats NON exclus
 * (tous sauf ceux dont le nom contient « sarani », cf. BEEPER_EXCLUDE), les
 * groupe par chat, triage la pertinence (DeepSeek Flash via wrapper LLM), et
 * notifie Thomas sur Telegram pour les conversations pertinentes.
 *
 * 🔒 V1 = NOTIFICATION SEULE : aucune écriture vault automatique (RGPD/anti-bruit).
 * La documentation vault (avec validation Telegram) viendra en V2.
 * Lecture WhatsApp strictement read-only ; aucun envoi WhatsApp.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listTextMessagesSince, type BeeperMessage } from '../beeper-source/beeper-client';
import { callLLM } from '../llm/client';
import { sendTelegramMessage } from '../telegram';

const FIRST_RUN_LOOKBACK_MS = 2 * 60 * 60 * 1000; // 2h au premier run (pas tout l'historique)
const MAX_MESSAGES_PER_RUN = 300;
const MAX_SNIPPET_MESSAGES = 25;

function cursorFile(): string {
  return process.env.BEEPER_CURSOR_FILE ?? path.join(process.env.HOME ?? '/home/thomas', '.anya-beeper-cursor.json');
}

async function readCursor(): Promise<number | null> {
  try {
    const raw = await fs.readFile(cursorFile(), 'utf-8');
    const n = Number((JSON.parse(raw) as { ts?: number }).ts);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function writeCursor(ts: number): Promise<void> {
  try {
    await fs.writeFile(cursorFile(), JSON.stringify({ ts }), 'utf-8');
  } catch (err) {
    console.warn(`[whatsapp-ingest] écriture curseur échouée : ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface WhatsappIngestStats {
  newMessages: number;
  chats: number;
  relevantChats: number;
  notified: number;
  errors: number;
}

interface RelevanceVerdict {
  relevant: boolean;
  summary: string;
}

async function triageChatRelevance(chatName: string, texts: string[]): Promise<RelevanceVerdict> {
  const snippet = texts.slice(-MAX_SNIPPET_MESSAGES).join('\n');
  const system =
    "Tu es Anya, secrétariat IA de Thomas Issa (ISSA Capital — patrimoine, immobilier, business). " +
    "On te donne des messages WhatsApp récents d'UNE conversation. Détermine s'ils contiennent une info " +
    "PRO ou ACTIONNABLE qui mérite l'attention de Thomas (RDV, deal, décision, demande, échéance, doc important). " +
    "Ignore le bavardage perso/famille/amical pur. Réponds en JSON strict : " +
    '{"relevant": boolean, "summary": "1 phrase courte en français (vide si non pertinent)"}.';
  try {
    const { text } = await callLLM({
      task: 'email-triage', // DeepSeek Flash (classification lean) — réutilisé pour WhatsApp
      system,
      messages: [{ role: 'user', content: `Conversation : ${chatName}\n\nMessages :\n${snippet}` }],
      maxTokens: 400,
      timeoutMs: 30_000,
      responseFormat: 'json',
    });
    const parsed = JSON.parse(text || '{}') as Partial<RelevanceVerdict>;
    return { relevant: Boolean(parsed.relevant), summary: String(parsed.summary ?? '').trim() };
  } catch (err) {
    console.warn(`[whatsapp-ingest] triage "${chatName}" échoué : ${err instanceof Error ? err.message : String(err)}`);
    return { relevant: false, summary: '' };
  }
}

async function notifyThomas(message: string): Promise<boolean> {
  const chatIdStr = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!chatIdStr) {
    console.warn('[whatsapp-ingest] TELEGRAM_CHAT_ID_THOMAS manquant — pas de notif');
    return false;
  }
  const chatId = parseInt(chatIdStr, 10);
  if (Number.isNaN(chatId)) return false;
  const r = await sendTelegramMessage(chatId, message);
  return r.success;
}

export async function runWhatsappIngest(): Promise<WhatsappIngestStats> {
  const stats: WhatsappIngestStats = { newMessages: 0, chats: 0, relevantChats: 0, notified: 0, errors: 0 };

  const nowTs = Date.now();
  const stored = await readCursor();
  const cursor = stored ?? nowTs - FIRST_RUN_LOOKBACK_MS;

  const messages = await listTextMessagesSince(cursor, MAX_MESSAGES_PER_RUN);
  stats.newMessages = messages.length;

  if (messages.length === 0) {
    await writeCursor(nowTs);
    console.warn('[whatsapp-ingest] aucun nouveau message (hors sarani)');
    return stats;
  }

  // Grouper par chat (roomID).
  const byChat = new Map<string, { name: string; msgs: BeeperMessage[] }>();
  for (const m of messages) {
    const g = byChat.get(m.roomID) ?? { name: m.chatName || '(chat sans nom)', msgs: [] };
    g.msgs.push(m);
    byChat.set(m.roomID, g);
  }
  stats.chats = byChat.size;

  for (const [, group] of byChat) {
    try {
      const verdict = await triageChatRelevance(group.name, group.msgs.map((m) => m.text));
      if (verdict.relevant) {
        stats.relevantChats++;
        const body =
          `💬 *WhatsApp — ${group.name}*\n` +
          `${verdict.summary}\n` +
          `_(${group.msgs.length} nouveau(x) message(s))_`;
        if (await notifyThomas(body)) stats.notified++;
      }
    } catch (err) {
      stats.errors++;
      console.warn(`[whatsapp-ingest] erreur chat "${group.name}" : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await writeCursor(nowTs);
  console.warn(
    `[whatsapp-ingest] terminé — ${stats.newMessages} msg, ${stats.chats} chats, ${stats.relevantChats} pertinents, ${stats.notified} notifiés, ${stats.errors} erreurs`,
  );
  return stats;
}
