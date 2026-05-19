/**
 * POST /api/telegram/webhook
 *
 * Route handler Next.js (App Router) pour le secrétariat ISSA Capital.
 *
 * Flow complet :
 *  1. Vérifier le secret token (X-Telegram-Bot-Api-Secret-Token) via timingSafeEqual
 *  2. Parser le body JSON via Zod (TelegramUpdateSchema)
 *  3. Vérifier le chat_id contre la whitelist (TELEGRAM_ALLOWED_CHAT_IDS)
 *  4. Envoyer le message à Claude avec system prompt fiscal + contacts + historique Craft
 *  5. Claude peut faire des recherches web (adresses, entreprises)
 *  6. Si needs_clarification → renvoyer la question (conversation multi-tours)
 *     Si ready → envoyer aperçu CR + boutons Valider/Modifier/Annuler
 *  7. Valider → référence IC-CR-YYYY-XXXX + publication Craft + confirmation
 *  8. Toujours retourner 200 OK (Telegram retente agressivement sinon)
 *
 * Mémoire : historique de conversation persisté en JSON (24h TTL, 20 messages max).
 * Contacts récurrents injectés dans le prompt. Recherche web automatique.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { callAnthropic } from '@/lib/secretariat/llm/client';
import { SONNET_4 } from '@/lib/secretariat/llm/models';
import { TelegramUpdateSchema, ClaudeResponseSchema } from '@/lib/secretariat/types';
import type { CRDraft } from '@/lib/secretariat/types';
import {
  sendTelegramMessage,
  sendTelegramConfirmation,
  sendTelegramDocument,
  answerCallbackQuery,
  downloadTelegramPhoto,
  downloadTelegramFile,
  sendTypingAction,
} from '@/lib/secretariat/telegram';
import {
  renderCrForTelegram,
  buildCraftTitle,
} from '@/lib/secretariat/cr-renderer';
import { formatContactsForPrompt, addContact } from '@/lib/secretariat/contacts';
import {
  getConversation,
  appendMessage as storeMessage,
  toClaudeMessages,
  setPendingDraft,
  getPendingDraft,
  clearPendingDraft,
  clearConversation,
  addPhoto,
  getPhotos,
  clearPhotos,
  getActiveWorkflow,
  setActiveWorkflow,
  clearActiveWorkflow,
} from '@/lib/secretariat/conversation-store';
import type { PhotoAttachment } from '@/lib/secretariat/conversation-store';
import { getNextReference } from '@/lib/secretariat/reference-counter';
import { generateCrPdf } from '@/lib/secretariat/pdf-generator';
import { uploadToDrive } from '@/lib/secretariat/drive-upload';
import { writeBackCrToFiche } from '@/lib/secretariat/handlers/cr-writeback';
import { saveCrToHistory, formatHistoryForPrompt } from '@/lib/secretariat/cr-history';
import { backupToGoogleDrive, restoreFromGoogleDrive } from '@/lib/secretariat/drive-backup';
import { getWorkflow } from '@/lib/secretariat/workflows/registry';
import type { WorkflowState } from '@/lib/secretariat/workflows/types';
import { generateBatch } from '@/lib/secretariat/workflows/quittance';
import { generateBail } from '@/lib/secretariat/workflows/bail';
import { generateFinDeBail } from '@/lib/secretariat/workflows/fin-de-bail';
import type { FinDeBailWorkflowData, CandidatWorkflowData } from '@/lib/secretariat/rent/types';
import { uploadCandidatFiche } from '@/lib/secretariat/workflows/candidat';
import type { Locataire, BailWorkflowData } from '@/lib/secretariat/rent/types';
import {
  handleInboxText,
  handleInboxVoice,
  handleInboxDocument,
} from '@/lib/secretariat/inbox';
import {
  startOrExtendBatch,
  isWaitingForInboxPhotoDate,
  hasPendingBatch,
  getBatchPhotoCount,
  handleDateReply,
  buildDatePromptMessage,
  cancelBatch,
} from '@/lib/secretariat/workflows/inbox-photo-batch';
import type { BatchPhoto } from '@/lib/secretariat/workflows/inbox-photo-batch';
import {
  handleInboxMessage,
  handleInboxVoiceMessage,
  handleRouterCallback,
  ROUTER_CALLBACK_PREFIX,
} from '@/lib/secretariat/workflows/inbox-message-router';
import { handleTelegramCallback as handleEmailValCallback } from '@/lib/secretariat/telegram-validation';
import { handleHealthRenewed } from '@/lib/secretariat/telegram-validation/handlers/health-renewed';
import { handleHealthSnooze } from '@/lib/secretariat/telegram-validation/handlers/health-snooze';
import {
  TICKTICK_PROJECTS_CALLBACK_PREFIX,
  handleTickTickProjectsCallback,
} from '@/lib/secretariat/telegram-validation/handlers/ticktick-projects-confirm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================
// Constantes mode inbox / workflows
// ============================================================

/** Seuil de caractères pour la détection auto CR (texte long → workflow CR) */
const AUTO_CR_TEXT_THRESHOLD = 100;

// ============================================================
// System prompt — chargement et cache singleton
// ============================================================

let cachedSystemPrompt: string | null = null;

/**
 * Charge le system prompt fiscal depuis docs/ia/secretariat-system-prompt.md.
 * Extrait le contenu du premier bloc code (```) sous "## 2. System prompt complet".
 * Cache en mémoire après le premier appel.
 */
function loadSystemPrompt(): string {
  if (cachedSystemPrompt !== null) {
    return cachedSystemPrompt;
  }

  const promptPath = resolve(process.cwd(), 'docs', 'ia', 'secretariat-system-prompt.md');
  const fileContent = readFileSync(promptPath, 'utf8');

  const sectionMarker = '## 2. System prompt complet';
  const sectionIdx = fileContent.indexOf(sectionMarker);
  if (sectionIdx === -1) {
    throw new Error(`[webhook] section "${sectionMarker}" introuvable dans ${promptPath}`);
  }

  const afterSection = fileContent.slice(sectionIdx);
  const openIdx = afterSection.indexOf('```');
  if (openIdx === -1) {
    throw new Error('[webhook] aucun bloc code trouvé après la section 2');
  }

  const afterOpen = afterSection.slice(openIdx + 3);
  const newlineAfterOpen = afterOpen.indexOf('\n');
  if (newlineAfterOpen === -1) {
    throw new Error('[webhook] bloc code malformé');
  }

  const contentStart = newlineAfterOpen + 1;
  const closeIdx = afterOpen.indexOf('```', contentStart);
  if (closeIdx === -1) {
    throw new Error('[webhook] bloc code non fermé');
  }

  const promptBody = afterOpen.slice(contentStart, closeIdx).trim();
  if (promptBody.length < 500) {
    throw new Error(
      `[webhook] system prompt trop court (${promptBody.length} chars), fichier probablement corrompu`,
    );
  }

  cachedSystemPrompt = promptBody;
  return cachedSystemPrompt;
}

// ============================================================
// Vérification du secret webhook
// ============================================================

function verifyWebhookSecret(request: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || secret.trim() === '' || secret === '__TO_FILL__') {
    return false;
  }

  const header = request.headers.get('x-telegram-bot-api-secret-token');
  if (!header || header.length === 0) {
    return false;
  }

  // Comparaison en temps constant pour éviter les timing attacks
  if (header.length !== secret.length) {
    return false;
  }

  const headerBuf = Buffer.from(header, 'utf8');
  const secretBuf = Buffer.from(secret, 'utf8');
  return timingSafeEqual(headerBuf, secretBuf);
}

// ============================================================
// Whitelist des chat_ids autorisés
// ============================================================

function isAllowedChatId(chatId: number): boolean {
  const raw = process.env.TELEGRAM_ALLOWED_CHAT_IDS;
  if (!raw || raw.trim() === '') {
    return false;
  }

  const allowedIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));

  return allowedIds.includes(chatId);
}

// ============================================================
// Appel Claude pour générer le CR
// ============================================================

const ANTHROPIC_TIMEOUT_MS = 60_000;
const ANTHROPIC_MODEL = SONNET_4;

/**
 * Génère l'instruction temporelle dynamique pour le system prompt.
 * Doit être appelée à chaque requête pour avoir la date/heure actuelles.
 */
function buildTimeInstruction(): string {
  const now = new Date();
  const dateFr = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(now);
  const yesterday = new Date(now.getTime() - 86400000);
  const dayBefore = new Date(now.getTime() - 2 * 86400000);
  const hierFr = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(yesterday);
  const avantHierFr = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(dayBefore);
  const todayIso = now.toISOString().split('T')[0];
  const hierIso = yesterday.toISOString().split('T')[0];
  const avantHierIso = dayBefore.toISOString().split('T')[0];

  return `

# REGLE PRIORITAIRE — DATES ET HEURES

Tu connais la date et l'heure actuelles. Quand l'utilisateur dit "ce matin", "ce midi", "ce soir", "hier", "hier soir", "tout à l'heure", "avant-hier" ou toute expression temporelle relative — tu CALCULES la date toi-même. Tu ne demandes JAMAIS "quelle est la date exacte".

Date du jour : ${dateFr} = ${todayIso}
Hier : ${hierFr} = ${hierIso}
Avant-hier : ${avantHierFr} = ${avantHierIso}

TABLE DE CONVERSION :
"aujourd'hui" / "ce matin" / "ce midi" / "cet après-midi" / "ce soir" / "tout à l'heure" / "à l'instant" / "il y a une heure" → ${todayIso}
"déjeuner ce midi" / "petit-déjeuner ce matin" / "dîner ce soir" / "réunion de ce matin" → ${todayIso}
"hier" / "hier matin" / "hier midi" / "hier après-midi" / "hier soir" → ${hierIso}
"avant-hier" → ${avantHierIso}
"lundi/mardi/mercredi/jeudi/vendredi/samedi/dimanche dernier" → CALCULE depuis ${todayIso}
`;
}

