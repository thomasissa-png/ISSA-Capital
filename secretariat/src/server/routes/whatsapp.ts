/**
 * Routes webhook WhatsApp (Phase 2).
 *
 *   GET  /api/whatsapp/webhook — vérification token Meta (handshake Cloud API)
 *   POST /api/whatsapp/webhook — réception des messages entrants
 *
 * Flow POST :
 *  1. verifyMetaSignature (middleware) — HMAC-SHA256 sur rawBody
 *  2. parseWebhookPayload — Zod strict
 *  3. Pour chaque message :
 *     a. checkWhitelist inline — silent block si KO (200 + access_log)
 *     b. getActiveSession / createSession (TTL 24h)
 *     c. Dispatch de commande (parseCommand) :
 *        - `content`  → append au brouillon (accumulation côté session)
 *        - `finalize` → appel Phase 3 (generateCR) → preview WhatsApp
 *        - `validate` → appel Phase 4 (publishToCraft) → confirmation
 *        - `cancel`   → état `abandoned`
 *  4. Toujours répondre 200 OK à Meta (sinon retries agressifs Meta)
 *
 * Sources :
 *  - docs/ia/secretariat-architecture.md Sections 3, 7.
 *  - docs/ia/secretariat-implementation-plan.md Phase 2.
 */

import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';

import { getDb } from '../db/connection';
import { verifyMetaSignature } from '../middleware/verifyMetaSignature';
import { checkWhitelist, toE164 } from '../middleware/whitelistGuard';
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
  parseWebhookPayload,
  sendInteractiveConfirmation,
  sendMessage,
} from '../services/whatsapp';
import {
  WhatsAppParseError,
  type CommandType,
  type ConversationSession,
  type ParsedCommand,
  type WhatsAppIncomingMessage,
} from '../services/whatsapp.types';
import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';

export const whatsappRouter = Router();

// ============================================================
// Constantes — vocabulaire de commande
// ============================================================

const FINALIZE_KEYWORDS = new Set(['terminer', 'stop', 'fin', 'termine', 'finir']);
const VALIDATE_KEYWORDS = new Set(['valider', 'ok', 'publier', 'oui']);
const CANCEL_KEYWORDS = new Set(['annuler', 'cancel', 'non']);

/**
 * Parse une commande depuis le texte d'un message entrant.
 *
 * Les mots-clés sont comparés en lowercase + trim. Un message qui contient
 * un mot-clé ET autre chose (ex: "OK merci") est traité comme `content`
 * pour éviter des faux positifs — on ne reconnaît une commande QUE si le
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

// ============================================================
// GET /webhook — handshake Meta Cloud API
// ============================================================

/**
 * Meta envoie un GET avec trois query params lors de la configuration
 * initiale du webhook. On doit retourner `hub.challenge` en text/plain
 * si `hub.verify_token` correspond à notre secret local.
 */
whatsappRouter.get('/webhook', (req: Request, res: Response): void => {
  const log = getLogger();
  const env = getEnv();

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = env.WHATSAPP_VERIFY_TOKEN;
  if (
    expectedToken === undefined ||
    expectedToken.trim() === '' ||
    expectedToken === '__TO_FILL__'
  ) {
    log.error('[whatsapp] WHATSAPP_VERIFY_TOKEN non configuré — handshake refusé');
    res.status(500).send('Webhook non configuré');
    return;
  }

  if (mode !== 'subscribe' || typeof token !== 'string' || typeof challenge !== 'string') {
    res.status(400).send('Paramètres manquants');
    return;
  }

  // Comparaison temps constant (token de taille connue)
  if (token.length !== expectedToken.length) {
    log.warn({ ip: req.ip }, '[whatsapp] handshake refusé — verify_token invalide');
    res.status(403).send('Token invalide');
    return;
  }
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  if (diff !== 0) {
    log.warn({ ip: req.ip }, '[whatsapp] handshake refusé — verify_token invalide');
    res.status(403).send('Token invalide');
    return;
  }

  log.info('[whatsapp] handshake Meta réussi');
  res.status(200).type('text/plain').send(challenge);
});

// ============================================================
// Helpers DB — drafts (flow WhatsApp)
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
// Handlers de commandes
// ============================================================

