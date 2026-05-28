/**
 * Polissage du contexte libre fourni par Thomas (reply Telegram) avant
 * insertion dans une fiche contact (S24 nuit).
 *
 * Reformule pour un ton de fiche (neutre, factuel, 3e personne, paragraphes
 * courts) — JAMAIS d'invention : aucune information absente du texte original
 * ne doit apparaître dans la sortie. Si le LLM échoue ou suspecte d'invention,
 * fallback transparent sur le texte brut (la création de fiche n'est jamais
 * bloquée par ce polissage).
 *
 * Tâche LLM : `contact-context-polish` (Haiku 4.5, override env possible).
 */

import { callLLM } from '../llm/client';
import type { ContactType } from '../telegram-validation/no-match-card';

const TIMEOUT_MS = 15_000;
// S24 nuit (post-audit) : bumpé de 512 → 2048 pour laisser de la marge sur les
// contextes longs. Avec Haiku le polish a un ratio ~1:1 à 1:1.3 vs l'input,
// donc 2048 tokens ≈ 5-6k caractères de sortie, largement assez pour les
// notes Thomas (dictée vocale, paragraphes). Toujours protégé par la
// détection de troncature ci-dessous (fallback brut si polish suspect).
const MAX_TOKENS = 2048;

/** Texte trop court (< 8 car. utiles) → on retourne tel quel, pas la peine
 * de payer un LLM ni de risquer une reformulation maladroite. */
const MIN_LENGTH_TO_POLISH = 8;

/**
 * Détecte si le polish a probablement été TRONQUÉ par le cap MAX_TOKENS,
 * auquel cas on perd la fin du texte de Thomas (violation directe de la red
 * line « préserver TOUTES les infos »). Heuristique : fin abrupte sans
 * ponctuation finale (ni `.`, `!`, `?`, `:`, ni fin de bloc markdown).
 */
function looksTruncated(text: string): boolean {
  const trimmed = text.trimEnd();
  if (trimmed.length === 0) return false;
  const lastChar = trimmed[trimmed.length - 1]!;
  return !/[.!?:")\]'»]/u.test(lastChar);
}

const SYSTEM_PROMPT = `Tu reformules une note libre que Thomas a écrite à propos d'un contact qu'il vient d'ajouter à son répertoire, pour qu'elle s'intègre dans la section "## Qui c'est" de la fiche.

RÈGLES ABSOLUES :
1. **ZÉRO invention** : n'ajoute AUCUNE information qui n'est pas explicitement dans le texte de Thomas. Pas de société, pas de rôle, pas de lien, pas de jugement non présents. Si Thomas n'a pas dit où la personne habite, ne le devine pas.
2. **Préserve TOUTES les informations** du texte original. Tu reformules, tu ne résumes ni ne supprimes des faits.
3. **3e personne, ton neutre/factuel** : transforme "je l'ai rencontré chez X" → "rencontré chez X". Pas de "je", "moi", "mon", "j'ai" (sauf si la personne décrite parle d'elle-même, ce qui n'arrivera pas).
4. **Format** : 1 à 3 paragraphes courts, markdown léger autorisé (gras pour les noms-clés, listes si plusieurs items distincts). Pas de titre H1/H2 (on est déjà dans une section).
5. **Si le texte est déjà bien formulé pour une fiche**, retourne-le quasi tel quel (corrections orthographe/ponctuation uniquement).

Réponds UNIQUEMENT avec le texte reformulé, SANS préambule, SANS guillemets autour, SANS commentaire.`;

export interface PolishUserContextInput {
  /** Texte brut écrit par Thomas (reply Telegram). */
  rawText: string;
  /** Nom du contact (affichage : « Marc Gernot ») pour donner le contexte au LLM. */
  contactName: string;
  /** Type de contact choisi (pro / famille / amis / autres). */
  type: ContactType;
}

/**
 * Polit le texte. Ne throw jamais : sur échec LLM, timeout, ou texte trop
 * court, retourne le texte original (fallback gracieux).
 */
export async function polishUserContext(input: PolishUserContextInput): Promise<string> {
  const raw = input.rawText.trim();
  if (raw.length < MIN_LENGTH_TO_POLISH) return raw;

  const userPrompt = [
    `Contact : ${input.contactName} (catégorie : ${input.type})`,
    '',
    'Note libre de Thomas :',
    raw,
  ].join('\n');

  try {
    const { text } = await callLLM({
      task: 'contact-context-polish',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: MAX_TOKENS,
      timeoutMs: TIMEOUT_MS,
    });
    const polished = (text ?? '').trim();
    if (polished.length === 0) {
      return raw; // LLM vide → on garde le brut
    }
    // Garde-fou troncature : si le polish se termine sans ponctuation finale,
    // probable cap MAX_TOKENS atteint → on perdrait la fin du texte de Thomas
    // (et peut-être des infos clés : tél, email…). Fallback brut sécurisé.
    if (looksTruncated(polished)) {
      console.warn(
        `[polish-user-context] sortie suspectée tronquée (fin "${polished.slice(-20)}") — fallback texte brut`,
      );
      return raw;
    }
    return polished;
  } catch (err) {
    console.warn(
      `[polish-user-context] LLM KO — fallback texte brut : ${err instanceof Error ? err.message : String(err)}`,
    );
    return raw;
  }
}
