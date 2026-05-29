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

import { timingSafeEqual } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { callLLM } from '@/lib/secretariat/llm/client';
import { loadSkill } from '@/lib/secretariat/skills/skill-loader';
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
import { formatPhoneForDisplay } from '@/lib/secretariat/whatsapp-ingest/whatsapp-ingest-runner';
import { writeBackCrToFiche } from '@/lib/secretariat/handlers/cr-writeback';
import { writeBackCrToContacts } from '@/lib/secretariat/handlers/cr-contact-writeback';
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
// S20.1 — `handleInboxMessage` (router texte Calendar/Todo.md) retiré du
// webhook (Bug 2 fix : violait SOT vault `Workflow Todo.md` en patchant
// directement Todo.md miroir). `handleInboxVoiceMessage` conservé pour les
// vocaux (scope vocal non couvert par les bugs S20.1, à traiter séparément).
// `handleRouterCallback` + `ROUTER_CALLBACK_PREFIX` conservés pour les
// callbacks anciens (TTL 7j historique inbox-edit S20.A qui partagent le
// préfixe `inbox_router:`). Suppression complète : S21.
// S20.2 — `handleInboxVoiceMessage` (router vocal Calendar/Todo.md) marqué
// @deprecated. Le vocal Telegram passe maintenant par le même flow que le texte
// court (transcription Whisper → parseAddTaskFromText → preview TickTick si
// `looksLikeTask`, sinon fallback note Drive). Verbatim Thomas S20.2 : "soit
// pas débile, évidemment qu'on intègre le vocal vu qu'on a plus qu'un flow".
// Suppression complète : S21 (kill-switch progressif).
import {
  handleRouterCallback,
  ROUTER_CALLBACK_PREFIX,
  transcribeWithWhisper,
} from '@/lib/secretariat/workflows/inbox-message-router';
import {
  handleInboxEditCallback,
  handleInboxEditText,
  hasActivePendingEdit,
} from '@/lib/secretariat/handlers/inbox-edit';
import {
  handleTelegramCallback as handleEmailValCallback,
  findNoMatchByCardMessageId,
  updateNoMatchUserContext,
  findWhatsappNoMatchByCardMessageId,
  updateWhatsappNoMatchUserContext,
  listActiveNoMatch,
  listActiveWhatsappNoMatch,
} from '@/lib/secretariat/telegram-validation';
import { handleHealthRenewed } from '@/lib/secretariat/telegram-validation/handlers/health-renewed';
import { handleHealthSnooze } from '@/lib/secretariat/telegram-validation/handlers/health-snooze';
import {
  TICKTICK_PROJECTS_CALLBACK_PREFIX,
  handleTickTickProjectsCallback,
} from '@/lib/secretariat/telegram-validation/handlers/ticktick-projects-confirm';
// S24 — voie hot-context inline supprimée : plus de carte `hotcontext:` ni de
// routage de texte d'édition. Le hot-context « vit seul » via la revue autonome
// (cron `cron-hot-context-review` : Haiku le soir, Sonnet le dimanche).
// S23 — désambiguïsation projet calendar-ingest, callback `calproj:` (R4)
import {
  CAL_PROJET_CALLBACK_PREFIX,
  handleCalProjetCallback,
} from '@/lib/secretariat/telegram-validation/handlers/cal-projet-confirm';
// S20 → S20.1 — Telegram → TickTick (PREVIEW flow) + callback `task_*` (R4)
// Bug 1 fix : carte preview avec 3 boutons (Valider/Modifier/Annuler) AVANT
//             création (vs création directe + Annuler en S20).
// Bug 2 fix : `handleInboxMessage` (router Calendar/Todo.md) plus appelé sur
//             texte libre — remplacé par `looksLikeTask` + preview TickTick.
import {
  previewAddTaskFromTelegram,
  parseAddTaskFromText,
  patchAndPreviewAddTaskFromInstruction,
  looksLikeTask,
} from '@/lib/secretariat/handlers/todo-from-telegram';
import {
  handleTaskCallback,
  TASK_CALLBACK_PREFIX,
} from '@/lib/secretariat/handlers/task';
import { handleEnrichirCommand } from '@/lib/secretariat/handlers/enrichir';
import { findLatestAwaitingEditForChat } from '@/lib/secretariat/task-pending-store';
// S19 — handler `tickticksync_delete:` retiré (completion silencieuse vault
// remplace la carte Telegram delete). Code mort supprimé.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================
// Constantes mode inbox / workflows
// ============================================================