async function handleFinalize(
  session: ConversationSession,
  contact: { phoneE164: string; displayName: string },
): Promise<void> {
  const log = getLogger();

  if (session.activeDraftId === null) {
    await sendMessage(
      contact.phoneE164,
      'Aucun brouillon en cours. Envoie-moi le contenu de ta réunion pour commencer.',
    );
    return;
  }

  const draft = getDraftContent(session.activeDraftId);
  if (draft === null) {
    await sendMessage(contact.phoneE164, 'Brouillon introuvable — commence un nouveau CR.');
    updateSessionState(session.conversationId, 'idle');
    return;
  }

  const accumulated = draft.enriched_input ?? draft.raw_input;

  // --- Appel Phase 3 (generateCR) ---
  try {
    const { response } = await generateCR({
      rawInput: accumulated,
      userPhone: contact.phoneE164,
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
      await sendMessage(
        contact.phoneE164,
        response.clarification_question ?? 'Peux-tu préciser ?',
      );
      return;
    }

    // status === 'ready'
    const cr = response.cr;
    if (cr === null || cr === undefined) {
      await sendMessage(
        contact.phoneE164,
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

    // Preview WhatsApp : entête + JSON summary court
    const preview =
      `Brouillon CR — ${cr.entite} / ${cr.type_reunion}\n` +
      `Date : ${cr.date_reunion}\n` +
      `Lieu : ${cr.lieu}\n` +
      `Objet : ${cr.objet}\n\n` +
      `Réponds VALIDER pour publier, ou envoie une correction.`;

    // Message texte (preview long) puis boutons interactifs (action courte).
    await sendMessage(contact.phoneE164, preview);
    await sendInteractiveConfirmation(
      contact.phoneE164,
      session.activeDraftId,
      'Confirmer la publication Craft ?',
    );

    logAccess({
      actorPhone: contact.phoneE164,
      actorDisplayName: contact.displayName,
      resourceType: 'cr_draft',
      resourceId: session.activeDraftId,
      action: 'generate',
      entite: cr.entite,
      result: 'success',
    });
  } catch (err) {
    log.error({ err, draftId: session.activeDraftId }, '[whatsapp] generateCR KO');
    await sendMessage(
      contact.phoneE164,
      'Service de génération temporairement indisponible. Réessaye dans une minute.',
    );
  }
}

async function handleValidate(
  session: ConversationSession,
  contact: { phoneE164: string; displayName: string },
): Promise<void> {
  const log = getLogger();

  if (session.activeDraftId === null || session.state !== 'awaiting_publish_confirm') {
    await sendMessage(
      contact.phoneE164,
      'Aucun brouillon à publier. Envoie d\'abord le contenu de ta réunion.',
    );
    return;
  }

  const draft = getDraftContent(session.activeDraftId);
  if (draft === null || draft.cr_json === null) {
    await sendMessage(contact.phoneE164, 'Brouillon introuvable ou incomplet.');
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
        '[whatsapp] cr_json corrompu',
      );
      await sendMessage(contact.phoneE164, 'CR corrompu, regénère-le avec TERMINER.');
      return;
    }
    cr = validation.data;
  } catch (err) {
    log.error({ err }, '[whatsapp] cr_json non parseable');
    await sendMessage(contact.phoneE164, 'CR corrompu, regénère-le avec TERMINER.');
    return;
  }

  // Mapping et publication Craft
  const reference = `${cr.entite}-CR-${cr.date_reunion.slice(0, 4)}-XXXX`;
  const payload = mapCrToCraftPayload({
    cr,
    draftId: session.activeDraftId,
    reference,
    dateEtablissement: new Date().toISOString(),
    userPhone: contact.phoneE164,
  });

  const result = await publishToCraft(payload);

  if (!result.success) {
    logAccess({
      actorPhone: contact.phoneE164,
      actorDisplayName: contact.displayName,
      resourceType: 'cr_draft',
      resourceId: session.activeDraftId,
      action: 'publish',
      entite: cr.entite,
      result: 'error',
    });
    await sendMessage(
      contact.phoneE164,
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
    actorPhone: contact.phoneE164,
    actorDisplayName: contact.displayName,
    resourceType: 'cr_draft',
    resourceId: session.activeDraftId,
    action: 'publish',
    entite: cr.entite,
    result: 'success',
  });

  await sendMessage(
    contact.phoneE164,
    `CR publié sur Craft.\n${result.craftUrl ?? result.craftDocId ?? ''}`.trim(),
  );
}

async function handleCancel(
  session: ConversationSession,
  contact: { phoneE164: string; displayName: string },
): Promise<void> {
  if (session.activeDraftId !== null) {
    const db = getDb();
    db.prepare(
      `UPDATE cr_drafts SET status = 'abandoned', updated_at = ? WHERE id = ?`,
    ).run(new Date().toISOString(), session.activeDraftId);
    logAccess({
      actorPhone: contact.phoneE164,
      actorDisplayName: contact.displayName,
      resourceType: 'cr_draft',
      resourceId: session.activeDraftId,
      action: 'cancel',
      entite: null,
      result: 'success',
    });
  }
  updateSessionState(session.conversationId, 'abandoned');
  await sendMessage(contact.phoneE164, 'Brouillon annulé.');
}

async function handleContent(
  session: ConversationSession,
  contact: { phoneE164: string; displayName: string },
  text: string,
): Promise<void> {
  let draftId = session.activeDraftId;

  if (draftId === null) {
    draftId = createEmptyDraftForSession(session, text);
    await sendMessage(
      contact.phoneE164,
      'Brouillon démarré. Envoie le reste puis écris TERMINER pour générer le CR.',
    );
    return;
  }

  appendToDraftContent(draftId, text);
  await sendMessage(contact.phoneE164, 'Ajouté au brouillon en cours.');
}

// ============================================================
// Dispatcher (exporté pour tests unitaires)
// ============================================================

/**
 * Traite un message WhatsApp entrant déjà whitelisté + validé.
 * Cette fonction est exportée pour être testée en isolation (sans supertest).
 */
export async function dispatchMessage(
  message: WhatsAppIncomingMessage,
  contact: { phoneE164: string; displayName: string },
): Promise<void> {
  const log = getLogger();

  // Type non-texte : on répond poliment sans crasher
  if (message.type !== 'text' || message.text === undefined) {
    await sendMessage(
      contact.phoneE164,
      'Merci d\'envoyer le contenu de la réunion en texte (les médias ne sont pas encore supportés).',
    );
    return;
  }

  const text = message.text.body;
  const command = parseCommand(text);

  // Prolonge (ou crée) la session avant dispatch
  let session = getActiveSession(contact.phoneE164);
  if (session === null) {
    session = createSession(contact.phoneE164);
  }

  const messageTs = new Date(Number.parseInt(message.timestamp, 10) * 1000);
  appendMessage(
    session.conversationId,
    text,
    Number.isNaN(messageTs.getTime()) ? new Date() : messageTs,
  );

  log.info(
    {
      conversationId: session.conversationId,
      phoneE164: contact.phoneE164,
      command: command.type,
    },
    '[whatsapp] message dispatché',
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

// ============================================================
// POST /webhook — réception des messages entrants
// ============================================================

whatsappRouter.post(
  '/webhook',
  verifyMetaSignature,
  async (req: Request, res: Response): Promise<void> => {
    const log = getLogger();

    // --- 1. Parsing ---
    let messages: WhatsAppIncomingMessage[];
    try {
      messages = parseWebhookPayload(req.body);
    } catch (err) {
      if (err instanceof WhatsAppParseError) {
        log.warn({ err: err.message }, '[whatsapp] payload webhook invalide');
        // 200 OK pour éviter les retries Meta : le payload est cassé, pas un bug transitoire
        res.status(200).json({ ok: true, ignored: 'invalid_payload' });
        return;
      }
      log.error({ err }, '[whatsapp] erreur inattendue parsing webhook');
      res.status(200).json({ ok: true, ignored: 'unknown_error' });
      return;
    }

    if (messages.length === 0) {
      // Webhook de status (delivered / read) ou changement hors messages
      res.status(200).json({ ok: true });
      return;
    }

    // --- 2. Dispatch message par message ---
    for (const message of messages) {
      try {
        // Whitelist check inline (pas un middleware — granularité message)
        const phoneE164 = toE164(message.from);
        const contact = checkWhitelist(phoneE164);
        if (contact === null) {
          // Silent block : logué dans access_logs via checkWhitelist
          continue;
        }

        await dispatchMessage(message, {
          phoneE164: contact.phoneE164,
          displayName: contact.displayName,
        });
      } catch (err) {
        // On loggue mais on ne fait JAMAIS crasher la réponse Meta
        log.error({ err, messageId: message.id }, '[whatsapp] erreur dispatch message');
      }
    }

    // --- 3. Toujours 200 OK à Meta (sinon retries agressifs) ---
    res.status(200).json({ ok: true });
  },
);
