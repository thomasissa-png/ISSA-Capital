/**
 * Routes webhook Telegram Bot API.
 *
 *   POST /api/telegram/webhook — réception des Updates Telegram
 *
 * Flow POST :
 *  1. Vérifier le secret token (header X-Telegram-Bot-Api-Secret-Token)
 *  2. Parsing Zod du payload (TelegramUpdate)
 *  3. Pour chaque Update :
 *     a. Extraire le chat_id
 *     b. checkTelegramWhitelist — silent block si KO (200 + access_log)
 *     c. checkTelegramRateLimit — silent block si KO
 *     d. Si message texte → parseCommand → dispatch (même state machine que WhatsApp)
 *     e. Si callback_query → router le bouton (validate/modify/cancel)
 *  4. Toujours répondre 200 OK à Telegram (sinon retries agressifs)
 *
 * La state machine (conversation-state.ts) et les commandes (parseCommand)
 * sont réutilisées telles quelles depuis le connecteur WhatsApp.
 *
 * L'identifiant de session est `telegram:<chat_id>` (stocké dans `user_phone`
 * de whatsapp_sessions — le champ est un identifiant générique, pas strictement
 * un numéro E.164 pour le connecteur Telegram).
 *
 * Sources :
 *  - https://core.telegram.org/bots/api#update
 *  - https://core.telegram.org/bots/api#setwebhook (secret_token)
 *  - routes/whatsapp.ts (pattern de référence)
 */

import { randomUUID } from 'node:crypto';
import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';

import { getDb } from '../db/connection';
import { checkTelegramWhitelist } from '../middleware/telegramWhitelistGuard';
import { checkTelegramRateLimit } from '../middleware/rateLimitTelegram';
import { generateCR } from '../services/anthropic';
import {
  appendMessage,
  createSession,
  finalizeSession,
  getActiveSession,
  updateSessionState,
} from '../services/conversation-state';
import { publishToCraft } from '../services/craft';
import { mapCrToCraftPayload } from '../services/cr-to-craft-mapper';
import { CRDraftSchema, type CRDraft } from '../services/anthropic.types';
import {
  answerCallbackQuery,
  parseTelegramUpdate,
  sendTelegramConfirmation,
  sendTelegramMessage,
} from '../services/telegram';
import { TelegramParseError, type TelegramUpdate } from '../services/telegram.types';
import type { CommandType, ConversationSession, ParsedCommand } from '../services/whatsapp.types';
import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';

export const telegramRouter = Router();

// ============================================================
// Constantes — vocabulaire de commande (identique à WhatsApp)
// ============================================================

const FINALIZE_KEYWORDS = new Set(['terminer', 'stop', 'fin', 'termine', 'finir']);
const VALIDATE_KEYWORDS = new Set(['valider', 'ok', 'publier', 'oui']);
const CANCEL_KEYWORDS = new Set(['annuler', 'cancel', 'non']);

/**
 * Parse une commande depuis le texte d'un message entrant.
 * Identique à la version WhatsApp — on ne reconnaît une commande QUE si le
 * message est strictement un mot-clé (après normalisation).
 */
export function parseCommand(raw: string): ParsedCommand {
  const normalized = raw.trim().toLowerCase();

  let type: CommandType = 'content';
  if (FINALIZE_KEYWORDS.has(normalized)) {
    type = 'finalize';
  } else if (VALIDATE_KEYWORDS.has(normalized)) {
    type = 'validate';
  } else if (CANCEL_KEYWORDS.has(normalized)) {
    type = 'cancel';
  }

  return { type, raw };
}

/**
 * Construit l'identifiant de session pour un chat Telegram.
 * Stocké dans `user_phone` de `whatsapp_sessions`.
 */
function telegramSessionKey(chatId: number): string {
  return `telegram:${chatId}`;
}

// ============================================================
// Vérification du secret token Telegram
// ============================================================

/**
 * Vérifie le header `X-Telegram-Bot-Api-Secret-Token`.
 *
 * Telegram envoie ce header si un `secret_token` a été configuré via
 * l'API setWebhook. La comparaison est en temps constant.
 *
 * @returns true si valide, false sinon.
 */
function verifyTelegramSecret(req: Request): boolean {
  const env = getEnv();
  const secret = env.TELEGRAM_WEBHOOK_SECRET;

  // Si pas de secret configuré côté serveur, on refuse tout webhook
  // (sécurité : ne pas accepter de webhooks non authentifiés).
  if (
    secret === undefined ||
    secret.trim() === '' ||
    secret === '__TO_FILL__'
  ) {
    return false;
  }

  const header = req.headers['x-telegram-bot-api-secret-token'];
  if (typeof header !== 'string' || header.length === 0) {
    return false;
  }

  // Comparaison en temps constant
  if (header.length !== secret.length) {
    return false;
  }

  const headerBuf = Buffer.from(header, 'utf8');
  const secretBuf = Buffer.from(secret, 'utf8');
  return crypto.timingSafeEqual(headerBuf, secretBuf);
}

