/**
 * POST /api/telegram/webhook
 *
 * Route handler Next.js (App Router) pour le secrétariat ISSA Capital.
 *
 * Flow complet :
 *  1. Vérifier le secret token (X-Telegram-Bot-Api-Secret-Token) via timingSafeEqual
 *  2. Parser le body JSON via Zod (TelegramUpdateSchema)
 *  3. Vérifier le chat_id contre la whitelist (TELEGRAM_ALLOWED_CHAT_IDS)
 *  4. Envoyer le message à Claude avec system prompt fiscal + contacts + historique Craft
 *  5. Claude peut faire des recherches web (adresses, entreprises)
 *  6. Si needs_clarification → renvoyer la question (conversation multi-tours)
 *     Si ready → envoyer aperçu CR + boutons Valider/Modifier/Annuler
 *  7. Valider → référence IC-CR-YYYY-XXXX + publication Craft + confirmation
 *  8. Toujours retourner 200 OK (Telegram retente agressivement sinon)
 *
 * Mémoire : historique de conversation persisté en JSON (24h TTL, 20 messages max).
 * Contacts récurrents injectés dans le prompt. Recherche web automatique.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { TelegramUpdateSchema, ClaudeResponseSchema } from '@/lib/secretariat/types';
import type { CRDraft } from '@/lib/secretariat/types';
import {
  sendTelegramMessage,
  sendTelegramConfirmation,
  answerCallbackQuery,
} from '@/lib/secretariat/telegram';
import {
  renderCrForTelegram,
  renderCrForCraft,
  buildCraftTitle,
} from '@/lib/secretariat/cr-renderer';
import { formatContactsForPrompt } from '@/lib/secretariat/contacts';
import { fetchRecentCRs } from '@/lib/secretariat/craft-reader';
import {
  getConversation,
  appendMessage as storeMessage,
  toClaudeMessages,
  setPendingDraft,
  getPendingDraft,
  clearPendingDraft,
  clearConversation,
} from '@/lib/secretariat/conversation-store';
import { getNextReference } from '@/lib/secretariat/reference-counter';
import { publishToCraft } from '@/lib/secretariat/craft-publisher';

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

async function generateCR(
  messageText: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<{
  success: boolean;
  status?: 'needs_clarification' | 'ready';
  clarificationQuestion?: string;
  crText?: string;
  crDraft?: CRDraft;
  error?: string;
}> {
  try {
    let systemPrompt = loadSystemPrompt();
    const client = getAnthropicClient();

    // Injecter la base de contacts récurrents dans le system prompt
    const contactsBlock = formatContactsForPrompt();
    systemPrompt = systemPrompt.replace(
      '[INJECTION_DATABASE_CONTACTS_ICI]',
      contactsBlock,
    );

    // Récupérer les derniers CR depuis Craft (contexte historique)
    const recentCRs = await fetchRecentCRs();

    // Injecter la date/heure actuelle pour que Claude comprenne "aujourd'hui", "hier", etc.
    const now = new Date();
    const dateFr = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Paris',
    }).format(now);
    const heureFr = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    }).format(now);

    const enrichedMessage = `[Date et heure actuelles : ${dateFr}, ${heureFr} (Europe/Paris)]\n\n[${recentCRs}]\n\n${messageText}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

    // Instruction recherche web ajoutée au system prompt
    const searchInstruction = `

# REGLE 12 — RECHERCHE WEB AUTOMATIQUE

Tu disposes d'un outil de recherche web. Utilise-le AUTOMATIQUEMENT pour :
- Trouver l'adresse exacte d'un restaurant, hôtel ou lieu mentionné par l'utilisateur (ex : "Le Voltaire Paris" → rechercher l'adresse complète)
- Vérifier le titre ou la société d'un interlocuteur non présent dans la database contacts
- Trouver des informations publiques sur une entreprise mentionnée dans la réunion
- Compléter toute information factuelle vérifiable qui améliore la qualité du CR

Tu n'as PAS besoin de demander la permission pour chercher. Si un nom de lieu ou d'entreprise apparaît sans adresse complète, cherche automatiquement.
`;

    let message;
    try {
      message = await client.messages.create(
        {
          model: process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL,
          max_tokens: 4096,
          system: systemPrompt + searchInstruction,
          tools: [
            {
              type: 'web_search_20250305' as const,
              name: 'web_search',
              max_uses: 3,
            },
          ],
          messages: [
            ...conversationHistory,
            { role: 'user' as const, content: enrichedMessage },
          ],
        },
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timer);
    }

    // Extraire le texte de la réponse (ignore les blocs tool_use/web_search_result)
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

    // Nettoyer le JSON : Claude envoie parfois ```json ... ``` autour du JSON
    let cleanJson = rawText;
    const jsonBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (jsonBlockMatch?.[1]) {
      cleanJson = jsonBlockMatch[1].trim();
    }

    // Parser le JSON et valider via Zod
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      return { success: false, error: `Réponse Claude non-JSON : ${cleanJson.slice(0, 200)}` };
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
    return { success: true, status: 'ready', crText, crDraft: response.cr };
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

      // Récupérer l'historique de conversation pour ce chat
      const history = getConversation(chatId);
      const claudeHistory = toClaudeMessages(history);

      // Sauvegarder le message utilisateur dans l'historique
      storeMessage(chatId, 'user', text);

      // Appel Claude avec l'historique complet
      const result = await generateCR(text, claudeHistory);

      if (!result.success) {
        const errorMsg = `Erreur de génération : ${result.error ?? 'inconnue'}. Réessaie dans un moment.`;
        storeMessage(chatId, 'assistant', errorMsg);
        await sendTelegramMessage(chatId, errorMsg);
        return Response.json({ ok: true });
      }

      if (result.status === 'needs_clarification') {
        const question = result.clarificationQuestion ?? 'Peux-tu préciser ?';
        // Sauvegarder la réponse dans l'historique pour le prochain échange
        storeMessage(chatId, 'assistant', question);
        await sendTelegramMessage(chatId, question);
        return Response.json({ ok: true });
      }

      // status === 'ready' — envoyer l'aperçu avec boutons de validation
      if (result.crText && result.crDraft) {
        const previewText = `${result.crText}\n\n—\nVérifie le CR ci-dessus puis choisis une action :`;
        storeMessage(chatId, 'assistant', result.crText);

        // Stocker le draft en attente de validation
        setPendingDraft(chatId, result.crDraft, result.crText);

        // Envoyer l'aperçu avec les boutons inline Valider/Modifier/Annuler
        await sendTelegramConfirmation(chatId, previewText);
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

    // 3c. Callback query (boutons inline) — cycle Valider/Modifier/Annuler
    if (update.callback_query !== undefined) {
      const callbackData = update.callback_query.data;
      const callbackChatId = update.callback_query.message?.chat.id;
      const callbackQueryId = update.callback_query.id;

      // Acquitter immédiatement le callback pour retirer le spinner Telegram
      await answerCallbackQuery(callbackQueryId);

      if (!callbackChatId || !callbackData) {
        return Response.json({ ok: true });
      }

      if (!isAllowedChatId(callbackChatId)) {
        return Response.json({ ok: true });
      }

      const pendingDraft = getPendingDraft(callbackChatId);

      if (!pendingDraft) {
        await sendTelegramMessage(
          callbackChatId,
          'Aucun CR en attente de validation. Envoie le contenu d\'une réunion pour générer un nouveau CR.',
        );
        return Response.json({ ok: true });
      }

      // --- VALIDER ---
      if (callbackData === 'validate') {
        try {
          // 1. Générer la référence séquentielle
          const reference = getNextReference(pendingDraft.cr.entite);
          const dateEtablissement = new Date().toISOString();

          // 2. Rendre le markdown Craft (format légal complet)
          const craftMarkdown = renderCrForCraft(
            pendingDraft.cr,
            reference,
            dateEtablissement,
          );

          // 3. Construire le titre Craft
          const craftTitle = buildCraftTitle(pendingDraft.cr);

          // 4. Publier sur Craft
          const craftResult = await publishToCraft({
            markdown: craftMarkdown,
            title: craftTitle,
            reference,
          });

          // 5. Envoyer la confirmation sur Telegram
          if (craftResult.success) {
            let confirmMsg = `CR validé et publié sur Craft.\n\nRéférence : ${reference}`;
            if (craftResult.craftUrl) {
              confirmMsg += `\nURL : ${craftResult.craftUrl}`;
            }
            await sendTelegramMessage(callbackChatId, confirmMsg);
          } else {
            // Craft a échoué — on valide quand même le CR localement
            // mais on prévient que la publication Craft n'a pas marché
            const warnMsg =
              `CR validé avec la référence ${reference}.\n\n` +
              `⚠️ La publication sur Craft a échoué : ${craftResult.error ?? 'erreur inconnue'}.\n` +
              'Le CR est sauvegardé localement. La publication Craft pourra être retentée.';
            await sendTelegramMessage(callbackChatId, warnMsg);
          }

          // 6. Nettoyer la conversation et le draft
          clearPendingDraft(callbackChatId);
          clearConversation(callbackChatId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error('[telegram-webhook] erreur validation CR :', errMsg);
          await sendTelegramMessage(
            callbackChatId,
            `Erreur lors de la validation : ${errMsg.slice(0, 200)}. Réessaie dans un moment.`,
          );
        }

        return Response.json({ ok: true });
      }

      // --- MODIFIER ---
      if (callbackData === 'modify') {
        clearPendingDraft(callbackChatId);
        await sendTelegramMessage(
          callbackChatId,
          'CR mis de côté. Renvoie le contenu corrigé ou tes modifications, et je regénère le CR.',
        );
        return Response.json({ ok: true });
      }

      // --- ANNULER ---
      if (callbackData === 'cancel') {
        clearPendingDraft(callbackChatId);
        clearConversation(callbackChatId);
        await sendTelegramMessage(callbackChatId, 'CR annulé.');
        return Response.json({ ok: true });
      }

      // Callback inconnu — ignorer
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
