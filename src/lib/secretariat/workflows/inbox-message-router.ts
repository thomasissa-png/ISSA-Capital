/**
 * Workflow inbox message router — route texte/vocal vers Google Calendar ou Todo.md.
 *
 * Quand Thomas envoie un message court (texte ou vocal) en mode inbox
 * (aucun workflow actif, aucun batch photo en attente de date), Anya :
 *   1. Transcrit le vocal via Claude Sonnet 4.6 (audio natif)
 *   2. Extrait un JSON structuré { titre, date, heure, lieu, description }
 *   3. Affiche une carte preview avec boutons [Calendar] [Tâches] [Annuler]
 *   4. Thomas clique → action appliquée (Calendar API ou Todo.md append)
 *
 * Cache RAM avec TTL 10 min pour stocker les données entre l'extraction
 * et le callback de Thomas.
 *
 * Décision Thomas : pas de routage automatique, c'est Thomas qui choisit.
 */

import Anthropic from '@anthropic-ai/sdk';
import { sendTelegramMessageWithButtons, sendTypingAction } from '../telegram';
import { createCalendarEvent } from '@/lib/google/calendar';
import { appendToTodoInbox } from '../drive-todo';

// ============================================================
// Types
// ============================================================

export interface ExtractedMessage {
  titre: string;
  date: string | null; // YYYY-MM-DD
  heure: string | null; // HH:MM
  lieu: string | null;
  description: string | null;
}

interface CachedEntry {
  data: ExtractedMessage;
  createdAt: number;
  chatId: number;
}

// ============================================================
// Constantes
// ============================================================

const CACHE_TTL_MS = 10 * 60 * 1_000; // 10 minutes
const ANTHROPIC_TIMEOUT_MS = 30_000;
// Haiku 4.5 : suffisant pour extraction JSON simple + résolution date FR
// + transcription audio native. ~5x moins cher et ~2x plus rapide que Sonnet.
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

/** Préfixe callback_data pour les boutons du router */
export const ROUTER_CALLBACK_PREFIX = 'inbox_router:';

// ============================================================
// Cache globalThis — persiste entre les re-évaluations Next.js
// ============================================================

const ROUTER_CACHE_KEY = '__issa_inbox_router_cache__' as const;

function getRouterCache(): Map<string, CachedEntry> {
  if (!(ROUTER_CACHE_KEY in globalThis)) {
    (globalThis as Record<string, unknown>)[ROUTER_CACHE_KEY] = new Map<string, CachedEntry>();
  }
  return (globalThis as Record<string, unknown>)[ROUTER_CACHE_KEY] as Map<string, CachedEntry>;
}

/**
 * Génère une clé de cache unique.
 */
function generateCacheKey(chatId: number): string {
  return `${chatId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Nettoie les entrées expirées du cache (appel best-effort).
 */
function cleanExpiredEntries(): void {
  const cache = getRouterCache();
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

// ============================================================
// Anthropic client — singleton lazy (réutilise le même que le webhook)
// ============================================================

let cachedClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (cachedClient !== null) {
    return cachedClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === '__TO_FILL__') {
    throw new Error('ANTHROPIC_API_KEY manquante ou placeholder');
  }

  cachedClient = new Anthropic({ apiKey, maxRetries: 2 });
  return cachedClient;
}

// ============================================================
// System prompt pour l'extraction structurée
// ============================================================

function buildExtractionPrompt(today: string): string {
  return `Tu es Anya, secrétariat IA de Thomas Issa. Tu reçois un message Telegram court (texte ou vocal transcrit) qui décrit soit une tâche, soit un événement. Tu DOIS retourner un JSON strict de la forme :

{
  "titre": "string court 3-8 mots, première lettre majuscule, sans date ni lieu dedans",
  "date": "YYYY-MM-DD" | null,
  "heure": "HH:MM" | null,
  "lieu": "string" | null,
  "description": "string" | null
}

Règles :
- Date du jour actuelle : ${today}.
- Si l'utilisateur dit "demain", "après-demain", "vendredi prochain", "le 15", résous en date absolue YYYY-MM-DD.
- Si aucune date n'est mentionnée explicitement ou implicitement, date=null.
- Si heure non mentionnée, heure=null.
- Si lieu non mentionné, lieu=null.
- Description = info utile non couverte par les autres champs (participants, contexte) ; null si rien à ajouter.
- Ne JAMAIS inventer. Si tu hésites, mets null.
- Sortie : JSON brut uniquement, pas de markdown, pas d'explication.`;
}

