/**
 * Synthèse de fiche contact enrichie depuis N emails (S23).
 *
 * À partir des emails rassemblés par `gatherContactEmails`, un LLM (tâche
 * `contact-fiche` → DeepSeek V4 Flash, extraction lean) extrait les infos clés
 * d'un contact : nom complet probable, rôle, société, sujets récurrents,
 * coordonnées repérées. Le résultat structuré (JSON) est ensuite rendu en
 * markdown de fiche (frontmatter + corps) cohérent avec le format existant.
 *
 * 🔒 ZÉRO INVENTION (gate G1) : le prompt impose de n'extraire QUE ce qui est
 * littéralement présent dans les emails. Tout champ inconnu = omis (frontmatter
 * laissé vide, comme le stub) — jamais deviné.
 *
 * Ne throw jamais côté API publique : en cas d'échec (LLM KO, JSON invalide,
 * scan vide), retourne `null` → l'appelant retombe sur le stub mono-email.
 */

import { callLLM } from '../llm/client';
import type { GatheredContactEmail } from '../gmail-source/contact-emails-gatherer';
import type { ContactType } from './no-match-card';
import { renderFicheContent, type FicheRenderData } from './fiche-renderer';

// ============================================================
// Types
// ============================================================

/**
 * Infos clés extraites par le LLM. Tout champ est optionnel : seul ce qui est
 * présent dans les emails est rempli (zéro invention).
 */
export interface ContactFicheData {
  /** Nom complet probable (depuis signature / header From). */
  nomComplet?: string;
  /** Rôle / fonction (ex: "Directeur commercial"). */
  role?: string;
  /** Société / organisation. */
  societe?: string;
  /** Sujets / dossiers récurrents abordés dans les échanges. */
  sujets?: string[];
  /** Numéro(s) de téléphone repéré(s). */
  telephone?: string;
  /** Autre adresse email repérée (≠ celle de l'expéditeur). */
  autreEmail?: string;
  /** Langue / registre dominant (ex: "français, registre formel"). */
  langue?: string;
  /** Mentions repérées dans le nom mais NON intégrées (codes type « OMS »). */
  nameNotes?: string;
}

export interface ContactFicheSynthInput {
  /** Adresse email de l'expéditeur (source du scan). */
  senderEmail: string;
  /** Nom de l'expéditeur tel que vu dans le header From (peut être null). */
  nameFrom: string | null;
  /** Type de contact choisi par Thomas (pilote la catégorie frontmatter). */
  type: ContactType;
  /** Emails rassemblés par le scan (déjà compactés). */
  emails: GatheredContactEmail[];
  /** Référence du thread email d'origine (pour la 1re ligne d'historique). */
  emailThreadRef: string;
}

// ============================================================
// Constantes
// ============================================================

const SYSTEM_PROMPT = `Tu es Anya, l'assistante personnelle de Thomas Issa. Tu enrichis la fiche d'un contact (pro ou perso) à partir des emails échangés avec lui — pour que le contexte de Thomas reste à jour automatiquement.

RÈGLE ABSOLUE — ZÉRO INVENTION : n'extrais QUE ce qui est littéralement écrit dans les emails (signatures, en-têtes, corps). Si une information est absente, OMETS le champ. N'invente JAMAIS un rôle, une société, un numéro, un sujet, un nom.

Exemple :
- Signature « Marc Gernot — Directeur commercial, Acme Co » → {"nomComplet": "Marc Gernot", "role": "Directeur commercial", "societe": "Acme Co"}
- Email d'un cousin sans signature → {"langue": "français informel"} (rien d'autre).

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown autour, champs tous optionnels (omettre si inconnu) :
{
  "nomComplet": "string si visible",
  "role": "string si mentionné",
  "societe": "string si mentionnée",
  "sujets": ["string"] (max 5, dossiers récurrents),
  "telephone": "string si en signature",
  "autreEmail": "string si différent de l'expéditeur",
  "langue": "string (ex: français formel, anglais professionnel, français familial)"
}`;

const TIMEOUT_MS = 30_000;
const MAX_TOKENS = 1024;

// ============================================================
// API publique — synthèse
// ============================================================

/**
 * Synthétise les infos clés d'un contact depuis ses emails via le LLM.
 *
 * @returns Les données extraites, ou `null` si le scan est vide, le LLM échoue,
 *   ou le JSON est inexploitable. Ne throw jamais.
 */
