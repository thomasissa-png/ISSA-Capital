/**
 * Historique des CR validés — mémoire longue d'Anya.
 *
 * Stocke le texte complet de chaque CR validé dans un fichier JSON persistant.
 * Anya consulte cet historique avant chaque génération pour :
 * - Connaître les participants récurrents et leurs rôles
 * - Retrouver les décisions passées et les suites à donner
 * - Maintenir la cohérence entre les CR
 *
 * Persisté dans /home/runner/issa-data/ (survit aux redéploiements Replit).
 * Les CR sont stockés du plus récent au plus ancien.
 * Limite : 50 derniers CR (au-delà, les plus anciens sont archivés).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CRDraft } from './types';

const DATA_DIR = existsSync('/home/runner') ? '/home/runner/issa-data' : '/tmp/issa-secretariat';
const HISTORY_PATH = resolve(DATA_DIR, 'cr-history.json');
const MAX_HISTORY = 50;

interface CrHistoryEntry {
  reference: string;
  entite: string;
  dateReunion: string;
  dateValidation: string;
  type: string;
  lieu: string;
  objet: string;
  participants: string[];
  sections: {
    objet: string;
    points: string;
    decisions: string;
    suites: string | null;
  };
  annexesCount: number;
}

type HistoryData = CrHistoryEntry[];

// globalThis pour survivre aux re-évaluations Next.js
const GLOBAL_KEY = '__issa_cr_history__' as const;

function getGlobalHistory(): HistoryData {
  if (!(GLOBAL_KEY in globalThis)) {
    (globalThis as Record<string, unknown>)[GLOBAL_KEY] = [];
  }
  return (globalThis as Record<string, unknown>)[GLOBAL_KEY] as HistoryData;
}

function setGlobalHistory(data: HistoryData): void {
  (globalThis as Record<string, unknown>)[GLOBAL_KEY] = data;
}

function ensureDir(): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // best effort
  }
}

function loadHistory(): HistoryData {
  const cached = getGlobalHistory();
  if (cached.length > 0) return cached;

  try {
    ensureDir();
    if (existsSync(HISTORY_PATH)) {
      const raw = readFileSync(HISTORY_PATH, 'utf8');
      const parsed = JSON.parse(raw) as HistoryData;
      setGlobalHistory(parsed);
      return parsed;
    }
  } catch {
    console.warn('[cr-history] fichier corrompu, reset');
  }

  setGlobalHistory([]);
  return [];
}

function saveHistory(data: HistoryData): void {
  setGlobalHistory(data);
  try {
    ensureDir();
    writeFileSync(HISTORY_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[cr-history] erreur écriture :', err);
  }
}

/**
 * Enregistre un CR validé dans l'historique.
 */
export function saveCrToHistory(
  cr: CRDraft,
  reference: string,
  dateValidation: string,
): void {
  const history = loadHistory();

  const entry: CrHistoryEntry = {
    reference,
    entite: cr.entite,
    dateReunion: cr.date_reunion,
    dateValidation,
    type: cr.type_reunion,
    lieu: cr.lieu,
    objet: cr.objet,
    participants: cr.participants.map(
      (p) => `${p.prenom} ${p.nom}, ${p.titre}, ${p.societe}`,
    ),
    sections: {
      objet: cr.section_1_objet_art_39_1,
      points: cr.section_2_points_abordes,
      decisions: cr.section_3_decisions,
      suites: cr.section_4_suites_a_donner,
    },
    annexesCount: cr.annexes_photographiques?.length ?? 0,
  };

  // Ajouter en tête (plus récent d'abord)
  history.unshift(entry);

  // Limiter à MAX_HISTORY
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY;
  }

  saveHistory(history);
}

/**
 * Formate les N derniers CR pour injection dans le contexte Claude.
 * Priorise les plus récents. Résumé compact pour ne pas exploser le contexte.
 */
export function formatHistoryForPrompt(maxEntries = 10): string {
  const history = loadHistory();

  if (history.length === 0) {
    return '(Aucun CR précédent dans l\'historique)';
  }

  const entries = history.slice(0, maxEntries);

  const formatted = entries.map((e, i) => {
    const participants = e.participants.join(' ; ');
    const suites = e.sections.suites
      ? `\n   Suites : ${e.sections.suites.slice(0, 200)}`
      : '';

    return (
      `${i + 1}. [${e.reference}] ${e.dateReunion} — ${e.type} — ${e.lieu}\n` +
      `   Entité : ${e.entite} | Participants : ${participants}\n` +
      `   Objet : ${e.objet}\n` +
      `   Décisions : ${e.sections.decisions.slice(0, 300)}${suites}`
    );
  });

  return `HISTORIQUE DES ${entries.length} DERNIERS CR (du plus récent au plus ancien) :\n\n${formatted.join('\n\n')}`;
}
