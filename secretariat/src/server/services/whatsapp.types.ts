/**
 * Types et schémas Zod pour le service WhatsApp Cloud API (Phase 2).
 *
 * Source de vérité :
 *  - `docs/ia/secretariat-architecture.md` Section 7 (format webhook Meta,
 *    endpoint d'envoi, limites 4096 chars).
 *  - `docs/ia/secretariat-architecture.md` Section 2.5 (table whatsapp_sessions).
 *  - Meta Cloud API v21.0 : https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 *
 * Principes :
 *  - Les schémas Zod sont la source unique de vérité — types dérivés via z.infer.
 *  - Le schéma Meta est permissif (`.passthrough()`) pour absorber les ajouts
 *    côté Meta sans casser le parsing.
 *  - Les types `CommandType` et `SessionState` miroirent EXACTEMENT les valeurs
 *    stockées en SQLite (colonne `state` de `whatsapp_sessions`).
 */

import { z } from 'zod';

// ============================================================
// 1. Webhook Meta Cloud API — schémas d'entrée
// ============================================================

/**
 * Type de message WhatsApp entrant. Phase 2 ne gère nativement que `text`
 * (les médias sont parsés mais pas traités — le handler répond une question
 * de clarification "merci d'envoyer du texte").
 */
export const WhatsAppMessageTypeSchema = z.enum([
  'text',
  'image',
  'audio',
  'video',
  'document',
  'sticker',
  'location',
  'contacts',
  'interactive',
  'button',
  'reaction',
  'unsupported',
]);
export type WhatsAppMessageType = z.infer<typeof WhatsAppMessageTypeSchema>;

/**
 * Contenu d'un message texte Meta. Meta envoie `body` en UTF-8 brut.
 */
export const WhatsAppTextContentSchema = z.object({
  body: z.string(),
});

/**
 * Metadata d'un média (image / audio / document / video).
 * Phase 2 n'utilise pas `id` (pas de download), mais on le parse pour logger.
 */
export const WhatsAppMediaContentSchema = z
  .object({
    id: z.string().optional(),
    mime_type: z.string().optional(),
    sha256: z.string().optional(),
    filename: z.string().optional(),
    caption: z.string().optional(),
  })
  .passthrough();

/**
 * Réponse utilisateur à un bouton interactif (commandes valider/annuler/modifier).
 */