async function generateCR(
  messageText: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  photos: PhotoAttachment[] = [],
): Promise<{
  success: boolean;
  status?: 'needs_clarification' | 'ready';
  clarificationQuestion?: string;
  crText?: string;
  crDraft?: CRDraft;
  error?: string;
}> {
  try {
    let systemPrompt = loadSystemPrompt();

    // Injecter la base de contacts récurrents dans le system prompt
    const contactsBlock = await formatContactsForPrompt();
    systemPrompt = systemPrompt.replace(
      '[INJECTION_DATABASE_CONTACTS_ICI]',
      contactsBlock,
    );

    // Récupérer l'historique des CR validés (mémoire longue)
    const recentCRs = formatHistoryForPrompt(10);

    // Le contexte temporel (dates, "ce matin"→date ISO) est maintenant dans
    // timeInstruction (injecté dans le system prompt). Ici on ajoute juste l'historique.
    const enrichedMessage = `[${recentCRs}]\n\n${messageText}`;

    const timeInstruction = buildTimeInstruction();

    // Instruction recherche web ajoutée au system prompt
    const searchInstruction = `

# REGLE 12 — RECHERCHE WEB AUTOMATIQUE

Tu disposes d'un outil de recherche web. Utilise-le AUTOMATIQUEMENT pour :
- Trouver l'adresse exacte d'un restaurant, hôtel ou lieu mentionné par l'utilisateur (ex : "Le Voltaire Paris" → rechercher l'adresse complète)
- Vérifier le titre ou la société d'un interlocuteur non présent dans la database contacts
- Trouver des informations publiques sur une entreprise mentionnée dans la réunion
- Compléter toute information factuelle vérifiable qui améliore la qualité du CR

Tu n'as PAS besoin de demander la permission pour chercher. Si un nom de lieu ou d'entreprise apparaît sans adresse complète, cherche automatiquement.
`;

    // Construire le contenu du message utilisateur (texte seul ou multimodal avec photos)
    type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    type TextBlock = { type: 'text'; text: string };
    type ImageBlock = {
      type: 'image';
      source: { type: 'base64'; media_type: ImageMediaType; data: string };
    };
    type ContentBlock = TextBlock | ImageBlock;

    let userContent: string | ContentBlock[];

    if (photos.length > 0) {
      // Message multimodal : photos + texte
      const contentParts: ContentBlock[] = [];

      for (const photo of photos) {
        // Cast mimeType en union littérale acceptée par l'API Anthropic
        const validMediaTypes: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const mediaType: ImageMediaType = validMediaTypes.includes(photo.mimeType as ImageMediaType)
          ? (photo.mimeType as ImageMediaType)
          : 'image/jpeg';

        contentParts.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: photo.base64,
          },
        });
        // Si la photo avait une légende, l'ajouter comme contexte
        if (photo.caption) {
          contentParts.push({
            type: 'text',
            text: `[Légende photo : ${photo.caption}]`,
          });
        }
      }

      contentParts.push({
        type: 'text',
        text: enrichedMessage,
      });

      userContent = contentParts;
    } else {
      userContent = enrichedMessage;
    }

    // Wrapper LLM unifié : cache_control auto sur la partie stable
    // (systemPrompt + searchInstruction), partie dynamique (timeInstruction)
    // concaténée sans cache pour préserver la variabilité de l'heure.
    const { message } = await callAnthropic({
      family: 'sonnet',
      modelOverride: process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL,
      system: systemPrompt + searchInstruction,
      dynamicSystem: timeInstruction,
      maxTokens: 4096,
      tools: [
        {
          type: 'web_search_20250305' as const,
          name: 'web_search',
          max_uses: 3,
        },
      ],
      messages: [
        ...conversationHistory,
        { role: 'user' as const, content: userContent },
      ],
      timeoutMs: ANTHROPIC_TIMEOUT_MS,
    });

    // Extraire le texte de la réponse (ignore les blocs tool_use/web_search_result)
    const textParts: string[] = [];
    for (const block of message.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      }
    }
    const rawText = textParts.join('\n').trim();

    if (rawText.length === 0) {
      return { success: false, error: 'Réponse Claude vide' };
    }

    // Extraction du JSON depuis la réponse Claude.
    // Claude peut mélanger du texte libre (web search, réflexion) avec le JSON.
    // Stratégie : chercher dans l'ordre :
    //   1. Un bloc ```json ... ```
    //   2. Un objet JSON brut { ... } (le dernier de la réponse)
    //   3. Si aucun JSON trouvé mais du texte → traiter comme clarification en langage naturel

    let cleanJson: string | null = null;

    // Stratégie 1 : bloc markdown ```json ... ```
    const jsonBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (jsonBlockMatch?.[1]) {
      cleanJson = jsonBlockMatch[1].trim();
    }

    // Stratégie 2 : dernier objet JSON brut { ... } dans le texte
    if (!cleanJson) {
      const jsonObjMatch = rawText.match(/\{[\s\S]*"status"\s*:\s*"(?:needs_clarification|ready)"[\s\S]*\}/);
      if (jsonObjMatch?.[0]) {
        cleanJson = jsonObjMatch[0].trim();
      }
    }

    // Stratégie 3 : aucun JSON → texte libre = clarification naturelle
    if (!cleanJson) {
      // Claude a répondu en texte libre (souvent après un web search raté)
      // On traite ça comme une clarification
      return {
        success: true,
        status: 'needs_clarification',
        clarificationQuestion: rawText.slice(0, 4000),
      };
    }

    // Parser le JSON et valider via Zod
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      // JSON malformé/tronqué → extraire le texte lisible comme clarification
      // Chercher du texte avant le JSON cassé
      const textBeforeJson = rawText.split('{')[0]?.trim();
      if (textBeforeJson && textBeforeJson.length > 20) {
        return {
          success: true,
          status: 'needs_clarification',
          clarificationQuestion: textBeforeJson.slice(0, 4000),
        };
      }
      return { success: false, error: `Réponse Claude non-JSON : ${cleanJson.slice(0, 200)}` };
    }

    let validation = ClaudeResponseSchema.safeParse(parsed);

    // Correction 1 — Retry Zod : si la validation échoue, retenter une fois
    // en renvoyant le JSON invalide + les erreurs Zod à Claude pour qu'il se corrige.
    if (!validation.success) {
      const issues = validation.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('\n');

      const retryPrompt = `Le JSON que tu as renvoyé est invalide. Voici le JSON :\n\`\`\`json\n${cleanJson.slice(0, 3000)}\n\`\`\`\n\nErreurs de validation :\n${issues}\n\nCorrige le JSON et renvoie-le complet. Ne renvoie QUE le JSON corrigé, sans texte avant ou après.`;

      try {
        // Retry Zod via wrapper unifié : cache_control auto + tracking usage.
        const { text: retryRawText } = await callAnthropic({
          family: 'sonnet',
          modelOverride: process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL,
          system: systemPrompt + searchInstruction,
          dynamicSystem: timeInstruction,
          maxTokens: 4096,
          messages: [
            ...conversationHistory,
            { role: 'user' as const, content: userContent },
            { role: 'assistant' as const, content: rawText },
            { role: 'user' as const, content: retryPrompt },
          ],
          timeoutMs: ANTHROPIC_TIMEOUT_MS,
        });

        // Extraire le JSON de la réponse retry
        let retryJson: string | null = null;
        const retryBlockMatch = retryRawText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
        if (retryBlockMatch?.[1]) {
          retryJson = retryBlockMatch[1].trim();
        }
        if (!retryJson) {
          const retryObjMatch = retryRawText.match(/\{[\s\S]*"status"\s*:\s*"(?:needs_clarification|ready)"[\s\S]*\}/);
          if (retryObjMatch?.[0]) {
            retryJson = retryObjMatch[0].trim();
          }
        }

        if (retryJson) {
          try {
            const retryParsed = JSON.parse(retryJson);
            const retryValidation = ClaudeResponseSchema.safeParse(retryParsed);
            if (retryValidation.success) {
              // Retry réussi — utiliser la réponse corrigée
              parsed = retryParsed;
              validation = retryValidation;
            }
          } catch {
            // JSON parse échoue sur le retry — on tombe dans le fallback ci-dessous
          }
        }
      } catch (retryErr) {
        // Retry échoué (timeout, erreur réseau) — on continue avec l'erreur originale
        console.warn('[telegram-webhook] retry Zod échoué :', retryErr instanceof Error ? retryErr.message : String(retryErr));
      }
    }

    // Si après retry la validation échoue toujours → retourner l'erreur
    if (!validation.success) {
      const issues = validation.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ');
      return { success: false, error: `Schéma CR invalide : ${issues}` };
    }

    const response = validation.data;

    // Traiter l'ajout d'un nouveau contact (si Claude en a détecté un)
    const rawParsed = parsed as Record<string, unknown>;
    const newContact = rawParsed['new_contact'] as {
      prenom?: string;
      nom?: string;
      titre?: string;
      societe?: string;
      entites_visibles?: string[];
      notes?: string;
    } | null | undefined;

    if (newContact?.prenom && newContact?.nom && newContact?.titre && newContact?.societe) {
      const added = await addContact({
        prenom: newContact.prenom,
        nom: newContact.nom,
        titre: newContact.titre,
        societe: newContact.societe,
        entitesVisibles: newContact.entites_visibles ?? ['IC', 'GO', 'VI', 'VV'],
        notes: newContact.notes,
      });
      if (added) {
        console.info(`[contacts] nouveau contact ajouté : ${newContact.prenom} ${newContact.nom}`);
      }
    }

    if (response.status === 'needs_clarification') {
      return {
        success: true,
        status: 'needs_clarification',
        clarificationQuestion: response.clarification_question ?? 'Peux-tu préciser ?',
      };
    }

    // status === 'ready'
    if (response.cr === null) {
      return { success: false, error: 'CR null malgré status ready' };
    }

    const crText = renderCrForTelegram(response.cr);
    return { success: true, status: 'ready', crText, crDraft: response.cr };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || msg.includes('aborted'));

    if (isAbort) {
      return { success: false, error: 'Timeout Claude (60s dépassées)' };
    }

    return { success: false, error: `Erreur Claude : ${msg.slice(0, 200)}` };
  }
}

// ============================================================
// Appel Claude pour traiter un message vocal
// ============================================================

/**
 * Envoie un message vocal (audio base64) à Claude pour transcription et traitement.
 * Claude gère nativement l'audio via le content block input_audio.
 * Le résultat est traité comme un message texte normal (clarification ou CR).
 */
