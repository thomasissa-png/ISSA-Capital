/**
 * Assembleur du brief du matin.
 *
 * `buildMorningBrief()` collecte 3 sections INDÉPENDANTES (TickTick, agenda,
 * citation), chacune en try/catch : si l'une échoue, le brief part avec les
 * autres + une ligne d'erreur sobre pour la section en défaut (jamais de brief
 * manqué pour une source down). Aucun état persisté (lecture seule).
 *
 * Format : court, lisible, emojis légers (📋 🗓️ 💬). Sections vides = ligne sobre.
 * R8 : toutes les bornes temporelles dérivent du jour Paris (paris-date).
 */

import { getParisDayBounds } from './paris-date';
import { collectTickTick, type TickTickSection } from './collect-ticktick';

/** Nombre de jours de la fenêtre « à venir » (décision Thomas S23). */
const UPCOMING_DAYS = 7;
import { collectCalendar, type CalendarSection } from './collect-calendar';
import { pickDailyCitation, type DailyCitation } from './citation';

export interface MorningBriefResult {
  /** Message Telegram prêt à envoyer. */
  message: string;
  /** Diagnostic par section (pour la réponse du cron). */
  sections: {
    ticktick: 'ok' | 'error';
    calendar: 'ok' | 'error';
    citation: 'ok' | 'empty' | 'error';
  };
}

const ERROR_LINE = 'momentanément indisponible.';

// ============================================================
// Formatage des sections
// ============================================================

function formatTickTick(section: TickTickSection): string {
  if (section.total === 0) {
    return '📋 Tâches du jour\nRien d’urgent aujourd’hui. 👌';
  }
  const lines: string[] = [`📋 Tâches du jour (${section.total})`];
  for (const group of section.groups) {
    lines.push(`\n${group.projectName}`);
    for (const t of group.tasks) {
      const flag = t.overdue ? '⚠️ ' : '• ';
      lines.push(`${flag}${t.title}`);
    }
  }
  return lines.join('\n');
}

/** Formate une échéance ISO en JJ/MM (Europe/Paris) pour la section « à venir ». */
function frDay(dueIso?: string): string {
  if (!dueIso) return '';
  const d = new Date(dueIso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Paris',
  }).format(d);
}

function formatUpcoming(section: TickTickSection): string {
  if (section.total === 0) return '';
  const lines: string[] = [`🔜 À venir (${UPCOMING_DAYS} j)`];
  for (const group of section.groups) {
    lines.push(`\n${group.projectName}`);
    for (const t of group.tasks) {
      const day = frDay(t.dueIso);
      lines.push(`• ${t.title}${day ? ` — ${day}` : ''}`);
    }
  }
  return lines.join('\n');
}

function formatCalendar(section: CalendarSection): string {
  if (section.events.length === 0) {
    return '🗓️ Agenda\nAucune réunion aujourd’hui.';
  }
  const lines: string[] = ['🗓️ Agenda du jour'];
  for (const e of section.events) {
    const prefix = e.time ? `${e.time} — ` : 'Journée — ';
    const who = e.attendees.length > 0 ? ` (${e.attendees.join(', ')})` : '';
    lines.push(`${prefix}${e.title}${who}`);
  }
  return lines.join('\n');
}

function formatCitation(citation: DailyCitation): string {
  return `💬 Citation du jour\n${citation.text}\n— ${citation.book}`;
}

// ============================================================
// Assemblage
// ============================================================

/**
 * Construit le brief du matin complet.
 *
 * @param now Instant de référence (injectable pour les tests).
 */
export async function buildMorningBrief(
  now: Date = new Date(),
): Promise<MorningBriefResult> {
  const bounds = getParisDayBounds(now);
  const blocks: string[] = [];
  const sections: MorningBriefResult['sections'] = {
    ticktick: 'ok',
    calendar: 'ok',
    citation: 'empty',
  };

  // En-tête (date lisible).
  blocks.push(`Bonjour Thomas 👋 — ${bounds.date}`);

  // Section TickTick (aujourd'hui+retard, puis « à venir 7 j »).
  try {
    const endUpcomingUtcIso = new Date(
      new Date(bounds.endUtcIso).getTime() + UPCOMING_DAYS * 86400_000,
    ).toISOString();
    const tt = await collectTickTick(
      bounds.startUtcIso,
      bounds.endUtcIso,
      endUpcomingUtcIso,
    );
    blocks.push(formatTickTick(tt.today));
    const upcoming = formatUpcoming(tt.upcoming);
    if (upcoming) blocks.push(upcoming);
  } catch (err) {
    sections.ticktick = 'error';
    console.warn(
      `[morning-brief] section TickTick échouée : ${err instanceof Error ? err.message : String(err)}`,
    );
    blocks.push(`📋 Tâches du jour\nListe ${ERROR_LINE}`);
  }

  // Section Agenda.
  try {
    const cal = await collectCalendar(bounds.startUtcIso, bounds.endUtcIso);
    blocks.push(formatCalendar(cal));
  } catch (err) {
    sections.calendar = 'error';
    console.warn(
      `[morning-brief] section Agenda échouée : ${err instanceof Error ? err.message : String(err)}`,
    );
    blocks.push(`🗓️ Agenda\nAgenda ${ERROR_LINE}`);
  }

  // Section Citation (optionnelle : pas de ligne si absente).
  try {
    const citation = await pickDailyCitation(bounds.dayOfYear);
    if (citation) {
      sections.citation = 'ok';
      blocks.push(formatCitation(citation));
    }
  } catch (err) {
    sections.citation = 'error';
    console.warn(
      `[morning-brief] section Citation échouée : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { message: blocks.join('\n\n'), sections };
}
