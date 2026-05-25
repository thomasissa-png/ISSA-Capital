/**
 * Runner calendar-ingest — orchestre Google Calendar → vault + TickTick (refonte S23).
 *
 * Plus de fiche réunion (`06. Réunions` abandonné). Pour chaque event confirmé :
 *   1. Skip si déjà traité avec même event.updated (idempotence event-level)
 *   2. Enrichir les historiques CONTACTS (fiches vault existantes)
 *   3. Détecter le(s) projet(s) :
 *      - 1 match → enrichir l'historique projet directement
 *      - 2+ matchs → carte Telegram de désambiguïsation (calproj:), pending TTL 7j ;
 *        l'historique est écrit au clic de Thomas (handler cal-projet-confirm)
 *      - 0 match → rien
 *   4. Créer UN todo « CR à faire » dans TickTick si éligible (hors récurrent/all-day/perso)
 *   5. Marquer l'event traité DÈS que le travail réussit (fix racine du bug prod :
 *      avant, le state n'était jamais mis à jour quand la fiche échouait → boucle infinie)
 *   6. Logger explicitement result.errors par event (logging #2)
 *
 * Idempotence (CRITIQUE) : le cron repasse sur ±14j toutes les 15 min. Le state
 * `processedEvents[id]` garde lastSeenUpdated + contactsEnriched + projectsEnriched
 * + todoId. Re-passage sans changement → `no-change`. Si event.updated change
 * (replanification) → on réutilise todoId stocké (update, pas create).
 */

import {
  loadCalendarIngestState,
  saveCalendarIngestState,
} from './state-store';
import { listCalendarEvents } from './calendar-source';
import { mapEventToProjection, isEventTodoEligible } from './event-mapper';
import {
  enrichContactsFromEvent,
  countEnriched,
} from './contact-enricher';
import { enrichProjetHistorique } from './projet-enricher';
import { createCrTodo } from './todo-creator';
import { findProjetFicheByEntite } from '../vault-reader';
import {
  sendCalProjetCard,
  type CalProjetPending,
} from '../telegram-validation/handlers/cal-projet-confirm';
import { appendCalendarAuditLog } from './audit-log';
import type {
  CalendarEvent,
  CalendarIngestResult,
  CalendarIngestStats,
  CalendarIngestState,
} from './types';
import { emptyStats } from './types';

// ============================================================
// Constantes
// ============================================================

const DEFAULT_WINDOW_DAYS = 14;

// ============================================================
// API publique
// ============================================================

export interface RunCalendarIngestOpts {
  /** Fenêtre temporelle ± jours autour de now (défaut 14) */
  windowDays?: number;
  /** Si true : ne sauve pas le state + n'écrit rien (preview only) */
  dryRun?: boolean;
  /** Overrides pour tests (injection de deps) */
  _calendarClient?: typeof listCalendarEvents;
  _enrichContacts?: typeof enrichContactsFromEvent;
  _enrichProjet?: typeof enrichProjetHistorique;
  _createTodo?: typeof createCrTodo;
  _findProjetFiche?: typeof findProjetFicheByEntite;
  _sendCalProjetCard?: typeof sendCalProjetCard;
  _appendAudit?: typeof appendCalendarAuditLog;
  _loadState?: typeof loadCalendarIngestState;
  _saveState?: typeof saveCalendarIngestState;
}

export interface RunCalendarIngestOutput {
  stats: CalendarIngestStats;
  results: CalendarIngestResult[];
  stateSaved: boolean;
}

interface ProcessDeps {
  enrichContacts: typeof enrichContactsFromEvent;
  enrichProjet: typeof enrichProjetHistorique;
  createTodo: typeof createCrTodo;
  findProjetFiche: typeof findProjetFicheByEntite;
  sendCalProjetCard: typeof sendCalProjetCard;
}

/**
 * Exécute un cycle calendar-ingest complet.
 */
