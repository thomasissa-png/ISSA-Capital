/**
 * Ingestion WhatsApp (Beeper) — V2 : enrichit le vault « comme les emails ».
 *
 * Pour chaque conversation NON exclue (nom sans « sarani » / « ubi », cf.
 * BEEPER_EXCLUDE), Anya lit les nouveaux messages (depuis un curseur), en
 * extrait l'essentiel via LLM, puis :
 *   1. ENRICHIT LE VAULT en silence quand c'est cohérent — append à
 *      l'historique d'une fiche Contact (match par email connu) et/ou d'une
 *      fiche Projet (code entité). Append-only, PATCH in-place (R5).
 *   2. PRÉPARE UN BROUILLON D'EMAIL (Gmail) si la conversation appelle un envoi
 *      d'email de la part de Thomas. JAMAIS envoyé — brouillon seul (règle 11).
 *   3. NOTIFIE THOMAS SUR TELEGRAM UNIQUEMENT s'il y a une todo à faire ou une
 *      action (ex : brouillon d'email préparé). Sinon : enrichissement silencieux.
 *
 * 🔒 Lecture WhatsApp strictement read-only ; aucun envoi WhatsApp.
 * 🔒 Aucun brouillon de réponse WhatsApp (impossible + non souhaité).
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listTextMessagesSince, type BeeperMessage } from '../beeper-source/beeper-client';
import { callLLM } from '../llm/client';
import { sendTelegramMessage } from '../telegram';
import { loadKnownContacts } from '../email-ingest/contacts-cache';
import { findContactByEmail, appendToHistorique } from '../vault-client';
import { appendProjetHistoriqueLine } from '../calendar-ingest/projet-enricher';
import { createDraft } from '../gmail-source/gmail-client';
import { PROJET_CODES, type ProjetCode, type KnownContact } from '../triage/types';

const FIRST_RUN_LOOKBACK_MS = 4 * 60 * 60 * 1000; // 4h au premier run (cadence scan)
const MAX_MESSAGES_PER_RUN = 300;
const MAX_SNIPPET_MESSAGES = 30;

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
  /** fiches Contact enrichies (historique). */
  contactsEnriched: number;
  /** fiches Projet enrichies (historique). */
  projetsEnriched: number;
  /** brouillons d'email Gmail préparés. */
  draftsPrepared: number;
  /** notifications Telegram envoyées (todo / action seulement). */
  notified: number;
  errors: number;
}

interface EmailIntent {
  to: string;
  subject: string;
  intent: string;
}

interface ChatExtraction {
  relevant: boolean;
  summary: string;
  /** email EXACT d'un contact connu si la conversation le concerne clairement, sinon null. */
  contactEmail: string | null;
  /** code entité projet (IC/GO/VI/VV/VM/IM) si clairement concerné, sinon null. */
  projet: ProjetCode | null;
  /** actions concrètes que Thomas doit faire. */
  todos: string[];
  /** email à préparer si la conversation appelle un envoi de la part de Thomas. */
  emailToPrepare: EmailIntent | null;
}

const PROJET_LEGENDE =
  'IC = ISSA Capital, GO = Gradient One, VI = Versi Immobilier, VV = Versi Invest, VM = Versimo, IM = Immocrew';

/**
 * Extraction structurée d'UNE conversation : pertinence + match vault + todos +
 * éventuel email à préparer. Un seul appel LLM (DeepSeek Flash) par chat.
 */