// ============================================================
// Helpers DB — drafts (flow Telegram, identique à WhatsApp)
// ============================================================

interface DraftContentRow {
  id: string;
  raw_input: string;
  enriched_input: string | null;
  status: string;
  cr_json: string | null;
  entite: string | null;
  type_reunion: string | null;
}

function createEmptyDraftForSession(
  session: ConversationSession,
  firstMessage: string,
): string {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO cr_drafts (
      id, user_phone, conversation_id, raw_input, enriched_input,
      status, clarification_history, cr_json, cr_markdown,
      type_reunion, entite, date_reunion,
      created_at, updated_at, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    session.userPhone,
    session.conversationId,
    firstMessage,
    firstMessage,
    'drafting',
    null,
    null,
    null,
    null,
    null,
    null,
    now,
    now,
    null,
  );

  // Lier la session au nouveau draft
  getDb()
    .prepare(`UPDATE whatsapp_sessions SET active_draft_id = ? WHERE conversation_id = ?`)
    .run(id, session.conversationId);

  return id;
}

function appendToDraftContent(draftId: string, additionalText: string): void {
  const db = getDb();
  const now = new Date().toISOString();

  const row = db
    .prepare(`SELECT raw_input, enriched_input FROM cr_drafts WHERE id = ?`)
    .get(draftId) as { raw_input: string; enriched_input: string | null } | undefined;

  if (row === undefined) {
    return;
  }

  const nextEnriched =
    row.enriched_input !== null && row.enriched_input.length > 0
      ? `${row.enriched_input}\n${additionalText}`
      : `${row.raw_input}\n${additionalText}`;

  db.prepare(
    `UPDATE cr_drafts SET enriched_input = ?, updated_at = ? WHERE id = ?`,
  ).run(nextEnriched, now, draftId);
}

function getDraftContent(draftId: string): DraftContentRow | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, raw_input, enriched_input, status, cr_json, entite, type_reunion
       FROM cr_drafts WHERE id = ?`,
    )
    .get(draftId) as DraftContentRow | undefined;
  return row ?? null;
}

function updateDraftAfterGeneration(
  draftId: string,
  status: 'needs_clarification' | 'ready',
  crJson: string | null,
  entite: string | null,
  typeReunion: string | null,
  dateReunion: string | null,
): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE cr_drafts
     SET status = ?, cr_json = ?, entite = ?, type_reunion = ?,
         date_reunion = ?, updated_at = ?
     WHERE id = ?`,
  ).run(status, crJson, entite, typeReunion, dateReunion, now, draftId);
}

