/**
 * Types et schémas Zod pour le triage email — Anya.
 *
 * TriageResult = sortie du LLM (Haiku 4.5), validé par Zod.
 * Catégories alignées sur le prompt triage-v1.md.
 */

import { z } from 'zod';

// ============================================================
// Catégories
// ============================================================

export const TRIAGE_CATEGORIES = [
  'locataire',
  'candidat',
  'contact-pro',
  'apporteur',
  'spam',
  'a-classifier',
] as const;

export type TriageCategory = (typeof TRIAGE_CATEGORIES)[number];

// ============================================================
// Action suggérée
// ============================================================

export const suggestedActionSchema = z.object({
  type: z.enum([
    'append_historique',
    'update_frontmatter',
    'create_bien_stub',
    'add_todo',
    'skip',
  ]),
  target: z.string().nullable(),
  payload: z.record(z.unknown()),
});

export type SuggestedAction = z.infer<typeof suggestedActionSchema>;

// ============================================================
// TriageResult — schéma Zod complet
// ============================================================

/**
 * Codes entité projet connus (alignés sur calendar-ingest/event-mapper
 * PROJECT_ALIASES + vault-reader ENTITE_TO_FICHE_NAME).
 *   IC = ISSA Capital, GO = Gradient One, VI = Versi Immobilier,
 *   VV = Versi Invest, VM = Versimo, IM = Immocrew.
 */
export const PROJET_CODES = ['IC', 'GO', 'VI', 'VV', 'VM', 'IM'] as const;

export type ProjetCode = (typeof PROJET_CODES)[number];

export const triageResultSchema = z.object({
  category: z.enum(TRIAGE_CATEGORIES),
  intent: z.string().min(1),
  confidence: z.number().min(0).max(1),
  matchedContact: z.string().nullable(),
  summary: z.string().min(1),
  suggestedActions: z.array(suggestedActionSchema),
  /**
   * S23 — Code entité projet clairement concerné par l'email (match unique
   * certain). Le LLM le remplit SEULEMENT si un projet connu est explicitement
   * en jeu, sinon omet le champ. Alimente l'action `append_projet_historique`
   * (silencieuse). 0 / ambigu → omis.
   *
   * S25 (2026-05-29) : `.nullish()` au lieu de `.optional()`. Le LLM (DeepSeek
   * V4 / Anthropic) renvoie souvent `projet: null` explicitement plutôt que
   * d'omettre le champ ; `.optional()` rejetait ce `null` (n'accepte que
   * `undefined`), Zod failait, triage retournait `null` après retry,
   * `markFailed` silencieux → 0 brouillon créé. Cf. journal 29/05 09:00:07.
   */
  projet: z.enum(PROJET_CODES).nullish(),
  /**
   * S23 — Filenames des pièces jointes à conserver (jugement anti-clutter du
   * LLM). Seulement les PJ qui enrichissent un sujet suivi (facture, contrat,
   * bail, état des lieux, doc projet…). EXCLUT : signatures inline, pixels de
   * tracking, images < ~15 Ko, PJ de newsletters/marketing/spam. Dans le doute
   * → ne pas lister. Alimente l'action `copy_attachment` (proposée, validée).
   */
  attachments_to_keep: z.array(z.string()).optional(),
});

export type TriageResult = z.infer<typeof triageResultSchema>;

// ============================================================
// Contacts injectés en contexte
// ============================================================

export interface KnownContact {
  name: string;
  email: string;
  type: 'locataire' | 'pro';
}
