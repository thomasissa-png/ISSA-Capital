/**
 * Collecteur TickTick du brief du matin.
 *
 * Deux buckets (décision Thomas S23) :
 *   - `today`    : en retard + dues aujourd'hui (dueDate <= fin de journée Paris).
 *   - `upcoming` : échéances des 7 prochains jours (fin de journée < dueDate <= +7j).
 * Groupés par projet, triés par échéance. 100% déterministe (0 LLM).
 *
 * Réutilise `ticktick-client` (listTasks / listProjects) déjà câblé pour le
 * poll/mirror. R8 : les bornes sont calculées en Paris (DST-safe) par l'appelant.
 */

import { listTasks, listProjects } from '../ticktick/ticktick-client';
import type { TickTickTask } from '../ticktick/types';

/** Une tâche prête à afficher (échéance + libellé), groupée par projet. */
export interface BriefTaskGroup {
  projectName: string;
  tasks: { title: string; dueIso?: string; overdue: boolean }[];
}

export interface TickTickSection {
  groups: BriefTaskGroup[];
  total: number;
}

export interface TickTickResult {
  /** En retard + dues aujourd'hui. */
  today: TickTickSection;
  /** Échéances des 7 prochains jours (après aujourd'hui). */
  upcoming: TickTickSection;
}

/** Groupe une liste de tâches par projet + trie (échéance puis projet). */
function groupByProject(
  tasks: TickTickTask[],
  projectName: Map<string, string>,
  startMs: number,
): TickTickSection {
  const byProject = new Map<string, BriefTaskGroup>();
  for (const t of tasks) {
    const name = projectName.get(t.projectId) ?? 'Sans projet';
    let group = byProject.get(t.projectId);
    if (!group) {
      group = { projectName: name, tasks: [] };
      byProject.set(t.projectId, group);
    }
    const dueMs = new Date(t.dueDate as string).getTime();
    group.tasks.push({
      title: t.title.trim() || '(sans titre)',
      dueIso: t.dueDate,
      overdue: dueMs < startMs,
    });
  }
  for (const group of byProject.values()) {
    group.tasks.sort((a, b) => {
      const am = a.dueIso ? new Date(a.dueIso).getTime() : 0;
      const bm = b.dueIso ? new Date(b.dueIso).getTime() : 0;
      return am - bm;
    });
  }
  const groups = [...byProject.values()].sort((a, b) =>
    a.projectName.localeCompare(b.projectName, 'fr'),
  );
  return { groups, total: tasks.length };
}

/**
 * Récupère les tâches actives, réparties en deux buckets (aujourd'hui+retard,
 * à venir 7 jours), groupées par projet.
 *
 * @param startUtcIso       Début de journée Paris (ISO UTC) — seuil de retard.
 * @param endTodayUtcIso    Fin de journée Paris (ISO UTC) — borne « aujourd'hui ».
 * @param endUpcomingUtcIso Fin de journée Paris + 7j (ISO UTC) — borne « à venir ».
 */
export async function collectTickTick(
  startUtcIso: string,
  endTodayUtcIso: string,
  endUpcomingUtcIso: string,
): Promise<TickTickResult> {
  const startMs = new Date(startUtcIso).getTime();
  const endTodayMs = new Date(endTodayUtcIso).getTime();
  const endUpcomingMs = new Date(endUpcomingUtcIso).getTime();

  const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);

  const projectName = new Map<string, string>();
  for (const p of projects) projectName.set(p.id, p.name);

  const active = tasks.filter((t: TickTickTask) => {
    if (t.status !== 0) return false;
    if (!t.dueDate) return false;
    return !Number.isNaN(new Date(t.dueDate).getTime());
  });

  const todayTasks = active.filter(
    (t) => new Date(t.dueDate as string).getTime() <= endTodayMs,
  );
  const upcomingTasks = active.filter((t) => {
    const dueMs = new Date(t.dueDate as string).getTime();
    return dueMs > endTodayMs && dueMs <= endUpcomingMs;
  });

  return {
    today: groupByProject(todayTasks, projectName, startMs),
    upcoming: groupByProject(upcomingTasks, projectName, startMs),
  };
}