function logAccess(params: {
  actorPhone: string;
  actorDisplayName: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
  entite: string | null;
  result: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO access_logs
       (actor_phone, actor_display_name, resource_type, resource_id,
        action, entite, result, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    params.actorPhone,
    params.actorDisplayName,
    params.resourceType,
    params.resourceId,
    params.action,
    params.entite,
    params.result,
    new Date().toISOString(),
  );
}

// ============================================================
// Handlers de commandes (adaptés pour Telegram)
// ============================================================

/**
 * Contact abstrait pour les handlers — identifiant + display name + chat_id.
 */
interface TelegramContact {
  /** Identifiant de session : "telegram:<chatId>" */
  sessionKey: string;
  displayName: string;
  chatId: number;
}

async function handleFinalize(
  session: ConversationSession,
  contact: TelegramContact,
): Promise<void> {
  const log = getLogger();

  if (session.activeDraftId === null) {
    await sendTelegramMessage(
      contact.chatId,
      'Aucun brouillon en cours. Envoie-moi le contenu de ta réunion pour commencer.',
    );
    return;
  }

  const draft = getDraftContent(session.activeDraftId);
  if (draft === null) {
    await sendTelegramMessage(contact.chatId, 'Brouillon introuvable — commence un nouveau CR.');
    updateSessionState(session.conversationId, 'idle');
    return;
  }

  const accumulated = draft.enriched_input ?? draft.raw_input;

  // --- Appel Phase 3 (generateCR) ---
  try {
    const { response } = await generateCR({
      rawInput: accumulated,
      userPhone: contact.sessionKey,
    });

    if (response.status === 'needs_clarification') {
      updateDraftAfterGeneration(
        session.activeDraftId,
        'needs_clarification',
        null,
        response.detected_entite ?? null,
        response.detected_type ?? null,
        null,
      );
      updateSessionState(session.conversationId, 'clarifying');
      await sendTelegramMessage(
        contact.chatId,
        response.clarification_question ?? 'Peux-tu préciser ?',
      );
      return;
    }

    // status === 'ready'
    const cr = response.cr;
    if (cr === null || cr === undefined) {
      await sendTelegramMessage(
        contact.chatId,
        'Erreur de génération : CR vide. Peux-tu reformuler ?',
      );
      return;
    }

    updateDraftAfterGeneration(
      session.activeDraftId,
      'ready',
      JSON.stringify(cr),
      cr.entite,
      cr.type_reunion,
      cr.date_reunion,
    );

    finalizeSession(session.conversationId, session.activeDraftId);

    // Preview Telegram : entête + summary
    const preview =
      `Brouillon CR — ${cr.entite} / ${cr.type_reunion}\n` +
      `Date : ${cr.date_reunion}\n` +
      `Lieu : ${cr.lieu}\n` +
      `Objet : ${cr.objet}\n\n` +
      `Réponds VALIDER pour publier, ou envoie une correction.`;

    // Message texte (preview) puis inline keyboard (action).
    await sendTelegramMessage(contact.chatId, preview);
    await sendTelegramConfirmation(
      contact.chatId,
      session.activeDraftId,
      'Confirmer la publication Craft ?',
    );

    logAccess({
      actorPhone: contact.sessionKey,
      actorDisplayName: contact.displayName,
      resourceType: 'cr_draft',
      resourceId: session.activeDraftId,
      action: 'generate',
      entite: cr.entite,
      result: 'success',
    });
  } catch (err) {
    log.error({ err, draftId: session.activeDraftId }, '[telegram] generateCR KO');
    await sendTelegramMessage(
      contact.chatId,
      'Service de génération temporairement indisponible. Réessaye dans une minute.',
    );
  }
}

async function handleValidate(
  session: ConversationSession,
  contact: TelegramContact,
): Promise<void> {
  const log = getLogger();

  if (session.activeDraftId === null || session.state !== 'awaiting_publish_confirm') {
    await sendTelegramMessage(
      contact.chatId,
      'Aucun brouillon à publier. Envoie d\'abord le contenu de ta réunion.',
    );
    return;
  }

  const draft = getDraftContent(session.activeDraftId);
  if (draft === null || draft.cr_json === null) {
    await sendTelegramMessage(contact.chatId, 'Brouillon introuvable ou incomplet.');
    return;
  }

  // Revalidation du cr_json
  let cr: CRDraft;
  try {
    const parsed: unknown = JSON.parse(draft.cr_json);
    const validation = CRDraftSchema.safeParse(parsed);
    if (!validation.success) {
      log.error(
        { draftId: session.activeDraftId, issues: validation.error.issues },
        '[telegram] cr_json corrompu',
      );
      await sendTelegramMessage(contact.chatId, 'CR corrompu, regénère-le avec TERMINER.');
      return;
    }
    cr = validation.data;
  } catch (err) {
    log.error({ err }, '[telegram] cr_json non parseable');
    await sendTelegramMessage(contact.chatId, 'CR corrompu, regénère-le avec TERMINER.');
    return;
  }

  // Mapping et publication Craft
  const reference = `${cr.entite}-CR-${cr.date_reunion.slice(0, 4)}-XXXX`;
  const payload = mapCrToCraftPayload({
    cr,
    draftId: session.activeDraftId,
    reference,
    dateEtablissement: new Date().toISOString(),
    userPhone: contact.sessionKey,
  });

  const result = await publishToCraft(payload);

  if (!result.success) {
    logAccess({
      actorPhone: contact.sessionKey,
      actorDisplayName: contact.displayName,
      resourceType: 'cr_draft',
      resourceId: session.activeDraftId,
      action: 'publish',
      entite: cr.entite,
      result: 'error',
    });
    await sendTelegramMessage(
      contact.chatId,
      `Erreur publication Craft : ${result.error ?? 'inconnue'}. Brouillon conservé.`,
    );
    return;
  }

  // Succès : update draft, log, confirmation
  const db = getDb();
  db.prepare(
    `UPDATE cr_drafts SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?`,
  ).run(new Date().toISOString(), new Date().toISOString(), session.activeDraftId);
  updateSessionState(session.conversationId, 'idle');

  logAccess({
    actorPhone: contact.sessionKey,
    actorDisplayName: contact.displayName,
    resourceType: 'cr_draft',
    resourceId: session.activeDraftId,
    action: 'publish',
    entite: cr.entite,
    result: 'success',
  });

  await sendTelegramMessage(
    contact.chatId,
    `CR publié sur Craft.\n${result.craftUrl ?? result.craftDocId ?? ''}`.trim(),
  );
}

async function handleCancel(
  session: ConversationSession,
  contact: TelegramContact,
): Promise<void> {
  if (session.activeDraftId !== null) {
    const db = getDb();
    db.prepare(
      `UPDATE cr_drafts SET status = 'abandoned', updated_at = ? WHERE id = ?`,
    ).run(new Date().toISOString(), session.activeDraftId);
    logAccess({
      actorPhone: contact.sessionKey,
      actorDisplayName: contact.displayName,
      resourceType: 'cr_draft',
      resourceId: session.activeDraftId,
      action: 'cancel',
      entite: null,
      result: 'success',
    });
  }
  updateSessionState(session.conversationId, 'abandoned');
  await sendTelegramMessage(contact.chatId, 'Brouillon annulé.');
}

async function handleContent(
  session: ConversationSession,
  contact: TelegramContact,
  text: string,
): Promise<void> {
  let draftId = session.activeDraftId;

  if (draftId === null) {
    draftId = createEmptyDraftForSession(session, text);
    await sendTelegramMessage(
      contact.chatId,
      'Brouillon démarré. Envoie le reste puis écris TERMINER pour générer le CR.',
    );
    return;
  }

  appendToDraftContent(draftId, text);
  await sendTelegramMessage(contact.chatId, 'Ajouté au brouillon en cours.');
}

// ============================================================
// Dispatcher (exporté pour tests unitaires)
// ============================================================

/**
 * Traite un message texte Telegram entrant déjà whitelisté + validé.
 */
export async function dispatchTelegramMessage(
  text: string,
  messageDate: number,
  contact: TelegramContact,
): Promise<void> {
  const log = getLogger();

  const command = parseCommand(text);

  // Prolonge (ou crée) la session avant dispatch
  let session = getActiveSession(contact.sessionKey);
  if (session === null) {
    session = createSession(contact.sessionKey);
  }

  const messageTs = new Date(messageDate * 1000);
  appendMessage(
    session.conversationId,
    text,
    Number.isNaN(messageTs.getTime()) ? new Date() : messageTs,
  );

  log.info(
    {
      conversationId: session.conversationId,
      chatId: contact.chatId,
      command: command.type,
    },
    '[telegram] message dispatché',
  );

  switch (command.type) {
    case 'finalize':
      await handleFinalize(session, contact);
      break;
    case 'validate':
      await handleValidate(session, contact);
      break;
    case 'cancel':
      await handleCancel(session, contact);
      break;
    case 'content':
    default:
      await handleContent(session, contact, text);
      break;
  }
}

/**
 * Traite un callback_query Telegram (bouton inline).
 *
 * Format du callback_data : "action:draftId"
 * Actions supportées : validate, modify, cancel
 */
export async function dispatchCallbackQuery(
  callbackQueryId: string,
  callbackData: string,
  contact: TelegramContact,
): Promise<void> {
  const log = getLogger();

  // Parse callback_data : "validate:uuid" / "modify:uuid" / "cancel:uuid"
  const colonIdx = callbackData.indexOf(':');
  if (colonIdx === -1) {
    await answerCallbackQuery(callbackQueryId, 'Action non reconnue.');
    return;
  }

  const action = callbackData.slice(0, colonIdx);
  // draftId is available but not used directly here — the session tracks the active draft
  // const _draftId = callbackData.slice(colonIdx + 1);

  let session = getActiveSession(contact.sessionKey);
  if (session === null) {
    await answerCallbackQuery(callbackQueryId, 'Session expirée.');
    await sendTelegramMessage(contact.chatId, 'Session expirée. Envoie un nouveau message pour recommencer.');
    return;
  }

  log.info(
    {
      conversationId: session.conversationId,
      chatId: contact.chatId,
      callbackAction: action,
    },
    '[telegram] callback_query dispatché',
  );

  switch (action) {
    case 'validate':
      await answerCallbackQuery(callbackQueryId, 'Publication en cours…');
      await handleValidate(session, contact);
      break;
    case 'modify':
      await answerCallbackQuery(callbackQueryId, 'Envoie ta correction.');
      await sendTelegramMessage(
        contact.chatId,
        'Envoie ta correction puis écris TERMINER pour regénérer le CR.',
      );
      // Retour en drafting pour permettre modification
      updateSessionState(session.conversationId, 'drafting');
      break;
    case 'cancel':
      await answerCallbackQuery(callbackQueryId, 'Brouillon annulé.');
      await handleCancel(session, contact);
      break;
    default:
      await answerCallbackQuery(callbackQueryId, 'Action non reconnue.');
      break;
  }
}

// ============================================================
// POST /webhook — réception des Updates Telegram
// ============================================================

telegramRouter.post(
  '/webhook',
  async (req: Request, res: Response): Promise<void> => {
    const log = getLogger();

    // --- 1. Vérification du secret token ---
    if (!verifyTelegramSecret(req)) {
      log.warn(
        { ip: req.ip },
        '[telegram] webhook refusé : secret token invalide ou manquant',
      );
      res.status(401).json({ error: 'Secret token invalide', code: 'INVALID_SECRET' });
      return;
    }

    // --- 2. Parsing ---
    let update: TelegramUpdate;
    try {
      update = parseTelegramUpdate(req.body);
    } catch (err) {
      if (err instanceof TelegramParseError) {
        log.warn({ err: err.message }, '[telegram] payload webhook invalide');
        // 200 OK pour éviter les retries Telegram
        res.status(200).json({ ok: true, ignored: 'invalid_payload' });
        return;
      }
      log.error({ err }, '[telegram] erreur inattendue parsing webhook');
      res.status(200).json({ ok: true, ignored: 'unknown_error' });
      return;
    }

    // --- 3. Dispatch ---
    try {
      // --- 3a. Message texte ---
      if (update.message !== undefined && update.message.text !== undefined) {
        const msg = update.message;
        const msgText = update.message.text;
        const chatId = msg.chat.id;

        // Whitelist check
        const whitelistedContact = checkTelegramWhitelist(chatId);
        if (whitelistedContact === null) {
          // Silent block
          res.status(200).json({ ok: true });
          return;
        }

        // Rate limit
        const rateLimit = checkTelegramRateLimit(chatId);
        if (!rateLimit.allowed) {
          log.warn(
            {
              chatId,
              reason: rateLimit.reason,
              count1min: rateLimit.count1min,
              count1hour: rateLimit.count1hour,
            },
            '[telegram] message rate-limited, silent drop',
          );
          res.status(200).json({ ok: true });
          return;
        }

        const contact: TelegramContact = {
          sessionKey: telegramSessionKey(chatId),
          displayName: whitelistedContact.displayName,
          chatId,
        };

        await dispatchTelegramMessage(msgText, msg.date, contact);

        res.status(200).json({ ok: true });
        return;
      }

      // --- 3b. Message sans texte (photo, sticker, etc.) ---
      if (update.message !== undefined && update.message.text === undefined) {
        const chatId = update.message.chat.id;

        const whitelistedContact = checkTelegramWhitelist(chatId);
        if (whitelistedContact !== null) {
          await sendTelegramMessage(
            chatId,
            'Merci d\'envoyer le contenu de la réunion en texte (les médias ne sont pas encore supportés).',
          );
        }

        res.status(200).json({ ok: true });
        return;
      }

      // --- 3c. Callback query (bouton inline) ---
      if (update.callback_query !== undefined) {
        const cbq = update.callback_query;
        const chatId = cbq.message?.chat.id;

        if (chatId === undefined || cbq.data === undefined) {
          if (cbq.id !== undefined) {
            await answerCallbackQuery(cbq.id, 'Erreur : données manquantes.');
          }
          res.status(200).json({ ok: true });
          return;
        }

        // Whitelist check
        const whitelistedContact = checkTelegramWhitelist(chatId);
        if (whitelistedContact === null) {
          await answerCallbackQuery(cbq.id, 'Accès non autorisé.');
          res.status(200).json({ ok: true });
          return;
        }

        // Rate limit (callback_query compte aussi)
        const rateLimit = checkTelegramRateLimit(chatId);
        if (!rateLimit.allowed) {
          await answerCallbackQuery(cbq.id, 'Trop de requêtes, patiente un moment.');
          res.status(200).json({ ok: true });
          return;
        }

        const contact: TelegramContact = {
          sessionKey: telegramSessionKey(chatId),
          displayName: whitelistedContact.displayName,
          chatId,
        };

        await dispatchCallbackQuery(cbq.id, cbq.data, contact);

        res.status(200).json({ ok: true });
        return;
      }

      // --- 3d. Update non géré (edited_message, channel_post, etc.) ---
      res.status(200).json({ ok: true });
    } catch (err) {
      // On loggue mais on ne fait JAMAIS crasher la réponse Telegram
      log.error({ err, updateId: update.update_id }, '[telegram] erreur dispatch update');
      res.status(200).json({ ok: true });
    }
  },
);