export async function runCalendarIngest(
  opts: RunCalendarIngestOpts = {},
): Promise<RunCalendarIngestOutput> {
  const startMs = Date.now();
  const stats = emptyStats();
  const results: CalendarIngestResult[] = [];

  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const calendarClient = opts._calendarClient ?? listCalendarEvents;
  const auditLogger = opts._appendAudit ?? appendCalendarAuditLog;
  const loadState = opts._loadState ?? loadCalendarIngestState;
  const saveState = opts._saveState ?? saveCalendarIngestState;
  const deps: ProcessDeps = {
    enrichContacts: opts._enrichContacts ?? enrichContactsFromEvent,
    enrichProjet: opts._enrichProjet ?? enrichProjetHistorique,
    createTodo: opts._createTodo ?? createCrTodo,
    findProjetFiche: opts._findProjetFiche ?? findProjetFicheByEntite,
    sendCalProjetCard: opts._sendCalProjetCard ?? sendCalProjetCard,
  };

  // 1. Charger state
  const state = await loadState();

  // 2. Fenêtre temporelle
  const now = new Date();
  const timeMin = new Date(now.getTime() - windowDays * 86400_000).toISOString();
  const timeMax = new Date(now.getTime() + windowDays * 86400_000).toISOString();

  // 3. Fetch events
  let events: CalendarEvent[];
  try {
    events = await calendarClient({
      timeMin,
      timeMax,
      showDeleted: true,
      singleEvents: true,
    });
  } catch (err) {
    console.warn(
      `[calendar-ingest] fetch erreur : ${err instanceof Error ? err.message : String(err)}`,
    );
    stats.errors = 1;
    stats.durationMs = Date.now() - startMs;
    return { stats, results, stateSaved: false };
  }

  stats.eventsFetched = events.length;
  console.warn(`[calendar-ingest] ${events.length} event(s) fetched`);

  // 4. Traiter chaque event
  for (const event of events) {
    let result: CalendarIngestResult;
    try {
      result = await processOneEvent(event, state, opts.dryRun ?? false, deps);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result = {
        eventId: event.id,
        summary: event.summary,
        date: '',
        op: 'error',
        participantsTotal: event.attendees.length,
        contactsEnriched: 0,
        projectsEnriched: [],
        projectAmbiguous: false,
        todoCreated: false,
        errors: [msg],
      };
    }
    results.push(result);
    updateStatsFromResult(stats, result);

    // Logging #2 : erreurs explicites par event (au lieu d'incrément silencieux).
    if (result.errors.length > 0) {
      console.warn(
        `[calendar-ingest] event ${event.id} "${event.summary}" : ${result.errors.join(' ; ')}`,
      );
    }

    // Audit non-bloquant (sauf dryRun).
    if (!opts.dryRun && result.op !== 'no-change' && result.op !== 'skipped') {
      try {
        await auditLogger(result);
      } catch (err) {
        console.warn(
          `[calendar-ingest] audit échec event ${event.id} : ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // 5. Sauver state
  state.lastSync = new Date().toISOString();
  let stateSaved = false;
  if (!opts.dryRun) {
    stateSaved = await saveState(state);
    if (!stateSaved) {
      console.warn('[calendar-ingest] saveState échec — sync next run risque doublons');
    }
  }

  stats.durationMs = Date.now() - startMs;
  console.warn(
    `[calendar-ingest] terminé en ${stats.durationMs}ms — ` +
      `fetched=${stats.eventsFetched} processed=${stats.eventsProcessed} ` +
      `contacts=${stats.contactsEnriched} projets=${stats.projectsEnriched} ` +
      `ambigus=${stats.projectsAmbiguous} todos=${stats.todosCreated} ` +
      `skipped=${stats.skipped} errors=${stats.errors}`,
  );

  return { stats, results, stateSaved };
}

// ============================================================
// Traitement d'un event
// ============================================================

async function processOneEvent(
  event: CalendarEvent,
  state: CalendarIngestState,
  dryRun: boolean,
  deps: ProcessDeps,
): Promise<CalendarIngestResult> {
  const seen = state.processedEvents[event.id];

  // Event annulé : rien à écrire. Si jamais vu → skip. Si déjà connu → cancelled.
  if (event.status === 'cancelled') {
    return {
      eventId: event.id,
      summary: event.summary || '(annulé)',
      date: seen?.date ?? '',
      op: seen ? 'cancelled' : 'skipped',
      participantsTotal: event.attendees.length,
      contactsEnriched: 0,
      projectsEnriched: [],
      projectAmbiguous: false,
      todoCreated: false,
      errors: [],
    };
  }

  // Idempotence event-level : event.updated identique → rien à refaire.
  if (seen && seen.lastSeenUpdated === event.updated) {
    return {
      eventId: event.id,
      summary: event.summary,
      date: seen.date,
      op: 'no-change',
      participantsTotal: event.attendees.length,
      contactsEnriched: 0,
      projectsEnriched: [],
      projectAmbiguous: false,
      todoCreated: false,
      errors: [],
    };
  }

  // Projection (date/heure/durée/projets).
  const projection = mapEventToProjection(event);
  if (!projection) {
    return {
      eventId: event.id,
      summary: event.summary,
      date: '',
      op: 'skipped',
      participantsTotal: event.attendees.length,
      contactsEnriched: 0,
      projectsEnriched: [],
      projectAmbiguous: false,
      todoCreated: false,
      errors: ['mapEventToProjection null (date invalide)'],
    };
  }

  const errors: string[] = [];

  // Dry-run : pas d'écriture, on annonce ce qui serait fait.
  if (dryRun) {
    return {
      eventId: event.id,
      summary: event.summary,
      date: projection.date,
      op: 'processed',
      participantsTotal: event.attendees.length,
      contactsEnriched: 0,
      projectsEnriched: [],
      projectAmbiguous: projection.projectCodes.length >= 2,
      todoCreated: false,
      errors: [],
    };
  }

  // --- A. Contacts ---
  let contactsEnriched = 0;
  const contactEmails: string[] = [];
  try {
    const enrichResults = await deps.enrichContacts(
      event,
      projection.date,
      projection.sujet,
    );
    contactsEnriched = countEnriched(enrichResults);
    for (const r of enrichResults) {
      if (r.status === 'enriched') contactEmails.push(r.email);
    }
  } catch (err) {
    errors.push(`contacts : ${err instanceof Error ? err.message : String(err)}`);
  }

  // --- B. Projet ---
  const projectsEnriched: string[] = [];
  let projectAmbiguous = false;
  const codes = projection.projectCodes;
  if (codes.length === 1) {
    const code = codes[0]!;
    try {
      const res = await deps.enrichProjet(code, projection, event.id);
      if (res.status === 'enriched') projectsEnriched.push(code);
      else if (res.status === 'error') {
        errors.push(`projet ${code} : ${res.error ?? 'erreur'}`);
      }
    } catch (err) {
      errors.push(`projet ${code} : ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (codes.length >= 2) {
    // Ambigu → carte Telegram. L'event est marqué traité (contacts/todo faits) ;
    // l'historique projet est écrit au clic de Thomas (handler cal-projet-confirm).
    projectAmbiguous = true;
    try {
      const candidateNames = await resolveCandidateNames(codes, deps.findProjetFiche);
      const pending: CalProjetPending = {
        id: event.id,
        candidateCodes: codes,
        candidateNames,
        projection,
        createdAt: new Date().toISOString(),
      };
      const sent = await deps.sendCalProjetCard(pending);
      if (!sent) errors.push('carte désambiguïsation projet : envoi échec');
    } catch (err) {
      errors.push(
        `désambiguïsation projet : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // --- C. Todo TickTick (si éligible) ---
  let todoCreated = false;
  let todoId = seen?.todoId;
  if (isEventTodoEligible(event)) {
    // Nom canonique du projet pour la liste TickTick : seulement si projet non ambigu.
    const projectName =
      projectsEnriched.length === 1
        ? await resolveSingleProjectName(projectsEnriched[0]!, deps.findProjetFiche)
        : undefined;
    try {
      const res = await deps.createTodo(projection, projectName, todoId);
      if (res.status === 'created' || res.status === 'updated') {
        todoCreated = true;
        todoId = res.todoId ?? todoId;
      } else {
        errors.push(`todo : ${res.error ?? 'erreur'}`);
      }
    } catch (err) {
      errors.push(`todo : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // --- Fix racine : marquer l'event traité DÈS que le travail a tourné, même
  // partiellement (les erreurs sont loggées + remontées, pas avalées en boucle). ---
  state.processedEvents[event.id] = {
    lastSeenUpdated: event.updated,
    processedAt: new Date().toISOString(),
    date: projection.date,
    contactsEnriched: contactEmails,
    projectsEnriched,
    ...(todoId ? { todoId } : {}),
  };

  return {
    eventId: event.id,
    summary: event.summary,
    date: projection.date,
    op: 'processed',
    participantsTotal: event.attendees.length,
    contactsEnriched,
    projectsEnriched,
    projectAmbiguous,
    todoCreated,
    errors,
  };
}

/**
 * Résout les noms canoniques des codes candidats (pour libellés boutons).
 * Fallback : le code lui-même si la fiche n'est pas résolvable.
 */
async function resolveCandidateNames(
  codes: string[],
  findFiche: typeof findProjetFicheByEntite,
): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const code of codes) {
    try {
      const fiche = await findFiche(code);
      names[code] = fiche?.ficheName ?? code;
    } catch {
      names[code] = code;
    }
  }
  return names;
}

/** Résout le nom canonique d'un projet unique (pour la liste TickTick). */
async function resolveSingleProjectName(
  code: string,
  findFiche: typeof findProjetFicheByEntite,
): Promise<string | undefined> {
  try {
    const fiche = await findFiche(code);
    return fiche?.ficheName;
  } catch {
    return undefined;
  }
}

function updateStatsFromResult(
  stats: CalendarIngestStats,
  result: CalendarIngestResult,
): void {
  switch (result.op) {
    case 'processed':
      stats.eventsProcessed++;
      break;
    case 'skipped':
    case 'no-change':
    case 'cancelled':
      stats.skipped++;
      break;
    case 'error':
      stats.errors++;
      break;
  }
  stats.contactsEnriched += result.contactsEnriched;
  stats.projectsEnriched += result.projectsEnriched.length;
  if (result.projectAmbiguous) stats.projectsAmbiguous++;
  if (result.todoCreated) stats.todosCreated++;
  // Erreurs sur un event "processed" : compter aussi (visibilité récap).
  if (result.op === 'processed' && result.errors.length > 0) {
    stats.errors += result.errors.length;
  }
}