async function extractChat(
  chatName: string,
  texts: string[],
  contacts: KnownContact[],
): Promise<ChatExtraction> {
  const empty: ChatExtraction = {
    relevant: false,
    summary: '',
    contactEmail: null,
    projet: null,
    todos: [],
    emailToPrepare: null,
  };
  const snippet = texts.slice(-MAX_SNIPPET_MESSAGES).join('\n');
  const contactsList = contacts.map((c) => `- ${c.name} <${c.email}>`).join('\n') || '(aucun)';
  const system =
    "Tu es Anya, secrétariat IA de Thomas Issa (ISSA Capital — patrimoine, immobilier, business). " +
    "On te donne les messages WhatsApp récents d'UNE conversation, la liste des contacts connus de " +
    "Thomas (avec leur email), et les codes projet. Détermine ce qui mérite d'être consigné/agi. " +
    "Ignore le bavardage perso/famille/amical pur. Réponds en JSON STRICT :\n" +
    '{"relevant": bool, "summary": "1-2 phrases FR (ce qui compte ; vide si non pertinent)", ' +
    '"contactEmail": "email EXACT pris dans la liste fournie si la conversation concerne clairement CE contact, sinon null", ' +
    `"projet": "un code parmi [${PROJET_CODES.join(', ')}] si un projet connu est clairement concerné, sinon null", ` +
    '"todos": ["actions concrètes que THOMAS doit faire, sinon []"], ' +
    '"emailToPrepare": {"to":"email du destinataire","subject":"objet","intent":"ce que l\'email doit dire"} ' +
    "ou null si aucun email n'est clairement à envoyer par Thomas}.\n" +
    `Codes projet : ${PROJET_LEGENDE}. ` +
    "N'invente JAMAIS un email : contactEmail et emailToPrepare.to doivent venir d'un email connu/cité, sinon null.";
  try {
    const { text } = await callLLM({
      task: 'email-triage', // DeepSeek Flash (classification lean)
      system,
      messages: [
        {
          role: 'user',
          content: `Conversation : ${chatName}\n\nContacts connus :\n${contactsList}\n\nMessages :\n${snippet}`,
        },
      ],
      maxTokens: 600,
      timeoutMs: 30_000,
      responseFormat: 'json',
    });
    const p = JSON.parse(text || '{}') as Partial<ChatExtraction> & {
      emailToPrepare?: Partial<EmailIntent> | null;
    };
    const projet =
      typeof p.projet === 'string' && (PROJET_CODES as readonly string[]).includes(p.projet)
        ? (p.projet as ProjetCode)
        : null;
    const contactEmail =
      typeof p.contactEmail === 'string' && p.contactEmail.includes('@')
        ? p.contactEmail.toLowerCase().trim()
        : null;
    let emailToPrepare: EmailIntent | null = null;
    if (p.emailToPrepare && typeof p.emailToPrepare.to === 'string' && p.emailToPrepare.to.includes('@')) {
      emailToPrepare = {
        to: p.emailToPrepare.to.trim(),
        subject: String(p.emailToPrepare.subject ?? '').trim() || '(sans objet)',
        intent: String(p.emailToPrepare.intent ?? '').trim(),
      };
    }
    return {
      relevant: Boolean(p.relevant),
      summary: String(p.summary ?? '').trim(),
      contactEmail,
      projet,
      todos: Array.isArray(p.todos) ? p.todos.map((t) => String(t).trim()).filter((t) => t.length > 0) : [],
      emailToPrepare,
    };
  } catch (err) {
    console.warn(
      `[whatsapp-ingest] extraction "${chatName}" échouée : ${err instanceof Error ? err.message : String(err)}`,
    );
    return empty;
  }
}

