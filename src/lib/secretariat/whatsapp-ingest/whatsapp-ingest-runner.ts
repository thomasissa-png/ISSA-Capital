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
  listActiveWhatsappNoMatch,
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

/**
 * Formate un téléphone (9 derniers chiffres FR) pour affichage / écriture dans
 * le vault au format canonique `+33 6 64 85 06 31`. Utilisé partout où on
 * affiche/écrit un téléphone issu d'un `chatPhone()` ou `normalizePhone()` —
 * sinon on stocke ou affiche des « 664850631 » (bug S26 #1).
 *
 * Comportement :
 *  - `null` / `undefined` / `''` → `''`
 *  - 9 chiffres FR (mobile ou fixe) → `+33 X XX XX XX XX`
 *  - 11 chiffres préfixés `33` (S26 H5) → normalisés vers 9 puis formatés
 *  - Autre cas (numéro international non-FR, court, alpha) → on **préfixe `+`**
 *    aux digits s'il en manque (préserve l'indicatif au lieu d'inventer `+33`
 *    pour un numéro US/UK — S26 H3). Si on ne peut rien faire de raisonnable,
 *    renvoyer la chaîne d'origine telle quelle.
 *
 * Le matching `alias_telephone` reste cohérent : `normalizePhone('+33 6 64 …')`
 * et `normalizePhone('664850631')` produisent le même hash 9-chiffres.
 */
