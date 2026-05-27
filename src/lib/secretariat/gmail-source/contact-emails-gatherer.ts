/**
 * Scan de la boîte mail d'un expéditeur — enrichissement fiche contact (S23).
 *
 * Quand Thomas accepte de créer une fiche pour un expéditeur inconnu
 * (carte no-match), on scanne d'abord la boîte pour retrouver les autres
 * emails de cet expéditeur (et les fils où Thomas a écrit), afin de
 * synthétiser une fiche riche au lieu d'un stub mono-email.
 *
 * 🔒 INVARIANT (règle 11) : LECTURE seule. Ce module n'appelle QUE
 * listMessages/getMessage — jamais d'envoi ni de modification de label.
 *
 * Réutilise le gmail-client mutualisé (listMessages/getMessage/extractBodyPlain).
 * Ne throw jamais : en cas d'échec partiel (token absent, HTTP KO), retourne
 * une liste vide ou tronquée — l'appelant retombe sur le stub.
 */

import {
  listMessages,
  getMessage,
  extractBodyPlain,
  getHeader,
} from './gmail-client';

// ============================================================
// Types
// ============================================================

/**
 * Un email de l'expéditeur, compacté pour le prompt LLM `contact-fiche`.
 * Pas de PJ, pas de HTML — juste ce qui sert à profiler le contact.
 */
export interface GatheredContactEmail {
  /** Date ISO (YYYY-MM-DD) du message, ou null si indéterminée. */
  date: string | null;
  /** Objet du mail (header Subject), tronqué. */
  subject: string;
  /** Extrait du corps texte (tronqué, HTML strippé). */
  excerpt: string;
  /** Direction du fil : `from` = reçu de l'expéditeur, `to` = écrit à lui. */
  direction: 'from' | 'to';
}

export interface GatherContactEmailsResult {
  /** Emails compactés, triés du plus récent au plus ancien. */
  emails: GatheredContactEmail[];
  /** Nombre de messages réellement scannés (getMessage OK). */
  scanned: number;
}

// ============================================================
// Constantes
// ============================================================

/** Longueur max de l'extrait de corps injecté dans le prompt. */
const EXCERPT_MAX_CHARS = 600;
/** Longueur max de l'objet injecté dans le prompt. */
const SUBJECT_MAX_CHARS = 200;

// ============================================================
// API publique
// ============================================================

/**
 * Scanne la boîte mail pour rassembler les emails liés à un expéditeur.
 *
 * Stratégie de recherche : `from:<sender> OR to:<sender>` — capture à la fois
 * les mails reçus de lui ET les fils où Thomas lui a écrit (signature, contexte).
 * Cap global ~`cap` messages les plus récents.
 *
 * @param senderEmail Adresse email de l'expéditeur (déjà normalisée minuscule).
 * @param cap Nombre maximum de messages à rassembler (défaut 15).
 * @returns Liste compacte d'emails + compteur. Jamais d'exception.
 */
export async function gatherContactEmails(
  senderEmail: string,
  cap = 15,
): Promise<GatherContactEmailsResult> {
  const normalized = senderEmail.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    console.warn('[contact-gatherer] email expéditeur invalide — scan ignoré');
    return { emails: [], scanned: 0 };
  }

  try {
    // from: ET to: dans une seule query (capture les deux directions du fil).
    const query = `from:${normalized} OR to:${normalized}`;
    const refs = await listMessages(query, cap);

    if (refs.length === 0) {
      console.warn(`[contact-gatherer] aucun email trouvé pour ${normalized}`);
      return { emails: [], scanned: 0 };
    }

    const collected: GatheredContactEmail[] = [];
    let scanned = 0;

    for (const ref of refs) {
      const raw = await getMessage(ref.id);
      if (!raw) {
        // getMessage a déjà loggé — on continue sans bloquer.
        continue;
      }
      scanned += 1;

      const from = (getHeader(raw, 'From') ?? '').toLowerCase();
      const direction: 'from' | 'to' = from.includes(normalized) ? 'from' : 'to';

      const subjectRaw = getHeader(raw, 'Subject') ?? '(sans objet)';
      const subject = truncate(subjectRaw.trim(), SUBJECT_MAX_CHARS);

      const bodyRaw = extractBodyPlain(raw);
      // Head + tail : la signature (rôle, société, téléphone) est en FIN de mail.
      // Tronquer uniquement le début la perdait → fiche sans coordonnées (bug S23/S24).
      const excerpt = headAndTail(collapseWhitespace(bodyRaw), EXCERPT_MAX_CHARS);

      collected.push({
        date: parseDate(raw.internalDate, getHeader(raw, 'Date')),
        subject,
        excerpt,
        direction,
      });
    }

    // Tri récent → ancien (date null en dernier).
    collected.sort((a, b) => {
      if (a.date === b.date) return 0;
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return b.date.localeCompare(a.date);
    });

    console.warn(
      `[contact-gatherer] ${normalized} : ${collected.length} emails compactés (scannés ${scanned})`,
    );
    return { emails: collected, scanned };
  } catch (err) {
    console.warn(
      `[contact-gatherer] échec scan ${normalized} : ${err instanceof Error ? err.message : String(err)}`,
    );
    return { emails: [], scanned: 0 };
  }
}

// ============================================================
// Helpers internes
// ============================================================

/**
 * Convertit l'`internalDate` Gmail (ms epoch en string) ou le header Date
 * en date ISO courte (YYYY-MM-DD). Retourne null si indéterminée.
 */
function parseDate(internalDate?: string, dateHeader?: string | null): string | null {
  if (internalDate) {
    const ms = Number(internalDate);
    if (Number.isFinite(ms) && ms > 0) {
      return new Date(ms).toISOString().slice(0, 10);
    }
  }
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return null;
}

/**
 * Effondre les espaces multiples / retours ligne en un seul espace.
 * Garde le texte lisible pour le LLM sans gonfler les tokens.
 */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Tronque une chaîne à `max` caractères avec une ellipse si dépassement.
 */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/**
 * Garde le DÉBUT et la FIN d'un texte (la signature vit en fin de mail).
 * Si le texte tient dans `max`, retourné tel quel. Sinon : ~60% tête + ~40%
 * queue, séparés par une ellipse.
 */
export function headAndTail(text: string, max: number): string {
  if (text.length <= max) return text;
  const SEP = ' […] ';
  const budget = Math.max(0, max - SEP.length);
  const headLen = Math.floor(budget * 0.6);
  const tailLen = budget - headLen;
  const head = text.slice(0, headLen).trimEnd();
  const tail = text.slice(text.length - tailLen).trimStart();
  return `${head}${SEP}${tail}`;
}