/** Génère le corps d'un email (DeepSeek Pro) et crée un brouillon Gmail. Jamais d'envoi. */
async function prepareEmailDraft(intent: EmailIntent, chatName: string): Promise<string | null> {
  const system =
    "Tu es Anya, l'assistante de Thomas Issa. Rédige un email PROFESSIONNEL en français, prêt à relire. " +
    "Style sobre, direct, sans superflu. Signature OBLIGATOIRE (ne jamais écrire « Bien cordialement, ») : " +
    "ligne vide, puis « Très cordialement, », ligne vide, « Thomas Issa », « 06 64 85 06 31 ». " +
    'Réponds en JSON STRICT : {"body": "corps complet de l\'email avec la signature"}.';
  let body = '';
  try {
    const { text } = await callLLM({
      task: 'email-draft', // DeepSeek Pro (qualité rédactionnelle)
      system,
      messages: [
        {
          role: 'user',
          content: `Contexte (conversation WhatsApp « ${chatName} ») : ${intent.intent}\n\nDestinataire : ${intent.to}\nObjet : ${intent.subject}`,
        },
      ],
      maxTokens: 700,
      timeoutMs: 45_000,
      responseFormat: 'json',
    });
    body = String((JSON.parse(text || '{}') as { body?: string }).body ?? '').trim();
  } catch (err) {
    console.warn(`[whatsapp-ingest] rédaction email échouée : ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  if (!body) return null;

  const r = await createDraft({ to: intent.to, subject: intent.subject, body });
  return r.success ? r.gmailUrl ?? '(brouillon créé)' : null;
}

/** Enrichit l'historique d'une fiche Contact (match par email connu). */
async function enrichContact(contactEmail: string, summary: string, chatName: string): Promise<boolean> {
  const match = await findContactByEmail(contactEmail);
  if (!match) return false;
  const today = new Date().toISOString().slice(0, 10);
  return appendToHistorique(match.folderPath, `${match.name}.md`, {
    title: `${today} — WhatsApp : ${chatName}`,
    content: summary,
    trigger: `whatsapp-ingest:contact:${contactEmail}`,
    updateLastInteraction: true,
  });
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
  const stats: WhatsappIngestStats = {
    newMessages: 0,
    chats: 0,
    relevantChats: 0,
    contactsEnriched: 0,
    projetsEnriched: 0,
    draftsPrepared: 0,
    notified: 0,
    errors: 0,
  };

  const nowTs = Date.now();
  const stored = await readCursor();
  const cursor = stored ?? nowTs - FIRST_RUN_LOOKBACK_MS;

  const messages = await listTextMessagesSince(cursor, MAX_MESSAGES_PER_RUN);
  stats.newMessages = messages.length;

  if (messages.length === 0) {
    await writeCursor(nowTs);
    console.warn('[whatsapp-ingest] aucun nouveau message (hors exclusions)');
    return stats;
  }

  let contacts: KnownContact[] = [];
  try {
    contacts = await loadKnownContacts();
  } catch {
    console.warn('[whatsapp-ingest] chargement contacts échoué — match contact désactivé ce run');
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
      const ex = await extractChat(group.name, group.msgs.map((m) => m.text), contacts);
      if (!ex.relevant) continue;
      stats.relevantChats++;

      // 1. Enrichissement vault SILENCIEUX (quand cohérent).
      if (ex.contactEmail) {
        try {
          if (await enrichContact(ex.contactEmail, ex.summary, group.name)) stats.contactsEnriched++;
        } catch (err) {
          console.warn(`[whatsapp-ingest] enrichContact échoué : ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      if (ex.projet) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const res = await appendProjetHistoriqueLine(ex.projet, {
            title: `${today} — WhatsApp : ${group.name}`,
            content: ex.summary,
            trigger: `whatsapp-ingest:projet:${ex.projet}`,
          });
          if (res.status === 'enriched') stats.projetsEnriched++;
        } catch (err) {
          console.warn(`[whatsapp-ingest] enrichProjet échoué : ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 2. Action : préparer un brouillon d'email (jamais envoyé).
      let draftUrl: string | null = null;
      if (ex.emailToPrepare) {
        draftUrl = await prepareEmailDraft(ex.emailToPrepare, group.name);
        if (draftUrl) stats.draftsPrepared++;
      }

      // 3. Telegram UNIQUEMENT s'il y a une todo ou une action.
      const hasAction = ex.todos.length > 0 || draftUrl !== null;
      if (hasAction) {
        const lines = [`💬 *WhatsApp — ${group.name}*`, ex.summary];
        if (ex.todos.length > 0) {
          lines.push('', '*À faire :*', ...ex.todos.map((t) => `• ${t}`));
        }
        if (draftUrl) {
          lines.push('', `📧 Brouillon d'email préparé : ${ex.emailToPrepare?.subject ?? ''}`, draftUrl);
        }
        if (await notifyThomas(lines.join('\n'))) stats.notified++;
      }
    } catch (err) {
      stats.errors++;
      console.warn(`[whatsapp-ingest] erreur chat "${group.name}" : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await writeCursor(nowTs);
  console.warn(
    `[whatsapp-ingest] terminé — ${stats.newMessages} msg, ${stats.chats} chats, ${stats.relevantChats} pertinents, ` +
      `${stats.contactsEnriched} contacts enrichis, ${stats.projetsEnriched} projets enrichis, ` +
      `${stats.draftsPrepared} brouillons, ${stats.notified} notifiés, ${stats.errors} erreurs`,
  );
  return stats;
}
