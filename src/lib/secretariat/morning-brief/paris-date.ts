/**
 * Helpers de date « aujourd'hui à Paris » — DST-safe (R8).
 *
 * Toute la logique du brief du matin (fenêtre TickTick / Calendar, sélection
 * déterministe de la citation) s'appuie sur le jour calendaire de Paris, jamais
 * sur UTC implicite. On dérive le décalage réel via `Intl.DateTimeFormat`
 * (UTC+1 hiver / UTC+2 été) plutôt que de hardcoder l'offset.
 *
 * Pattern de référence : `parisLocalToTickTickFields` (handlers/todo-from-telegram).
 */

const PARIS_TZ = 'Europe/Paris';

/** Composants du jour calendaire Paris pour un instant donné. */
export interface ParisDayBounds {
  /** Date Paris au format YYYY-MM-DD. */
  date: string;
  /** Rang du jour dans l'année (1 = 1er janvier), calculé sur le calendrier Paris. */
  dayOfYear: number;
  /** Début de journée Paris (00:00:00) → instant UTC ISO. */
  startUtcIso: string;
  /** Fin de journée Paris (23:59:59.999) → instant UTC ISO. */
  endUtcIso: string;
}

/**
 * Extrait les composantes (année, mois, jour, heure, minute, seconde) telles
 * qu'affichées dans le fuseau Paris pour un instant donné.
 */
function parisParts(instant: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const map = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/**
 * Convertit une heure locale Paris (composantes) en instant UTC ISO, DST-safe.
 *
 * On construit un timestamp UTC « candidat » avec les composantes locales, on
 * mesure ce que Paris affiche pour ce candidat, et on corrige par l'écart.
 */
function parisLocalToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms = 0,
): string {
  const candidateMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const shown = parisParts(new Date(candidateMs));
  const shownAsUtcMs = Date.UTC(
    shown.year,
    shown.month - 1,
    shown.day,
    shown.hour,
    shown.minute,
    shown.second,
  );
  // shownAsUtcMs - candidateMs = offset Paris (en ms). On le retire pour obtenir
  // l'instant UTC correspondant à l'heure locale demandée.
  const offsetMs = shownAsUtcMs - Date.UTC(year, month - 1, day, hour, minute, second);
  return new Date(candidateMs - offsetMs).toISOString();
}

/**
 * Calcule les bornes du jour Paris pour un instant `now` (défaut : maintenant).
 *
 * @param now Instant de référence (injectable pour les tests).
 */
export function getParisDayBounds(now: Date = new Date()): ParisDayBounds {
  const { year, month, day } = parisParts(now);

  const date = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  // day-of-year calculé sur le calendrier Paris (UTC pour l'arithmétique de jours).
  const startOfYearMs = Date.UTC(year, 0, 1);
  const thisDayMs = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.floor((thisDayMs - startOfYearMs) / 86_400_000) + 1;

  const startUtcIso = parisLocalToUtcIso(year, month, day, 0, 0, 0, 0);
  const endUtcIso = parisLocalToUtcIso(year, month, day, 23, 59, 59, 999);

  return { date, dayOfYear, startUtcIso, endUtcIso };
}

/**
 * Formate un instant ISO en heure Paris « HH:mm » (pour l'agenda du brief).
 */
export function formatParisTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = parisParts(d);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}
