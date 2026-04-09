/**
 * Types et schémas Zod pour le webhook Telegram / secrétariat MVP.
 *
 * Réutilise les mêmes schémas que secretariat/src/server/services/ mais
 * sans les dépendances Express/SQLite/Pino.
 *
 * Source de vérité : docs/ia/secretariat-system-prompt.md Section 3.
 */

import { z } from 'zod';

// ============================================================
// Telegram Update — schémas d'entrée
// ============================================================

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

export const TelegramPhotoSizeSchema = z.object({
  file_id: z.string(),
  file_unique_id: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  file_size: z.number().int().optional(),
});
export type TelegramPhotoSize = z.infer<typeof TelegramPhotoSizeSchema>;

export const TelegramMessageSchema = z
  .object({
    message_id: z.number().int(),
    from: TelegramUserSchema.optional(),
    chat: TelegramChatSchema,
    date: z.number().int(),
    text: z.string().optional(),
    photo: z.array(TelegramPhotoSizeSchema).optional(),
    caption: z.string().optional(),
  })
  .passthrough();
export type TelegramMessage = z.infer<typeof TelegramMessageSchema>;

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

export const TelegramUpdateSchema = z
  .object({
    update_id: z.number().int(),
    message: TelegramMessageSchema.optional(),
    callback_query: TelegramCallbackQuerySchema.optional(),
  })
  .passthrough();
export type TelegramUpdate = z.infer<typeof TelegramUpdateSchema>;

// ============================================================
// CR — schémas de sortie Claude
// ============================================================

export const EntiteSchema = z.enum(['IC', 'GO', 'VI', 'VV']);
export type Entite = z.infer<typeof EntiteSchema>;

export const TypeReunionSchema = z.enum([
  'dejeuner',
  'conseil',
  'appel',
  'interne',
  'visite-immo',
  'signature-contrat',
  'diner',
]);
export type TypeReunion = z.infer<typeof TypeReunionSchema>;

export const ParticipantSchema = z.object({
  prenom: z.string().min(1, 'prenom requis'),
  nom: z.string().min(1, 'nom requis'),
  titre: z.string().min(1, 'titre requis'),
  societe: z.string().min(1, 'societe requise'),
  qualite_relation: z.string().min(1, 'qualite_relation requise'),
});
export type Participant = z.infer<typeof ParticipantSchema>;

export const AnnexePhotographiqueSchema = z.object({
  numero: z.number().int(),
  legende: z.string().min(1, 'légende requise'),
});
export type AnnexePhotographique = z.infer<typeof AnnexePhotographiqueSchema>;

export const CRDraftSchema = z.object({
  reference_placeholder: z.literal('[REF_TO_BE_GENERATED]'),
  entite: EntiteSchema,
  type_reunion: TypeReunionSchema,
  date_reunion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_reunion doit être au format YYYY-MM-DD'),
  lieu: z.string().min(1, 'lieu requis'),
  participants: z.array(ParticipantSchema).min(1, 'au moins un participant requis'),
  objet: z.string().min(10, "objet doit contenir au moins 10 caractères"),
  montant_ttc_eur: z.number().positive().nullable(),
  etablissement_nom: z.string().nullable(),
  section_1_objet_art_39_1: z
    .string()
    .min(50, 'section_1 doit contenir au moins 50 caractères (Art. 39-1 CGI)'),
  section_2_points_abordes: z
    .string()
    .min(50, 'section_2 doit contenir au moins 50 caractères'),
  section_3_decisions: z
    .string()
    .min(20, 'section_3 doit contenir au moins 20 caractères'),
  section_4_suites_a_donner: z.string().nullable(),
  annexes_photographiques: z.array(AnnexePhotographiqueSchema).nullable().optional(),
});
export type CRDraft = z.infer<typeof CRDraftSchema>;

export const ClaudeResponseSchema = z
  .object({
    status: z.enum(['needs_clarification', 'ready']),
    clarification_question: z.string().nullable(),
    detected_entite: EntiteSchema.nullable(),
    detected_type: TypeReunionSchema.nullable(),
    cr: CRDraftSchema.nullable(),
  })
  .refine(
    (data) => {
      if (data.status === 'ready') {
        return data.cr !== null;
      }
      if (data.status === 'needs_clarification') {
        return data.clarification_question !== null && data.cr === null;
      }
      return true;
    },
    {
      message:
        "status='ready' requiert cr non-null ; status='needs_clarification' requiert clarification_question non-null et cr=null",
    },
  );
export type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>;
