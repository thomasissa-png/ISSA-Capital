/**
 * Hot-context staleness (V0) — orchestration : check + alerte + bump + snooze.
 *
 * Garde-fou anti-dérive : alerte Thomas sur Telegram si `hot-context.md` est
 * périmé (semaine ISO passée OU pas touché depuis > 3 j ; critique > 7 j). Le
 * bump met le frontmatter à aujourd'hui en préservant le corps. 0 appel LLM.
 */

import { readFile, writeFile } from '../vault-client/obsidian-file';
import { resolveFilePath } from '../vault-client/drive-resolver';
import { HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME } from '../hot-context/applier';
import { writeAuditLog } from '../vault-client/audit-log';
import { evaluateStaleness, bumpFrontmatter, parisParts, type StalenessVerdict } from './staleness';
import { readStalenessState, writeStalenessState } from './state';
import { sendStalenessCard } from './card';

const SNOOZE_MS = 24 * 60 * 60 * 1000;

function thomasChatId(): number | null {
  const raw = process.env.TELEGRAM_CHAT_ID_THOMAS;
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

/** URL Drive « ouvrir le fichier » (ou null si non résolu). */
async function hotContextDriveUrl(): Promise<string | null> {
  try {
    const r = await resolveFilePath(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME);
    return r.success && r.fileId ? `https://drive.google.com/file/d/${r.fileId}/view` : null;
  } catch {
    return null;
  }
}

export interface StalenessRunResult {
  proceeded: boolean;
  severity?: StalenessVerdict['severity'];
  notified: boolean;
  reason: string;
}

/**
 * Vérifie la fraîcheur et alerte si besoin.
 * @param force ignore la fenêtre horaire Paris (test manuel via ?force=1).
 */
export async function runStalenessCheck(force = false): Promise<StalenessRunResult> {
  const p = parisParts();
  // Fenêtre : tous les jours 20h Paris + dimanche 19h Paris (revue weekly).
  const inWindow = p.hour === 20 || (p.weekday === 0 && p.hour === 19);
  if (!force && !inWindow) {
    return { proceeded: false, notified: false, reason: `hors fenêtre (Paris ${p.hour}h, j${p.weekday})` };
  }

  const read = await readFile(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME);
  if (!read.success || read.content === undefined) {
    console.warn(`[hot-context-staleness] lecture échouée : ${read.error ?? 'inconnue'}`);
    return { proceeded: true, notified: false, reason: `lecture échouée : ${read.error ?? 'inconnue'}` };
  }

  const verdict = evaluateStaleness(read.content);
  if (verdict.severity === 'fresh') {
    return { proceeded: true, severity: 'fresh', notified: false, reason: 'à jour' };
  }

  const state = await readStalenessState();
  const now = Date.now();
  if (state.snoozedUntil && now < state.snoozedUntil) {
    return { proceeded: true, severity: verdict.severity, notified: false, reason: 'snooze actif' };
  }
  if (state.lastAlertDate === verdict.currentDate) {
    return { proceeded: true, severity: verdict.severity, notified: false, reason: 'déjà alerté aujourd\'hui' };
  }

  const chatId = thomasChatId();
  if (chatId === null) {
    return { proceeded: true, severity: verdict.severity, notified: false, reason: 'TELEGRAM_CHAT_ID_THOMAS manquant' };
  }

  const driveUrl = await hotContextDriveUrl();
  const sent = await sendStalenessCard(chatId, verdict, driveUrl);
  if (!sent.ok) {
    console.warn(`[hot-context-staleness] envoi carte échoué : ${sent.error}`);
    return { proceeded: true, severity: verdict.severity, notified: false, reason: `envoi échoué : ${sent.error}` };
  }

  // Dédup 1/jour : on mémorise la date d'alerte. On purge un snooze expiré.
  await writeStalenessState({ lastAlertDate: verdict.currentDate });
  await writeAuditLog({
    ts: new Date().toISOString(),
    op: 'classify_note',
    target: 'hot-context.md',
    trigger: 'hot-context-staleness:alert',
    payload: { event: 'hot-context-stale-alert', severity: verdict.severity, fileWeek: verdict.fileWeek, currentWeek: verdict.currentWeek, daysSince: verdict.daysSince },
    status: 'success',
  });
  console.warn(
    `[hot-context-staleness] alerte envoyée (${verdict.severity}) — frontmatter ${verdict.fileWeek}/${verdict.fileDate}, courant ${verdict.currentWeek}/${verdict.currentDate}`,
  );
  return { proceeded: true, severity: verdict.severity, notified: true, reason: 'alerte envoyée' };
}

export interface BumpResult {
  ok: boolean;
  week?: string;
  date?: string;
  error?: string;
}

/** Met le frontmatter à aujourd'hui (semaine ISO + date), corps préservé. */
export async function bumpHotContext(): Promise<BumpResult> {
  const read = await readFile(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME);
  if (!read.success || read.content === undefined) {
    return { ok: false, error: read.error ?? 'lecture échouée' };
  }
  const p = parisParts();
  const updated = bumpFrontmatter(read.content, p.isoWeekStr, p.dateStr);
  if (updated === read.content) {
    // Aucun changement (frontmatter sans les clés, ou déjà à jour) → no-op.
    return { ok: true, week: p.isoWeekStr, date: p.dateStr };
  }
  const w = await writeFile(HOT_CONTEXT_FOLDER, HOT_CONTEXT_FILENAME, updated);
  if (!w.success) {
    return { ok: false, error: w.error ?? 'écriture échouée' };
  }
  // Fichier frais → on réarme l'état (plus de snooze, plus de dédup).
  await writeStalenessState({});
  await writeAuditLog({
    ts: new Date().toISOString(),
    op: 'classify_note',
    target: 'hot-context.md',
    trigger: 'hot-context-staleness:bump',
    payload: { event: 'hot-context-bumped', semaine: p.isoWeekStr, date_mise_a_jour: p.dateStr },
    status: 'success',
  });
  console.warn(`[hot-context-staleness] frontmatter bumpé → ${p.isoWeekStr} / ${p.dateStr}`);
  return { ok: true, week: p.isoWeekStr, date: p.dateStr };
}

/** Snooze 24h : ne plus alerter pendant 24h. */
export async function snoozeStaleness(): Promise<void> {
  const state = await readStalenessState();
  await writeStalenessState({ ...state, snoozedUntil: Date.now() + SNOOZE_MS });
}

export async function getHotContextDriveUrl(): Promise<string | null> {
  return hotContextDriveUrl();
}
