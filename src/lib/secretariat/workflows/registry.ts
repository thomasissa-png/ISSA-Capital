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
import { quittanceWorkflow } from './quittance';
import { bailWorkflow } from './bail';
import { finDeBailWorkflow } from './fin-de-bail';
import { candidatWorkflow } from './candidat';

// ============================================================
// Registry — tous les workflows disponibles
// ============================================================

const WORKFLOW_REGISTRY: Record<WorkflowType, Workflow> = {
  cr: crWorkflow,
  quittance: quittanceWorkflow,
  bail: bailWorkflow,
  findebail: finDeBailWorkflow,
  candidat: candidatWorkflow,
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

/**
 * Liste les commandes Telegram de tous les workflows enregistrés.
 * Utilisé par /api/telegram/setup pour construire le menu auto-complétion.
 */
export function listWorkflowCommands(): Array<{ command: string; description: string }> {
  return Object.values(WORKFLOW_REGISTRY).map((wf) => ({
    command: wf.command,
    description: wf.commandDescription,
  }));
}
