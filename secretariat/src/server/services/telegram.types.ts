/**
 * Types et schémas Zod pour le service Telegram Bot API.
 *
 * Source de vérité :
 *  - https://core.telegram.org/bots/api#update
 *  - https://core.telegram.org/bots/api#message
 *  - https://core.telegram.org/bots/api#callbackquery
 *
 * Principes :
 *  - Les schémas Zod sont la source unique de vérité — types dérivés via z.infer.
 *  - `.passthrough()` sur les objets pour absorber les champs Telegram non
 *    utilisés sans casser le parsing.
 *  - Les types `CommandType`, `SessionState`, `ConversationSession` et
 *    `ParsedCommand` sont réutilisés depuis `whatsapp.types.ts` (state machine
 *    identique) — on ne les redéfinit pas ici.
 */

import { z } from 'zod';

// ============================================================
// 1. Telegram Update — schémas d'entrée
// ============================================================

/**
 * Utilisateur Telegram (from).
 */
export const TelegramUserSchema = z
  .object({
    id: z.number().int(),
    is_bot: z.boolean().optional(),
    first_name: z.string(),
    last_name: z.string().optional(),
    username: z.string().optional(),
    language_code: z.string().optional(),
  })
  .passthrough();
export type TelegramUser = z.infer<typeof TelegramUserSchema>;

/**
 * Chat Telegram (privé, groupe, supergroupe ou channel).
 * Phase actuelle ne gère que les chats privés (type === 'private').
 */
export const TelegramChatSchema = z
  .object({
    id: z.number().int(),
    type: z.enum(['private', 'group', 'supergroup', 'channel']),
    title: z.string().optional(),
    username: z.string().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
  })
  .passthrough();
export type TelegramChat = z.infer<typeof TelegramChatSchema>;

/**
 * Message Telegram entrant.
 * Phase actuelle ne gère que les messages texte (text présent).
 */
export const TelegramMessageSchema = z
  .object({
    message_id: z.number().int(),
    from: TelegramUserSchema.optional(),
    chat: TelegramChatSchema,
    date: z.number().int(),
    text: z.string().optional(),
  })
  .passthrough();
export type TelegramMessage = z.infer<typeof TelegramMessageSchema>;

/**
 * Callback query (réponse à un inline keyboard button).
 * Déclenché quand l'utilisateur clique sur Valider/Modifier/Annuler.
 */
export const TelegramCallbackQuerySchema = z
  .object({
    id: z.string(),
    from: TelegramUserSchema,
    message: TelegramMessageSchema.optional(),
    chat_instance: z.string().optional(),
    data: z.string().optional(),
  })
  .passthrough();
export type TelegramCallbackQuery = z.infer<typeof TelegramCallbackQuerySchema>;

/**
 * Update Telegram — l'objet racine reçu sur le webhook.
 * Un Update contient soit un message, soit un callback_query, soit d'autres
 * types que l'on ignore (edited_message, channel_post, etc.).
 */
export const TelegramUpdateSchema = z
  .object({
    update_id: z.number().int(),
    message: TelegramMessageSchema.optional(),
    callback_query: TelegramCallbackQuerySchema.optional(),
  })
  .passthrough();
export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;

// ============================================================
// 2. Résultat d'envoi (sortant)
// ============================================================

/**
 * Résultat d'un appel sortant vers Telegram Bot API.
 * Cohérent avec `WhatsAppSendResult` : ne throw pas, caller lit `success`.
 */
export interface TelegramSendResult {
  success: boolean;
  /** Identifiant Telegram du message envoyé. */
  messageId?: number;
  /** Message d'erreur si success=false. */
  error?: string;
  /** HTTP status code de la réponse Telegram. */
  httpStatus?: number;
  /** Durée totale (incluant retries) en ms. */
  durationMs: number;
  /** Nombre de tentatives (1 = pas de retry). */
  attempts: number;
}

// ============================================================
// 3. Erreurs typées
// ============================================================

export class TelegramHttpError extends Error {
  constructor(
    public readonly httpStatus: number,
    message: string,
    public readonly bodyPreview: string,
  ) {
    super(message);
    this.name = 'TelegramHttpError';
  }
}

export class TelegramTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Appel Telegram API interrompu après ${timeoutMs}ms`);
    this.name = 'TelegramTimeoutError';
  }
}

export class TelegramParseError extends Error {
  constructor(
    message: string,
    public readonly rawPayload: string,
  ) {
    super(message);
    this.name = 'TelegramParseError';
  }
}

export class TelegramConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelegramConfigError';
  }
}