export async function synthesizeContactFiche(
  input: ContactFicheSynthInput,
): Promise<ContactFicheData | null> {
  if (input.emails.length === 0) {
    return null;
  }

  const userPrompt = buildUserPrompt(input);

  try {
    const result = await callLLM({
      task: 'contact-fiche',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: MAX_TOKENS,
      responseFormat: 'json',
      timeoutMs: TIMEOUT_MS,
    });

    const data = parseFicheJson(result.text);
    if (!data) {
      console.warn('[contact-fiche-synth] JSON LLM inexploitable — fallback stub');
      return null;
    }
    return data;
  } catch (err) {
    console.warn(
      `[contact-fiche-synth] échec synthèse : ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

// ============================================================
// Rendu markdown
// ============================================================

/**
 * Rend une fiche contact markdown enrichie (frontmatter + corps) à partir des
 * données synthétisées. Format aligné sur le stub existant (callback-handler)
 * mais avec les champs remplis quand connus + une section Synthèse.
 *
 * @param data Données extraites par le LLM (champs inconnus omis).
 * @param ctx Contexte de création (email, nom, type, date, ref thread).
 * @param scannedCount Nombre d'emails scannés (pour la note d'historique).
 */
export function renderEnrichedFiche(
  data: ContactFicheData,
  ctx: {
    senderEmail: string;
    nameFrom: string | null;
    type: ContactType;
    today: string;
    emailThreadRef: string;
    /** Sources ayant contribué (gmail, outlook:sarani…) — note d'historique. */
    sources?: string[];
    /** Contexte libre fourni par Thomas via reply Telegram avant son clic (S24 soir). */
    userContext?: string | null;
  },
  scannedCount: number,
): { displayName: string; content: string } {
  // Nom d'affichage : priorité au nom synthétisé, puis header From, puis local-part.
  const displayName =
    sanitizeLine(data.nomComplet) ??
    sanitizeLine(ctx.nameFrom) ??
    fallbackNameFromEmail(ctx.senderEmail);

  const sujets = (data.sujets ?? [])
    .map((s) => sanitizeLine(s))
    .filter((s): s is string => s !== null)
    .slice(0, 5);

  // S25 (2026-05-29) : rendu délégué au helper `fiche-renderer.ts` aligné sur
  // les templates `Contact pro.md` / `Contact relationnel.md` du vault. Avant :
  // frontmatter et sections divergeaient du template (champs manquants,
  // sections hors-template, etc.).
  const renderData: FicheRenderData = {
    displayName,
    societe: sanitizeLine(data.societe) ?? undefined,
    role: sanitizeLine(data.role) ?? undefined,
    email: ctx.senderEmail,
    telephone: sanitizeLine(data.telephone) ?? undefined,
    langue: sanitizeLine(data.langue) ?? undefined,
    rencontreVia: 'Email',
    sujets: sujets.length > 0 ? sujets : undefined,
    autreEmail: sanitizeLine(data.autreEmail) ?? undefined,
    nameNotes: sanitizeLine(data.nameNotes) ?? undefined,
    userContext: ctx.userContext ?? undefined,
  };

  const sourcesNote =
    ctx.sources && ctx.sources.length > 0 ? ` (sources : ${ctx.sources.join(', ')})` : '';
  const historiqueContent =
    `Fiche enrichie à partir de ${scannedCount} email${scannedCount > 1 ? 's' : ''} ` +
    `de l'expéditeur${sourcesNote}. ${ctx.emailThreadRef}`;

  const content = renderFicheContent(ctx.type, renderData, {
    today: ctx.today,
    historiqueTitle: 'Fiche créée (synthèse emails)',
    historiqueContent,
  });

  return { displayName, content };
}

// ============================================================
// Helpers internes
// ============================================================

/**
 * Construit le prompt utilisateur : nom/email connus + liste des emails.
 */
function buildUserPrompt(input: ContactFicheSynthInput): string {
  const header = [
    `Expéditeur : ${input.nameFrom ?? '(nom inconnu)'} <${input.senderEmail}>`,
    `Nombre d'emails analysés : ${input.emails.length}`,
    '',
    'Emails (du plus récent au plus ancien) :',
    '',
  ];

  const body = input.emails.map((e, i) => {
    const dir = e.direction === 'from' ? 'Reçu de lui' : 'Écrit à lui';
    return [
      `--- Email ${i + 1} (${dir}, ${e.date ?? 'date inconnue'}) ---`,
      `Objet : ${e.subject}`,
      `Extrait : ${e.excerpt || '(corps vide)'}`,
    ].join('\n');
  });

  return [...header, body.join('\n\n')].join('\n');
}

/**
 * Parse le JSON renvoyé par le LLM (tolère un bloc ```json``` ou objet brut).
 * Retourne null si rien d'exploitable. Ne conserve que les champs attendus,
 * typés et nettoyés.
 */
function parseFicheJson(raw: string): ContactFicheData | null {
  if (!raw) return null;
  // DeepSeek peut emballer la sortie : bloc de raisonnement <think>…</think>,
  // fence ```json, prose autour. On nettoie avant d'extraire l'objet.
  const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const blockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidate =
    blockMatch?.[1]?.trim() ?? cleaned.match(/\{[\s\S]*\}/)?.[0]?.trim() ?? null;
  if (!candidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    // Tolérance virgules traînantes (`,}` / `,]`) — erreur DeepSeek fréquente.
    try {
      parsed = JSON.parse(candidate.replace(/,(\s*[}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const data: ContactFicheData = {};

  const str = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  };

  const nomComplet = str(obj['nomComplet']);
  if (nomComplet) data.nomComplet = nomComplet;
  const role = str(obj['role']);
  if (role) data.role = role;
  const societe = str(obj['societe']);
  if (societe) data.societe = societe;
  const telephone = str(obj['telephone']);
  if (telephone) data.telephone = telephone;
  const autreEmail = str(obj['autreEmail']);
  if (autreEmail) data.autreEmail = autreEmail;
  const langue = str(obj['langue']);
  if (langue) data.langue = langue;

  if (Array.isArray(obj['sujets'])) {
    const sujets = obj['sujets']
      .map((s) => str(s))
      .filter((s): s is string => s !== undefined);
    if (sujets.length > 0) data.sujets = sujets;
  }

  // Une fiche vide (LLM n'a rien trouvé) ne vaut pas mieux que le stub.
  return Object.keys(data).length > 0 ? data : null;
}

/**
 * Nettoie une valeur pour une ligne de frontmatter/markdown : retire les retours
 * ligne (qui casseraient le YAML) et trim. Retourne null si vide/absent.
 */
function sanitizeLine(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Fallback nom depuis le local-part de l'email (aligné callback-handler).
 */
function fallbackNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'inconnu';
  return (
    local
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || 'Inconnu'
  );
}