async function generateCRFromVoice(
  audioBase64: string,
  audioMimeType: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  photos: PhotoAttachment[] = [],
): Promise<{
  success: boolean;
  status?: 'needs_clarification' | 'ready';
  clarificationQuestion?: string;
  crText?: string;
  crDraft?: CRDraft;
  error?: string;
}> {
  try {
    let systemPrompt = loadSystemPrompt();

    const contactsBlock = await formatContactsForPrompt();
    systemPrompt = systemPrompt.replace(
      '[INJECTION_DATABASE_CONTACTS_ICI]',
      contactsBlock,
    );

    const recentCRs = formatHistoryForPrompt(10);

    const timeInstruction = buildTimeInstruction();
    const searchInstruction = `\\n# REGLE 12 — RECHERCHE WEB AUTOMATIQUE\\nTu disposes d'un outil de recherche web. Utilise-le AUTOMATIQUEMENT pour trouver des adresses, vérifier des titres/sociétés, ou compléter des infos factuelles.\\n`;

    // Construire les content blocks : audio + texte contextuel + photos éventuelles
    type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    type TextBlock = { type: 'text'; text: string };
    type ImageBlock = {
      type: 'image';
      source: { type: 'base64'; media_type: ImageMediaType; data: string };
    };
    type AudioBlock = {
      type: 'input_audio';
      source: { type: 'base64'; media_type: string; data: string };
    };
    type ContentBlock = TextBlock | ImageBlock | AudioBlock;

    const contentBlocks: ContentBlock[] = [];

    // Audio en premier — Claude input_audio
    contentBlocks.push({
      type: 'input_audio',
      source: {
        type: 'base64',
        media_type: audioMimeType,
        data: audioBase64,
      },
    });

    // Photos en attente (si Thomas a envoyé des photos avant le vocal)
    if (photos.length > 0) {
      for (const photo of photos) {
        const validMediaTypes: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const mediaType: ImageMediaType = validMediaTypes.includes(photo.mimeType as ImageMediaType)
          ? (photo.mimeType as ImageMediaType)
          : 'image/jpeg';

        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: photo.base64,
          },
        });
        if (photo.caption) {
          contentBlocks.push({
            type: 'text',
            text: `[Légende photo : ${photo.caption}]`,
          });
        }
      }
    }

    // Texte contextuel (date, historique CR, instruction de transcription)
    contentBlocks.push({
      type: 'text',
      text: `${recentCRs}\n\n[Message vocal Telegram — transcris le contenu et traite-le comme un message texte normal pour générer le CR.]`,
    });


    // Wrapper LLM unifié pour message vocal : cache_control auto sur
    // (systemPrompt + searchInstruction), timeInstruction en dynamique.
    const { message } = await callAnthropic({
      family: 'sonnet',
      modelOverride: process.env.ANTHROPIC_MODEL ?? ANTHROPIC_MODEL,
      system: systemPrompt + searchInstruction,
      dynamicSystem: timeInstruction,
      maxTokens: 4096,
      tools: [
        {
          type: 'web_search_20250305' as const,
          name: 'web_search',
          max_uses: 3,
        },
      ],
      messages: [
        ...conversationHistory,
        { role: 'user' as const, content: contentBlocks as unknown as Anthropic.Messages.MessageParam['content'] },
      ],
      timeoutMs: ANTHROPIC_TIMEOUT_MS,
    });

    // Extraire le texte de la réponse
    const textParts: string[] = [];
    for (const block of message.content) {
      if (block.type === 'text') {
        textParts.push(block.text);
      }
    }
    const rawText = textParts.join('\n').trim();

    if (rawText.length === 0) {
      return { success: false, error: 'Réponse Claude vide pour le message vocal' };
    }

    // Extraction JSON identique au flow texte
    let cleanJson: string | null = null;
    const jsonBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (jsonBlockMatch?.[1]) {
      cleanJson = jsonBlockMatch[1].trim();
    }
    if (!cleanJson) {
      const jsonObjMatch = rawText.match(/\{[\s\S]*"status"\s*:\s*"(?:needs_clarification|ready)"[\s\S]*\}/);
      if (jsonObjMatch?.[0]) {
        cleanJson = jsonObjMatch[0].trim();
      }
    }

    // Pas de JSON → clarification en texte libre
    if (!cleanJson) {
      return {
        success: true,
        status: 'needs_clarification',
        clarificationQuestion: rawText.slice(0, 4000),
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      const textBeforeJson = rawText.split('{')[0]?.trim();
      if (textBeforeJson && textBeforeJson.length > 20) {
        return {
          success: true,
          status: 'needs_clarification',
          clarificationQuestion: textBeforeJson.slice(0, 4000),
        };
      }
      return { success: false, error: 'Réponse vocale non-JSON et non interprétable' };
    }

    const validation = ClaudeResponseSchema.safeParse(parsed);
    if (!validation.success) {
      const issues = validation.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(' | ');
      return { success: false, error: `Schéma CR invalide (vocal) : ${issues}` };
    }

    const response = validation.data;

    if (response.status === 'needs_clarification') {
      return {
        success: true,
        status: 'needs_clarification',
        clarificationQuestion: response.clarification_question ?? 'Peux-tu préciser ?',
      };
    }

    if (response.cr === null) {
      return { success: false, error: 'CR null malgré status ready (vocal)' };
    }

    const crText = renderCrForTelegram(response.cr);
    return { success: true, status: 'ready', crText, crDraft: response.cr };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAbort =
      err instanceof Error &&
      (err.name === 'AbortError' || msg.includes('aborted'));

    if (isAbort) {
      return { success: false, error: 'Timeout Claude vocal (60s dépassées)' };
    }

    return { success: false, error: `Erreur Claude vocal : ${msg.slice(0, 200)}` };
  }
}

// ============================================================
// Commandes slash — /start, /cr, /inbox, /cancel, /status
// ============================================================

async function handleSlashCommand(chatId: number, normalizedText: string): Promise<Response> {
  // /start — message de bienvenue
  if (normalizedText === '/start') {
    await sendTelegramMessage(
      chatId,
      'Anya prête. Mode inbox actif — envoie photos, notes ou documents.\nPour un compte rendu, tape /cr ou envoie un long message.',
    );
    return Response.json({ ok: true });
  }

  // /quittance — démarrer le workflow quittance de loyer
  if (normalizedText === '/quittance') {
    // Annuler tout workflow actif
    const existing = getActiveWorkflow(chatId);
    if (existing) {
      clearActiveWorkflow(chatId);
    }
    clearPendingDraft(chatId);
    clearConversation(chatId);
    clearPhotos(chatId);

    const qWf = getWorkflow('quittance');
    if (qWf) {
      await sendTypingAction(chatId);
      const startResult = await qWf.start(chatId);
      if (startResult.newState) {
        setActiveWorkflow(chatId, startResult.newState);
      }
      // Envoyer les messages de démarrage
      for (const msg of startResult.messages) {
        await sendTelegramMessage(chatId, msg.text);
      }
    }
    return Response.json({ ok: true });
  }

  // /bail — démarrer le workflow bail meublé
  if (normalizedText === '/bail') {
    // Annuler tout workflow actif
    const existingBail = getActiveWorkflow(chatId);
    if (existingBail) {
      clearActiveWorkflow(chatId);
    }
    clearPendingDraft(chatId);
    clearConversation(chatId);
    clearPhotos(chatId);

    const bailWf = getWorkflow('bail');
    if (bailWf) {
      await sendTypingAction(chatId);
      const startResult = await bailWf.start(chatId);
      if (startResult.newState) {
        setActiveWorkflow(chatId, startResult.newState);
      }
      for (const msg of startResult.messages) {
        await sendTelegramMessage(chatId, msg.text);
      }
    }
    return Response.json({ ok: true });
  }

  // /findebail — démarrer le workflow fin de bail (attestation PDF)
  if (normalizedText === '/findebail') {
    const existingWf = getActiveWorkflow(chatId);
    if (existingWf) {
      clearActiveWorkflow(chatId);
    }
    clearPendingDraft(chatId);
    clearConversation(chatId);
    clearPhotos(chatId);

    const fdbWf = getWorkflow('findebail');
    if (fdbWf) {
      await sendTypingAction(chatId);
      const startResult = await fdbWf.start(chatId);
      if (startResult.newState) {
        setActiveWorkflow(chatId, startResult.newState);
      }
      for (const msg of startResult.messages) {
        await sendTelegramMessage(chatId, msg.text);
      }
    }
    return Response.json({ ok: true });
  }

  // /candidat — démarrer le workflow fiche candidat
  if (normalizedText === '/candidat') {
    const existingWf = getActiveWorkflow(chatId);
    if (existingWf) {
      clearActiveWorkflow(chatId);
    }
    clearPendingDraft(chatId);
    clearConversation(chatId);
    clearPhotos(chatId);

    const candWf = getWorkflow('candidat');
    if (candWf) {
      await sendTypingAction(chatId);
      const startResult = await candWf.start(chatId);
      if (startResult.newState) {
        setActiveWorkflow(chatId, startResult.newState);
      }
      for (const msg of startResult.messages) {
        await sendTelegramMessage(chatId, msg.text);
      }
    }
    return Response.json({ ok: true });
  }

  // /cr — démarrer le workflow CR
  if (normalizedText === '/cr') {
    const crWf = getWorkflow('cr');
    if (crWf) {
      const startResult = await crWf.start(chatId);
      if (startResult.newState) {
        setActiveWorkflow(chatId, startResult.newState);
      }
    }
    await sendTelegramMessage(
      chatId,
      'Mode CR activé. Envoie le contenu de ta réunion (texte, vocal ou photos).',
    );
    return Response.json({ ok: true });
  }

  // /inbox — forcer le retour en mode inbox
  if (normalizedText === '/inbox') {
    const hadWorkflow = getActiveWorkflow(chatId) !== null;
    const hadBatch = hasPendingBatch(chatId);
    clearActiveWorkflow(chatId);
    clearPendingDraft(chatId);
    clearConversation(chatId);
    clearPhotos(chatId);
    cancelBatch(chatId);
    if (hadWorkflow || hadBatch) {
      await sendTelegramMessage(chatId, 'Mode inbox réactivé. Tout annulé.');
    } else {
      await sendTelegramMessage(chatId, 'Déjà en mode inbox.');
    }
    return Response.json({ ok: true });
  }

  // /cancel — annuler le workflow actif
  if (normalizedText === '/cancel') {
    const hadWorkflow = getActiveWorkflow(chatId) !== null;
    const hadDraft = getPendingDraft(chatId) !== null;
    const hadHistory = getConversation(chatId).length > 0;
    const hadBatch = hasPendingBatch(chatId);
    clearActiveWorkflow(chatId);
    clearPendingDraft(chatId);
    clearConversation(chatId);
    clearPhotos(chatId);
    cancelBatch(chatId);
    if (hadWorkflow || hadDraft || hadHistory || hadBatch) {
      await sendTelegramMessage(chatId, 'Annulé. Mode inbox réactivé.');
    } else {
      await sendTelegramMessage(chatId, 'Rien en cours.');
    }
    return Response.json({ ok: true });
  }

  // /status — afficher l'état actuel
  if (normalizedText === '/status') {
    const workflow = getActiveWorkflow(chatId);
    const draft = getPendingDraft(chatId);
    const photos = getPhotos(chatId);
    const history = getConversation(chatId);
    const batchCount = getBatchPhotoCount(chatId);
    const batchWaiting = isWaitingForInboxPhotoDate(chatId);

    let status = 'Mode : ';
    if (workflow) {
      status += `workflow ${workflow.type} (étape : ${workflow.step})`;
    } else {
      status += 'inbox';
    }
    if (draft) {
      status += '\nCR en attente de validation';
    }
    if (photos.length > 0) {
      status += `\nPhotos en attente : ${photos.length}`;
    }
    if (history.length > 0) {
      status += `\nMessages en conversation : ${history.length}`;
    }
    if (batchCount > 0) {
      const batchState = batchWaiting ? 'en attente de date' : 'en accumulation';
      status += `\nBatch photos inbox : ${batchCount} photo${batchCount > 1 ? 's' : ''} (${batchState})`;
    }

    await sendTelegramMessage(chatId, status);
    return Response.json({ ok: true });
  }

  // Commande inconnue
  await sendTelegramMessage(
    chatId,
    'Commande inconnue. Commandes disponibles : /cr, /quittance, /bail, /findebail, /candidat, /inbox, /cancel, /status',
  );
  return Response.json({ ok: true });
}

