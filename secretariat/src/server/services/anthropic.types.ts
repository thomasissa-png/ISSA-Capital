/**
 * Types et schémas Zod pour le service Anthropic (Phase 3).
 *
 * Source de vérité : `docs/ia/secretariat-system-prompt.md` Section 3 (schéma Zod).
 *
 * Principes :
 *  - Le schéma Zod est la source unique de vérité — les types TS sont dérivés via z.infer.
 *  - Aucune valeur par défaut : toute absence d'un champ obligatoire = erreur explicite
 *    remontée à l'appelant (retry self-correction côté service anthropic.ts).
 *  - Les enums entite/type_reunion matchent EXACTEMENT le system prompt pour éviter
 *    toute dérive silencieuse entre le prompt et la validation backend.
 */

import { z } from 'zod';

// ============================================================
// Enums partagés — cohérence avec le system prompt
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

// ============================================================
// Participant — contact enrichi injecté dans le CR
// ============================================================

export const ParticipantSchema = z.object({
  prenom: z.string().min(1, 'prenom requis'),
  nom: z.string().min(1, 'nom requis'),
  titre: z.string().min(1, 'titre requis'),
  societe: z.string().min(1, 'societe requise'),
  qualite_relation: z.string().min(1, 'qualite_relation requise'),
});
export type Participant = z.infer<typeof ParticipantSchema>;

// ============================================================
// CRDraft — structure JSON d'un CR généré (hors clarification)
// ============================================================

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
});
export type CRDraft = z.infer<typeof CRDraftSchema>;

// ============================================================
// ClaudeResponse — enveloppe complète (clarification | ready)
// ============================================================

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

// ============================================================
// ContactRef — contact pré-identifié injectable dans l'input
// ============================================================

export const ContactRefSchema = z.object({
  id: z.string().min(1),
  prenom: z.string().min(1),
  nom: z.string().min(1),
  titre: z.string().optional(),
  societe: z.string().optional(),
  entites_visibles: z.array(EntiteSchema).optional(),
  notes: z.string().optional(),
});
export type ContactRef = z.infer<typeof ContactRefSchema>;

// ============================================================
// GenerateCRInput — payload d'appel du service
// ============================================================

export const GenerateCRInputSchema = z.object({
  rawInput: z
    .string()
    .min(1, 'rawInput requis')
    .max(5000, 'rawInput limité à 5000 caractères (anti-injection Phase 6)'),
  entity: EntiteSchema.optional(),
  contacts: z.array(ContactRefSchema).optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
      }),
    )
    .optional(),
  userPhone: z.string().min(1).default('thomas'),
});
export type GenerateCRInput = z.infer<typeof GenerateCRInputSchema>;

// ============================================================
// GenerateCRResult — sortie du service anthropic.generateCR
// ============================================================

export interface GenerateCRUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  model: string;
  latencyMs: number;
}

export interface GenerateCRResult {
  response: ClaudeResponse;
  usage: GenerateCRUsage;
}

// ============================================================
// Erreurs typées du service Anthropic
// ============================================================

export class AnthropicTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Appel Anthropic interrompu après ${timeoutMs}ms`);
    this.name = 'AnthropicTimeoutError';
  }
}

export class AnthropicParseError extends Error {
  constructor(
    message: string,
    public readonly rawContent: string,
  ) {
    super(message);
    this.name = 'AnthropicParseError';
  }
}

export class AnthropicSchemaError extends Error {
  constructor(
    message: string,
    public readonly issues: unknown,
  ) {
    super(message);
    this.name = 'AnthropicSchemaError';
  }
}