export const WhatsAppInteractiveContentSchema = z
  .object({
    type: z.string(),
    button_reply: z
      .object({
        id: z.string(),
        title: z.string(),
      })
      .optional(),
    list_reply: z
      .object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

/**
 * Un message WhatsApp entrant. Forme stable v21.0 Meta Cloud API.
 * Les champs non utilisés sont absorbés par `.passthrough()`.
 */
export const WhatsAppIncomingMessageSchema = z
  .object({
    from: z.string().min(1, 'message.from requis'),
    id: z.string().min(1, 'message.id requis'),
    timestamp: z.string().min(1, 'message.timestamp requis'),
    type: WhatsAppMessageTypeSchema,
    text: WhatsAppTextContentSchema.optional(),
    image: WhatsAppMediaContentSchema.optional(),
    audio: WhatsAppMediaContentSchema.optional(),
    video: WhatsAppMediaContentSchema.optional(),
    document: WhatsAppMediaContentSchema.optional(),
    interactive: WhatsAppInteractiveContentSchema.optional(),
    button: z
      .object({
        payload: z.string().optional(),
        text: z.string().optional(),
      })
      .optional(),
    context: z
      .object({
        from: z.string().optional(),
        id: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
export type WhatsAppIncomingMessage = z.infer<typeof WhatsAppIncomingMessageSchema>;

/**
 * Un contact WhatsApp (profile + wa_id).
 */
export const WhatsAppContactSchema = z
  .object({
    profile: z
      .object({
        name: z.string().optional(),
      })
      .optional(),
    wa_id: z.string().min(1),
  })
  .passthrough();
export type WhatsAppContact = z.infer<typeof WhatsAppContactSchema>;

/**
 * Value contenu dans `entry[].changes[].value` — wrapper des messages.
 */
export const WhatsAppWebhookValueSchema = z
  .object({
    messaging_product: z.literal('whatsapp').optional(),
    metadata: z
      .object({
        display_phone_number: z.string().optional(),
        phone_number_id: z.string().optional(),
      })
      .passthrough()
      .optional(),
    contacts: z.array(WhatsAppContactSchema).optional(),
    messages: z.array(WhatsAppIncomingMessageSchema).optional(),
    statuses: z.array(z.unknown()).optional(),
  })
  .passthrough();
export type WhatsAppWebhookValue = z.infer<typeof WhatsAppWebhookValueSchema>;

/**
 * Un `change` au sein d'une `entry` — chaque change cible un `field`.
 * Phase 2 ne gère que `field === "messages"`.
 */
export const WhatsAppWebhookChangeSchema = z
  .object({
    field: z.string(),
    value: WhatsAppWebhookValueSchema,
  })
  .passthrough();
export type WhatsAppWebhookChange = z.infer<typeof WhatsAppWebhookChangeSchema>;

/**
 * Une `entry` dans le payload webhook — 1 entry par WABA.
 */
export const WhatsAppWebhookEntrySchema = z
  .object({
    id: z.string().optional(),
    changes: z.array(WhatsAppWebhookChangeSchema),
  })
  .passthrough();
export type WhatsAppWebhookEntry = z.infer<typeof WhatsAppWebhookEntrySchema>;

/**
 * Payload webhook complet envoyé par Meta. Le champ `object` vaut toujours
 * `whatsapp_business_account` pour les webhooks WhatsApp.
 */
export const WhatsAppWebhookPayloadSchema = z
  .object({
    object: z.string(),
    entry: z.array(WhatsAppWebhookEntrySchema),
  })
  .passthrough();
export type WhatsAppWebhookPayload = z.infer<typeof WhatsAppWebhookPayloadSchema>;

// ============================================================
// 2. Envoi de messages sortants (Meta Cloud API)
// ============================================================

/**
 * Payload envoyé à `POST graph.facebook.com/v21.0/{phoneId}/messages`
 * pour un message texte simple.
 */
export interface WhatsAppSendTextPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: {
    body: string;
    preview_url?: boolean;
  };
}

/**
 * Payload pour un message interactif à boutons (max 3 boutons Meta).
 * Utilisé pour la confirmation de publication (valider / modifier / annuler).
 */
export interface WhatsAppSendInteractiveButtonsPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    body: {
      text: string;
    };
    action: {
      buttons: Array<{
        type: 'reply';
        reply: {
          id: string;
          title: string;
        };
      }>;
    };
  };
}

/**
 * Résultat d'un appel sortant vers Meta.
 * Cohérent avec `CraftPublishResult` : ne throw pas, caller lit `success`.
 */
export interface WhatsAppSendResult {
  success: boolean;
  /** Identifiant Meta du message envoyé (wamid.xxx). */
  messageId?: string;
  /** Message d'erreur si success=false. */
  error?: string;
  /** HTTP status code de la réponse Meta. */
  httpStatus?: number;
  /** Durée totale (incluant retries) en ms. */
  durationMs: number;
  /** Nombre de tentatives (1 = pas de retry). */
  attempts: number;
}

// ============================================================
// 3. Sessions conversationnelles (table whatsapp_sessions)
// ============================================================

/**
 * États possibles d'une session. Doit matcher EXACTEMENT la valeur stockée
 * dans la colonne `state` de `whatsapp_sessions` (architecture Section 2.5).
 */
export const SessionStateSchema = z.enum([
  'idle',
  'drafting',
  'clarifying',
  'awaiting_publish_confirm',
  'abandoned',
]);
export type SessionState = z.infer<typeof SessionStateSchema>;

/**
 * Projection TypeScript d'une ligne de `whatsapp_sessions`.
 */
export interface ConversationSession {
  conversationId: string;
  userPhone: string;
  activeDraftId: string | null;
  state: SessionState;
  lastMessageAt: string;
  expiresAt: string;
}

// ============================================================
// 4. Commandes reconnues dans le dispatcher
// ============================================================

/**
 * Commandes reconnues par le dispatcher WhatsApp.
 *
 * - `finalize` → "terminer", "stop", "fin" : déclenche la génération Anthropic.
 * - `validate` → "valider", "ok" : déclenche la publication Craft.
 * - `cancel` → "annuler" : marque la session en `abandoned`.
 * - `content` → message libre à ajouter au contenu accumulé.
 */
export type CommandType = 'finalize' | 'validate' | 'cancel' | 'content';

/**
 * Résultat du parsing d'une commande.
 */
export interface ParsedCommand {
  type: CommandType;
  /** Texte brut reçu (normalisé en lowercase + trim pour commandes). */
  raw: string;
}

// ============================================================
// 5. Erreurs typées
// ============================================================

export class WhatsAppHttpError extends Error {
  constructor(
    public readonly httpStatus: number,
    message: string,
    public readonly bodyPreview: string,
  ) {
    super(message);
    this.name = 'WhatsAppHttpError';
  }
}

export class WhatsAppTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Appel WhatsApp API interrompu après ${timeoutMs}ms`);
    this.name = 'WhatsAppTimeoutError';
  }
}

export class WhatsAppParseError extends Error {
  constructor(
    message: string,
    public readonly rawPayload: string,
  ) {
    super(message);
    this.name = 'WhatsAppParseError';
  }
}

export class WhatsAppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppConfigError';
  }
}
