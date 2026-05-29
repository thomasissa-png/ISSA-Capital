/**
 * Draft composer — Anya Jalon 5B.
 *
 * Génère un brouillon de réponse Gmail pour chaque email entrant
 * qui mérite une réponse (pas spam, pas newsletter).
 *
 * Pipeline :
 *   1. Lire la fiche contact (vault-reader TTL 1h) → tu/vous + registre
 *   2. Charger la tonalité Thomas (00. Me/01. Profil/voice-preferences.md, contenu complet sans frontmatter)
 *   3. Appeler le LLM (task email-draft, DeepSeek V4 Pro) pour rédiger le brouillon
 *   4. Garde « corps non vide » : si le LLM rend < 40 caractères → échec, pas de brouillon
 *   5. Créer le draft via Gmail API (drafts.create), rattaché au fil (threadId + In-Reply-To)
 *
 * Modèle LLM : routé via task 'email-draft' (rédaction texte, pas extraction JSON).
 * Fallback tonalité : DEFAULT_TONALITY hardcodé, aligné sur voice-preferences.md
 *   (mode dégradé si vault inaccessible — préserve le style Thomas).
 *
 * Spec: docs/session-memo-s15.md §5B + docs/orchestration-plan-s23-email-workflow.md.
 * S25 (2026-05-29) : la fiche `07. Contacts/02. Famille/Thomas Issa.md` n'a jamais
 *   existé — bascule vers `00. Me/01. Profil/voice-preferences.md` (source réelle
 *   du style Thomas). DEFAULT_TONALITY remonté à la hauteur du vault.
 */

import type { EmailMessage } from '../gmail-source/types';
import type { TriageResult } from '../triage/types';
import { createDraft } from '../gmail-source/gmail-client';
import { findContactCached, readVaultFile } from '../vault-reader';
import { parseObsidianFile } from '../vault-client/frontmatter';
import { callLLM } from '../llm/client';
import { loadSkill } from '../skills/skill-loader';
import type { SkillContext } from '../skills/types';

// ============================================================
// Constantes
// ============================================================

// S22 — rédaction de brouillon routée via `task:'email-draft'` (DeepSeek V4 Flash
// par défaut, override env LLM_TASK_OVERRIDE_EMAIL_DRAFT possible).

/** Timeout LLM */
const LLM_TIMEOUT_MS = 30_000;

/**
 * Longueur minimale du corps généré pour qu'un brouillon soit créé (S23).
 * En dessous, on considère que le LLM a échoué (corps vide ou « Bonjour » seul)
 * et on N'ENVOIE PAS le brouillon — pas de brouillon vide dans Gmail.
 */
const MIN_DRAFT_BODY_LENGTH = 40;

/** Catégories qui ne génèrent PAS de brouillon */
const SKIP_CATEGORIES = new Set(['spam', 'candidat']);

/**
 * Chemin vault de la fiche de préférences de communication de Thomas.
 * S25 (2026-05-29) : l'ancienne réf `07. Contacts/02. Famille/Thomas Issa.md`
 * était un chemin fantôme — la fiche n'a jamais existé. La vraie source de
 * tonalité est `00. Me/01. Profil/voice-preferences.md`, dont le contenu ENTIER
 * (sans le frontmatter) constitue la tonalité Thomas. La fiche `Thomas Issa.md`
 * du même dossier ne contient que parcours + projets, pas de section Tonalité.
 */
const TONALITY_FOLDER = '00. Me/01. Profil';
const TONALITY_FILENAME = 'voice-preferences.md';

/**
 * Cap soft de longueur pour le bloc tonalité injecté dans le system prompt.
 * 12000 caractères ≈ 3000 tokens — au-delà, on tronque + warn (un fichier de
 * tonalité qui explose finirait par cannibaliser le budget tokens du brouillon).
 */
const MAX_TONALITY_CHARS = 12_000;

/**
 * Fallback tonalité si vault inaccessible (mode dégradé).
 * S25 (2026-05-29) : remonté à la hauteur de `voice-preferences.md` pour que le
 * style Thomas survive même si le vault est down. Aligné sur la skill vault
 * `draft-email` v8 (registre + signature + anti-bullshit).
 */
