/**
 * POST /api/telegram/webhook
 *
 * Route handler Next.js (App Router) pour recevoir les webhooks Telegram.
 *
 * Flow MVP :
 *  1. Vérifier le secret token (X-Telegram-Bot-Api-Secret-Token) via timingSafeEqual
 *  2. Parser le body JSON via Zod (TelegramUpdateSchema)
 *  3. Vérifier le chat_id contre la whitelist (TELEGRAM_ALLOWED_CHAT_IDS)
 *  4. Envoyer le message texte à Claude avec le system prompt fiscal
 *  5. Si Claude retourne needs_clarification -> renvoyer la question
 *     Si Claude retourne ready -> formater le CR et renvoyer
 *  6. Toujours retourner 200 OK (Telegram retente agressivement sinon)
 *
 * Pas de session multi-messages dans ce MVP : chaque message = un appel Claude
 * complet. Thomas envoie le contenu de la réunion en un seul message, Claude
 * génère le CR en une passe.
 *
 * Choix de rendu : SSR force-dynamic (webhook temps réel, pas de cache)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { TelegramUpdateSchema, ClaudeResponseSchema } from '@/lib/secretariat/types';
import { sendTelegramMessage, answerCallbackQuery } from '@/lib/secretariat/telegram';
import { renderCrForTelegram } from '@/lib/secretariat/cr-renderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================
// System prompt — chargement et cache singleton
// ============================================================

let cachedSystemPrompt: string | null = null;

/**
 * Charge le system prompt fiscal depuis docs/ia/secretariat-system-prompt.md.
 * Extrait le contenu du premier bloc code (```) sous "## 2. System prompt complet".
 * Cache en mémoire après le premier appel.
 */
function loadSystemPrompt(): string {
  if (cachedSystemPrompt !== null) {
    return cachedSystemPrompt;
  }

  const promptPath = resolve(process.cwd(), 'docs', 'ia', 'secretariat-system-prompt.md');
  const fileContent = readFileSync(promptPath, 'utf8');

  const sectionMarker = '## 2. System prompt complet';
  const sectionIdx = fileContent.indexOf(sectionMarker);
  if (sectionIdx === -1) {
    throw new Error(`[webhook] section "${sectionMarker}" introuvable dans ${promptPath}`);
  }

  const afterSection = fileContent.slice(sectionIdx);
  const openIdx = afterSection.indexOf('```');
  if (openIdx === -1) {
    throw new Error('[webhook] aucun bloc code trouvé après la section 2');
  }

  const afterOpen = afterSection.slice(openIdx + 3);
  const newlineAfterOpen = afterOpen.indexOf('\n');
  if (newlineAfterOpen === -1) {
    throw new Error('[webhook] bloc code malformé');
  }

  const contentStart = newlineAfterOpen + 1;
  const closeIdx = afterOpen.indexOf('```', contentStart);
  if (closeIdx === -1) {
    throw new Error('[webhook] bloc code non fermé');
  }

  const promptBody = afterOpen.slice(contentStart, closeIdx).trim();
  if (promptBody.length < 500) {
    throw new Error(
      `[webhook] system prompt trop court (${promptBody.length} chars), fichier probablement corrompu`,
    );
  }

  cachedSystemPrompt = promptBody;
  return cachedSystemPrompt;
}

// ============================================================
// Anthropic client — singleton lazy
// ============================================================

let cachedClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (cachedClient !== null) {
    return cachedClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === '__TO_FILL__') {
    throw new Error('ANTHROPIC_API_KEY manquante ou placeholder');
  }

  cachedClient = new Anthropic({ apiKey, maxRetries: 2 });
  return cachedClient;
}

// ============================================================
// Vérification du secret webhook
// ============================================================

function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || secret.trim() === '' || secret === '__TO_FILL__') {
    return false;
  }

  const header = request.headers.get('x-telegram-bot-api-secret-token');
  if (!header || header.length === 0) {
    return false;
  }

  // Comparaison en temps constant pour éviter les timing attacks
  if (header.length !== secret.length) {
    return false;
  }

  const headerBuf = Buffer.from(header, 'utf8');
  const secretBuf = Buffer.from(secret, 'utf8');
  return timingSafeEqual(headerBuf, secretBuf);
}

// ============================================================
// Whitelist des chat_ids autorisés
// ============================================================

function isAllowedChatId(chatId: number): boolean {
  const raw = process.env.TELEGRAM_ALLOWED_CHAT_IDS;
  if (!raw || raw.trim() === '') {
    return false;
  }

  const allowedIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));

  return allowedIds.includes(chatId);
}

// ============================================================
// Appel Claude pour générer le CR
// ============================================================

const ANTHROPIC_TIMEOUT_MS = 60_000;
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';

