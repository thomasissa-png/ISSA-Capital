/**
 * Types pour les handlers email-ingest — Anya.
 *
 * Un handler prend un TriageResult + EmailMessage et retourne
 * une liste de ActionProposal (jamais void).
 * Les actions ne sont exécutées qu'après validation Telegram ("Valider").
 *
 * Spec: second-cerveau/Anya - Plan email-ingest.md section Jalon 4.
 */

import type { EmailMessage } from '../gmail-source/types';
import type { TriageResult } from '../triage/types';

// ============================================================
// ActionProposal
// ============================================================

export type ActionType =
  | 'append_historique'
  | 'update_frontmatter'
  | 'create_file'
  | 'create_bien_stub'
  | 'add_todo'
  | 'mark_processed'
  | 'skip';

export interface ActionProposal {
  /** Type d'action à exécuter via vault-client */
  type: ActionType;
  /** Chemin vault cible si applicable (ex: "07. Contacts/01. Pro/Martin Yhuel.md") */
  target: string | null;
  /** Données de l'action (contenu à ajouter, champs à modifier, etc.) */
  payload: Record<string, unknown>;
  /** Description humain-lisible affichée dans la carte Telegram */
  description: string;
}

// ============================================================
// Handler
// ============================================================

/**
 * Signature d'un handler email-ingest.
 *
 * Chaque handler analyse le TriageResult + EmailMessage et retourne
 * une liste ordonnée d'actions à proposer à Thomas via Telegram.
 *
 * Convention : le handler ne modifie JAMAIS le vault directement.
 * L'exécution est déléguée au callback-handler après validation.
 */
export type EmailHandler = (
  triage: TriageResult,
  email: EmailMessage,
) => Promise<ActionProposal[]>;