// ============================================================
// Handler texte CR — logique existante extraite en fonction
// ============================================================

async function handleCRText(
  chatId: number,
  text: string,
  normalizedText: string,
): Promise<Response> {
  // Commandes d'abandon (mots naturels) — annule la conversation en cours
  const cancelKeywords = ['annule', 'annuler', 'laisse tomber', 'oublie', 'stop', 'cancel', 'non merci'];
  if (cancelKeywords.some((kw) => normalizedText === kw || normalizedText.startsWith(kw))) {
    const hadDraft = getPendingDraft(chatId) !== null;
    const hadHistory = getConversation(chatId).length > 0;
    clearActiveWorkflow(chatId);
    clearPendingDraft(chatId);
    clearConversation(chatId);
    clearPhotos(chatId);
    if (hadDraft || hadHistory) {
      await sendTelegramMessage(chatId, 'Conversation annulée. Mode inbox réactivé.');
    } else {
      await sendTelegramMessage(chatId, 'Rien en cours. Mode inbox actif.');
    }
    return Response.json({ ok: true });
  }

  // Si un draft est en attente et Thomas dit "non" / "c'est bon" / "pas de photo"
  // → montrer l'aperçu avec les boutons de validation
  const noPhotoKeywords = ['non', 'no', 'pas de photo', 'c\'est bon', 'cest bon', 'sans photo', 'aucune', 'nope'];
  const draft = getPendingDraft(chatId);
  if (draft && noPhotoKeywords.some((kw) => normalizedText === kw || normalizedText.startsWith(kw))) {
    const photos = getPhotos(chatId);
    if (photos.length > 0) {
      // Regénérer le CR avec les photos
      await sendTypingAction(chatId);
      const history = getConversation(chatId);
      const claudeHistory = toClaudeMessages(history);
      const result = await generateCR(
        `Regénère le CR en intégrant les ${photos.length} photos jointes en annexes photographiques.`,
        claudeHistory,
        photos,
      );
      // NE PAS clearPhotos ici — on en a besoin pour le PDF quand Thomas validera
      if (result.crText && result.crDraft) {
        setPendingDraft(chatId, result.crDraft, result.crText);
        const previewText = `${result.crText}\n\n—\nVérifie le CR ci-dessus puis choisis une action :`;
        await sendTelegramConfirmation(chatId, previewText);
      } else {
        // Fallback : utiliser le draft original sans photos
        const previewText = `${draft.previewText}\n\n—\nVérifie le CR ci-dessus puis choisis une action :`;
        await sendTelegramConfirmation(chatId, previewText);
      }
    } else {
      // Pas de photos → montrer l'aperçu directement
      const previewText = `${draft.previewText}\n\n—\nVérifie le CR ci-dessus puis choisis une action :`;
      await sendTelegramConfirmation(chatId, previewText);
    }
    return Response.json({ ok: true });
  }

  // Récupérer l'historique de conversation pour ce chat
  const history = getConversation(chatId);
  const claudeHistory = toClaudeMessages(history);

  // Sauvegarder le message utilisateur dans l'historique
  storeMessage(chatId, 'user', text);

  // Récupérer les photos en attente (envoyées avant ce message texte)
  const pendingPhotos = getPhotos(chatId);

  // Typing indicator avant l'appel Claude (feedback immédiat)
  await sendTypingAction(chatId);

  // Accusé de réception UNIQUEMENT si c'est le premier message de la conversation
  // (pas une réponse à une clarification) ET le message est substantiel
  const isFirstMessage = history.length === 0;
  if (isFirstMessage && (text.length >= AUTO_CR_TEXT_THRESHOLD || pendingPhotos.length > 0)) {
    await sendTelegramMessage(chatId, 'Un instant, je prépare le compte rendu…');
  }

  // Appel Claude avec l'historique complet + photos en attente
  const result = await generateCR(text, claudeHistory, pendingPhotos);

  // Vider les photos après l'appel Claude (intégrées dans la requête)
  if (pendingPhotos.length > 0) {
    clearPhotos(chatId);
  }

  if (!result.success) {
    const errorMsg = `Erreur de génération : ${result.error ?? 'inconnue'}. Réessaie dans un moment.`;
    storeMessage(chatId, 'assistant', errorMsg);
    await sendTelegramMessage(chatId, errorMsg);
    return Response.json({ ok: true });
  }

  if (result.status === 'needs_clarification') {
    const question = result.clarificationQuestion ?? 'Peux-tu préciser ?';
    // Sauvegarder la réponse dans l'historique pour le prochain échange
    storeMessage(chatId, 'assistant', question);
    await sendTelegramMessage(chatId, question);
    return Response.json({ ok: true });
  }

  // status === 'ready' — stocker le draft, PUIS demander s'il y a des photos
  if (result.crText && result.crDraft) {
    storeMessage(chatId, 'assistant', result.crText);
    setPendingDraft(chatId, result.crDraft, result.crText);

    // Mettre à jour le workflow step
    const workflow = getActiveWorkflow(chatId);
    if (workflow) {
      setActiveWorkflow(chatId, { ...workflow, step: 'pending_photos' });
    }

    // Demander s'il y a des photos à joindre AVANT de montrer l'aperçu
    await sendTelegramMessage(
      chatId,
      'CR prêt. Des photos à joindre au compte rendu ? Si oui, envoie-les maintenant. Sinon, réponds « non ».',
    );
  }

  return Response.json({ ok: true });
}

// ============================================================
// POST handler
// ============================================================

// Flag global : restauration Drive déjà tentée ?
const RESTORE_KEY = '__issa_drive_restored__' as const;

