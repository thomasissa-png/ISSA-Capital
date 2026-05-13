/**
 * Triage email — point d'entrée.
 */

export {
  triageEmail,
  parseTriageResponse,
  buildUserMessage,
  loadTriagePrompt,
  invalidatePromptCache,
} from './triage';

export type {
  TriageResult,
  TriageCategory,
  SuggestedAction,
  KnownContact,
} from './types';

export {
  triageResultSchema,
  suggestedActionSchema,
  TRIAGE_CATEGORIES,
} from './types';
