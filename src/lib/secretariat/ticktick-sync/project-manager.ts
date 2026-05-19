/**
 * Project manager — création et résolution des 3 projets TickTick (S18.4).
 *
 * Au premier run (state.projects vide), Anya doit créer 3 projets dans TickTick :
 *   Critique, Important, Priorité basse.
 *
 * **Refacto S18.4** : décision Thomas (S18) verbatim : « Je veux 3 projets,
 * par priorité: critique, important, et priorité basse ». L'ancien mapping
 * par 7 tags (Versi/ISSA/Gradient One/...) est supprimé ; le routing se fait
 * désormais via `priorityToProjectName(priority)` dans le parser.
 *
 * Red line spec §8 step 4 : la création est gated par une confirmation
 * Telegram (carte avec boutons [Créer] / [Annuler]). Tant que les projets
 * ne sont pas créés, le push engine skip avec un log explicite.
 *
 * Une fois créés, les IDs sont stockés dans `state.projects[name] = id` et
 * persistés via state-store. Plus jamais re-créés.
 *
 * **Hotfix S18.3 (Thomas en prod, cron crash sur doublon de nom)** conservé :
 *   - `listExistingProjects` : fetch projets existants côté TickTick
 *   - `createMissingProjects` : idempotent par NOM (match case-insensitive
 *     + trim), réutilise les projets existants au lieu de tenter une
 *     création qui renvoie HTTP 500 `unknown_exception`
 *   - Recovery : si create throw, re-fetch existants pour vérifier si
 *     TickTick l'a quand même créé (cas race / network)
 */

import { PROJECT_NAMES, type SyncState } from './types';

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

/**
 * Liste tous les projets TickTick existants du user. Throws si HTTP non-ok.
 *
 * Endpoint GET /project → `[{id, name, color, ...}]`.
 *
 * Utilisé pour éviter de re-créer un projet qui existe déjà côté TickTick
 * (cas : projet créé manuellement par Thomas, OU run précédent partiellement
 * échoué qui a laissé des orphelins sans state).
 */
export async function listExistingProjects(
  accessToken: string,
): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch(`${TICKTICK_BASE}/project`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => '');
    throw new Error(`TickTick list projects HTTP ${response.status}: ${txt}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`TickTick list projects : réponse non-array`);
  }

  const out: Array<{ id: string; name: string }> = [];
  for (const item of data) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { name?: unknown }).name === 'string'
    ) {
      out.push({
        id: (item as { id: string }).id,
        name: (item as { name: string }).name,
      });
    }
  }
  return out;
}

// ============================================================
// API publique
// ============================================================

/** Indique si la sync peut démarrer (tous les projets de `PROJECT_NAMES`
 *  sont connus dans le state — 3 depuis S18.4). */
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

/** Normalise un nom de projet pour match (lower + trim). */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Cherche un projet existant par nom (case-insensitive + trim).
 * Retourne l'id ou null.
 */
function findExistingId(
  existing: ReadonlyArray<{ id: string; name: string }>,
  targetName: string,
): string | null {
  const needle = normalizeName(targetName);
  for (const p of existing) {
    if (normalizeName(p.name) === needle) return p.id;
  }
  return null;
}

/** Résultat enrichi de createMissingProjects (S18.3 hotfix). */
export interface ProjectMapping {
  name: string;
  id: string;
  /** true = projet existait déjà côté TickTick et a été réutilisé (pas créé). */
  reused: boolean;
}

/**
 * Crée tous les projets manquants dans TickTick et patch le state. **Hotfix S18.3** :
 * idempotent par NOM côté TickTick (pas seulement par state Drive).
 *
 * Algorithme :
 *   1. Fetch projets existants côté TickTick via `listExistingProjects`
 *   2. Pour chaque nom dans `PROJECT_NAMES` :
 *      - Si déjà dans `state.projects[name]` → skip
 *      - Si trouvé dans existants (match case-insensitive trim) → reuse id
 *      - Sinon → tente create. Si throw, re-fetch existants pour vérifier
 *        si TickTick l'a quand même créé (race) → reuse. Sinon propage
 *        l'erreur AVEC compteur partiel.
 *
 * Le state est mutated incrémentalement : si la fonction throw au milieu,
 * tout ce qui a été récupéré/créé AVANT est dans state.projects → le caller
 * doit faire `saveSyncState(state)` dans son catch pour ne rien perdre.
 *
 * @param accessToken Bearer TickTick
 * @param state State courant (sera mutated)
 * @returns Liste des projets mappés (créés OU réutilisés)
 */
export async function createMissingProjects(
  accessToken: string,
  state: SyncState,
): Promise<ProjectMapping[]> {
  const mapped: ProjectMapping[] = [];

  // Étape 1 : fetch existants une seule fois en amont
  let existing = await listExistingProjects(accessToken);

  for (const name of PROJECT_NAMES) {
    if (state.projects[name]) continue;

    // Match par nom dans les existants TickTick
    const existingId = findExistingId(existing, name);
    if (existingId) {
      state.projects[name] = existingId;
      mapped.push({ name, id: existingId, reused: true });
      continue;
    }

    // Tentative de création
    try {
      const id = await createTickTickProject(accessToken, name);
      state.projects[name] = id;
      mapped.push({ name, id, reused: false });
    } catch (err) {
      // Recovery : re-fetch existants, peut-être que TickTick l'a quand même
      // créé (race, network coupé après création serveur, etc.)
      try {
        existing = await listExistingProjects(accessToken);
        const recoveredId = findExistingId(existing, name);
        if (recoveredId) {
          state.projects[name] = recoveredId;
          mapped.push({ name, id: recoveredId, reused: true });
          continue;
        }
      } catch {
        // re-fetch lui-même a échoué → on propage l'erreur originale
      }

      // Pas récupérable : propage avec compteur partiel
      const partial = mapped.length;
      const total = PROJECT_NAMES.length;
      const origMsg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Échec création projet "${name}" après ${partial}/${total} mappés. Cause : ${origMsg}`,
      );
    }
  }

  return mapped;
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
