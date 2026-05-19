/**
 * Triage email via Claude Haiku 4.5 — email-ingest Anya.
 *
 * Appelle Haiku 4.5 avec le prompt versionné triage-v1.md,
 * injecte la liste des contacts connus comme contexte,
 * valide le retour JSON avec Zod, retry x1 si invalide.
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md section Jalon 3.
 * Modèle : claude-haiku-4-5-20251001 (mention exacte du model ID).
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { EmailMessage } from '../gmail-source/types';
import {
  triageResultSchema,
  type TriageResult,
  type KnownContact,
} from './types';
import { callAnthropic } from '../llm/client';
import { HAIKU_4_5 } from '../llm/models';

// ============================================================
// Constantes
// ============================================================

/** Modèle exact — Haiku 4.5 pour économie (~5x moins cher que Sonnet) */
const HAIKU_MODEL = HAIKU_4_5;

const TIMEOUT_MS = 30_000;
const MAX_BODY_CHARS = 3000;

// ============================================================
// Prompt système
// ============================================================

let cachedPrompt: string | null = null;

/**
 * Charge le prompt système depuis le fichier versionné.
 * Cache en mémoire pour éviter les lectures disque répétées.
 */
export function loadTriagePrompt(): string {
  if (cachedPrompt !== null) {
    return cachedPrompt;
  }

  const promptPath = join(
    process.cwd(),
    'src',
    'lib',
    'secretariat',
    'triage',
    'prompts',
    'triage-v1.md',
  );

  try {
    cachedPrompt = readFileSync(promptPath, 'utf-8');
    return cachedPrompt;
  } catch {
    console.warn('[triage] prompt triage-v1.md non trouvé — utilisation du prompt embarqué');
    // Fallback prompt embarqué (résumé du fichier externe)
    cachedPrompt = getEmbeddedPrompt();
    return cachedPrompt;
  }
}

/**
 * Invalide le cache du prompt (pour les tests).
 */
export function invalidatePromptCache(): void {
  cachedPrompt = null;
}

// ============================================================
// Construction du contexte
// ============================================================

/**
 * Construit le message utilisateur envoyé à Haiku.
 * Contient l'email à trier + la liste des contacts connus.
 */
export function buildUserMessage(
  email: EmailMessage,
  contacts: KnownContact[],
): string {
  const lines: string[] = [];

  // Contexte contacts
  if (contacts.length > 0) {
    const locataires = contacts.filter((c) => c.type === 'locataire');
    const pros = contacts.filter((c) => c.type === 'pro');

    if (locataires.length > 0) {
      lines.push('## Locataires actuels');
      for (const c of locataires) {
        lines.push(`- ${c.name} <${c.email}>`);
      }
      lines.push('');
    }

    if (pros.length > 0) {
      lines.push('## Contacts pro connus');
      for (const c of pros) {
        lines.push(`- ${c.name} <${c.email}>`);
      }
      lines.push('');
    }
  }

  // Email à trier
  lines.push('## Email à trier');
  lines.push(`From: ${email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email}`);
  lines.push(`To: ${email.to.map((a) => a.email).join(', ')}`);
  if (email.cc.length > 0) {
    lines.push(`Cc: ${email.cc.map((a) => a.email).join(', ')}`);
  }
  lines.push(`Subject: ${email.subject}`);
  lines.push(`Date: ${email.receivedAt.toISOString()}`);
  if (email.attachments.length > 0) {
    lines.push(`Attachments: ${email.attachments.map((a) => `${a.name} (${a.mimeType})`).join(', ')}`);
  }
  lines.push('');
  lines.push('Body:');
  // Tronquer le body pour économiser les tokens
  const body = email.bodyPlain.length > MAX_BODY_CHARS
    ? email.bodyPlain.slice(0, MAX_BODY_CHARS) + '\n\n[... tronqué]'
    : email.bodyPlain;
  lines.push(body);

  return lines.join('\n');
}

// ============================================================
// Appel LLM + validation
// ============================================================

/**
 * Trie un email via Claude Haiku 4.5.
 *
 * @param email Email normalisé à trier
 * @param contacts Liste des contacts connus (locataires + pros)
 * @returns TriageResult validé par Zod, ou null en cas d'échec
 */
export async function triageEmail(
  email: EmailMessage,
  contacts: KnownContact[],
): Promise<TriageResult | null> {
  const systemPrompt = loadTriagePrompt();
  const userMessage = buildUserMessage(email, contacts);

  // Premier essai
  const result = await callHaiku(systemPrompt, userMessage);
  if (result) return result;

  // Retry x1 si JSON invalide
  console.warn('[triage] premier essai échoué — retry x1');
  const retry = await callHaiku(systemPrompt, userMessage);
  if (retry) return retry;

  console.warn('[triage] échec après 2 tentatives');
  return null;
}

/**
 * Appel unique à Haiku + parsing + validation Zod.
 */
async function callHaiku(
  systemPrompt: string,
  userMessage: string,
): Promise<TriageResult | null> {
  try {
    const { text } = await callAnthropic({
      family: 'haiku',
      modelOverride: HAIKU_MODEL,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 1024,
      timeoutMs: TIMEOUT_MS,
    });
    return parseTriageResponse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[triage] erreur appel Haiku : ${msg}`);
    return null;
  }
}

/**
 * Parse et valide la réponse JSON du LLM.
 */
export function parseTriageResponse(rawText: string): TriageResult | null {
  if (!rawText) {
    console.warn('[triage] réponse vide');
    return null;
  }

  // Extraire le JSON — support bloc markdown ou JSON brut
  let jsonStr: string | null = null;

  // Bloc ```json ... ```
  const blockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (blockMatch?.[1]) {
    jsonStr = blockMatch[1].trim();
  }

  // JSON brut { ... }
  if (!jsonStr) {
    const objMatch = rawText.match(/\{[\s\S]*\}/);
    if (objMatch?.[0]) {
      jsonStr = objMatch[0].trim();
    }
  }

  if (!jsonStr) {
    console.warn('[triage] pas de JSON dans la réponse');
    return null;
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Validation Zod
    const validated = triageResultSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn(`[triage] validation Zod échouée : ${validated.error.message.slice(0, 300)}`);
      return null;
    }

    let result = validated.data;

    // Enforcement : si confidence < 0.7, override la catégorie à "a-classifier"
    if (result.confidence < 0.7 && result.category !== 'a-classifier') {
      console.warn(
        `[triage] confidence ${result.confidence} < 0.7 — override catégorie "${result.category}" → "a-classifier"`,
      );
      result = { ...result, category: 'a-classifier' };
    }

    return result;
  } catch {
    console.warn(`[triage] JSON invalide : ${jsonStr.slice(0, 200)}`);
    return null;
  }
}

// ============================================================
// Prompt embarqué (fallback si fichier non trouvé)
// ============================================================

function getEmbeddedPrompt(): string {
  return `Tu es Anya, secrétariat IA d'ISSA Capital. Tu reçois un email brut et tu dois le classifier.

Catégories : locataire, candidat, contact-pro, apporteur, spam, a-classifier.

Anti-patterns :
1. Domaine pro = JAMAIS locataire.
2. Confiance honnête. Si < 0.7, catégorie = a-classifier.
3. Zéro invention.
4. Summary factuel.

Retourne UNIQUEMENT un JSON strict :
{
  "category": "...",
  "intent": "...",
  "confidence": 0.0-1.0,
  "matchedContact": "..." | null,
  "summary": "...",
  "suggestedActions": [{ "type": "...", "target": "..." | null, "payload": {} }]
}`;
}
