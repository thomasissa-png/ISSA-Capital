/**
 * Ingestion WhatsApp (Beeper) — V3 : enrichit le vault « comme les emails »,
 * avec match contact DÉTERMINISTE par numéro de téléphone.
 *
 * Pour chaque conversation NON exclue (nom sans « sarani » / « ubi », cf.
 * BEEPER_EXCLUDE), Anya lit les nouveaux messages (depuis un curseur), en
 * extrait l'essentiel via LLM, puis :
 *   1. ENRICHIT LE VAULT en silence quand c'est cohérent — append à
 *      l'historique d'une fiche Contact et/ou d'une fiche Projet (code entité).
 *      Le contact est résolu en PRIORITÉ par numéro de téléphone (DM WhatsApp
 *      `<phone>@s.whatsapp.net` ↔ champ `telephone` de la fiche), sinon par
 *      email proposé par le LLM. Append-only, PATCH in-place (R5).
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
import { randomUUID } from 'node:crypto';
import { listTextMessagesSince, type BeeperMessage } from '../beeper-source/beeper-client';
import { callLLM } from '../llm/client';
import { sendTelegramMessage } from '../telegram';
import { getVaultContacts, type VaultContact } from '../vault-contacts';
import { findContactByEmail, appendToHistorique } from '../vault-client';
import { appendProjetHistoriqueLine } from '../calendar-ingest/projet-enricher';
import { createDraft } from '../gmail-source/gmail-client';
import { PROJET_CODES, type ProjetCode } from '../triage/types';
import {
  saveWhatsappNoMatch,
  sendWhatsappNoMatchCard,
  type WhatsappNoMatchPending,
} from '../telegram-validation';
import { matchContacts } from '../handlers/enrichir';

// Fallback si curseur absent/corrompu : 48 h par défaut (R3 — un « 4 h » trop
// court saute la matinée si le 1er run de la journée est tardif). Paramétrable.
function fallbackLookbackMs(): number {
  const h = Number(process.env.BEEPER_FALLBACK_LOOKBACK_HOURS);
  return (Number.isFinite(h) && h > 0 ? h : 48) * 60 * 60 * 1000;
}
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

// ============================================================
// Téléphone — normalisation + index
// ============================================================

/**
 * Normalise un numéro vers ses 9 derniers chiffres significatifs (on retire
 * l'indicatif `+33` / le `0` de tête). Heuristique robuste pour les numéros FR :
 * `+33 6 64 85 06 31`, `06 64 85 06 31`, `33664850631@s.whatsapp.net` → `664850631`.
 */
export function normalizePhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length < 6) return null;
  return digits.slice(-9);
}

/** Extrait le numéro normalisé d'un chat DM WhatsApp (`<phone>@s.whatsapp.net`). */
function chatPhone(chatId: string): string | null {
  if (!chatId.endsWith('@s.whatsapp.net')) return null; // groupe (`…@g.us`) → pas de match contact
  return normalizePhone(chatId.split('@')[0] ?? '');
}

function contactDisplayName(c: VaultContact): string {
  return `${c.prenom} ${c.nom}`.trim() || c.filename?.replace(/\.md$/i, '') || '(contact)';
}

/** Index téléphone normalisé → fiche contact (1er gagnant en cas de doublon). */
function buildPhoneIndex(contacts: VaultContact[]): Map<string, VaultContact> {
  const map = new Map<string, VaultContact>();
  for (const c of contacts) {
    if (!c.telephone) continue;
    const key = normalizePhone(c.telephone);
    if (key && !map.has(key)) map.set(key, c);
  }
  return map;
}