export function formatPhoneForDisplay(normalized: string | null | undefined): string {
  if (!normalized) return '';
  const raw = String(normalized);
  const d = raw.replace(/\D/g, '');
  if (d.length === 9) {
    return `+33 ${d[0]} ${d.slice(1, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
  }
  // S26 H5 — 11 chiffres préfixés `33` (avec ou sans `+`) → mobile/fixe FR.
  if (d.length === 11 && d.startsWith('33')) {
    const nine = d.slice(2);
    return `+33 ${nine[0]} ${nine.slice(1, 3)} ${nine.slice(3, 5)} ${nine.slice(5, 7)} ${nine.slice(7, 9)}`;
  }
  // S26 H3 — Numéro international non-FR (US `+1…`, UK `+44…`) ou format non
  // reconnu : préserver l'indicatif au lieu d'inventer `+33`. Si la chaîne
  // d'origine a déjà un `+`, on la renvoie inchangée ; sinon on préfixe
  // `+` aux digits (préserve la longueur, signale que c'est un numéro
  // international plutôt qu'un identifiant interne).
  if (raw.trim().startsWith('+')) return raw.trim();
  if (d.length >= 7) return `+${d}`;
  return raw;
}

/** Extrait le numéro normalisé d'un chat DM WhatsApp (`<phone>@s.whatsapp.net`). */
function chatPhone(chatId: string): string | null {
  if (!chatId.endsWith('@s.whatsapp.net')) return null; // groupe (`…@g.us`) → pas de match contact
  return normalizePhone(chatId.split('@')[0] ?? '');
}

function contactDisplayName(c: VaultContact): string {
  return `${c.prenom} ${c.nom}`.trim() || c.filename?.replace(/\.md$/i, '') || '(contact)';
}

/**
 * Index téléphone normalisé → fiche contact (1er gagnant en cas de doublon).
 *
 * S26 — Indexe `telephone` ET `aliasTelephones` (liste). Sans ça, un contact
 * « Lié » via le bouton no-match (numéro ajouté en `alias_telephone`) restait
 * vu comme inconnu au cron suivant → carte renvoyée → spam Thomas. Bug
 * structurel observé en complément de la demande Thomas S26 « carte pour
 * tout inconnu » (sinon le fix carte-pour-tout-inconnu démultipliait le spam).
 */
function buildPhoneIndex(contacts: VaultContact[]): Map<string, VaultContact> {
  const map = new Map<string, VaultContact>();
  for (const c of contacts) {
    const allPhones = [c.telephone, ...(c.aliasTelephones ?? [])].filter(
      (p): p is string => typeof p === 'string' && p.trim().length > 0,
    );
    for (const raw of allPhones) {
      const key = normalizePhone(raw);
      if (key && !map.has(key)) map.set(key, c);
    }
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
  // S26 — Ventilation des chats DM non transformés en carte no-match, par raison.
  // Permet d'identifier pourquoi le volume de fiches reçues << volume attendu
  // (Bug #2 confirmé Thomas 28/05 — « manque beaucoup de fiches contact »).
  /** chats où le LLM a renvoyé `relevant: false` (bavardage / non actionnable). */
  chatsSkippedNotRelevant: number;
  /** chats qui sont des groupes (`@g.us`) — pas de carte no-match (pas d'expéditeur unique). */
  chatsSkippedGroup: number;
  /** chats pertinents mais dont le contact est déjà connu (match téléphone ou email) → enrichi sans carte. */
  chatsSkippedAlreadyMatched: number;
  /** chats DM pertinents non matchés où `summary` LLM est vide → carte muette évitée. */
  chatsSkippedEmptySummary: number;
  /** S26 I2 — chats où l'appel LLM `extractChat` a échoué (timeout / 5xx /
   *  JSON cassé). À distinguer de `chatsSkippedNotRelevant` (relevant=false
   *  explicite du LLM) pour ne pas biaiser le diag Bug #2. */
  chatsSkippedLlmError: number;
  /** S26 — DM inconnu où une carte pending est déjà active (TTL 7j) → on
   *  n'envoie pas de 2e carte pour le même chatId (anti-spam). */
  chatsSkippedAlreadyPending: number;
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
  /** S26 I2 — `true` si le LLM a échoué (try/catch) et qu'on est retombé sur
   *  l'objet vide. Le caller doit alors compter le chat en `LlmError`, pas en
   *  `NotRelevant` (qui réfère à un `relevant: false` explicite du LLM). */
  extractFailed?: boolean;
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
    return { ...empty, extractFailed: true };
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
    chatsSkippedNotRelevant: 0,
    chatsSkippedGroup: 0,
    chatsSkippedAlreadyMatched: 0,
    chatsSkippedEmptySummary: 0,
    chatsSkippedLlmError: 0,
    chatsSkippedAlreadyPending: 0,
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

  // S26 — Demande Thomas : « envoie carte pour TOUT numéro inconnu, pas
  // seulement les conversations marquées `relevant` par le LLM ». Pour ne pas
  // spammer une 2e carte sur le même chat tant qu'une carte est déjà en
  // attente (TTL 7j), on lit la liste des pendings actifs une fois par run.
  const activeNoMatchChatIds = new Set<string>();
  try {
    const activePendings = await listActiveWhatsappNoMatch();
    for (const p of activePendings) activeNoMatchChatIds.add(p.chatId);
  } catch (err) {
    console.warn(
      `[whatsapp-ingest] lecture pendings WhatsApp KO (dédup carte dégradée) : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Grouper par chat (roomID).
  const byChat = new Map<string, { name: string; chatId: string; msgs: BeeperMessage[] }>();
  for (const m of messages) {
    const g = byChat.get(m.roomID) ?? { name: m.chatName || '(chat sans nom)', chatId: m.chatId, msgs: [] };
    g.msgs.push(m);
    byChat.set(m.roomID, g);
  }
  stats.chats = byChat.size;

  for (const [, group] of byChat) {
    // S26 — Bug #2 : 1 ligne de log par chat à la fin de la boucle, pour
    // identifier précisément où chaque chat « tombe » dans le pipeline.
    let cardOutcome: 'sent' | 'skip:group' | 'skip:matched' | 'skip:already-pending' | 'skip:empty-summary' | 'skip:llm-error' | 'error' = 'skip:matched';
    let chatRelevant = false;
    let chatEnrichedContact = false;
    let chatEnrichedByEmail = false;
    let chatProjet: string | null = null;
    let chatDraft = false;
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
      // S26 I2 — Distinguer LLM échoué (exception) de `relevant: false` explicite.
      // Reste un early-return : sans extraction on ne peut rien tagger.
      if (ex.extractFailed) {
        stats.chatsSkippedLlmError++;
        cardOutcome = 'skip:llm-error';
        continue;
      }
      // S26 — Demande Thomas verbatim : « Anya doit me proposer une carte pour
      // tout numéro qu'elle ne connaît pas à compter de maintenant », même
      // si le LLM marque la conversation `relevant: false` (= bavardage perso).
      // Le gate `relevant` ne s'applique donc PLUS au chemin carte no-match —
      // il reste en revanche sur l'enrichissement (historique fiche/projet)
      // et sur la préparation de brouillon email (les flux business).
      if (ex.relevant) {
        chatRelevant = true;
        stats.relevantChats++;
      } else {
        stats.chatsSkippedNotRelevant++;
        // Pas de `continue` ici : on continue vers la décision carte
        // no-match (qui ignore `relevant`). Le compteur trace que le LLM
        // a jugé la conv non-business, c'est tout.
      }

      // 1a. Contact — priorité au match téléphone (déterministe), sinon email LLM.
      // S26 — Gardé sous `ex.relevant` : on n'enrichit l'historique d'une fiche
      // qu'avec des conv business. Sinon on polluerait les fiches avec du
      // bavardage perso (« Salut, ça va ? »).
      if (ex.relevant) {
        if (matched?.folderPath && matched.filename) {
          try {
            if (await appendContactLine(matched.folderPath, matched.filename, ex.summary, group.name, `whatsapp-ingest:phone:${phone}`)) {
              stats.contactsEnriched++;
              stats.contactsByPhone++;
              chatEnrichedContact = true;
            }
          } catch (err) {
            console.warn(`[whatsapp-ingest] enrich contact (phone) échoué : ${err instanceof Error ? err.message : String(err)}`);
          }
        } else if (ex.contactEmail) {
          try {
            const m = await findContactByEmail(ex.contactEmail);
            if (m && (await appendContactLine(m.folderPath, `${m.name}.md`, ex.summary, group.name, `whatsapp-ingest:email:${ex.contactEmail}`))) {
              stats.contactsEnriched++;
              chatEnrichedContact = true;
              chatEnrichedByEmail = true;
            }
          } catch (err) {
            console.warn(`[whatsapp-ingest] enrich contact (email) échoué : ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // 1c. Décision carte « contact WhatsApp inconnu ».
      // S26 — Demande Thomas : carte envoyée pour TOUT numéro inconnu DM,
      // peu importe `relevant`. Anti-spam : skip si pending actif pour ce
      // chatId, OU si contact déjà matché (phone via index étendu
      // alias_telephone, ou email lors d'un enrichissement précédent).
      const isDM = group.chatId.endsWith('@s.whatsapp.net');
      // S26 — Summary : si LLM a un summary `relevant`, on l'utilise ;
      // sinon fallback générique (Thomas verra juste « Contact inconnu — N
      // messages dans la fenêtre » → suffisant pour décider du type).
      const summaryForCard =
        ex.relevant && ex.summary && ex.summary.trim().length > 0
          ? ex.summary
          : `Conversation détectée (${group.msgs.length} message${group.msgs.length > 1 ? 's' : ''} dans la fenêtre, classée non-business par le LLM).`;
      const isContactKnown = Boolean(matched);
      const isAlreadyPending = activeNoMatchChatIds.has(group.chatId);
      if (!isDM) {
        stats.chatsSkippedGroup++;
        cardOutcome = 'skip:group';
      } else if (isContactKnown) {
        stats.chatsSkippedAlreadyMatched++;
        cardOutcome = 'skip:matched';
      } else if (isAlreadyPending) {
        // Une carte est déjà en attente pour ce chat (TTL 7j) — pas de doublon.
        stats.chatsSkippedAlreadyPending++;
        cardOutcome = 'skip:already-pending';
      }
      if (isDM && !isContactKnown && !isAlreadyPending) {
        try {
          // S24 nuit — détection homonyme via chatName (array jusqu'à 3).
          // S26 I3 — tracker le `total` réel avant `slice(0,3)` pour que la
          // carte puisse afficher « X homonymes (top 3 affichés) » au lieu
          // du chiffre tronqué silencieusement.
          let existingMatchHints: WhatsappNoMatchPending['existingMatchHints'] = null;
          let existingMatchHintsTotal = 0;
          if (group.name && group.name.trim().length >= 3) {
            try {
              const allHomonyms = matchContacts(contacts, group.name).filter(
                (m) => m.folderPath && m.filename,
              );
              existingMatchHintsTotal = allHomonyms.length;
              const homonyms = allHomonyms.slice(0, 3);
              existingMatchHints = homonyms.map((m) => ({
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
            summary: summaryForCard,
            defaultType: 'pro',
            userContext: null,
            cardMessageId: null,
            createdAt: new Date().toISOString(),
            existingMatchHints,
            existingMatchHintsTotal: existingMatchHintsTotal || undefined,
          };
          // S24 nuit (post-audit) — ordre corrigé : envoyer D'ABORD, sauver
          // UNE FOIS avec messageId. Élimine la race save → send → re-save
          // qui faisait perdre les replies ultra-rapides.
          const sent = await sendWhatsappNoMatchCard(pending);
          pending.cardMessageId = sent.messageId;
          await saveWhatsappNoMatch(pending);
          // S26 — Ajouter immédiatement au set anti-spam pour éviter une 2e
          // carte sur le même chatId si plusieurs runs concurrents.
          activeNoMatchChatIds.add(group.chatId);
          stats.noMatchCardsSent++;
          cardOutcome = 'sent';
        } catch (err) {
          stats.errors++;
          cardOutcome = 'error';
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
          if (res.status === 'enriched') {
            stats.projetsEnriched++;
            chatProjet = ex.projet;
          }
        } catch (err) {
          console.warn(`[whatsapp-ingest] enrich projet échoué : ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 2. Action : préparer un brouillon d'email (jamais envoyé).
      let draftUrl: string | null = null;
      if (ex.emailToPrepare) {
        draftUrl = await prepareEmailDraft(ex.emailToPrepare, group.name);
        if (draftUrl) {
          stats.draftsPrepared++;
          chatDraft = true;
        }
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
      cardOutcome = 'error';
      console.warn(`[whatsapp-ingest] erreur chat "${group.name}" : ${err instanceof Error ? err.message : String(err)}`);
    }

    // S26 — Bug #2 : 1 ligne par chat avec le résultat de chaque étape.
    // Sans logger le contenu (privacy) : juste outcome + flags binaires.
    const isDM = group.chatId.endsWith('@s.whatsapp.net');
    const phoneStr = chatPhone(group.chatId) ?? 'none';
    const matchedStr = (isDM && byPhone.get(phoneStr) ? 'phone' : chatEnrichedByEmail ? 'email' : 'none');
    console.warn(
      `[whatsapp-ingest:chat] "${group.name}" DM=${isDM ? 'oui' : 'non'} phone=${phoneStr} matched=${matchedStr} ` +
        `relevant=${chatRelevant ? 'oui' : 'non'} enriched=${chatEnrichedContact ? 'oui' : 'non'} ` +
        `projet=${chatProjet ?? 'none'} draft=${chatDraft ? 'oui' : 'non'} card=${cardOutcome}`,
    );
  }

  await writeCursor(nowTs);
  console.warn(
    `[whatsapp-ingest] terminé — ${stats.newMessages} msg, ${stats.chats} chats, ${stats.relevantChats} pertinents, ` +
      `${stats.contactsEnriched} contacts enrichis (${stats.contactsByPhone} via tél.), ${stats.projetsEnriched} projets enrichis, ` +
      `${stats.draftsPrepared} brouillons, ${stats.notified} notifiés, ${stats.noMatchCardsSent} cartes no-match, ${stats.errors} erreurs`,
  );
  // S26 — Ventilation par raison de skip carte. Le compteur
  // `chatsSkippedNotRelevant` n'est plus une raison de skip carte depuis le
  // fix Thomas S26 (carte envoyée même si relevant=false) mais reste utile
  // pour observer combien de conversations sont jugées non-business.
  console.warn(
    `[whatsapp-ingest] ventilation cartes — sent=${stats.noMatchCardsSent}, ` +
      `skip:group=${stats.chatsSkippedGroup}, ` +
      `skip:matched=${stats.chatsSkippedAlreadyMatched}, ` +
      `skip:already-pending=${stats.chatsSkippedAlreadyPending}, ` +
      `skip:llm-error=${stats.chatsSkippedLlmError}, ` +
      `(info) not-relevant=${stats.chatsSkippedNotRelevant} (LLM non-business — n'empêche plus la carte)`,
  );
  return stats;
}
