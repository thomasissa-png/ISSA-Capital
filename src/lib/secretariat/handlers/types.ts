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
  | 'skip'
  | 'prompt_create_contact_choice'
  // S23 — email-ingest cohérent
  /** Enrichit l'historique de la fiche Projet (silencieux, match certain). */
  | 'append_projet_historique'
  /** Copie une pièce jointe pertinente vers le vault (proposé, validé). */
  | 'copy_attachment'
  /** Met à jour le briefing hot-context.md (proposé, validé, carte hotcontext:). */
  | 'update_hot_context';

export interface ActionProposal {
  /** Type d'action à exécuter via vault-client */
  type: ActionType;
  /** Chemin vault cible si applicable (ex: "07. Contacts/01. Pro/Martin Yhuel.md") */
  target: string | null;
  /** Données de l'action (contenu à ajouter, champs à modifier, etc.) */
  payload: Record<string, unknown>;
  /** Description humain-lisible affichée dans la carte Telegram */
  description: string;
  /**
   * Si true, l'action est exécutée automatiquement (sans validation Telegram).
   * Utilisé pour les actions "sûres" : append historique + maj date pour
   * un contact existant (S18.5, décision Thomas verbatim :
   * "pour les contacts existants, je veux que l'histo soit ajouté
   * automatiquement").
   *
   * Le runner email-ingest sépare les actions autoExecute du pending Telegram :
   *   - autoExecute=true → exécution immédiate via callback-handler.executeAction
   *   - autoExecute=false/undefined → mises dans le pending, validation Thomas
   *
   * Si TOUTES les actions sont autoExecute, aucune carte Telegram n'est envoyée
   * (Anya silencieuse). C'est le comportement attendu pour les emails d'un
   * contact connu.
   */
  autoExecute?: boolean;
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