// ============================================================
// Extraction via Claude Sonnet
// ============================================================

/**
 * Extrait les données structurées d'un message texte via Claude Sonnet.
 */
async function extractFromText(text: string): Promise<{
  success: boolean;
  data?: ExtractedMessage;
  error?: string;
}> {
  try {
    const client = getAnthropicClient();
    const today = new Date().toISOString().split('T')[0]!;
    const systemPrompt = buildExtractionPrompt(today);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

    let message;
    try {
      message = await client.messages.create(
        {
          model: process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL,
          max_tokens: 512,
          system: [
            {
              type: 'text' as const,
              text: systemPrompt,
              cache_control: { type: 'ephemeral' as const },
            },
          ],
          messages: [{ role: 'user', content: text }],
        },
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timer);
    }

    // Extraire le texte
    const rawText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return parseExtractionResult(rawText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[inbox-router] erreur extraction texte : ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Transcrit un buffer audio via OpenAI Whisper API.
 *
 * L'API Anthropic publique ne supporte pas input_audio (vérifié Session 13).
 * Google STT nécessitait un billing account → on passe à Whisper :
 * juste une clé API standalone, ~$0.006/min, robuste sur le français.
 *
 * Endpoint : https://api.openai.com/v1/audio/transcriptions
 * Format Telegram voice : OGG Opus 48kHz mono — supporté nativement.
 */
async function transcribeWithWhisper(
  audioBase64: string,
  audioMimeType: string,
): Promise<{ success: boolean; text?: string; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: 'OPENAI_API_KEY non défini dans Replit Secrets — la transcription vocale est désactivée',
    };
  }

  const extMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
  };
  const ext = extMap[audioMimeType] ?? 'ogg';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const blob = new Blob([buffer], { type: audioMimeType });
    const form = new FormData();
    form.append('file', blob, `voice.${ext}`);
    form.append('model', 'whisper-1');
    form.append('language', 'fr');

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { success: false, error: `Whisper ${resp.status} : ${errText.slice(0, 200)}` };
    }

    const json = (await resp.json()) as { text?: string };
    if (!json.text) {
      return { success: false, error: 'Whisper response sans champ text' };
    }
    return { success: true, text: json.text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extrait les données structurées d'un message vocal.
 * Pipeline : Whisper (audio → texte FR) → Haiku 4.5 (texte → JSON).
 */
async function extractFromVoice(
  audioBase64: string,
  audioMimeType: string,
): Promise<{
  success: boolean;
  data?: ExtractedMessage;
  error?: string;
}> {
  const transcript = await transcribeWithWhisper(audioBase64, audioMimeType);
  if (!transcript.success || !transcript.text) {
    console.warn(`[inbox-router] transcription Whisper échouée : ${transcript.error}`);
    return { success: false, error: transcript.error ?? 'Whisper failure' };
  }

  console.warn(`[inbox-router] transcription Whisper : "${transcript.text.slice(0, 120)}"`);
  return await extractFromText(transcript.text);
}

/**
 * Parse le résultat JSON de Claude.
 */
function parseExtractionResult(rawText: string): {
  success: boolean;
  data?: ExtractedMessage;
  error?: string;
} {
  if (!rawText) {
    return { success: false, error: 'Réponse Claude vide' };
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
    return { success: false, error: 'Pas de JSON dans la réponse Claude' };
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    // Validation minimale
    if (typeof parsed['titre'] !== 'string' || parsed['titre'].length === 0) {
      return { success: false, error: 'Champ "titre" manquant ou vide' };
    }

    const data: ExtractedMessage = {
      titre: parsed['titre'] as string,
      date: typeof parsed['date'] === 'string' ? parsed['date'] : null,
      heure: typeof parsed['heure'] === 'string' ? parsed['heure'] : null,
      lieu: typeof parsed['lieu'] === 'string' ? parsed['lieu'] : null,
      description: typeof parsed['description'] === 'string' ? parsed['description'] : null,
    };

    // Validation format date YYYY-MM-DD
    if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      console.warn(`[inbox-router] date invalide détectée : ${data.date} — mise à null`);
      data.date = null;
    }

    // Validation format heure HH:MM
    if (data.heure && !/^\d{2}:\d{2}$/.test(data.heure)) {
      console.warn(`[inbox-router] heure invalide détectée : ${data.heure} — mise à null`);
      data.heure = null;
    }

    return { success: true, data };
  } catch {
    return { success: false, error: `JSON invalide : ${jsonStr.slice(0, 100)}` };
  }
}