const DEFAULT_TONALITY = `**Principe premier : Simplicité > Démonstration > Élégance.** Thomas ne veut pas impressionner — il veut exister.

## Ton de voix
Direct, exigeant, sans bullshit. Affirmations, pas justifications.

### Ce qui marche
- **Phrases courtes, factuelles.** "Trois fondateurs. Quarante ans de terrain." — pas "Nous avons l'honneur de..."
- **Affirmation sans justification.** "Nous investissons sur 30 ans." — pas "...car nous croyons que..."
- **Le factuel prime sur le narratif.** Chiffres et résultats, pas adjectifs.
- **Sobriété.** Premium par la substance, pas par le vocabulaire.
- **Honnêteté sur les limites.** "Je n'ai pas cette info" > inventer.

### Ce qui est banni
- **Remplissage défensif.** "Nous ne sommes pas un fonds...", "Ce n'est pas un consultant classique..." → JAMAIS.
- **Jargon abstrait.** "Synergie", "écosystème dynamique", "solution holistique" → INTERDIT.
- **Bullshit marketing.** "Leader du marché", "solution innovante", "partenaire de confiance" → BANNI.
- **Antithèses en série.** "On décide. Pas un calendrier de fonds." → anti-pattern.
- **Emojis** dans les livrables professionnels.
- **Le "trop littéraire/pompeux".**

### Registre
Vouvoiement systématique par défaut. En réponse à un email reçu où l'expéditeur tutoie Thomas ("tu", "ton", "te", "Salut Thomas", signature prénom seul), aligner sur son ton → tutoyer dans le brouillon. Le caractère pro/non pro est INDÉPENDANT du registre.

## Règle zéro-invention
Si un fait manque (chiffre, nom, date, montant), poser un marqueur \`[À COMPLÉTER : la question]\`. JAMAIS d'invention ni de placeholder flou.

## Signature (règle stricte)
Une ligne vide précède TOUJOURS la signature.
- **Contact NON professionnel** (famille, amis, locataires, autres — ~90 % des cas) : AUCUNE formule de clôture. Signer du seul prénom « Thomas ».
- **Contact professionnel** (fiche dans 07. Contacts/03. Pro/) : « Très cordialement, » puis « Thomas Issa » puis « 06 64 85 06 31 » à la ligne.
- **BANNI** : « Bien cordialement, » et toute variante (« Cordialement, », « Bien à vous, »…). Seule « Très cordialement, » est admise, et uniquement pour un contact professionnel.`;

// ============================================================
// Types
// ============================================================

export interface DraftResult {
  /** Brouillon créé avec succès */
  success: boolean;
  /** ID du brouillon Gmail */
  draftId?: string;
  /** URL directe vers le brouillon dans Gmail */
  gmailUrl?: string;
  /** Première ligne du brouillon (pour la notif Telegram) */
  preview?: string;
  /** Raison du skip (si pas de brouillon) */
  skipReason?: string;
  /** Erreur technique */
  error?: string;
}

/**
 * Fonction de création de brouillon, injectée par la source (Gmail ou Outlook).
 * Permet au composer de rester agnostique du fournisseur (multi-boîtes S23).
 */
export type DraftFn = (
  email: EmailMessage,
  subject: string,
  body: string,
) => Promise<{ success: boolean; draftId?: string; url?: string; error?: string }>;

/** Brouillon Gmail par défaut (compat + tests) — utilisé si aucune source injectée. */
const defaultGmailDraftFn: DraftFn = async (email, subject, body) => {
  const r = await createDraft({
    to: email.from.email,
    subject,
    body,
    threadId: email.threadId,
    inReplyTo: email.messageIdHeader,
  });
  return { success: r.success, draftId: r.draftId, url: r.gmailUrl, error: r.error };
};

interface TonalityContext {
  /** Tu ou vous */
  register: 'tu' | 'vous';
  /** Instructions tonalité complètes (de la fiche Thomas ou fallback) */
  instructions: string;
  /** Nom du contact (pour personnaliser le brouillon) */
  contactName?: string;
}

// ============================================================
// API publique
// ============================================================

/**
 * Compose et crée un brouillon Gmail pour un email entrant.
 *
 * Skip automatique pour : spam, candidat (pas de réponse auto).
 * Lit la fiche contact pour le registre tu/vous.
 * Lit la fiche Thomas pour la tonalité de rédaction.
 * Appelle Sonnet 4 pour rédiger le corps du brouillon.
 *
 * @param email Email source normalisé
 * @param triage Résultat du triage Haiku
 * @returns Résultat avec URL Gmail ou raison du skip
 */
