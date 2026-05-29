/**
 * Entrypoint du module CR Réunion.
 *
 * Point d'entrée unique pour le webhook (et tout futur appelant : cron,
 * batch replay, tests E2E). Centralise validation déterministe (§6 du
 * Workflow CR Réunion v3) et génération de référence séquentielle.
 */

export {
  generateReference,
  isValidReference,
  parseReference,
  REFERENCE_REGEX,
} from './reference-generator';

export {
  ENTITES,
  TYPES_REUNION,
  isValidEntite,
  isValidType,
  checkRbac,
  checkEntiteCoherence,
  detectBannedFormulas,
  checkSection1Legal,
  validateCrPayload,
  isDuplicateCr,
} from './validators';

export type { ValidateCrResult, ValidateCrOptions, CrIdentity } from './validators';

import type { CRDraft } from '../types';
import { generateReference } from './reference-generator';
import {
  validateCrPayload,
  type ValidateCrOptions,
  type ValidateCrResult,
} from './validators';

export interface ValidateAndPrepareResult extends ValidateCrResult {
  reference?: string;
}

/**
 * Valide un payload CR ET, si valide, génère la prochaine référence
 * séquentielle pour son entité.
 *
 * Garantie : la référence n'est générée QUE si toutes les errors sont vides.
 * (Évite d'incrémenter le compteur pour un CR qui sera rejeté.)
 */
export function validateAndPrepareReference(
  cr: CRDraft,
  opts: ValidateCrOptions = {},
): ValidateAndPrepareResult {
  const result = validateCrPayload(cr, opts);
  if (!result.ok) {
    return { ...result };
  }
  const reference = generateReference(cr.entite);
  return { ...result, reference };
}
