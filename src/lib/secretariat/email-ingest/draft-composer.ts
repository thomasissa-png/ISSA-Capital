/**
 * Draft composer — Anya Jalon 5B.
 *
 * Génère un brouillon de réponse Gmail pour chaque email entrant
 * qui mérite une réponse (pas spam, pas newsletter).
 *
 * Pipeline :
 *   1. Lire la fiche contact (vault-reader TTL 1h) → tu/vous + registre
 *   2. Charger la tonalité Thomas (fiche Thomas Issa.md → section Tonalité)
 *   3. Appeler Sonnet 4 pour rédiger le brouillon
 *   4. Créer le draft via Gmail API (drafts.create)
 *   5. Retourner l'URL Gmail pour le bouton Telegram
 *
 * Modèle LLM : Sonnet 4 (rédaction texte, pas extraction JSON).
 * Fallback tonalité : vouvoiement, ton professionnel chaleureux,
 *   courte signature « Thomas Issa ».
 *
 * Spec: docs/session-memo-s15.md §5B.
 */

import type { EmailMessage } from '../gmail-source/types';
import type { TriageResult } from '../triage/types';
import { createDraft } from '../gmail-source/gmail-client';
import { findContactCached, readVaultFile } from '../vault-reader';
import { parseObsidianFile } from '../vault-client/frontmatter';
import { callAnthropic } from '../llm/client';
import { SONNET_4 } from '../llm/models';
import { loadSkill } from '../skills/skill-loader';
import type { SkillContext } from '../skills/types';

// ============================================================
// Constantes
// ============================================================

/** Modèle pour la rédaction de brouillons */
const SONNET_MODEL = SONNET_4;

/** Timeout API Anthropic */
const ANTHROPIC_TIMEOUT_MS = 30_000;

/** Catégories qui ne génèrent PAS de brouillon */
const SKIP_CATEGORIES = new Set(['spam', 'candidat']);

/** Chemin vault de la fiche Thomas Issa */
const THOMAS_FICHE_FOLDER = '07. Contacts/02. Famille';
const THOMAS_FICHE_FILENAME = 'Thomas Issa.md';

/** Fallback tonalité si fiche Thomas indisponible */
const DEFAULT_TONALITY = `Vouvoiement systématique. Ton professionnel et chaleureux. Phrases courtes et directes. Pas de formules creuses. Signature courte : "Thomas Issa".`;

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

    // 3. Générer le corps du brouillon via Sonnet
    const draftBody = await generateDraftBody(email, triage, tonality);
    if (!draftBody) {
      return {
        success: false,
        error: 'Sonnet n\'a pas retourné de contenu pour le brouillon',
      };
    }

    // 4. Créer le brouillon Gmail
    const subject = buildReplySubject(email.subject);
    const gmailResult = await createDraft({
      to: email.from.email,
      subject,
      body: draftBody,
      threadId: extractThreadId(email),
      inReplyTo: extractMessageId(email),
    });

    if (!gmailResult.success) {
      return {
        success: false,
        error: `Gmail API : ${gmailResult.error ?? 'erreur inconnue'}`,
      };
    }

    // 5. Extraire la première ligne pour la preview Telegram
    const preview = draftBody.split('\n').find((l) => l.trim().length > 0) ?? '';

    return {
      success: true,
      draftId: gmailResult.draftId,
      gmailUrl: gmailResult.gmailUrl,
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
 * 3. Charge la section Tonalité de la fiche Thomas Issa.md
 * 4. Si fiche Thomas indisponible → fallback hardcodé
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

  // 2. Charger la tonalité depuis la fiche Thomas
  const instructions = await loadThomasTonality();

  return { register, instructions, contactName };
}

/**
 * Charge la section Tonalité de la fiche Thomas Issa.md.
 * Fallback : instructions hardcodées si fiche indisponible.
 */
async function loadThomasTonality(): Promise<string> {
  try {
    const result = await readVaultFile(THOMAS_FICHE_FOLDER, THOMAS_FICHE_FILENAME);
    if (result.success && result.content) {
      // Extraire la section ## Tonalité
      const tonalitySection = extractSection(result.content, 'Tonalité');
      if (tonalitySection && tonalitySection.trim().length > 20) {
        return tonalitySection.trim();
      }
    }
  } catch (err) {
    console.warn(
      `[draft-composer] fiche Thomas Issa.md indisponible : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  console.warn('[draft-composer] fallback tonalité par défaut');
  return DEFAULT_TONALITY;
}

/**
 * Extrait le contenu d'une section ## d'un fichier Markdown.
 * Retourne le contenu entre le heading et le prochain heading de même niveau ou supérieur.
 */
function extractSection(content: string, sectionName: string): string | null {
  const lines = content.split('\n');
  let capturing = false;
  const captured: string[] = [];

  for (const line of lines) {
    if (capturing) {
      // Arrêter si on atteint un heading de niveau 2 ou supérieur
      if (/^##\s/.test(line)) {
        break;
      }
      captured.push(line);
    } else if (line.match(new RegExp(`^##\\s+${sectionName}\\s*$`, 'i'))) {
      capturing = true;
    }
  }

  return captured.length > 0 ? captured.join('\n') : null;
}

// ============================================================
// Génération du brouillon via Sonnet
// ============================================================

/**
 * Appelle Sonnet 4 pour rédiger le corps du brouillon.
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
    const { text } = await callAnthropic({
      family: 'sonnet',
      modelOverride: SONNET_MODEL,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
      timeoutMs: ANTHROPIC_TIMEOUT_MS,
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
 *    tonalité Thomas extraite de la fiche `Thomas Issa.md`).
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
  return `Tu es l'assistant de rédaction de Thomas Issa, dirigeant d'ISSA Capital (holding patrimoniale familiale, immobilier résidentiel en Île-de-France).

Tu rédiges des brouillons de réponse email que Thomas relira et enverra manuellement. Le brouillon doit être prêt à envoyer tel quel, mais Thomas peut le modifier.

## Règles de rédaction
- Phrases courtes et directes. Pas de formules creuses ("j'espère que vous allez bien", "je me permets de", "n'hésitez pas à").
- Répondre précisément à la demande. Si tu ne sais pas, propose à Thomas de compléter avec un marqueur [À COMPLÉTER].
- Ne JAMAIS inventer de dates, montants, noms de biens, ou informations factuelles non présentes dans l'email source.
- Signature : "Thomas Issa" (pas de titre, pas de numéro de téléphone, pas de formule de politesse longue).
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

/**
 * Extrait le threadId depuis un EmailMessage.
 * Le rawRef contient l'URL Gmail qui inclut le messageId,
 * mais le threadId n'est pas directement dans EmailMessage.
 * On retourne undefined — le threadId sera résolu par Gmail API
 * via le header In-Reply-To.
 */
function extractThreadId(_email: EmailMessage): string | undefined {
  // EmailMessage ne contient pas le threadId directement.
  // Gmail API résoudra le fil via In-Reply-To.
  return undefined;
}

/**
 * Extrait le Message-ID (header RFC 2822) depuis le rawRef.
 * Le rawRef est l'URL Gmail, pas le Message-ID.
 * On retourne undefined — les drafts sans In-Reply-To
 * seront des réponses autonomes.
 */
function extractMessageId(_email: EmailMessage): string | undefined {
  // EmailMessage ne contient pas le header Message-ID.
  // Le draft sera créé sans In-Reply-To.
  return undefined;
}