async function generateCR(messageText: string): Promise<{
  success: boolean;
  status?: 'needs_clarification' | 'ready';
  clarificationQuestion?: string;
  crText?: string;
  error?: string;
}> {
  try {
    const systemPrompt = loadSystemPrompt();
    const client = getAnthropicClient();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

    let message;
    try {
      message = await client.messages.create(
        {
          model: process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: messageText }],
        },
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timer);
    }

    // Extraire le texte de la réponse
    const textParts: string[] = [];
    for (const block of message.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      }
    }
    const rawText = textParts.join('\n').trim();

    if (rawText.length === 0) {
      return { success: false, error: 'Réponse Claude vide' };
    }

    // Parser le JSON et valider via Zod
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return { success: false, error: `Réponse Claude non-JSON : ${rawText.slice(0, 200)}` };
    }

    const validation = ClaudeResponseSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ');
      return { success: false, error: `Schéma CR invalide : ${issues}` };
    }

    const response = validation.data;

    if (response.status === 'needs_clarification') {
      return {
        success: true,
        status: 'needs_clarification',
        clarificationQuestion: response.clarification_question ?? 'Peux-tu préciser ?',
      };
    }

    // status === 'ready'
    if (response.cr === null) {
      return { success: false, error: 'CR null malgré status ready' };
    }

    const crText = renderCrForTelegram(response.cr);
    return { success: true, status: 'ready', crText };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || msg.includes('aborted'));

    if (isAbort) {
      return { success: false, error: 'Timeout Claude (60s dépassées)' };
    }

    return { success: false, error: `Erreur Claude : ${msg.slice(0, 200)}` };
  }
}

// ============================================================
// POST handler
// ============================================================

export async function POST(request: Request): Promise<Response> {
  // 1. Vérification du secret
  if (!verifyWebhookSecret(request)) {
    // On retourne quand même 200 pour ne pas que Telegram retente
    // mais on log l'échec de secret
    console.warn('[telegram-webhook] secret invalide ou manquant');
    return Response.json({ ok: true, ignored: 'invalid_secret' });
  }

  // 2. Parsing du body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn('[telegram-webhook] body JSON invalide');
    return Response.json({ ok: true, ignored: 'invalid_json' });
  }

  const parsed = TelegramUpdateSchema.safeParse(body);
  if (!parsed.success) {
    console.warn('[telegram-webhook] payload Telegram invalide :', parsed.error.issues.slice(0, 3));
    return Response.json({ ok: true, ignored: 'invalid_payload' });
  }

  const update = parsed.data;

  // 3. Dispatch
  try {
    // 3a. Message texte
    if (update.message?.text !== undefined) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      // Whitelist
      if (!isAllowedChatId(chatId)) {
        console.warn(`[telegram-webhook] chat_id ${chatId} non autorisé`);
        return Response.json({ ok: true });
      }

      // Commande /start — réponse de bienvenue
      if (text.trim().toLowerCase() === '/start') {
        await sendTelegramMessage(
          chatId,
          'Secrétariat ISSA Capital prêt. Envoie le contenu de ta réunion et je génère le CR.',
        );
        return Response.json({ ok: true });
      }

      // Envoyer un accusé de réception immédiat
      await sendTelegramMessage(chatId, 'Génération du CR en cours…');

      // Appel Claude
      const result = await generateCR(text);

      if (!result.success) {
        await sendTelegramMessage(
          chatId,
          `Erreur de génération : ${result.error ?? 'inconnue'}. Réessaie dans un moment.`,
        );
        return Response.json({ ok: true });
      }

      if (result.status === 'needs_clarification') {
        await sendTelegramMessage(chatId, result.clarificationQuestion ?? 'Peux-tu préciser ?');
        return Response.json({ ok: true });
      }

      // status === 'ready' — envoyer le CR
      if (result.crText) {
        await sendTelegramMessage(chatId, result.crText);
      }

      return Response.json({ ok: true });
    }

    // 3b. Message sans texte (photo, sticker, etc.)
    if (update.message !== undefined && update.message.text === undefined) {
      const chatId = update.message.chat.id;
      if (isAllowedChatId(chatId)) {
        await sendTelegramMessage(
          chatId,
          'Envoie le contenu de la réunion en texte (les médias ne sont pas encore supportés).',
        );
      }
      return Response.json({ ok: true });
    }

    // 3c. Callback query (boutons inline) — pas utilisé dans le MVP,
    // mais on acquitte pour éviter le spinner infini côté Telegram
    if (update.callback_query !== undefined) {
      await answerCallbackQuery(
        update.callback_query.id,
        'Cette action n\'est pas disponible dans cette version.',
      );
      return Response.json({ ok: true });
    }

    // 3d. Autres types d'updates — on ignore silencieusement
    return Response.json({ ok: true });
  } catch (err) {
    // JAMAIS crasher la réponse — Telegram retentera sinon
    console.error('[telegram-webhook] erreur dispatch :', err);
    return Response.json({ ok: true });
  }
}
