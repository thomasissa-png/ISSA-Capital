/**
 * Types pour l'architecture modulaire de workflows Anya.
 *
 * Un workflow = un parcours structuré multi-étapes (CR, quittances, baux…).
 * Le mode "inbox" (par défaut) n'est PAS un workflow — c'est l'absence de workflow actif.
 *
 * Extensible : ajouter un type dans WorkflowType + implémenter l'interface Workflow.
 */

// ============================================================
// Types de workflow — union extensible
// ============================================================

/** Types de workflow disponibles. Ajouter ici pour chaque nouveau workflow. */
export type WorkflowType = 'cr';

// ============================================================
// État d'un workflow actif
// ============================================================

/** Étapes possibles pour le workflow CR */
export type CRWorkflowStep =
  | 'collecting'
  | 'pending_photos'
  | 'pending_validation'
  | 'validated'
  | 'cancelled';

/** État persisté d'un workflow actif pour un chat_id donné. */
export interface WorkflowState {
  /** Type de workflow en cours */
  type: WorkflowType;
  /** Étape courante dans le workflow */
  step: string;
  /** Données accumulées pendant le workflow (spécifiques au type) */
  data: Record<string, unknown>;
  /** Timestamp de démarrage (epoch ms) */
  startedAt: number;
  /** Timestamp d'expiration (epoch ms) — au-delà, le workflow est auto-nettoyé */
  expiresAt: number;
}

// ============================================================
// Réponse d'un handler de workflow
// ============================================================

/** Message à envoyer à l'utilisateur (texte + optionnel boutons inline) */
export interface WorkflowMessage {
  text: string;
  /** Si présent, envoyer avec des boutons inline (confirmation CR par ex.) */
  showConfirmation?: boolean;
}

/** Résultat retourné par chaque handler de workflow */
export interface WorkflowResponse {
  /** Nouvel état du workflow (null = workflow terminé, retour en inbox) */
  newState: WorkflowState | null;
  /** Messages à envoyer à l'utilisateur dans l'ordre */
  messages: WorkflowMessage[];
}

// ============================================================
// Interface Workflow — contrat pour chaque workflow
// ============================================================

/**
 * Interface qu'un workflow doit implémenter.
 *
 * Chaque méthode reçoit le chatId, le state courant (ou null pour start),
 * et les données du message Telegram. Elle retourne un WorkflowResponse.
 */
export interface Workflow {
  /** Type identifiant ce workflow */
  readonly type: WorkflowType;

  /** TTL en ms — durée max avant expiration automatique */
  readonly ttlMs: number;

  /** Démarre le workflow (premier message utilisateur) */
  start(chatId: number, initialText?: string): Promise<WorkflowResponse>;

  /** Traite un message texte pendant le workflow */
  handleMessage(chatId: number, state: WorkflowState, text: string): Promise<WorkflowResponse>;

  /** Traite une photo pendant le workflow */
  handlePhoto(
    chatId: number,
    state: WorkflowState,
    photoBase64: string,
    mimeType: string,
    caption?: string,
  ): Promise<WorkflowResponse>;

  /** Traite un message vocal pendant le workflow */
  handleVoice(
    chatId: number,
    state: WorkflowState,
    audioBase64: string,
    audioMimeType: string,
  ): Promise<WorkflowResponse>;

  /** Traite un callback inline (boutons Valider/Modifier/Annuler) */
  handleCallback(
    chatId: number,
    state: WorkflowState,
    callbackData: string,
  ): Promise<WorkflowResponse>;

  /** Annule le workflow en cours */
  cancel(chatId: number, state: WorkflowState): Promise<WorkflowResponse>;
}