// ============================================================
// API publique — handlers
// ============================================================

/**
 * Formate la carte de preview pour Telegram.
 */
function buildPreviewMessage(data: ExtractedMessage): string {
  const lines: string[] = ['\u{1F4DD} J\'ai compris :'];

  lines.push(`\u{2022} Titre : ${data.titre}`);

  if (data.date) {
    // Formatter en JJ/MM/AAAA
    const parts = data.date.split('-');
    const dateFr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : data.date;
    lines.push(`\u{2022} Date : ${dateFr}`);
  } else {
    lines.push('\u{2022} Date : non détectée');
  }

  if (data.heure) {
    lines.push(`\u{2022} Heure : ${data.heure}`);
  }

  if (data.lieu) {
    lines.push(`\u{2022} Lieu : ${data.lieu}`);
  }

  if (data.description) {
    lines.push(`\u{2022} Info : ${data.description}`);
  }

  lines.push('');
  lines.push('Où je le mets ?');

  return lines.join('\n');
}

/**
 * Traite un message texte en mode inbox → extraction + carte preview.
 *
 * Retourne true si le message a été traité (carte envoyée ou erreur gérée).
 */
export async function handleInboxMessage(
  chatId: number,
  text: string,
): Promise<boolean> {
  await sendTypingAction(chatId);

  const result = await extractFromText(text);

  if (!result.success || !result.data) {
    console.warn(`[inbox-router] extraction échouée : ${result.error ?? 'inconnue'}`);
    // Ne pas gérer ici — laisser le fallback inbox normal traiter le message
    return false;
  }

  // Stocker dans le cache
  cleanExpiredEntries();
  const cacheKey = generateCacheKey(chatId);
  const cache = getRouterCache();
  cache.set(cacheKey, {
    data: result.data,
    createdAt: Date.now(),
    chatId,
  });

  // Construire et envoyer la carte preview
  const previewText = buildPreviewMessage(result.data);

  await sendTelegramMessageWithButtons(chatId, previewText, [
    [
      { text: '\u{1F4C5} Google Calendar', callback_data: `${ROUTER_CALLBACK_PREFIX}calendar:${cacheKey}` },
      { text: '\u{1F4CB} Tâches inbox', callback_data: `${ROUTER_CALLBACK_PREFIX}task:${cacheKey}` },
    ],
    [
      { text: '\u{2717} Annuler', callback_data: `${ROUTER_CALLBACK_PREFIX}cancel:${cacheKey}` },
    ],
  ]);

  return true;
}

/**
 * Traite un message vocal en mode inbox → transcription + extraction + carte preview.
 *
 * Retourne true si le message a été traité.
 */