/** Seuil de caractères pour la détection auto CR (texte long → workflow CR) */
const AUTO_CR_TEXT_THRESHOLD = 100;

// ============================================================
// System prompt CR — chargé depuis le vault (skill `cr-reunion`)
// ============================================================
//
// S21.2 — Option A : vault = SOT unique.
// Le system prompt CR est le contenu brut du SKILL.md vault
// `00. Me/08. Outils/Skills/cr-reunion/SKILL.md` (fallback repo si Drive down).
// On utilise le markdown complet (frontmatter inclus) — Thomas pilote le
// contenu côté vault, le code ne réécrit pas.
//
// S21.4 — Les contacts du vault Drive `07. Contacts/` sont LUS LIVE à chaque
// chargement (cache 1h dans vault-contacts.ts) et APPENDÉS systématiquement
// au system prompt sous la section `## Contacts récurrents (vault Drive)`.
// Plus de placeholder `[INJECTION_DATABASE_CONTACTS_ICI]` — le vault dicte
// le format et les contacts sont lus en parallèle. Fallback gracieux : si
// Drive down, le bloc reste vide et le LLM demande clarification.

async function loadCrSystemPrompt(): Promise<string> {
  // Lecture parallèle skill + contacts vault (les deux ont leur propre cache TTL)
  const [ctx, contactsBlock] = await Promise.all([
    loadSkill('cr-reunion'),
    formatContactsForPrompt().catch((err) => {
      console.warn(
        `[cr-system-prompt] erreur lecture contacts vault : ${err instanceof Error ? err.message : String(err)}`,
      );
      return '';
    }),
  ]);
  // Marqueur de la source pour debug en cas de fallback repo.
  // Le contenu complet est reconstruit depuis le SkillContext fields
  // mais le skill-loader ne ré-expose pas le markdown brut. On lit via
  // une seconde passe légère : le builder a déjà parsé, on s'en remet à
  // une concat des sections injectables + frontmatter sérialisé n'est pas
  // nécessaire ici. À la place, on charge le contenu brut via loadSkill
  // qui cache, et on relit le fichier original via les paths connus.
  //
  // Architecture choisie : le contenu brut est reconstruit en concaténant
  // les sections clés (5.1 red lines + 5.2 arbre + 5.4 exemple + section 4
  // recap) qui sont les seules INJECTÉES par contrat (cf. types.ts).
  const parts: string[] = [];
  parts.push(`# Skill : ${ctx.name}`);
  parts.push(`> Source : ${ctx.vaultPath}`);
  parts.push('');
  if (ctx.redLines) {
    parts.push('## Red lines');
    parts.push(ctx.redLines);
    parts.push('');
  }
  if (ctx.decisionTree) {
    parts.push('## Arbre de décision');
    parts.push(ctx.decisionTree);
    parts.push('');
  }
  if (ctx.recapTemplate) {
    parts.push('## Gabarit récap');
    parts.push(ctx.recapTemplate);
    parts.push('');
  }
  if (ctx.example) {
    parts.push('## Exemple');
    parts.push(ctx.example);
    parts.push('');
  }

  // S21.4 — Bloc contacts vault live (toujours présent si Drive accessible)
  if (contactsBlock && contactsBlock !== '(Aucun contact récurrent enregistré)') {
    parts.push('## Contacts récurrents (vault Drive)');
    parts.push(
      'Liste des contacts connus de Thomas (lue en direct depuis le vault Obsidian, section `07. Contacts/`). Utilise ces fiches pour identifier les personnes mentionnées en réunion. Si une personne n\'est pas dans cette liste, demande clarification ou propose de créer une fiche.',
    );
    parts.push('');
    parts.push(contactsBlock);
    parts.push('');
  }

  // S21.8 — Hotfix prod : le SKILL.md vault ne contient pas l'instruction de
  // sortie JSON stricte. Sans ce suffixe, Sonnet rédige le CR en markdown
  // narratif et le pipeline ne parse pas → pas de PDF généré.
  // Ce bloc est exigé par le contrat Zod côté backend (cr-schema.ts) et le
  // parsing regex (route.ts:466). Il NE doit PAS être déplacé dans le SKILL.md
  // vault — c'est une contrainte technique du code Anya, pas du contrat skill.
  parts.push('## FORMAT DE SORTIE OBLIGATOIRE');
  parts.push('');
  parts.push(
    'Tu réponds EXCLUSIVEMENT en JSON valide. Pas de texte hors JSON. Pas de markdown autour du JSON. Pas de bloc ```json. Schéma :',
  );
  parts.push('');
  parts.push('```');
  parts.push('{');
  parts.push('  "status": "needs_clarification" | "ready",');
  parts.push('  "clarification_question": string | null,');
  parts.push('  "detected_entite": "IC" | "GO" | "VI" | "VV" | null,');
  parts.push(
    '  "detected_type": "dejeuner" | "conseil" | "appel" | "interne" | "visite-immo" | "signature-contrat" | "diner" | null,',
  );
  parts.push('  "cr": {');
  parts.push('    "reference_placeholder": "[REF_TO_BE_GENERATED]",');
  parts.push('    "entite": "IC" | "GO" | "VI" | "VV",');
  parts.push(
    '    "type_reunion": "dejeuner" | "conseil" | "appel" | "interne" | "visite-immo" | "signature-contrat" | "diner",',
  );
  parts.push('    "date_reunion": "YYYY-MM-DD",');
  parts.push('    "lieu": string,');
  parts.push('    "participants": [');
  parts.push(
    '      { "prenom": string, "nom": string, "titre": string, "societe": string, "qualite_relation": string }',
  );
  parts.push('    ],');
  parts.push('    "objet": string,');
  parts.push('    "montant_ttc_eur": number | null,');
  parts.push('    "etablissement_nom": string | null,');
  parts.push('    "section_1_objet_art_39_1": string,');
  parts.push('    "section_2_points_abordes": string,');
  parts.push('    "section_3_decisions": string,');
  parts.push('    "section_4_suites_a_donner": string | null,');
  parts.push('    "annexes_photographiques": [ { "numero": number, "legende": string } ] | null');
  parts.push('  } | null');
  parts.push('}');
  parts.push('```');
  parts.push('');
  parts.push(
    '**Règle de routage** : si une information critique manque (entité, type de réunion, date, lieu, objet, ou identité d\'un participant non reconnu dans la base contacts vault), réponds avec `status: "needs_clarification"` + `clarification_question` (UNE seule question précise) + `cr: null`. Sinon, réponds avec `status: "ready"` + `cr: { ... }` rempli selon le contrat des règles juridiques (§ 6 du skill).',
  );
  parts.push('');
  parts.push(
    '**Aucune prose hors JSON.** Pas de rédaction en markdown du CR — le backend produit le PDF à partir du JSON. Si tu rédiges en markdown, le pipeline plante et aucun PDF n\'est généré.',
  );

  return parts.join('\n').trim();
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
// S22 — CR routé via `task:'cr'` (Anthropic Sonnet, web_search). Override env :
// LLM_TASK_OVERRIDE_CR ou ANTHROPIC_MODEL_OVERRIDE_SONNET.

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
    // S21.4 — Le system prompt CR contient déjà le bloc contacts vault
    // (lecture live + cache 1h) appendé par loadCrSystemPrompt(). Plus de
    // post-traitement nécessaire.
    const systemPrompt = await loadCrSystemPrompt();

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
    const { message } = await callLLM({
      task: 'cr',
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

    if (!message) {
      return { success: false, error: 'Réponse Claude absente (provider inattendu)' };
    }

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
        // Retry Zod du CR → reste sur Anthropic Sonnet (task:'cr'), sans tools.
        const { text: retryRawText } = await callLLM({
          task: 'cr',
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
    // S21.4 — Contacts vault déjà injectés par loadCrSystemPrompt()
    const systemPrompt = await loadCrSystemPrompt();

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
    const { message } = await callLLM({
      task: 'cr',
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

    if (!message) {
      return { success: false, error: 'Réponse Claude absente pour le message vocal (provider inattendu)' };
    }

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

  // /pending — liste les cartes no-match actives (audit S24 nuit).
  if (normalizedText === '/pending') {
    try {
      // Check préalable Drive : si pas de token, on évite le faux négatif
      // « 0 carte en attente » alors que Drive est juste KO.
      const { getAccessToken } = await import('@/lib/secretariat/drive-upload');
      const tok = await getAccessToken();
      if (!tok) {
        await sendTelegramMessage(
          chatId,
          '\u{26A0}\u{FE0F} Drive indisponible (pas de token OAuth2). Impossible de lire les pendings — réessaie dans quelques minutes.',
        );
        return Response.json({ ok: true });
      }
      const [emailPendings, waPendings] = await Promise.all([
        listActiveNoMatch(),
        listActiveWhatsappNoMatch(),
      ]);
      const total = emailPendings.length + waPendings.length;
      if (total === 0) {
        await sendTelegramMessage(chatId, '\u{2705} Aucune carte no-match en attente.');
        return Response.json({ ok: true });
      }
      const lines: string[] = [`\u{1F4CC} ${total} carte(s) no-match en attente :`, ''];
      const now = Date.now();
      const fmtAge = (iso: string): string => {
        const ms = now - new Date(iso).getTime();
        const h = Math.floor(ms / 3_600_000);
        if (h < 1) return 'il y a < 1h';
        if (h < 24) return `il y a ${h}h`;
        return `il y a ${Math.floor(h / 24)}j`;
      };
      for (const p of emailPendings) {
        const who = p.nameFrom ? `${p.nameFrom} <${p.emailFrom}>` : p.emailFrom;
        lines.push(`📧 Email — ${who} (${fmtAge(p.createdAt)})`);
        const hints = p.existingMatchHints ?? [];
        if (hints.length === 1) {
          lines.push(`   ⚠️ Homonyme : ${hints[0]!.displayName}`);
        } else if (hints.length > 1) {
          lines.push(`   ⚠️ ${hints.length} homonymes`);
        }
      }
      for (const p of waPendings) {
        // S26 H1 — formatage `+33 6 64 85 06 31` au lieu des 9 chiffres bruts
        // (récidive du Bug #1 que la PR #70 initiale avait raté ici).
        const phoneFmt = p.phone ? formatPhoneForDisplay(p.phone) : '';
        lines.push(
          `💬 WhatsApp — ${p.chatName}${phoneFmt ? ` (${phoneFmt})` : ''} (${fmtAge(p.createdAt)})`,
        );
        const hints = p.existingMatchHints ?? [];
        if (hints.length === 1) {
          lines.push(`   ⚠️ Homonyme : ${hints[0]!.displayName}`);
        } else if (hints.length > 1) {
          lines.push(`   ⚠️ ${hints.length} homonymes`);
        }
      }
      lines.push('');
      lines.push(
        '_Remonte le fil Telegram pour retrouver chaque carte et cliquer un type (ou Lier)._',
      );
      lines.push('_TTL pending : 7 jours (R3)._');
      await sendTelegramMessage(chatId, lines.join('\n'));
    } catch (err) {
      console.warn(
        `[/pending] erreur : ${err instanceof Error ? err.message : String(err)}`,
      );
      await sendTelegramMessage(chatId, `\u{274C} Erreur lecture pendings : ${err instanceof Error ? err.message : 'inconnue'}`);
    }
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
    // S24 nuit (post-audit) — guard transverse : reply VOCAL/PHOTO/DOCUMENT
    // à une carte no-match. Sans ça, le vocal partait dans `handleInboxVoice`
    // et devenait une todo aléatoire. Ack utile + return.
    const replyText = (update.message?.reply_to_message as { text?: string } | undefined)?.text ?? '';
    const replyToNoMatchCard =
      replyText.includes('Contact inconnu détecté') ||
      replyText.includes('Contact WhatsApp inconnu');
    const isNonTextReply =
      (update.message?.voice || update.message?.photo?.length || update.message?.document) &&
      update.message?.text === undefined &&
      update.message?.reply_to_message;
    if (replyToNoMatchCard && isNonTextReply && update.message) {
      const chatId = update.message.chat.id;
      if (isAllowedChatId(chatId)) {
        await sendTelegramMessage(
          chatId,
          "\u{1F50A} Reply non-texte à une carte contact : seul le TEXTE est capté comme contexte. " +
            "Réponds en texte (ou crée la fiche puis utilise `/enrichir <nom>` après).",
        );
      }
      return Response.json({ ok: true });
    }

    // 3a. Message texte — router 3 niveaux
    if (update.message?.text !== undefined) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      // Whitelist
      if (!isAllowedChatId(chatId)) {
        console.warn(`[telegram-webhook] chat_id ${chatId} non autorisé`);
        return Response.json({ ok: true });
      }

      // ── S24 soir — Reply à une carte no-match (email OU WhatsApp) ────
      // Si Thomas répond à une carte avec un texte AVANT de cliquer un bouton,
      // on capture ce texte comme contexte du pending — il sera intégré à la
      // fiche au moment du clic (priorité dans la section « Qui c'est »).
      //
      // S24 nuit (post-audit) — détection de reply à carte EXPIRÉE :
      // si le `reply_to_message` est manifestement une carte no-match (texte
      // contient « Contact inconnu » / « Contact WhatsApp inconnu ») mais
      // aucun pending ne matche son `message_id` (déjà traité ou expiré 7j),
      // on ack « carte expirée » et on RETURN — sans tomber dans le pipeline
      // normal qui aurait créé une fausse tâche TickTick.
      const repliedToId = update.message.reply_to_message?.message_id;
      const repliedToText = (update.message.reply_to_message as { text?: string } | undefined)?.text ?? '';
      const looksLikeNoMatchCard =
        repliedToText.includes('Contact inconnu détecté') ||
        repliedToText.includes('Contact WhatsApp inconnu');

      if (repliedToId && text.trim().length > 0) {
        const userContext = text.trim();
        try {
          const emailNoMatch = await findNoMatchByCardMessageId(repliedToId);
          if (emailNoMatch) {
            const ok = await updateNoMatchUserContext(emailNoMatch.id, userContext);
            if (ok) {
              const who = emailNoMatch.nameFrom
                ? `${emailNoMatch.nameFrom} (${emailNoMatch.emailFrom})`
                : emailNoMatch.emailFrom;
              // S26 — Wording renforcé : « quand tu veux » sonnait optionnel,
              // Thomas oubliait de cliquer après reply (cas Mélanie Toledano
              // 28/05 — contexte tapé, jamais cliqué Pro). Reformulation
              // impérative + emoji visuel direct vers la carte au-dessus.
              // S26 — Wording renforcé : « quand tu veux » sonnait optionnel,
              // Thomas oubliait de cliquer après reply (cas Mélanie Toledano
              // 28/05). Reformulation impérative MAJUSCULES + flèche visuelle.
              // (sendTelegramMessage n'envoie pas de parse_mode → plain text.)
              await sendTelegramMessage(
                chatId,
                `\u{1F4DD} Contexte noté pour ${who}.\n\n` +
                  `\u{26A0}\u{FE0F} POUR CRÉER LA FICHE : clique sur le type ` +
                  `(Pro / Famille / Amis / Autres) sur la carte ci-dessus \u{2B06}\u{FE0F}`,
              );
              return Response.json({ ok: true });
            }
          }
          const waNoMatch = await findWhatsappNoMatchByCardMessageId(repliedToId);
          if (waNoMatch) {
            const ok = await updateWhatsappNoMatchUserContext(waNoMatch.id, userContext);
            if (ok) {
              await sendTelegramMessage(
                chatId,
                `\u{1F4DD} Contexte noté pour « ${waNoMatch.chatName} ».\n\n` +
                  `\u{26A0}\u{FE0F} POUR CRÉER LA FICHE : clique sur le type ` +
                  `(Pro / Famille / Amis / Autres) sur la carte ci-dessus \u{2B06}\u{FE0F}`,
              );
              return Response.json({ ok: true });
            }
          }
          // Pas de pending matché. Si c'est manifestement un reply à une carte
          // no-match (texte d'origine reconnaissable) → carte expirée/cliquée.
          // ack utile + RETURN pour ne pas créer une fausse tâche TickTick.
          if (looksLikeNoMatchCard) {
            await sendTelegramMessage(
              chatId,
              "\u{26A0}\u{FE0F} Cette carte a déjà été traitée ou a expiré (TTL 7j). " +
                "Si tu veux compléter une fiche existante, utilise `/enrichir <nom>`.",
            );
            return Response.json({ ok: true });
          }
          // Sinon (reply à un autre message bot — CR, todo, etc.) → on laisse
          // passer au pipeline normal.
        } catch (ctxErr) {
          console.warn(
            `[telegram-webhook] capture contexte no-match KO : ${ctxErr instanceof Error ? ctxErr.message : String(ctxErr)}`,
          );
          // ne pas bloquer le flux normal
        }
      }

      // (le guard voice/photo en reply à carte no-match est posé plus haut
      //  dans la dispatch — cf. juste avant le branchement texte/voice/photo.)

      const normalizedText = text.trim().toLowerCase();

      // ── S20.1 — slash command /todo → PREVIEW flow ──────────────
      // Doit être traité AVANT handleSlashCommand pour préserver la casse du
      // titre. Fix Bug 1 : affiche carte preview avec 3 boutons (Valider /
      // Modifier / Annuler) au lieu de créer direct + bouton Annuler.
      // R4 : préfixes `task_validate:`, `task_modify:`, `task_cancel_preview:`
      //      → handler dédié `task.ts` + dispatch + tests E2E.
      if (normalizedText.startsWith('/todo') || normalizedText.startsWith('/task ')) {
        const messageId = update.message.message_id;
        const parsed = await parseAddTaskFromText(text);
        await previewAddTaskFromTelegram({
          chatId,
          messageId,
          parsed,
        });
        return Response.json({ ok: true });
      }

      // ── S24 — slash command /enrichir <nom> → enrichit une fiche contact ──
      // AVANT handleSlashCommand pour préserver la casse du nom recherché.
      if (normalizedText.startsWith('/enrichir')) {
        const query = text.trim().replace(/^\/enrichir(@\w+)?\s*/i, '').trim();
        await handleEnrichirCommand(chatId, query);
        return Response.json({ ok: true });
      }

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

      // ── Niveau 2c : édition conversationnelle inbox-preview (S20.A) ──
      // Un pending-edit (carte preview en attente d'une saisie) ne doit JAMAIS
      // court-circuiter un workflow actif ni un batch photo en cours :
      // - un pending-edit fantôme (Thomas a cliqué ✏️ puis lancé /cr ou un
      //   autre flow sans répondre) reste 7j dans le store globalThis Map ;
      // - sans cette priorité, il intercepterait tout texte → workflow CR
      //   ne reçoit plus les réponses de Thomas → demande photos prématurée.
      // Hotfix S20.B : ce check vient APRÈS workflow + batch photo.
      if (await hasActivePendingEdit(chatId)) {
        await handleInboxEditText(text, chatId);
        return Response.json({ ok: true });
      }

      // ── Niveau 2d : modification d'une carte preview TickTick (S20.1 → S20.2) ──
      // Thomas a cliqué ✏️ Modifier sur une carte preview tâche → le pending
      // est en phase `awaiting_edit`. Le prochain message texte est traité
      // comme une INSTRUCTION PARTIELLE (ex: "à 15h", "change Martin en Marc")
      // via `patchDraftFromInstruction` — JAMAIS re-parsé à zéro (Fix S20.2
      // Thomas : "modifier ne veut pas dire retaper le texte").
      // Priorité juste après inbox-edit pour le même raisonnement (un pending
      // fantôme ne doit pas avaler les workflows).
      const awaitingTaskEdit = findLatestAwaitingEditForChat(chatId);
      if (awaitingTaskEdit) {
        await patchAndPreviewAddTaskFromInstruction({
          chatId,
          messageId: update.message.message_id,
          pending: awaitingTaskEdit,
          instruction: text,
        });
        return Response.json({ ok: true });
      }

      // ── Niveau 2e SUPPRIMÉ (S24) : édition de patch hot-context inline retirée
      //    (le hot-context vit seul via la revue autonome). ──

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

      // Texte court en mode inbox (S20.1 — fix Bug 2 : kill router Calendar) :
      //   1. Parse via Sonnet pour extraire titre + date éventuelle.
      //   2. Si `looksLikeTask` (verbe d'action OU date présente) → preview TickTick.
      //   3. Sinon → fallback note Drive (texte trop court / pas tâche).
      //
      // L'ancien router `handleInboxMessage` (Calendar/Todo.md) est désactivé
      // car il violait le SOT vault `08. Outils/Anya/Skills/Workflow Todo.md`
      // (TickTick = hub unique, Todo.md miroir read-only). Suppression S21
      // (kill-switch progressif, pattern S18). Le module reste importé pour
      // ses prefixes inbox-edit utilisés ailleurs.
      //
      // Priorité handlers texte (mise à jour S20.1) :
      //   1. Commande slash → handleSlashCommand
      //   2. Workflow actif → handler du workflow
      //   3. Batch photo en attente de date → handleDateReply
      //   4. Pending inbox-edit awaiting → handleInboxEditText
      //   5. Pending task awaiting_edit → patchAndPreviewAddTaskFromInstruction (S20.2)
      //   6. Texte long → auto-CR
      //   7. Texte court tâche-like → preview TickTick (3 boutons)
      //   8. Sinon → note Drive
      try {
        const parsedTask = await parseAddTaskFromText(text);
        if (
          parsedTask.title &&
          parsedTask.title.trim().length > 0 &&
          looksLikeTask(text, parsedTask)
        ) {
          await previewAddTaskFromTelegram({
            chatId,
            messageId: update.message.message_id,
            parsed: parsedTask,
          });
          return Response.json({ ok: true });
        }
      } catch (err) {
        // Best-effort : si le parsing Sonnet crashe, on fallback note Drive
        // (jamais bloquer Thomas).
        console.warn(
          `[telegram-webhook] parseAddTaskFromText échoué (fallback note Drive) : ${err instanceof Error ? err.message : String(err)}`,
        );
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

      // S20.2 — Mode inbox vocal : exactement le même flow que le texte court.
      //   1. Transcription Whisper (OpenAI).
      //   2. Si KO → fallback upload direct Drive (comportement préservé).
      //   3. Si OK → parseAddTaskFromText + looksLikeTask → preview TickTick.
      //   4. Sinon → fallback note Drive (texte transcrit comme caption éventuelle).
      //
      // L'ancien router `handleInboxVoiceMessage` (Calendar/Todo.md) n'est PLUS
      // appelé : TickTick = hub unique, Todo.md miroir read-only (SOT vault
      // `08. Outils/Anya/Skills/Workflow Todo.md`).
      await sendTypingAction(chatId);
      const transcript = await transcribeWithWhisper(
        audioResult.base64,
        audioResult.mimeType ?? 'audio/ogg',
      );

      if (!transcript.success || !transcript.text) {
        console.warn(
          `[telegram-webhook] transcription Whisper KO (${transcript.error ?? 'inconnue'}) — fallback upload Drive direct`,
        );
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

      // Transcription OK : appliquer EXACTEMENT le même flow que texte court.
      const voiceText = transcript.text;
      try {
        const parsedTask = await parseAddTaskFromText(voiceText);
        if (
          parsedTask.title &&
          parsedTask.title.trim().length > 0 &&
          looksLikeTask(voiceText, parsedTask)
        ) {
          await previewAddTaskFromTelegram({
            chatId,
            messageId: update.message!.message_id,
            parsed: parsedTask,
          });
          return Response.json({ ok: true });
        }
      } catch (err) {
        console.warn(
          `[telegram-webhook] parseAddTaskFromText échoué sur vocal (fallback note Drive) : ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Fallback : sauvegarder le vocal comme note Drive (comportement préservé).
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

      // Inbox edit — callbacks préfixés par "cb_inbox_edit_{titre|date|heure|lieu}_"
      // (S20.A — R4 : handler dédié + dispatch + tests)
      if (callbackData.startsWith('cb_inbox_edit_')) {
        await handleInboxEditCallback(
          callbackData,
          callbackChatId,
          update.callback_query.message?.message_id ?? 0,
        );
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

      // Validation Telegram — callbacks préfixés `email_val:` / `email_nomatch:`
      // (email-ingest) ou `wa_nomatch:` (WhatsApp ingest, S24 soir).
      // handleTelegramCallback dispatch en interne entre les 3 préfixes.
      if (
        callbackData.startsWith('email_val:') ||
        callbackData.startsWith('email_nomatch:') ||
        callbackData.startsWith('wa_nomatch:')
      ) {
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

      // Calendar-ingest — désambiguïsation projet, préfixe "calproj:" (S23, R4)
      // Réunion matchant 2+ projets → Thomas choisit le projet à rattacher.
      if (callbackData.startsWith(CAL_PROJET_CALLBACK_PREFIX)) {
        await handleCalProjetCallback({
          callback_query_id: callbackQueryId,
          data: callbackData,
          message_id: update.callback_query.message?.message_id ?? 0,
          chat_id: callbackChatId,
        });
        return Response.json({ ok: true });
      }

      // Hot-context inline SUPPRIMÉ (S24) : plus de callback `hotcontext:`.

      // S20 — Telegram → TickTick : callback `task_*` (R4)
      // Annulation tâche créée depuis Telegram (decision Thomas : completeTask
      // par défaut, marque [x] côté TickTick, disparaît du miroir au prochain
      // render). Voir handlers/task.ts + docs/ia/ticktick-gap-analysis-s20.md.
      if (callbackData.startsWith(TASK_CALLBACK_PREFIX)) {
        await handleTaskCallback({
          callbackQueryId,
          callbackData,
          chatId: callbackChatId,
          messageId: update.callback_query.message?.message_id ?? 0,
        });
        return Response.json({ ok: true });
      }

      // S19 — dispatch `tickticksync_delete:` retiré : completion silencieuse
      // vault remplace la carte Telegram delete (décision Thomas S19 :
      // « Si je supprime des tâches dans TickTick, Anya pas besoin de me le dire »).
      // Tout callback résiduel de ce préfixe (TTL 7j historique) tombera dans
      // le default no-op du switch ci-dessous.

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

                // 6ter. Write-back CR → fiches CONTACT des participants (S24).
                // Symétrique du projet : ligne d'historique + lien PDF sur la
                // fiche de chaque participant matché par nom. Idempotent. Le
                // write-back contact ne doit jamais casser le workflow CR.
                try {
                  const contactWb = await writeBackCrToContacts({
                    participants: pendingDraft.cr.participants,
                    crDate: pendingDraft.cr.date_reunion,
                    crTitle: craftTitle,
                    crWebViewLink: driveLink,
                    crFilename: pdfFilename,
                    entiteCode: pendingDraft.cr.entite,
                  });
                  console.info(
                    `[telegram-webhook] write-back contacts : ${contactWb.enriched} enrichies, ${contactWb.skippedIdempotent} déjà à jour, ${contactWb.notMatched.length} non matchées${contactWb.notMatched.length ? ` (${contactWb.notMatched.join(', ')})` : ''}${contactWb.ambiguous.length ? `, ${contactWb.ambiguous.length} ambigus (${contactWb.ambiguous.join(', ')})` : ''}${contactWb.errors ? `, ${contactWb.errors} erreurs` : ''}`,
                  );
                } catch (wbErr) {
                  console.warn(
                    '[telegram-webhook] write-back fiches contact exception :',
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
