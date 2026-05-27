/**
 * État local du garde-fou hot-context (V0) : cooldown snooze + dédup quotidien.
 *
 * Fichier JSON local (comme le curseur Beeper) — simple, persiste sur le VPS,
 * pas de coût Drive pour un état transitoire. Override via HOT_CONTEXT_STALE_STATE_FILE.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface StalenessState {
  /** Timestamp ms jusqu'auquel ne plus alerter (snooze 24h). */
  snoozedUntil?: number;
  /** Dernière date Paris « YYYY-MM-DD » où une alerte a été envoyée (dédup 1/jour). */
  lastAlertDate?: string;
}

function stateFile(): string {
  return (
    process.env.HOT_CONTEXT_STALE_STATE_FILE ??
    path.join(process.env.HOME ?? '/home/thomas', '.anya-hotcontext-staleness.json')
  );
}

export async function readStalenessState(): Promise<StalenessState> {
  try {
    const raw = await fs.readFile(stateFile(), 'utf-8');
    return JSON.parse(raw) as StalenessState;
  } catch {
    return {};
  }
}

export async function writeStalenessState(state: StalenessState): Promise<void> {
  try {
    await fs.writeFile(stateFile(), JSON.stringify(state), 'utf-8');
  } catch (err) {
    console.warn(
      `[hot-context-staleness] écriture état échouée : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
