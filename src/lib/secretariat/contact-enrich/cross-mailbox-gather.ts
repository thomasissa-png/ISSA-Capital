/**
 * Rassemblement cross-boîtes des emails d'un contact (S24, enrichissement).
 *
 * Combine les 3 sources de Thomas EN PARALLÈLE — Gmail + Outlook Sarani +
 * Outlook Versi — pour qu'une fiche créée sur un expéditeur inconnu soit
 * enrichie même si l'historique est dans une boîte Outlook (pas Gmail).
 *
 * 🔒 LECTURE SEULE (règle 11) : n'appelle que des endpoints de lecture/recherche.
 *
 * Robustesse : chaque source a son propre timeout ; une source lente/KO
 * contribue 0 email sans bloquer les autres (allSettled + cap global).
 * Ne throw jamais.
 */

import {
  gatherContactEmails,
  headAndTail,
  type GatheredContactEmail,
} from '../gmail-source/contact-emails-gatherer';
import {
  OUTLOOK_BOXES,
  isBoxConfigured,
  searchMessagesByAddress,
  type GraphMessage,
} from '../outlook-source/outlook-client';

export interface GatherAllSourcesResult {
  emails: GatheredContactEmail[];
  /** Nombre total de messages réellement collectés (toutes sources). */
  scanned: number;
  /** Sources qui ont contribué au moins un email (gmail, outlook:sarani, …). */
  sources: string[];
}

export interface GatherAllSourcesOptions {
  /** Cap d'emails retournés (défaut ENRICH_MAX_EMAILS ou 10). */
  cap?: number;
  /** Timeout par source en ms (défaut ENRICH_TIMEOUT_MS ou 30000). */
  timeoutMs?: number;
}

const EXCERPT_MAX_CHARS = 600;
const SUBJECT_MAX_CHARS = 200;

function defaultCap(): number {
  const n = Number(process.env.ENRICH_MAX_EMAILS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}
function defaultTimeout(): number {
  const n = Number(process.env.ENRICH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30_000;
}

/** Exécute `p` avec un timeout ; en cas de dépassement, résout `fallback`. */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => {
      console.warn(`[cross-mailbox-gather] timeout ${ms}ms sur ${label} — source ignorée`);
      resolve(fallback);
    }, ms);
    p.then((v) => {
      clearTimeout(timer);
      resolve(v);
    }).catch((err) => {
      clearTimeout(timer);
      console.warn(
        `[cross-mailbox-gather] échec ${label} : ${err instanceof Error ? err.message : String(err)}`,
      );
      resolve(fallback);
    });
  });
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function graphDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Mappe un message Graph Outlook vers le format compact partagé. */
function mapGraphMessage(m: GraphMessage, senderEmail: string): GatheredContactEmail {
  const fromAddr = (m.from?.emailAddress?.address ?? '').toLowerCase();
  const direction: 'from' | 'to' = fromAddr.includes(senderEmail) ? 'from' : 'to';
  const subject = (m.subject ?? '(sans objet)').trim().slice(0, SUBJECT_MAX_CHARS);
  const bodyRaw = m.body?.content ?? m.bodyPreview ?? '';
  const excerpt = headAndTail(collapseWhitespace(bodyRaw), EXCERPT_MAX_CHARS);
  return { date: graphDate(m.receivedDateTime), subject, excerpt, direction };
}

/**
 * Rassemble les emails d'un contact depuis les 3 boîtes. Trie récent → ancien,
 * cap global. Ne throw jamais.
 */
export async function gatherContactEmailsAllSources(
  senderEmail: string,
  opts: GatherAllSourcesOptions = {},
): Promise<GatherAllSourcesResult> {
  const normalized = senderEmail.trim().toLowerCase();
  if (!normalized.includes('@')) {
    return { emails: [], scanned: 0, sources: [] };
  }

  const cap = opts.cap ?? defaultCap();
  const timeoutMs = opts.timeoutMs ?? defaultTimeout();

  // Gmail (gatherer existant : from: OR to:, head+tail).
  const gmailP = withTimeout(
    gatherContactEmails(normalized, cap),
    timeoutMs,
    { emails: [], scanned: 0 },
    'gmail',
  );

  // Outlook : une recherche par boîte configurée.
  const outlookBoxes = OUTLOOK_BOXES.filter((b) => isBoxConfigured(b));
  const outlookPs = outlookBoxes.map((box) =>
    withTimeout(
      searchMessagesByAddress(box, normalized, cap),
      timeoutMs,
      [] as GraphMessage[],
      `outlook:${box}`,
    ).then((msgs) => ({ box, msgs })),
  );

  const [gmail, ...outlookResults] = await Promise.all([gmailP, ...outlookPs]);

  const sources: string[] = [];
  let scanned = 0;
  const merged: GatheredContactEmail[] = [];

  if (gmail.emails.length > 0) sources.push('gmail');
  scanned += gmail.scanned;
  merged.push(...gmail.emails);

  for (const { box, msgs } of outlookResults) {
    if (msgs.length > 0) sources.push(`outlook:${box}`);
    scanned += msgs.length;
    merged.push(...msgs.map((m) => mapGraphMessage(m, normalized)));
  }

  // Dédup (date|direction|début du sujet) — un même fil peut remonter 2× .
  const seen = new Set<string>();
  const deduped = merged.filter((e) => {
    const key = `${e.date ?? ''}|${e.direction}|${e.subject.slice(0, 60).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Tri récent → ancien (date null en dernier), puis cap global.
  deduped.sort((a, b) => {
    if (a.date === b.date) return 0;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return b.date.localeCompare(a.date);
  });

  const emails = deduped.slice(0, cap);
  console.warn(
    `[cross-mailbox-gather] ${normalized} : ${emails.length} emails (sources: ${sources.join(', ') || 'aucune'}, scannés ${scanned})`,
  );
  return { emails, scanned, sources };
}
