/**
 * Handlers email-ingest — re-exports.
 *
 * Point d'entrée unique pour importer les handlers et leurs types.
 */

export { handleAClassifier } from './a-classifier';
export { handleContactPro } from './contact-pro';
export { handleLocataire } from './locataire';
export { handleApporteur } from './apporteur';
export type { ActionProposal, ActionType, EmailHandler } from './types';
