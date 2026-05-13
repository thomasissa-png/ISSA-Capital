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

export const triageResultSchema = z.object({
  category: z.enum(TRIAGE_CATEGORIES),
  intent: z.string().min(1),
  confidence: z.number().min(0).max(1),
  matchedContact: z.string().nullable(),
  summary: z.string().min(1),
  suggestedActions: z.array(suggestedActionSchema),
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
