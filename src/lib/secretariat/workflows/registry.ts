/**
 * Registry de workflows — point d'entrée pour le router.
 *
 * Pour ajouter un nouveau workflow :
 * 1. Créer le fichier dans workflows/ (ex: quittance.ts)
 * 2. Implémenter l'interface Workflow
 * 3. L'enregistrer ici dans WORKFLOW_REGISTRY
 */

import type { Workflow, WorkflowType } from './types';
import { crWorkflow } from './cr';

// ============================================================
// Registry — tous les workflows disponibles
// ============================================================

const WORKFLOW_REGISTRY: Record<WorkflowType, Workflow> = {
  cr: crWorkflow,
};

/**
 * Récupère un workflow par son type.
 * Retourne null si le type n'existe pas dans le registry.
 */
export function getWorkflow(type: WorkflowType): Workflow | null {
  return WORKFLOW_REGISTRY[type] ?? null;
}

/**
 * Liste tous les types de workflow disponibles.
 * Utile pour la commande /status.
 */
export function getAvailableWorkflowTypes(): WorkflowType[] {
  return Object.keys(WORKFLOW_REGISTRY) as WorkflowType[];
}
