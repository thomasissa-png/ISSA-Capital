/**
 * Export iCal (RFC 5545) — tâches TickTick Anya.
 *
 * Génère un flux iCal consultable par Google Calendar, Apple Calendar, etc.
 * URL signée avec un secret query param pour sécuriser l'accès.
 *
 * Format : VTODO (tâches) avec DTSTART/DUE si dates définies.
 * Pas de dépendance externe — génération RFC 5545 native (format simple).
 *
 * Jalon 5C — Session 15.
 */

import type { TickTickTask } from './types';

// ============================================================
// Constantes
// ============================================================

const CRLF = '\r\n';
const PRODID = '-//Anya Secrétariat//TickTick iCal Export//FR';

// ============================================================
// Helpers
// ============================================================

/**
 * Formate une date ISO en format iCal (YYYYMMDDTHHMMSSZ).
 */
function formatICalDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';

  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Escape les caractères spéciaux iCal dans le texte.
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Mappe la priorité TickTick (0-5) vers la priorité iCal (0-9).
 * iCal : 1-4 = haute, 5 = moyenne, 6-9 = basse, 0 = non définie
 * TickTick : 0 = none, 1 = low, 3 = medium, 5 = high
 */
function mapPriority(tickTickPriority: number): number {
  switch (tickTickPriority) {
    case 5: return 1;  // High → High
    case 3: return 5;  // Medium → Medium
    case 1: return 9;  // Low → Low
    default: return 0; // None
  }
}

/**
 * Mappe le statut TickTick vers le statut iCal VTODO.
 */
function mapStatus(status: number): string {
  return status === 2 ? 'COMPLETED' : 'NEEDS-ACTION';
}

// ============================================================
// API publique
// ============================================================

/**
 * Génère un calendrier iCal (RFC 5545) à partir d'une liste de tâches TickTick.
 *
 * @param tasks Liste de tâches TickTick
 * @param calendarName Nom du calendrier affiché dans les clients
 * @returns String iCal complète (VCALENDAR avec VTODO)
 */
export function generateICalFromTasks(
  tasks: TickTickTask[],
  calendarName = 'Anya — Tâches',
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    `X-WR-CALNAME:${calendarName}`,
    'METHOD:PUBLISH',
  ];

  for (const task of tasks) {
    lines.push('BEGIN:VTODO');
    lines.push(`UID:ticktick-${task.id}@anya.issa-capital.com`);
    lines.push(`SUMMARY:${escapeICalText(task.title)}`);

    if (task.desc) {
      lines.push(`DESCRIPTION:${escapeICalText(task.desc)}`);
    } else if (task.content) {
      lines.push(`DESCRIPTION:${escapeICalText(task.content)}`);
    }

    if (task.startDate) {
      const formatted = formatICalDate(task.startDate);
      if (formatted) lines.push(`DTSTART:${formatted}`);
    }

    if (task.dueDate) {
      const formatted = formatICalDate(task.dueDate);
      if (formatted) lines.push(`DUE:${formatted}`);
    }

    if (task.completedTime) {
      const formatted = formatICalDate(task.completedTime);
      if (formatted) lines.push(`COMPLETED:${formatted}`);
    }

    lines.push(`STATUS:${mapStatus(task.status)}`);
    lines.push(`PRIORITY:${mapPriority(task.priority)}`);

    if (task.tags && task.tags.length > 0) {
      lines.push(`CATEGORIES:${task.tags.map(escapeICalText).join(',')}`);
    }

    lines.push('END:VTODO');
  }

  lines.push('END:VCALENDAR');

  return lines.join(CRLF) + CRLF;
}