export async function composeDraft(
  email: EmailMessage,
  triage: TriageResult,
  draftFn: DraftFn = defaultGmailDraftFn,
): Promise<DraftResult> {
  // 1. Skip si catégorie non éligible
  if (SKIP_CATEGORIES.has(triage.category)) {
    return {
      success: false,
      skipReason: `Catégorie "${triage.category}" — pas de brouillon`,
    };
  }

  try {
    // 2. Charger le contexte tonalité
    const tonality = await loadTonalityContext(email.from.email, triage);

    // 3. Générer le corps du brouillon via le LLM
    const draftBody = await generateDraftBody(email, triage, tonality);
    if (!draftBody) {
      return {
        success: false,
        error: 'Le LLM n\'a pas retourné de contenu pour le brouillon',
      };
    }

    // Garde « corps non vide » (S23) — un corps trop court (LLM qui a mangé son
    // budget en réflexion, ou « Bonjour » seul) = échec, PAS de brouillon vide.
    if (draftBody.trim().length < MIN_DRAFT_BODY_LENGTH) {
      console.warn(
        `[draft-composer] corps vide/trop court (${draftBody.trim().length} car.) — brouillon non créé`,
      );
      return {
        success: false,
        error: `Corps généré trop court (${draftBody.trim().length} < ${MIN_DRAFT_BODY_LENGTH} car.)`,
      };
    }

    // 4. Créer le brouillon de réponse via la source (Gmail threadId+In-Reply-To,
    //    ou Outlook createReply). Rattaché au fil dans les deux cas.
    const subject = buildReplySubject(email.subject);
    const draftRes = await draftFn(email, subject, draftBody);

    if (!draftRes.success) {
      return {
        success: false,
        error: `Création brouillon : ${draftRes.error ?? 'erreur inconnue'}`,
      };
    }

    // 5. Extraire la première ligne pour la preview Telegram
    const preview = draftBody.split('\n').find((l) => l.trim().length > 0) ?? '';

    return {
      success: true,
      draftId: draftRes.draftId,
      gmailUrl: draftRes.url,
      preview: preview.slice(0, 100),
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[draft-composer] erreur : ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

/**
 * Vérifie si un brouillon devrait être créé pour cette catégorie.
 * Exposé pour les tests.
 */
export function shouldComposeDraft(category: string): boolean {
  return !SKIP_CATEGORIES.has(category);
}

// ============================================================
// Chargement contexte tonalité
// ============================================================

/**
 * Charge le contexte tonalité pour la rédaction du brouillon.
 *
 * 1. Cherche la fiche contact dans le vault (via vault-reader cache TTL 1h)
 * 2. Extrait le champ tu/vous du frontmatter
 * 3. Charge la tonalité Thomas depuis voice-preferences.md (contenu complet)
 * 4. Si voice-preferences.md indisponible → fallback hardcodé
 */
async function loadTonalityContext(
  senderEmail: string,
  triage: TriageResult,
): Promise<TonalityContext> {
  // Valeurs par défaut
  let register: 'tu' | 'vous' = 'vous';
  let contactName: string | undefined = triage.matchedContact ?? undefined;

  // 1. Chercher la fiche contact
  try {
    const contact = await findContactCached(senderEmail);
    if (contact) {
      contactName = contact.name;

      // Extraire tu/vous du frontmatter
      const parsed = parseObsidianFile(contact.content);
      if (parsed.frontmatter) {
        const tutoiement = parsed.frontmatter.fields['tutoiement'];
        if (tutoiement === true || tutoiement === 'true') {
          register = 'tu';
        }
        // Aussi chercher le champ 'registre'
        const registreField = parsed.frontmatter.fields['registre'];
        if (typeof registreField === 'string') {
          if (registreField.toLowerCase().includes('tu')) {
            register = 'tu';
          }
        }
      }
    }
  } catch (err) {
    console.warn(
      `[draft-composer] erreur lecture fiche contact ${senderEmail} : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 2. Charger la tonalité depuis voice-preferences.md
  const instructions = await loadVoiceTonality();

  return { register, instructions, contactName };
}

/**
 * Charge la tonalité Thomas depuis `00. Me/01. Profil/voice-preferences.md`.
 * Le contenu ENTIER du fichier (sans le frontmatter YAML) est la tonalité —
 * on ne cherche pas de section spécifique, le fichier est dédié à ça.
 * Fallback : `DEFAULT_TONALITY` hardcodé si vault indisponible (mode dégradé).
 * S25 (2026-05-29) : ancienne réf `Thomas Issa.md` était un chemin fantôme.
 */
async function loadVoiceTonality(): Promise<string> {
  try {
    const result = await readVaultFile(TONALITY_FOLDER, TONALITY_FILENAME);
    if (result.success && result.content) {
      const parsed = parseObsidianFile(result.content);
      const body = parsed.body?.trim() ?? '';
      if (body.length > 20) {
        // Cap soft : si jamais le fichier dépasse 3000 tokens (~12000 chars),
        // on tronque + warn pour préserver le budget tokens du brouillon.
        if (body.length > MAX_TONALITY_CHARS) {
          console.warn(
            `[draft-composer] tonalité tronquée (${body.length} > ${MAX_TONALITY_CHARS} chars)`,
          );
          return body.slice(0, MAX_TONALITY_CHARS);
        }
        return body;
      }
    }
  } catch (err) {
    console.warn(
      `[draft-composer] fiche ${TONALITY_FILENAME} indisponible : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  console.warn('[draft-composer] fallback tonalité par défaut');
  return DEFAULT_TONALITY;
}

// ============================================================
// Génération du brouillon via Sonnet
// ============================================================

/**
 * Appelle le LLM (DeepSeek V4 Pro via task 'email-draft') pour rédiger le corps du brouillon.
 */
async function generateDraftBody(
  email: EmailMessage,
  triage: TriageResult,
  tonality: TonalityContext,
): Promise<string | null> {
  // S21.2 — system prompt = SKILL.md vault `draft-email` + contexte dynamique
  // (registre tu/vous, tonalité Thomas, contact). Le vault est la SOT.
  // Si le vault est down, fallback repo docs/ia/skills/draft-email/SKILL.md.
  let skillCtx: SkillContext | null = null;
  try {
    skillCtx = await loadSkill('draft-email');
  } catch (err) {
    console.warn(
      `[draft-composer] loadSkill('draft-email') KO — fallback prompt hardcodé : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const systemPrompt = buildSystemPrompt(tonality, skillCtx);
  const userMessage = buildUserMessage(email, triage, tonality);

  try {
    // Sortie texte libre (corps d'email), pas de JSON → pas de responseFormat.
    const { text } = await callLLM({
      task: 'email-draft',
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      // S23 — 2048 : marge pour que le modèle ne tronque pas un brouillon complet.
      maxTokens: 2048,
      timeoutMs: LLM_TIMEOUT_MS,
    });
    return text || null;
  } catch (err) {
    console.warn(
      `[draft-composer] Sonnet erreur : ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Construit le system prompt pour la rédaction du brouillon.
 *
 * S21.2 — Stratégie :
 *  - Si `skillCtx` fourni (SKILL.md vault chargé) : le markdown vault forme
 *    le préambule (identité + red lines + arbre décision + critères qualité),
 *    et on ajoute en SUFFIXE le contexte dynamique runtime (registre tu/vous,
 *    tonalité Thomas extraite de `voice-preferences.md`).
 *  - Si `skillCtx` null (vault ET fallback repo down) : fallback hardcodé
 *    historique (préserve la résilience en mode dégradé).
 *
 * Le contexte dynamique reste injecté côté code car le SKILL.md vault ne peut
 * pas connaître le contact runtime ni la tonalité courante de Thomas.
 */
function buildSystemPrompt(
  tonality: TonalityContext,
  skillCtx: SkillContext | null,
): string {
  const dynamicSuffix = `

## Registre
${tonality.register === 'tu' ? 'Tutoiement. Tu tutoies le destinataire.' : 'Vouvoiement systématique. Tu vouvoies le destinataire.'}

## Tonalité Thomas
${tonality.instructions}`;

  if (skillCtx) {
    const parts: string[] = [];
    parts.push(`# Skill : ${skillCtx.name}`);
    parts.push(`> Source : ${skillCtx.vaultPath}`);
    parts.push('');
    parts.push("Tu es l'assistant de rédaction de Thomas Issa, dirigeant d'ISSA Capital (holding patrimoniale familiale, immobilier résidentiel en Île-de-France). Tu rédiges des brouillons de réponse email que Thomas relira et enverra manuellement.");
    parts.push('');
    if (skillCtx.redLines) {
      parts.push('## Red lines');
      parts.push(skillCtx.redLines);
      parts.push('');
    }
    if (skillCtx.decisionTree) {
      parts.push('## Arbre de décision');
      parts.push(skillCtx.decisionTree);
      parts.push('');
    }
    if (skillCtx.example) {
      parts.push('## Exemple');
      parts.push(skillCtx.example);
      parts.push('');
    }
    return parts.join('\n').trim() + dynamicSuffix;
  }

  // Fallback ultime — vault ET repo down.
  return `Tu es Anya, l'assistante personnelle de Thomas Issa, dirigeant d'ISSA Capital (holding patrimoniale familiale, immobilier résidentiel en Île-de-France).

Tu rédiges des brouillons de réponse email que Thomas relira et enverra manuellement. Le brouillon doit être prêt à envoyer tel quel, mais Thomas peut le modifier.

## Règles de rédaction
- Le périmètre couvre PRO ET PERSO sans distinction — locataires, famille, amis, partenaires d'affaires.
- Phrases courtes et directes. Pas de formules creuses ("j'espère que vous allez bien", "je me permets de", "n'hésitez pas à").
- Répondre précisément à la demande. Si tu ne sais pas, propose à Thomas de compléter avec un marqueur [À COMPLÉTER].
- Ne JAMAIS inventer de dates, montants, noms de biens, ou informations factuelles non présentes dans l'email source.
- Signature (une ligne vide AVANT) : contact NON professionnel (famille/amis/locataires/autres) → aucune formule de clôture, signer "Thomas" (prénom seul) ; contact professionnel → "Très cordialement," / "Thomas Issa" / "06 64 85 06 31". JAMAIS "Bien cordialement," ni variante ("Cordialement,", "Bien à vous,") — seule "Très cordialement," est admise, en formel uniquement.
- Format : texte brut, pas de HTML, pas de markdown.
- Longueur : 3 à 10 lignes maximum. Plus court = mieux.
- Si l'email source contient une question à laquelle seul Thomas peut répondre (montant, date, décision), écrire le brouillon avec un marqueur [À COMPLÉTER : question] pour que Thomas sache quoi remplir.` + dynamicSuffix;
}

/**
 * Construit le message utilisateur avec le contexte de l'email.
 */
function buildUserMessage(
  email: EmailMessage,
  triage: TriageResult,
  tonality: TonalityContext,
): string {
  const lines: string[] = [];

  lines.push('## Email reçu');
  lines.push(`De : ${email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email}`);
  lines.push(`Objet : ${email.subject}`);
  lines.push(`Date : ${email.receivedAt instanceof Date ? email.receivedAt.toISOString().slice(0, 10) : String(email.receivedAt).slice(0, 10)}`);
  lines.push('');
  lines.push('Corps :');
  // Tronquer le body à 2000 caractères pour ne pas dépasser le budget tokens
  const body = email.bodyPlain.length > 2000
    ? `${email.bodyPlain.slice(0, 2000)}\n[... tronqué]`
    : email.bodyPlain;
  lines.push(body);
  lines.push('');

  lines.push('## Contexte triage');
  lines.push(`Catégorie : ${triage.category}`);
  lines.push(`Intent : ${triage.intent}`);
  lines.push(`Résumé : ${triage.summary}`);
  if (tonality.contactName) {
    lines.push(`Contact identifié : ${tonality.contactName}`);
  }
  lines.push('');

  lines.push('## Consigne');
  lines.push('Rédige le brouillon de réponse. Texte brut uniquement, prêt à envoyer. Pas de préambule, pas d\'explication — juste le corps de l\'email de réponse.');

  return lines.join('\n');
}

// ============================================================
// Utilitaires
// ============================================================

/**
 * Construit le sujet de la réponse (ajoute "Re: " si absent).
 */
function buildReplySubject(originalSubject: string): string {
  const trimmed = originalSubject.trim();
  if (/^re\s*:/i.test(trimmed)) {
    return trimmed;
  }
  return `Re: ${trimmed}`;
}