export async function handleInboxVoiceMessage(
  chatId: number,
  audioBase64: string,
  audioMimeType: string,
): Promise<boolean> {
  await sendTypingAction(chatId);

  const result = await extractFromVoice(audioBase64, audioMimeType);

  if (!result.success || !result.data) {
    console.warn(`[inbox-router] extraction vocale échouée : ${result.error ?? 'inconnue'}`);
    return false;
  }

  // Stocker dans le cache
  cleanExpiredEntries();
  const cacheKey = generateCacheKey(chatId);
  const cache = getRouterCache();
  cache.set(cacheKey, {
    data: result.data,
    createdAt: Date.now(),
    chatId,
  });

  // Construire et envoyer la carte preview
  const previewText = buildPreviewMessage(result.data);

  await sendTelegramMessageWithButtons(chatId, previewText, [
    [
      { text: '\u{1F4C5} Google Calendar', callback_data: `${ROUTER_CALLBACK_PREFIX}calendar:${cacheKey}` },
      { text: '\u{1F4CB} Tâches inbox', callback_data: `${ROUTER_CALLBACK_PREFIX}task:${cacheKey}` },
    ],
    [
      { text: '\u{2717} Annuler', callback_data: `${ROUTER_CALLBACK_PREFIX}cancel:${cacheKey}` },
    ],
  ]);

  return true;
}

/**
 * Traite un callback inline du router (bouton cliqué par Thomas).
 *
 * @param callbackData La callback_data complète (ex: "inbox_router:calendar:abc123")
 * @returns Message de confirmation à envoyer à Thomas
 */
export async function handleRouterCallback(
  chatId: number,
  callbackData: string,
): Promise<string> {
  // Parser le callback : "inbox_router:{action}:{cacheKey}"
  const withoutPrefix = callbackData.slice(ROUTER_CALLBACK_PREFIX.length);
  const colonIdx = withoutPrefix.indexOf(':');
  if (colonIdx === -1) {
    return 'Erreur : callback invalide.';
  }

  const action = withoutPrefix.slice(0, colonIdx);
  const cacheKey = withoutPrefix.slice(colonIdx + 1);

  // Récupérer les données du cache
  const cache = getRouterCache();
  const entry = cache.get(cacheKey);

  if (!entry) {
    return 'Données expirées (> 10 min). Renvoie ton message.';
  }

  // Vérifier que le chatId correspond
  if (entry.chatId !== chatId) {
    return 'Erreur : cette action ne t\'appartient pas.';
  }

  // Nettoyer le cache après traitement
  cache.delete(cacheKey);

  const data = entry.data;

  switch (action) {
    case 'calendar': {
      const result = await createCalendarEvent({
        summary: data.titre,
        date: data.date ?? new Date().toISOString().split('T')[0]!,
        time: data.heure ?? undefined,
        location: data.lieu ?? undefined,
        description: data.description ?? undefined,
      });

      if (result.success) {
        let msg = `\u{2705} Événement créé dans Google Calendar`;
        if (data.date) {
          const parts = data.date.split('-');
          const dateFr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : data.date;
          msg += ` — ${dateFr}`;
        }
        if (data.heure) {
          msg += ` à ${data.heure}`;
        }
        if (result.htmlLink) {
          msg += `\n${result.htmlLink}`;
        }
        return msg;
      }

      return `\u{274C} Erreur Calendar : ${result.error ?? 'inconnue'}`;
    }

    case 'task': {
      const result = await appendToTodoInbox(
        data.titre,
        data.date ?? undefined,
        data.description ?? undefined,
      );

      if (result.success) {
        let msg = '\u{2705} Ajouté à Todo.md > Inbox';
        if (data.date) {
          const parts = data.date.split('-');
          const dateFr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : data.date;
          msg += ` — ${dateFr}`;
        }
        return msg;
      }

      return `\u{274C} Erreur Todo.md : ${result.error ?? 'inconnue'}`;
    }

    case 'cancel': {
      return '\u{2717} Annulé.';
    }

    default: {
      return `Action inconnue : ${action}`;
    }
  }
}

// ============================================================
// Exports pour tests
// ============================================================

export { buildPreviewMessage, parseExtractionResult, buildExtractionPrompt };
