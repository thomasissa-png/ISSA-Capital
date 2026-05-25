/**
 * Collecteur TickTick du brief du matin.
 *
 * Tâches dues aujourd'hui + en retard (dueDate <= fin de journée Paris).
 * Groupées par projet, triées par échéance. 100% déterministe (0 LLM).
 *
 * Réutilise `ticktick-client` (listTasks / listProjects) déjà câblé pour le
 * poll/mirror. R8 : la borne « fin de journée » est calculée en Paris (DST-safe).
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

/**
 * Récupère les tâches actives dues aujourd'hui + en retard, groupées par projet.
 *
 * @param endUtcIso Fin de journée Paris (ISO UTC) — seuil dueDate <= endUtcIso.
 * @param startUtcIso Début de journée Paris (ISO UTC) — pour distinguer le retard.
 */
export async function collectTickTick(
  endUtcIso: string,
  startUtcIso: string,
): Promise<TickTickSection> {
  const endMs = new Date(endUtcIso).getTime();
  const startMs = new Date(startUtcIso).getTime();

  const [tasks, projects] = await Promise.all([listTasks(), listProjects()]);

  const projectName = new Map<string, string>();
  for (const p of projects) projectName.set(p.id, p.name);

  // Filtre : tâche active (status 0) avec dueDate <= fin de journée Paris.
  const due = tasks.filter((t: TickTickTask) => {
    if (t.status !== 0) return false;
    if (!t.dueDate) return false;
    const dueMs = new Date(t.dueDate).getTime();
    if (Number.isNaN(dueMs)) return false;
    return dueMs <= endMs;
  });

  // Groupement par projet.
  const byProject = new Map<string, BriefTaskGroup>();
  for (const t of due) {
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

  // Tri intra-projet par échéance croissante.
  for (const group of byProject.values()) {
    group.tasks.sort((a, b) => {
      const am = a.dueIso ? new Date(a.dueIso).getTime() : 0;
      const bm = b.dueIso ? new Date(b.dueIso).getTime() : 0;
      return am - bm;
    });
  }

  // Tri des groupes par nom de projet (stable, lisible).
  const groups = [...byProject.values()].sort((a, b) =>
    a.projectName.localeCompare(b.projectName, 'fr'),
  );

  return { groups, total: due.length };
}