export async function POST(request: Request): Promise<Response> {
  // 0. Restaurer les données depuis Drive au premier appel après un redéploiement
  // BLOQUANT — on attend que la restauration soit terminée avant de traiter
  if (!(RESTORE_KEY in globalThis)) {
    (globalThis as Record<string, unknown>)[RESTORE_KEY] = true;
    try {
      await restoreFromGoogleDrive();
    } catch {
      // Si la restauration échoue, on continue — données vierges
    }
  }

  // 1. Vérification du secret
  if (!verifyWebhookSecret(request)) {
    // On retourne quand même 200 pour ne pas que Telegram retente
    // mais on log l'échec de secret
    console.warn('[telegram-webhook] secret invalide ou manquant');
    return Response.json({ ok: true, ignored: 'invalid_secret' });
  }

  // 2. Parsing du body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.warn('[telegram-webhook] body JSON invalide');
    return Response.json({ ok: true, ignored: 'invalid_json' });
  }

  const parsed = TelegramUpdateSchema.safeParse(body);
  if (!parsed.success) {
    console.warn('[telegram-webhook] payload Telegram invalide :', parsed.error.issues.slice(0, 3));
    return Response.json({ ok: true, ignored: 'invalid_payload' });
  }

  const update = parsed.data;

  // 3. Dispatch
  try {
    // 3a. Message texte — router 3 niveaux
    if (update.message?.text !== undefined) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      // Whitelist
      if (!isAllowedChatId(chatId)) {
        console.warn(`[telegram-webhook] chat_id ${chatId} non autorisé`);
        return Response.json({ ok: true });
      }

      const normalizedText = text.trim().toLowerCase();

      // ── Niveau 1 : commandes slash ──────────────────────────────
      if (normalizedText.startsWith('/')) {
        return await handleSlashCommand(chatId, normalizedText);
      }

      // ── Niveau 2 : workflow actif ──────────────────────────────
      const activeWorkflow = getActiveWorkflow(chatId);
      if (activeWorkflow) {
        // Workflow quittance : dispatch direct vers le workflow
        if (activeWorkflow.type === 'quittance') {
          return await handleQuittanceText(chatId, activeWorkflow, text);
        }
        // Workflow bail : dispatch direct vers le workflow
        if (activeWorkflow.type === 'bail') {
          return await handleBailText(chatId, activeWorkflow, text);
        }
        // Workflow fin de bail : dispatch direct vers le workflow
        if (activeWorkflow.type === 'findebail') {
          return await handleFinDeBailText(chatId, activeWorkflow, text);
        }
        // Workflow candidat : dispatch direct vers le workflow
        if (activeWorkflow.type === 'candidat') {
          return await handleCandidatText(chatId, activeWorkflow, text);
        }
        // Le workflow CR en Phase 1 est pass-through :
        // la logique reste dans ce fichier, le state sert juste de flag
        return await handleCRText(chatId, text, normalizedText);
      }

      // ── Niveau 2b : batch photo en attente de date ─────────────
      if (isWaitingForInboxPhotoDate(chatId)) {
        const dateResult = await handleDateReply(chatId, text);
        if (dateResult.userMessage) {
          await sendTelegramMessage(chatId, dateResult.userMessage);
        }
        // Si success=true, le batch a été uploadé (message de confirmation envoyé par finalizeBatch)
        // Si success=false avec userMessage, format invalide → message d'erreur envoyé ci-dessus
        // Si success=false sans userMessage, pas de batch → ne devrait pas arriver ici
        return Response.json({ ok: true });
      }

      // ── Niveau 3 : mode inbox (par défaut) ─────────────────────
      // Texte long (>= seuil) → démarrer automatiquement un workflow CR
      if (text.length >= AUTO_CR_TEXT_THRESHOLD) {
        // Activer le workflow CR
        const crWf = getWorkflow('cr');
        if (crWf) {
          const startResult = await crWf.start(chatId, text);
          if (startResult.newState) {
            setActiveWorkflow(chatId, startResult.newState);
          }
        }
        // Traiter le texte comme premier message CR (comportement existant)
        return await handleCRText(chatId, text, normalizedText);
      }

      // Texte court en mode inbox → essayer le router message (Calendar/Todo)
      // Si le router extrait un titre structuré → carte preview avec boutons
      // Sinon fallback → sauvegarder comme note Drive (comportement existant)
      // Priorité handlers texte (documenté session 13) :
      //   1. Commande slash → handleSlashCommand
      //   2. Workflow actif → handler du workflow
      //   3. Batch photo en attente de date → handleDateReply
      //   4. Texte long → auto-CR
      //   5. Texte court → router message (Calendar/Todo) ou note Drive
      const routerHandled = await handleInboxMessage(chatId, text);
      if (routerHandled) {
        return Response.json({ ok: true });
      }

      // Fallback : sauvegarder comme note Drive
      const inboxResult = await handleInboxText(chatId, text);
      await sendTelegramMessage(chatId, inboxResult.userMessage);
      return Response.json({ ok: true });
    }

    // 3b. Message avec photo(s)
    if (update.message?.photo !== undefined && update.message.photo.length > 0) {
      const chatId = update.message.chat.id;

      if (!isAllowedChatId(chatId)) {
        console.warn(`[telegram-webhook] chat_id ${chatId} non autorisé`);
        return Response.json({ ok: true });
      }

      // Prendre la dernière entrée du tableau photo (meilleure résolution)
      const photoArray = update.message.photo;
      const bestPhoto = photoArray[photoArray.length - 1];
      if (!bestPhoto) {
        return Response.json({ ok: true });
      }
      const caption = update.message.caption;

      // Télécharger la photo via l'API Telegram
      const photoResult = await downloadTelegramPhoto(bestPhoto.file_id);

      if (!photoResult.success || !photoResult.base64) {
        console.error('[telegram-webhook] échec téléchargement photo :', photoResult.error);
        await sendTelegramMessage(
          chatId,
          `Erreur lors du téléchargement de la photo : ${photoResult.error ?? 'inconnue'}. Réessaie.`,
        );
        return Response.json({ ok: true });
      }

      // Vérifier taille fichier
      if (bestPhoto.file_size && bestPhoto.file_size > 20 * 1024 * 1024) {
        await sendTelegramMessage(chatId, 'Photo trop volumineuse (> 20 Mo). Réduis la taille et réessaie.');
        return Response.json({ ok: true });
      }

      // Router selon le mode actif
      const activeWorkflow = getActiveWorkflow(chatId);
      const hasDraft = getPendingDraft(chatId) !== null;

      if (activeWorkflow || hasDraft) {
        // Mode workflow CR — stocker pour le CR (comportement existant)
        const added = addPhoto(chatId, photoResult.base64, photoResult.mimeType ?? 'image/jpeg', caption);

        if (!added) {
          await sendTelegramMessage(
            chatId,
            'Limite de 10 photos atteinte pour ce CR. Les photos supplémentaires sont ignorées.',
          );
          return Response.json({ ok: true });
        }

        const photoCount = getPhotos(chatId).length;

        if (caption && caption.trim().length > 0) {
          storeMessage(chatId, 'user', caption);
        }

        if (hasDraft) {
          await sendTelegramMessage(
            chatId,
            `Photo reçue (${photoCount}/10). Envoie d'autres photos, ou réponds « non » pour générer le CR.`,
          );
        } else {
          const captionInfo = caption ? ` (légende : "${caption.slice(0, 50)}")` : '';
          await sendTelegramMessage(
            chatId,
            `Photo reçue${captionInfo} (${photoCount}/10). Envoie d'autres photos ou le texte de ta réunion quand tu es prêt.`,
          );
        }
        return Response.json({ ok: true });
      }

      // Mode inbox — batch avec demande de date (bypass EXIF Telegram)
      {
        const batchPhoto: BatchPhoto = {
          base64: photoResult.base64,
          mimeType: photoResult.mimeType ?? 'image/jpeg',
          caption,
        };

        const wasWaiting = isWaitingForInboxPhotoDate(chatId);
        startOrExtendBatch(chatId, batchPhoto);

        // Si le batch était déjà en attente de date, notifier Thomas
        // (startOrExtendBatch ajoute la photo mais ne renvoie pas le message)
        if (wasWaiting) {
          const count = getBatchPhotoCount(chatId);
          const msg = buildDatePromptMessage(count);
          await sendTelegramMessage(chatId, msg);
        }

        return Response.json({ ok: true });
      }
    }

    // 3b-bis. Message vocal (dictaphone Telegram — audio/ogg opus)
    const voiceData = update.message?.voice;
    if (voiceData) {
      const chatId = update.message!.chat.id;

      if (!isAllowedChatId(chatId)) {
        console.warn(`[telegram-webhook] chat_id ${chatId} non autorisé`);
        return Response.json({ ok: true });
      }

      // Télécharger le fichier audio via l'API Telegram
      const audioResult = await downloadTelegramFile(voiceData.file_id);

      if (!audioResult.success || !audioResult.base64) {
        console.error('[telegram-webhook] échec téléchargement vocal :', audioResult.error);
        await sendTelegramMessage(
          chatId,
          `Erreur lors du téléchargement du message vocal : ${audioResult.error ?? 'inconnue'}. Réessaie.`,
        );
        return Response.json({ ok: true });
      }

      // Router selon le mode actif
      const activeWorkflow = getActiveWorkflow(chatId);
      if (activeWorkflow || getPendingDraft(chatId) !== null) {
        // Mode workflow CR — traiter comme avant (transcription + CR)
        await sendTypingAction(chatId);

        const history = getConversation(chatId);
        const claudeHistory = toClaudeMessages(history);
        const pendingPhotos = getPhotos(chatId);

        try {
          storeMessage(chatId, 'user', '[Message vocal]');

          const result = await generateCRFromVoice(
            audioResult.base64,
            audioResult.mimeType ?? 'audio/ogg',
            claudeHistory,
            pendingPhotos,
          );

          if (pendingPhotos.length > 0) {
            clearPhotos(chatId);
          }

          if (!result.success) {
            const errorMsg = `Erreur de traitement vocal : ${result.error ?? 'inconnue'}. Réessaie ou envoie en texte.`;
            storeMessage(chatId, 'assistant', errorMsg);
            await sendTelegramMessage(chatId, errorMsg);
            return Response.json({ ok: true });
          }

          if (result.status === 'needs_clarification') {
            const question = result.clarificationQuestion ?? 'Peux-tu préciser ?';
            storeMessage(chatId, 'assistant', question);
            await sendTelegramMessage(chatId, question);
            return Response.json({ ok: true });
          }

          if (result.crText && result.crDraft) {
            const previewText = `${result.crText}\n\n—\nVérifie le CR ci-dessus puis choisis une action :`;
            storeMessage(chatId, 'assistant', result.crText);
            setPendingDraft(chatId, result.crDraft, result.crText);
            await sendTelegramConfirmation(chatId, previewText);
          }

          return Response.json({ ok: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[telegram-webhook] erreur traitement vocal :', msg);
          await sendTelegramMessage(
            chatId,
            'Erreur lors du traitement du message vocal. Réessaie ou envoie en texte.',
          );
          return Response.json({ ok: true });
        }
      }

      // Mode inbox — essayer le router message (transcription vocale + Calendar/Todo)
      // Si le router extrait un titre structuré → carte preview avec boutons
      // Sinon fallback → upload direct vers Drive (comportement existant)
      const voiceRouterHandled = await handleInboxVoiceMessage(
        chatId,
        audioResult.base64,
        audioResult.mimeType ?? 'audio/ogg',
      );
      if (voiceRouterHandled) {
        return Response.json({ ok: true });
      }

      // Fallback : upload direct vers Drive (pas de transcription)
      const inboxVoiceResult = await handleInboxVoice(
        chatId,
        audioResult.base64,
        audioResult.mimeType ?? 'audio/ogg',
        voiceData.duration,
        voiceData.file_size,
      );
      await sendTelegramMessage(chatId, inboxVoiceResult.userMessage);
      return Response.json({ ok: true });
    }

    // 3b-ter. Message avec document (PDF, etc.)
    const documentData = update.message?.document;
    if (documentData) {
      const chatId = update.message!.chat.id;

      if (!isAllowedChatId(chatId)) {
        console.warn(`[telegram-webhook] chat_id ${chatId} non autorisé`);
        return Response.json({ ok: true });
      }

      // Vérifier la taille
      if (documentData.file_size && documentData.file_size > 20 * 1024 * 1024) {
        await sendTelegramMessage(chatId, 'Document trop volumineux (> 20 Mo). Réduis la taille et réessaie.');
        return Response.json({ ok: true });
      }

      // Télécharger le document via l'API Telegram
      const docResult = await downloadTelegramFile(documentData.file_id);

      if (!docResult.success || !docResult.base64) {
        console.error('[telegram-webhook] échec téléchargement document :', docResult.error);
        await sendTelegramMessage(
          chatId,
          `Erreur lors du téléchargement du document : ${docResult.error ?? 'inconnue'}. Réessaie.`,
        );
        return Response.json({ ok: true });
      }

      // Image ou vidéo envoyée en mode "fichier" (Send as file) → batch avec demande de date
      // Source : diagnostic bugs photos S12, EXIF strip S13 (Telegram iOS HEIC→JPEG)
      const docMimeType = documentData.mime_type ?? 'application/octet-stream';
      if (docMimeType.startsWith('image/') || docMimeType.startsWith('video/')) {
        console.warn(`[telegram-webhook] média en document détecté (mime=${docMimeType}, file_name=${documentData.file_name ?? 'n/a'}, size=${documentData.file_size ?? 'n/a'}) → batch inbox`);

        // Vérifier si un workflow est actif (ne pas intercepter)
        const docActiveWorkflow = getActiveWorkflow(chatId);
        const docHasDraft = getPendingDraft(chatId) !== null;
        if (docActiveWorkflow || docHasDraft) {
          // Workflow actif — traiter comme photo CR (comportement existant)
          const added = addPhoto(chatId, docResult.base64, docMimeType, update.message?.caption);
          if (!added) {
            await sendTelegramMessage(chatId, 'Limite de 10 photos atteinte pour ce CR.');
          } else {
            const photoCount = getPhotos(chatId).length;
            await sendTelegramMessage(chatId, `Photo reçue (${photoCount}/10).`);
          }
          return Response.json({ ok: true });
        }

        const batchPhoto: BatchPhoto = {
          base64: docResult.base64,
          mimeType: docMimeType,
          caption: update.message?.caption,
        };

        const wasWaiting = isWaitingForInboxPhotoDate(chatId);
        startOrExtendBatch(chatId, batchPhoto);

        if (wasWaiting) {
          const count = getBatchPhotoCount(chatId);
          const msg = buildDatePromptMessage(count);
          await sendTelegramMessage(chatId, msg);
        }

        return Response.json({ ok: true });
      }

      // Mode inbox — upload direct vers Drive
      const inboxDocResult = await handleInboxDocument(
        chatId,
        docResult.base64,
        docMimeType,
        documentData.file_name,
        documentData.file_size,
      );
      await sendTelegramMessage(chatId, inboxDocResult.userMessage);
      return Response.json({ ok: true });
    }

    // 3b-quinquies. Message avec vidéo (envoi compressé Telegram)
    // Même cas d'usage que les photos : journal Anya + dossier _Inbox/Photos/
    if (update.message?.video !== undefined) {
      const videoData = update.message.video;
      const chatId = update.message.chat.id;

      if (!isAllowedChatId(chatId)) {
        console.warn(`[telegram-webhook] chat_id ${chatId} non autorisé`);
        return Response.json({ ok: true });
      }

      if (videoData.file_size && videoData.file_size > 20 * 1024 * 1024) {
        await sendTelegramMessage(chatId, 'Vidéo trop volumineuse (> 20 Mo). Réduis la taille et réessaie.');
        return Response.json({ ok: true });
      }

      const videoResult = await downloadTelegramFile(videoData.file_id);
      if (!videoResult.success || !videoResult.base64) {
        console.error('[telegram-webhook] échec téléchargement vidéo :', videoResult.error);
        await sendTelegramMessage(chatId, `Erreur téléchargement vidéo : ${videoResult.error ?? 'inconnue'}.`);
        return Response.json({ ok: true });
      }

      console.warn(`[telegram-webhook] message.video (mime=${videoData.mime_type ?? 'video/mp4'}) → batch inbox`);

      // Vérifier si un workflow est actif (ne pas intercepter les vidéos en mode CR)
      const videoActiveWorkflow = getActiveWorkflow(chatId);
      const videoHasDraft = getPendingDraft(chatId) !== null;
      if (videoActiveWorkflow || videoHasDraft) {
        // Workflow actif — ignorer (les vidéos ne sont pas supportées dans les CR)
        await sendTelegramMessage(chatId, 'Les vidéos ne sont pas supportées dans ce workflow. Envoie une photo ou du texte.');
        return Response.json({ ok: true });
      }

      const videoBatchPhoto: BatchPhoto = {
        base64: videoResult.base64,
        mimeType: videoData.mime_type ?? 'video/mp4',
        caption: update.message.caption,
      };

      const videoWasWaiting = isWaitingForInboxPhotoDate(chatId);
      startOrExtendBatch(chatId, videoBatchPhoto);

      if (videoWasWaiting) {
        const count = getBatchPhotoCount(chatId);
        const msg = buildDatePromptMessage(count);
        await sendTelegramMessage(chatId, msg);
      }

      return Response.json({ ok: true });
    }

    // 3b-sexies. Message sans texte ni photo ni vocal ni document ni vidéo (sticker, etc.)
    if (update.message !== undefined && update.message.text === undefined && (update.message.photo === undefined || update.message.photo.length === 0) && update.message.voice === undefined && update.message.document === undefined && update.message.video === undefined) {
      const chatId = update.message.chat.id;
      if (isAllowedChatId(chatId)) {
        await sendTelegramMessage(
          chatId,
          'Type de fichier non supporté. Envoie du texte, des photos, des vidéos, des vocaux ou des documents (PDF, etc.).',
        );
      }
      return Response.json({ ok: true });
    }

    // 3c. Callback query (boutons inline) — cycle Valider/Modifier/Annuler
    if (update.callback_query !== undefined) {
      const callbackData = update.callback_query.data;
      const callbackChatId = update.callback_query.message?.chat.id;
      const callbackQueryId = update.callback_query.id;

      // Acquitter immédiatement le callback pour retirer le spinner Telegram
      await answerCallbackQuery(callbackQueryId);

      if (!callbackChatId || !callbackData) {
        return Response.json({ ok: true });
      }

      if (!isAllowedChatId(callbackChatId)) {
        return Response.json({ ok: true });
      }

      // Inbox message router — callbacks préfixés par "inbox_router:"
      if (callbackData.startsWith(ROUTER_CALLBACK_PREFIX)) {
        const routerMsg = await handleRouterCallback(callbackChatId, callbackData);
        await sendTelegramMessage(callbackChatId, routerMsg);
        return Response.json({ ok: true });
      }

      // Health monitor — callbacks préfixés par "health_renewed:" ou "health_snooze:"
      if (callbackData.startsWith('health_renewed:')) {
        await handleHealthRenewed({
          callbackQueryId: callbackQueryId,
          callbackData,
          chatId: callbackChatId,
          messageId: update.callback_query.message?.message_id ?? 0,
        });
        return Response.json({ ok: true });
      }

      if (callbackData.startsWith('health_snooze:')) {
        await handleHealthSnooze({
          callbackQueryId: callbackQueryId,
          callbackData,
          chatId: callbackChatId,
          messageId: update.callback_query.message?.message_id ?? 0,
        });
        return Response.json({ ok: true });
      }

      // Email-ingest validation — callbacks préfixés par "email_val:" ou "email_nomatch:"
      // (handleTelegramCallback dispatch en interne entre les 2 préfixes)
      if (callbackData.startsWith('email_val:') || callbackData.startsWith('email_nomatch:')) {
        await handleEmailValCallback({
          callback_query_id: callbackQueryId,
          data: callbackData,
          message_id: update.callback_query.message?.message_id ?? 0,
          chat_id: callbackChatId,
        });
        return Response.json({ ok: true });
      }

      // TickTick sync — callbacks préfixés par "tickticksync_projects:" (S18.1)
      // Confirmation création initiale des 7 projets TickTick (red line spec §8 step 4).
      if (callbackData.startsWith(TICKTICK_PROJECTS_CALLBACK_PREFIX)) {
        await handleTickTickProjectsCallback({
          callback_query_id: callbackQueryId,
          data: callbackData,
          message_id: update.callback_query.message?.message_id ?? 0,
          chat_id: callbackChatId,
        });
        return Response.json({ ok: true });
      }

      // Workflow quittance — callbacks préfixés par "q_"
      const quittanceWf = getActiveWorkflow(callbackChatId);
      if (quittanceWf && quittanceWf.type === 'quittance') {
        return await handleQuittanceCallback(callbackChatId, quittanceWf, callbackData);
      }

      // Workflow bail — callbacks préfixés par "bail_"
      const bailWf = getActiveWorkflow(callbackChatId);
      if (bailWf && bailWf.type === 'bail') {
        return await handleBailCallback(callbackChatId, bailWf, callbackData);
      }

      // Workflow fin de bail — callbacks préfixés par "fdb_"
      const fdbWf = getActiveWorkflow(callbackChatId);
      if (fdbWf && fdbWf.type === 'findebail') {
        return await handleFinDeBailCallback(callbackChatId, fdbWf, callbackData);
      }

      // Workflow candidat — callbacks préfixés par "cand_"
      const candWf = getActiveWorkflow(callbackChatId);
      if (candWf && candWf.type === 'candidat') {
        return await handleCandidatCallback(callbackChatId, candWf, callbackData);
      }

      const pendingDraft = getPendingDraft(callbackChatId);

      if (!pendingDraft) {
        await sendTelegramMessage(
          callbackChatId,
          'Aucun CR en attente de validation. Envoie le contenu d\'une réunion pour générer un nouveau CR.',
        );
        return Response.json({ ok: true });
      }

      // --- VALIDER ---
      if (callbackData === 'validate') {
        try {
          // 1. Générer la référence séquentielle
          const reference = getNextReference(pendingDraft.cr.entite);
          const dateEtablissement = new Date().toISOString();

          // 2. Construire le titre du document
          const craftTitle = buildCraftTitle(pendingDraft.cr);

          // Récupérer les photos en attente AVANT de les clear (pour le PDF)
          const photosForPdf = getPhotos(callbackChatId).map((p) => ({
            base64: p.base64,
            mimeType: p.mimeType,
          }));

          // 3. Générer le PDF du CR (avec photos embarquées si disponibles)
          let pdfBuffer: Buffer | null = null;
          try {
            pdfBuffer = await generateCrPdf({
              cr: pendingDraft.cr,
              reference,
              dateEtablissement,
              photos: photosForPdf.length > 0 ? photosForPdf : undefined,
            });
          } catch (pdfErr) {
            const pdfErrMsg = pdfErr instanceof Error
              ? `${pdfErr.message}\n${pdfErr.stack?.slice(0, 300) ?? ''}`
              : String(pdfErr);
            console.error('[telegram-webhook] erreur génération PDF :', pdfErrMsg);
            // Envoyer l'erreur sur Telegram pour diagnostic
            await sendTelegramMessage(
              callbackChatId,
              `⚠️ Erreur PDF : ${pdfErrMsg.slice(0, 500)}`,
            );
          }

          // 5. Envoyer le PDF sur Telegram (avant la publication Craft pour feedback rapide)
          if (pdfBuffer) {
            const pdfFilename = `${reference.replace(/\//g, '-')}.pdf`;
            const pdfCaption = `${craftTitle}\nRéf. ${reference}`;
            const docResult = await sendTelegramDocument(
              callbackChatId,
              pdfBuffer,
              pdfFilename,
              pdfCaption,
            );
            if (!docResult.success) {
              console.error(
                '[telegram-webhook] erreur envoi PDF Telegram :',
                docResult.error,
              );
              // On continue — le PDF n'est pas bloquant
            }
          }

          // 6. Upload PDF sur Google Drive
          let driveLink: string | undefined;
          let driveFileId: string | undefined;
          if (pdfBuffer) {
            const pdfFilename = `${reference.replace(/\//g, '-')}.pdf`;
            const driveResult = await uploadToDrive(
              pdfBuffer,
              pdfFilename,
              pendingDraft.cr.entite,
              craftTitle,
            );
            if (driveResult.success) {
              driveLink = driveResult.webViewLink;
              driveFileId = driveResult.fileId;
              console.info(`[telegram-webhook] PDF uploadé sur Drive : ${driveResult.fileId}`);

              // 6bis. Write-back CR → fiche Projet vault (S16 Q3)
              // Append le lien CR dans la section "## Comptes Rendus" de la fiche
              // Projet correspondant à l'entité. PATCH in-place (R5 P0 #99).
              // Idempotent : skip si le lien existe déjà.
              // await obligatoire (Replit autoscale : pas de fire-and-forget).
              if (driveLink && driveFileId) {
                try {
                  const writebackResult = await writeBackCrToFiche({
                    entiteCode: pendingDraft.cr.entite,
                    crFileId: driveFileId,
                    crFilename: pdfFilename,
                    crWebViewLink: driveLink,
                    crDate: pendingDraft.cr.date_reunion,
                    crTitle: craftTitle,
                  });
                  if (writebackResult.success) {
                    if (writebackResult.modified) {
                      console.info(
                        `[telegram-webhook] write-back fiche Projet OK : section ${writebackResult.sectionCreated ? 'créée' : 'mise à jour'} (fileId ${writebackResult.ficheFileId})`,
                      );
                    } else {
                      console.info('[telegram-webhook] write-back fiche Projet : skip idempotent (lien déjà présent)');
                    }
                  } else {
                    console.warn('[telegram-webhook] write-back fiche Projet échoué :', writebackResult.error);
                  }
                } catch (wbErr) {
                  // Le write-back ne doit jamais casser le workflow CR.
                  console.warn(
                    '[telegram-webhook] write-back fiche Projet exception :',
                    wbErr instanceof Error ? wbErr.message : wbErr,
                  );
                }
              }
            } else {
              console.warn('[telegram-webhook] échec upload Drive :', driveResult.error);
              await sendTelegramMessage(
                callbackChatId,
                `⚠️ Upload Drive échoué : ${driveResult.error?.slice(0, 300) ?? 'erreur inconnue'}`,
              );
            }
          }

          // 7. Envoyer la confirmation textuelle sur Telegram
          let confirmMsg = `CR validé.\n\nRéférence : ${reference}`;
          if (driveLink) {
            confirmMsg += `\nDrive : ${driveLink}`;
          }
          if (!pdfBuffer) {
            confirmMsg += '\n\n⚠️ Le PDF n\'a pas pu être généré.';
          }
          await sendTelegramMessage(callbackChatId, confirmMsg);

          // 8. Sauvegarder le CR dans l'historique (mémoire longue d'Anya)
          saveCrToHistory(pendingDraft.cr, reference, dateEtablissement);

          // 9. Backup compteur + historique sur Google Drive (survit aux redéploiements)
          backupToGoogleDrive().catch((e) =>
            console.warn('[telegram-webhook] backup Drive échoué :', e),
          );

          // 10. Nettoyer la conversation, le draft, les photos et le workflow
          clearActiveWorkflow(callbackChatId);
          clearPendingDraft(callbackChatId);
          clearConversation(callbackChatId);
          clearPhotos(callbackChatId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error('[telegram-webhook] erreur validation CR :', errMsg);
          await sendTelegramMessage(
            callbackChatId,
            `Erreur lors de la validation : ${errMsg.slice(0, 200)}. Réessaie dans un moment.`,
          );
        }

        return Response.json({ ok: true });
      }

      // --- MODIFIER ---
      if (callbackData === 'modify') {
        // Sauvegarder le CR précédent dans l'historique de conversation
        // pour que Claude ait le contexte lors de la modification.
        // Ainsi, Thomas peut dire "change le lieu par Le Voltaire" et Claude
        // sait quel CR il doit modifier.
        storeMessage(
          callbackChatId,
          'assistant',
          `[CR précédent à modifier]\n${pendingDraft.previewText}`,
        );
        clearPendingDraft(callbackChatId);
        await sendTelegramMessage(
          callbackChatId,
          'Que veux-tu modifier ? Envoie tes corrections et je regénère le CR.',
        );
        return Response.json({ ok: true });
      }

      // --- ANNULER ---
      if (callbackData === 'cancel') {
        clearActiveWorkflow(callbackChatId);
        clearPendingDraft(callbackChatId);
        clearConversation(callbackChatId);
        clearPhotos(callbackChatId);
        await sendTelegramMessage(callbackChatId, 'CR annulé. Mode inbox réactivé.');
        return Response.json({ ok: true });
      }

      // Callback inconnu — ignorer
      return Response.json({ ok: true });
    }

    // 3d. Autres types d'updates — on ignore silencieusement
    return Response.json({ ok: true });
  } catch (err) {
    // JAMAIS crasher la réponse — Telegram retentera sinon
    console.error('[telegram-webhook] erreur dispatch :', err);
    return Response.json({ ok: true });
  }
}

// ============================================================
// Handlers Quittance — dispatch texte et callbacks
// ============================================================

/**
 * Gère un message texte dans le contexte du workflow quittance.
 */
async function handleQuittanceText(
  chatId: number,
  state: WorkflowState,
  text: string,
): Promise<Response> {
  const qWf = getWorkflow('quittance');
  if (!qWf) {
    return Response.json({ ok: true });
  }

  // Si génération en cours, ignorer les messages texte
  if (state.step === 'generating') {
    await sendTelegramMessage(chatId, '🔄 Génération en cours, patiente...');
    return Response.json({ ok: true });
  }

  await sendTypingAction(chatId);
  const result = await qWf.handleMessage(chatId, state, text);

  // Mettre à jour le state
  if (result.newState) {
    setActiveWorkflow(chatId, result.newState);
  } else {
    clearActiveWorkflow(chatId);
  }

  // Envoyer les messages
  await sendQuittanceMessages(chatId, result.messages, result.newState);

  // Si la période vient d'être validée → lancer directement la génération batch
  // (décision Thomas : pas de récap, pas de confirmation)
  if (result.newState?.step === 'generating') {
    await handleQuittanceBatchGeneration(chatId, result.newState);
    return Response.json({ ok: true });
  }

  // Si le workflow est terminé (done) avec un PDF (legacy single mode), l'envoyer
  if (result.newState?.step === 'done') {
    await sendQuittancePdfIfAvailable(chatId, result.newState);
    clearActiveWorkflow(chatId);
  }

  return Response.json({ ok: true });
}

/**
 * Gère un callback inline dans le contexte du workflow quittance.
 */
async function handleQuittanceCallback(
  chatId: number,
  state: WorkflowState,
  callbackData: string,
): Promise<Response> {
  const qWf = getWorkflow('quittance');
  if (!qWf) {
    return Response.json({ ok: true });
  }

  await sendTypingAction(chatId);
  const result = await qWf.handleCallback(chatId, state, callbackData);

  // Mettre à jour le state
  if (result.newState) {
    setActiveWorkflow(chatId, result.newState);
  } else {
    clearActiveWorkflow(chatId);
  }

  // Envoyer les messages
  await sendQuittanceMessages(chatId, result.messages, result.newState);

  // If generating → run the batch and send PDFs one by one
  if (result.newState?.step === 'generating') {
    await handleQuittanceBatchGeneration(chatId, result.newState);
    return Response.json({ ok: true });
  }

  // Si le workflow est terminé (done) avec un PDF (legacy single mode), l'envoyer
  if (result.newState?.step === 'done') {
    await sendQuittancePdfIfAvailable(chatId, result.newState);
    clearActiveWorkflow(chatId);
  }

  return Response.json({ ok: true });
}

/**
 * Exécute la génération batch de quittances (N locataires × M mois).
 *
 * Envoie chaque PDF individuellement sur Telegram avec caption courte,
 * puis un récap final avec les erreurs éventuelles.
 */
async function handleQuittanceBatchGeneration(
  chatId: number,
  state: WorkflowState,
): Promise<void> {
  const data = state.data as Record<string, unknown>;
  const locataires = data['selectedLocataires'] as Locataire[] | undefined;
  const moisList = data['selectedMois'] as Array<{ year: number; month: number }> | undefined;

  if (!locataires || !moisList || locataires.length === 0 || moisList.length === 0) {
    await sendTelegramMessage(chatId, '❌ Erreur : données de batch manquantes.');
    clearActiveWorkflow(chatId);
    return;
  }

  const totalPdfs = locataires.length * moisList.length;

  try {
    const batchResult = await generateBatch(locataires, moisList);

    // Send each PDF individually
    for (let i = 0; i < batchResult.results.length; i++) {
      const r = batchResult.results[i]!;
      const caption = `📄 ${i + 1}/${totalPdfs} Quittance ${r.locataireNom} - ${r.moisLabel}`;
      await sendTelegramDocument(chatId, r.pdfBuffer, r.pdfFilename, caption);
    }

    // Build final summary
    const parts: string[] = [];
    if (batchResult.generated > 0) {
      parts.push(`✅ Terminé ! ${batchResult.generated}/${totalPdfs} quittances générées et uploadées dans Drive.`);
    }
    if (batchResult.failed.length > 0) {
      const failLines = batchResult.failed
        .map((f) => `  • ${f.locataire} - ${f.mois} (${f.reason})`)
        .join('\n');
      parts.push(`\n⚠️ ${batchResult.failed.length} quittance${batchResult.failed.length > 1 ? 's' : ''} non générée${batchResult.failed.length > 1 ? 's' : ''} :\n${failLines}`);
    }
    if (batchResult.generated === 0 && batchResult.failed.length === 0) {
      parts.push('❌ Aucune quittance générée.');
    }

    await sendTelegramMessage(chatId, parts.join('\n'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await sendTelegramMessage(chatId, `❌ Erreur batch : ${msg.slice(0, 300)}`);
  }

  clearActiveWorkflow(chatId);
}

/**
 * Envoie les messages du workflow quittance.
 *
 * Plus de boutons de confirmation depuis la suppression du récap final
 * (décision Thomas). showConfirmation est ignoré côté code pour rétro-
 * compatibilité — les messages sont envoyés en texte simple.
 */
async function sendQuittanceMessages(
  chatId: number,
  messages: Array<{ text: string; showConfirmation?: boolean }>,
  _state: WorkflowState | null,
): Promise<void> {
  for (const msg of messages) {
    await sendTelegramMessage(chatId, msg.text);
  }
}

/**
 * Envoie le PDF de quittance via Telegram s'il est disponible dans le state.
 */
async function sendQuittancePdfIfAvailable(
  chatId: number,
  state: WorkflowState,
): Promise<void> {
  const data = state.data as Record<string, unknown>;
  const pdfBase64 = data['pdfBase64'] as string | undefined;
  const pdfFilename = data['pdfFilename'] as string | undefined;

  if (pdfBase64 && pdfFilename) {
    try {
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      await sendTelegramDocument(chatId, pdfBuffer, pdfFilename, `Quittance ${pdfFilename}`);
    } catch (err) {
      console.error('[quittance] erreur envoi PDF Telegram :', err instanceof Error ? err.message : err);
    }
  }
}

// ============================================================
// Bail workflow handlers
// ============================================================

/**
 * Gère un message texte dans le contexte du workflow bail.
 */
async function handleBailText(
  chatId: number,
  state: WorkflowState,
  text: string,
): Promise<Response> {
  const bailWf = getWorkflow('bail');
  if (!bailWf) {
    return Response.json({ ok: true });
  }

  // Si génération en cours, ignorer les messages texte
  if (state.step === 'generating') {
    await sendTelegramMessage(chatId, '🔄 Génération du bail en cours, patiente…');
    return Response.json({ ok: true });
  }

  await sendTypingAction(chatId);
  const result = await bailWf.handleMessage(chatId, state, text);

  // Mettre à jour le state
  if (result.newState) {
    setActiveWorkflow(chatId, result.newState);
  } else {
    clearActiveWorkflow(chatId);
  }

  // Envoyer les messages
  for (const msg of result.messages) {
    await sendTelegramMessage(chatId, msg.text);
  }

  // Si le workflow passe en generating → lancer la génération
  if (result.newState?.step === 'generating') {
    await handleBailGeneration(chatId, result.newState);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

/**
 * Gère un callback inline dans le contexte du workflow bail.
 */
async function handleBailCallback(
  chatId: number,
  state: WorkflowState,
  callbackData: string,
): Promise<Response> {
  const bailWf = getWorkflow('bail');
  if (!bailWf) {
    return Response.json({ ok: true });
  }

  await sendTypingAction(chatId);
  const result = await bailWf.handleCallback(chatId, state, callbackData);

  if (result.newState) {
    setActiveWorkflow(chatId, result.newState);
  } else {
    clearActiveWorkflow(chatId);
  }

  for (const msg of result.messages) {
    await sendTelegramMessage(chatId, msg.text);
  }

  // Si generating → lancer la génération
  if (result.newState?.step === 'generating') {
    await handleBailGeneration(chatId, result.newState);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

/**
 * Exécute la génération du bail (DOCX + PDF), uploade sur Drive,
 * envoie les documents sur Telegram.
 */
async function handleBailGeneration(
  chatId: number,
  state: WorkflowState,
): Promise<void> {
  const data = state.data as unknown as BailWorkflowData;

  if (!data.selectedLocataire || !data.dateDebut) {
    await sendTelegramMessage(chatId, '❌ Données incomplètes. Relance /bail.');
    clearActiveWorkflow(chatId);
    return;
  }

  try {
    const dateDebut = new Date(data.dateDebut);
    const dateSignature = data.dateSignature ? new Date(data.dateSignature) : undefined;

    const result = await generateBail(data.selectedLocataire, dateDebut, dateSignature);

    if (!result.success || !result.docxBuffer || !result.pdfBuffer || !result.filenameBase) {
      await sendTelegramMessage(chatId, `❌ Erreur : ${result.error ?? 'génération échouée'}`);
      clearActiveWorkflow(chatId);
      return;
    }

    // Envoyer le DOCX sur Telegram
    await sendTelegramDocument(
      chatId,
      result.docxBuffer,
      `${result.filenameBase}.docx`,
      `📄 Bail DOCX — ${data.selectedLocataire.nomAffiche}`,
    );

    // Envoyer le PDF sur Telegram
    await sendTelegramDocument(
      chatId,
      result.pdfBuffer,
      `${result.filenameBase}.pdf`,
      `📄 Bail PDF — ${data.selectedLocataire.nomAffiche}`,
    );

    // Message de confirmation avec liens Drive
    const parts = [`✅ Bail généré pour ${data.selectedLocataire.nomAffiche}`];
    if (result.driveLinks && result.driveLinks.length > 0) {
      parts.push('\n📁 Drive :');
      for (const link of result.driveLinks) {
        parts.push(`  ${link.type} : ${link.link}`);
      }
    }
    parts.push('\nMode inbox réactivé.');

    await sendTelegramMessage(chatId, parts.join('\n'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[bail] erreur génération : ${msg}`);
    await sendTelegramMessage(chatId, `❌ Erreur bail : ${msg.slice(0, 300)}`);
  }

  clearActiveWorkflow(chatId);
}

// ============================================================
// Fin de bail workflow handlers
// ============================================================

/**
 * Gère un message texte dans le contexte du workflow fin de bail.
 */
async function handleFinDeBailText(
  chatId: number,
  state: WorkflowState,
  text: string,
): Promise<Response> {
  const fdbWf = getWorkflow('findebail');
  if (!fdbWf) {
    return Response.json({ ok: true });
  }

  if (state.step === 'generating') {
    await sendTelegramMessage(chatId, '🔄 Génération de l\'attestation en cours, patiente…');
    return Response.json({ ok: true });
  }

  await sendTypingAction(chatId);
  const result = await fdbWf.handleMessage(chatId, state, text);

  if (result.newState) {
    setActiveWorkflow(chatId, result.newState);
  } else {
    clearActiveWorkflow(chatId);
  }

  for (const msg of result.messages) {
    await sendTelegramMessage(chatId, msg.text);
  }

  if (result.newState?.step === 'generating') {
    await handleFinDeBailGeneration(chatId, result.newState);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

/**
 * Gère un callback inline dans le contexte du workflow fin de bail.
 */
async function handleFinDeBailCallback(
  chatId: number,
  state: WorkflowState,
  callbackData: string,
): Promise<Response> {
  const fdbWf = getWorkflow('findebail');
  if (!fdbWf) {
    return Response.json({ ok: true });
  }

  await sendTypingAction(chatId);
  const result = await fdbWf.handleCallback(chatId, state, callbackData);

  if (result.newState) {
    setActiveWorkflow(chatId, result.newState);
  } else {
    clearActiveWorkflow(chatId);
  }

  for (const msg of result.messages) {
    await sendTelegramMessage(chatId, msg.text);
  }

  if (result.newState?.step === 'generating') {
    await handleFinDeBailGeneration(chatId, result.newState);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

/**
 * Exécute la génération de l'attestation fin de bail (PDF),
 * uploade sur Drive, envoie sur Telegram.
 */
async function handleFinDeBailGeneration(
  chatId: number,
  state: WorkflowState,
): Promise<void> {
  const data = state.data as unknown as FinDeBailWorkflowData;

  if (!data.selectedLocataire || !data.dateFin) {
    await sendTelegramMessage(chatId, '❌ Données incomplètes. Relance /findebail.');
    clearActiveWorkflow(chatId);
    return;
  }

  try {
    const dateFin = new Date(data.dateFin);
    const dateEmission = data.dateEmission ? new Date(data.dateEmission) : undefined;

    const result = await generateFinDeBail(data.selectedLocataire, dateFin, dateEmission);

    if (!result.success || !result.pdfBuffer || !result.filenameBase) {
      await sendTelegramMessage(chatId, `❌ Erreur : ${result.error ?? 'génération échouée'}`);
      clearActiveWorkflow(chatId);
      return;
    }

    // Envoyer le PDF sur Telegram
    await sendTelegramDocument(
      chatId,
      result.pdfBuffer,
      `${result.filenameBase}.pdf`,
      `📄 Attestation fin de bail — ${data.selectedLocataire.nomAffiche}`,
    );

    // Message de confirmation avec lien Drive
    const parts = [`✅ Attestation fin de bail générée pour ${data.selectedLocataire.nomAffiche}`];
    if (result.driveLink) {
      parts.push(`\n📁 Drive : ${result.driveLink}`);
    }
    parts.push('\nMode inbox réactivé.');

    await sendTelegramMessage(chatId, parts.join('\n'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[fin-de-bail] erreur génération : ${msg}`);
    await sendTelegramMessage(chatId, `❌ Erreur fin de bail : ${msg.slice(0, 300)}`);
  }

  clearActiveWorkflow(chatId);
}

// ============================================================
// Candidat workflow handlers
// ============================================================

/**
 * Gère un message texte dans le contexte du workflow candidat.
 */
async function handleCandidatText(
  chatId: number,
  state: WorkflowState,
  text: string,
): Promise<Response> {
  const candWf = getWorkflow('candidat');
  if (!candWf) {
    return Response.json({ ok: true });
  }

  if (state.step === 'creating_fiche') {
    await sendTelegramMessage(chatId, '🔄 Création de la fiche en cours, patiente…');
    return Response.json({ ok: true });
  }

  await sendTypingAction(chatId);
  const result = await candWf.handleMessage(chatId, state, text);

  if (result.newState) {
    setActiveWorkflow(chatId, result.newState);
  } else {
    clearActiveWorkflow(chatId);
  }

  for (const msg of result.messages) {
    await sendTelegramMessage(chatId, msg.text);
  }

  if (result.newState?.step === 'creating_fiche') {
    await handleCandidatCreation(chatId, result.newState);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

/**
 * Gère un callback inline dans le contexte du workflow candidat.
 */
async function handleCandidatCallback(
  chatId: number,
  state: WorkflowState,
  callbackData: string,
): Promise<Response> {
  const candWf = getWorkflow('candidat');
  if (!candWf) {
    return Response.json({ ok: true });
  }

  await sendTypingAction(chatId);
  const result = await candWf.handleCallback(chatId, state, callbackData);

  if (result.newState) {
    setActiveWorkflow(chatId, result.newState);
  } else {
    clearActiveWorkflow(chatId);
  }

  for (const msg of result.messages) {
    await sendTelegramMessage(chatId, msg.text);
  }

  if (result.newState?.step === 'creating_fiche') {
    await handleCandidatCreation(chatId, result.newState);
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

/**
 * Exécute la création de la fiche candidat sur Drive,
 * confirme sur Telegram.
 */
async function handleCandidatCreation(
  chatId: number,
  state: WorkflowState,
): Promise<void> {
  const data = state.data as unknown as CandidatWorkflowData;

  if (!data.nom || !data.prenom) {
    await sendTelegramMessage(chatId, '❌ Données incomplètes. Relance /candidat.');
    clearActiveWorkflow(chatId);
    return;
  }

  try {
    const result = await uploadCandidatFiche(data);

    if (!result.success) {
      await sendTelegramMessage(chatId, `❌ Erreur : ${result.error ?? 'création échouée'}`);
      clearActiveWorkflow(chatId);
      return;
    }

    const parts = [`✅ Fiche candidat créée : ${data.prenom} ${data.nom}`];
    if (result.webViewLink) {
      parts.push(`\n📁 Drive : ${result.webViewLink}`);
    }
    parts.push('\nMode inbox réactivé.');

    await sendTelegramMessage(chatId, parts.join('\n'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[candidat] erreur création fiche : ${msg}`);
    await sendTelegramMessage(chatId, `❌ Erreur candidat : ${msg.slice(0, 300)}`);
  }

  clearActiveWorkflow(chatId);
}
