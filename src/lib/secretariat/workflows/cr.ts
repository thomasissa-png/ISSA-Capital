/**
 * Workflow CR — wrapper autour de la logique CR existante.
 *
 * Phase 1 : wrapper léger. La logique lourde (generateCR, generateCRFromVoice,
 * validation, PDF, etc.) reste dans route.ts. Ce fichier expose uniquement
 * l'interface Workflow pour le router.
 *
 * Phase 1.5 (future) : extraction propre des fonctions CR dans ce module.
 */

import type { Workflow, WorkflowState, WorkflowResponse } from './types';

// ============================================================
// Constantes
// ============================================================

/** TTL du workflow CR : 24 heures */
const CR_TTL_MS = 24 * 60 * 60 * 1000;

// ============================================================
// Workflow CR — implémente l'interface Workflow
// ============================================================

/**
 * Le workflow CR en Phase 1 est un "pass-through" :
 * il signale au router que le mode CR est actif, mais la logique
 * réelle reste dans route.ts (generateCR, callback handling, etc.).
 *
 * Le router utilise le state.step pour adapter son comportement :
 * - 'collecting' → le message est envoyé à generateCR
 * - 'pending_photos' → le CR est prêt, on attend des photos
 * - 'pending_validation' → l'aperçu est affiché, on attend un callback
 *
 * En Phase 1, les méthodes handle* retournent un signal "passthrough"
 * (messages vides) et le router délègue au code existant de route.ts.
 */
export const crWorkflow: Workflow = {
  type: 'cr',
  command: 'cr',
  commandDescription: 'Démarrer un compte rendu de réunion',
  ttlMs: CR_TTL_MS,

  async start(_chatId: number, _initialText?: string): Promise<WorkflowResponse> {
    const now = Date.now();
    const newState: WorkflowState = {
      type: 'cr',
      step: 'collecting',
      data: {},
      startedAt: now,
      expiresAt: now + CR_TTL_MS,
    };

    return {
      newState,
      messages: [],
    };
  },

  async handleMessage(
    _chatId: number,
    state: WorkflowState,
    _text: string,
  ): Promise<WorkflowResponse> {
    // Phase 1 : pass-through — le router délègue au code existant de route.ts
    return {
      newState: state,
      messages: [],
    };
  },

  async handlePhoto(
    _chatId: number,
    state: WorkflowState,
    _photoBase64: string,
    _mimeType: string,
    _caption?: string,
  ): Promise<WorkflowResponse> {
    // Phase 1 : pass-through
    return {
      newState: state,
      messages: [],
    };
  },

  async handleVoice(
    _chatId: number,
    state: WorkflowState,
    _audioBase64: string,
    _audioMimeType: string,
  ): Promise<WorkflowResponse> {
    // Phase 1 : pass-through
    return {
      newState: state,
      messages: [],
    };
  },

  async handleCallback(
    _chatId: number,
    state: WorkflowState,
    _callbackData: string,
  ): Promise<WorkflowResponse> {
    // Phase 1 : pass-through
    return {
      newState: state,
      messages: [],
    };
  },

  async cancel(_chatId: number, _state: WorkflowState): Promise<WorkflowResponse> {
    return {
      newState: null,
      messages: [{ text: 'CR annulé. Mode inbox réactivé.' }],
    };
  },
};