export interface WhatsappIngestStats {
  newMessages: number;
  chats: number;
  relevantChats: number;
  /** fiches Contact enrichies (historique). */
  contactsEnriched: number;
  /** dont enrichis par match téléphone déterministe. */
  contactsByPhone: number;
  /** fiches Projet enrichies (historique). */
  projetsEnriched: number;
  /** brouillons d'email Gmail préparés. */
  draftsPrepared: number;
  /** notifications Telegram envoyées (todo / action seulement). */
  notified: number;
  /** cartes Telegram « contact WhatsApp inconnu » envoyées (S24 soir). */
  noMatchCardsSent: number;
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
 *
 * `knownContactName` : si le numéro a déjà été reconnu (match téléphone), on le
 * donne en indice fort au LLM pour fiabiliser le rattachement.
 */
async function extractChat(
  chatName: string,
  texts: string[],
  contacts: VaultContact[],
  knownContactName: string | null,
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
  const contactsList =
    contacts
      .map((c) => {
        const email = c.email ? ` <${c.email}>` : '';
        const alias = c.surnoms && c.surnoms.length > 0 ? ` (alias : ${c.surnoms.join(', ')})` : '';
        return `- ${contactDisplayName(c)}${email}${alias}`;
      })
      .join('\n') || '(aucun)';
  const hint = knownContactName
    ? `\n\nIMPORTANT : le numéro de cette conversation correspond au contact connu « ${knownContactName} » — rattache-lui les infos.`
    : '';
  const system =
    "Tu es Anya, secrétariat IA de Thomas Issa (ISSA Capital — patrimoine, immobilier, business). " +
    "On te donne les messages WhatsApp récents d'UNE conversation, la liste des contacts connus de " +
    "Thomas (avec email + alias), et les codes projet. Détermine ce qui mérite d'être consigné/agi. " +
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
          content: `Conversation : ${chatName}\n\nContacts connus :\n${contactsList}\n\nMessages :\n${snippet}${hint}`,
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

/** Append une ligne d'historique à une fiche contact (chemin connu). */
async function appendContactLine(
  folderPath: string,
  filename: string,
  summary: string,
  chatName: string,
  trigger: string,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  return appendToHistorique(folderPath, filename, {
    title: `${today} — WhatsApp : ${chatName}`,
    content: summary,
    trigger,
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
    contactsByPhone: 0,
    projetsEnriched: 0,
    draftsPrepared: 0,
    notified: 0,
    noMatchCardsSent: 0,
    errors: 0,
  };

  const nowTs = Date.now();
  const stored = await readCursor();
  const cursor = stored ?? nowTs - fallbackLookbackMs();
  // R4 — diagnostic lisible : curseur d'entrée (date + epoch ms), source du curseur.
  console.warn(
    `[whatsapp-ingest] curseur d'entrée : ${new Date(cursor).toISOString()} (${cursor}) — ${stored ? 'fichier' : `fallback ${fallbackLookbackMs() / 3_600_000}h`}`,
  );

  let messages: BeeperMessage[];
  try {
    messages = await listTextMessagesSince(cursor, MAX_MESSAGES_PER_RUN);
  } catch (err) {
    // Lecture Beeper échouée → NE PAS avancer le curseur (sinon la fenêtre est
    // sautée définitivement). On signale l'erreur et on retentera au prochain run.
    stats.errors += 1;
    console.warn(
      `[whatsapp-ingest] lecture Beeper échouée — curseur conservé (${cursor}) : ${err instanceof Error ? err.message : String(err)}`,
    );
    return stats;
  }
  stats.newMessages = messages.length;

  if (messages.length === 0) {
    await writeCursor(nowTs);
    console.warn('[whatsapp-ingest] aucun nouveau message');
    return stats;
  }

  let contacts: VaultContact[] = [];
  try {
    contacts = await getVaultContacts();
  } catch {
    console.warn('[whatsapp-ingest] chargement contacts échoué — match contact dégradé ce run');
  }
  const byPhone = buildPhoneIndex(contacts);

  // Grouper par chat (roomID).
  const byChat = new Map<string, { name: string; chatId: string; msgs: BeeperMessage[] }>();
  for (const m of messages) {
    const g = byChat.get(m.roomID) ?? { name: m.chatName || '(chat sans nom)', chatId: m.chatId, msgs: [] };
    g.msgs.push(m);
    byChat.set(m.roomID, g);
  }
  stats.chats = byChat.size;

  for (const [, group] of byChat) {
    try {
      // Match téléphone déterministe (DM uniquement) AVANT l'extraction.
      const phone = chatPhone(group.chatId);
      const matched = phone ? byPhone.get(phone) : undefined;

      const ex = await extractChat(
        group.name,
        group.msgs.map((m) => m.text),
        contacts,
        matched ? contactDisplayName(matched) : null,
      );
      if (!ex.relevant) continue;
      stats.relevantChats++;

      // 1a. Contact — priorité au match téléphone (déterministe), sinon email LLM.
      let enrichedContact = false;
      if (matched?.folderPath && matched.filename) {
        try {
          if (await appendContactLine(matched.folderPath, matched.filename, ex.summary, group.name, `whatsapp-ingest:phone:${phone}`)) {
            stats.contactsEnriched++;
            stats.contactsByPhone++;
            enrichedContact = true;
          }
        } catch (err) {
          console.warn(`[whatsapp-ingest] enrich contact (phone) échoué : ${err instanceof Error ? err.message : String(err)}`);
        }
      } else if (ex.contactEmail) {
        try {
          const m = await findContactByEmail(ex.contactEmail);
          if (m && (await appendContactLine(m.folderPath, `${m.name}.md`, ex.summary, group.name, `whatsapp-ingest:email:${ex.contactEmail}`))) {
            stats.contactsEnriched++;
            enrichedContact = true;
          }
        } catch (err) {
          console.warn(`[whatsapp-ingest] enrich contact (email) échoué : ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 1c. Aucun match contact + DM pertinent → carte Telegram « contact
      // WhatsApp inconnu » (S24 soir, symétrie avec le no-match email).
      // Restreint aux DM (`<phone>@s.whatsapp.net`) — pas de carte pour les
      // groupes (pas d'expéditeur unique à transformer en fiche).
      if (!enrichedContact && group.chatId.endsWith('@s.whatsapp.net')) {
        try {
          // S24 nuit — détection homonyme via chatName (array jusqu'à 3).
          let existingMatchHints: WhatsappNoMatchPending['existingMatchHints'] = null;
          if (group.name && group.name.trim().length >= 3) {
            try {
              const homonyms = matchContacts(contacts, group.name).slice(0, 3);
              existingMatchHints = homonyms
                .filter((m) => m.folderPath && m.filename)
                .map((m) => ({
                  displayName: `${m.prenom} ${m.nom}`.trim(),
                  knownPhones: [m.telephone].filter((p): p is string => Boolean(p)),
                  folderPath: m.folderPath!,
                  filename: m.filename!,
                }));
              if (existingMatchHints.length === 0) existingMatchHints = null;
            } catch (homErr) {
              console.warn(
                `[whatsapp-ingest] détection homonymie KO pour "${group.name}" : ${homErr instanceof Error ? homErr.message : String(homErr)}`,
              );
            }
          }

          const pending: WhatsappNoMatchPending = {
            id: randomUUID(),
            chatId: group.chatId,
            chatName: group.name,
            phone: phone ?? null,
            summary: ex.summary,
            defaultType: 'pro',
            userContext: null,
            cardMessageId: null,
            createdAt: new Date().toISOString(),
            existingMatchHints,
          };
          // S24 nuit (post-audit) — ordre corrigé : envoyer D'ABORD, sauver
          // UNE FOIS avec messageId. Élimine la race save → send → re-save
          // qui faisait perdre les replies ultra-rapides.
          const sent = await sendWhatsappNoMatchCard(pending);
          pending.cardMessageId = sent.messageId;
          await saveWhatsappNoMatch(pending);
          stats.noMatchCardsSent++;
        } catch (err) {
          stats.errors++;
          console.warn(
            `[whatsapp-ingest] envoi carte no-match KO pour "${group.name}" : ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // 1b. Projet.
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
          console.warn(`[whatsapp-ingest] enrich projet échoué : ${err instanceof Error ? err.message : String(err)}`);
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
      `${stats.contactsEnriched} contacts enrichis (${stats.contactsByPhone} via tél.), ${stats.projetsEnriched} projets enrichis, ` +
      `${stats.draftsPrepared} brouillons, ${stats.notified} notifiés, ${stats.noMatchCardsSent} cartes no-match, ${stats.errors} erreurs`,
  );
  return stats;
}
