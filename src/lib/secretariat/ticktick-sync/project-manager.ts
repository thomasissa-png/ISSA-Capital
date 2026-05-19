/**
 * Project manager — création et résolution des 7 projets TickTick.
 *
 * Au premier run (state.projects vide), Anya doit créer 7 projets dans TickTick :
 *   Personnel, Versi, ISSA, Gradient One, Immobilier, Sarani, Inbox.
 *
 * Red line spec §8 step 4 : la création est gated par une confirmation
 * Telegram (carte avec boutons [Créer] / [Annuler]). Tant que les projets
 * ne sont pas créés, le push engine skip avec un log explicite.
 *
 * Une fois créés, les IDs sont stockés dans `state.projects[name] = id` et
 * persistés via state-store. Plus jamais re-créés.
 */

import { PROJECT_NAMES, type SyncState } from './types';
import { logAuditEntry } from './audit-logger';

// ============================================================
// API TickTick — création projet
// ============================================================

const TICKTICK_BASE = 'https://api.ticktick.com/open/v1';

/** Réponse minimale TickTick lors de la création d'un projet. */
interface TickTickProjectCreated {
  id: string;
  name: string;
}

/**
 * Crée un projet TickTick via l'API. Throws si HTTP non-ok.
 *
 * @param accessToken Bearer token TickTick (long-lived 180j cf #102 S15)
 * @param name Nom du projet
 * @returns ID du projet créé
 */
export async function createTickTickProject(
  accessToken: string,
  name: string,
): Promise<string> {
  const response = await fetch(`${TICKTICK_BASE}/project`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, color: '#3478f6', viewMode: 'list' }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    throw new Error(`TickTick create project "${name}" HTTP ${response.status}: ${txt}`);
  }

  const data = (await response.json()) as Partial<TickTickProjectCreated>;
  if (!data.id) {
    throw new Error(`TickTick create project "${name}" : pas d'id retourné`);
  }
  return data.id;
}

// ============================================================
// API publique
// ============================================================

/** Indique si la sync peut démarrer (7 projets connus dans le state). */
export function projectsReady(state: SyncState): boolean {
  for (const name of PROJECT_NAMES) {
    if (!state.projects[name]) return false;
  }
  return true;
}

/** Liste des projets non encore créés (pour la carte Telegram de confirmation). */
export function missingProjects(state: SyncState): string[] {
  return PROJECT_NAMES.filter((name) => !state.projects[name]);
}

/**
 * Crée tous les projets manquants dans TickTick et patch le state.
 *
 * Appelé après confirmation Telegram (callback `tickticksync_projects:create`).
 * Idempotent : ne re-crée pas un projet déjà présent dans state.projects.
 *
 * @param accessToken Bearer TickTick
 * @param state State courant (sera mutated)
 * @returns Liste des projets effectivement créés (nom + id)
 */
export async function createMissingProjects(
  accessToken: string,
  state: SyncState,
): Promise<Array<{ name: string; id: string }>> {
  const created: Array<{ name: string; id: string }> = [];

  for (const name of PROJECT_NAMES) {
    if (state.projects[name]) continue;

    try {
      const id = await createTickTickProject(accessToken, name);
      state.projects[name] = id;
      created.push({ name, id });
      await logAuditEntry({
        direction: 'push',
        op: 'project-create',
        status: 'success',
        details: { projectName: name, projectId: id },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await logAuditEntry({
        direction: 'push',
        op: 'project-create',
        status: 'error',
        errorMessage: msg,
        details: { projectName: name },
      });
      throw err;
    }
  }

  return created;
}

/**
 * Résout le projectId TickTick pour un nom de projet vault.
 * Throws si le projet n'est pas dans le state (= projets pas encore créés).
 */
export function resolveProjectId(state: SyncState, projectName: string): string {
  const id = state.projects[projectName];
  if (!id) {
    throw new Error(
      `Project "${projectName}" absent du state — créer les projets via projet-manager d'abord (callback Telegram).`,
    );
  }
  return id;
}
