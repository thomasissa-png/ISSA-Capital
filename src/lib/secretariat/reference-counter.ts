/**
 * Compteur de références séquentielles pour les CR.
 *
 * Génère des références au format : {ENTITE}-CR-{YYYY}-{XXXX}
 * Exemple : IC-CR-2026-0003
 *
 * Persisté dans un fichier JSON (.cr-counter.json) sur disque.
 * Compteur par entité et par année, zero-padded sur 4 chiffres.
 *
 * Source de vérité : secretariat/src/server/routes/publish.ts
 * (même logique, adaptée de SQLite vers fichier JSON)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Entite } from './types';

// Même répertoire /tmp que le conversation store
const COUNTER_DIR = '/tmp/issa-secretariat';
const COUNTER_PATH = resolve(COUNTER_DIR, 'cr-counter.json');

type CounterData = Record<string, number>;

const COUNTER_GLOBAL_KEY = '__issa_cr_counter__' as const;

function getGlobalCounters(): CounterData {
  if (!(COUNTER_GLOBAL_KEY in globalThis)) {
    (globalThis as Record<string, unknown>)[COUNTER_GLOBAL_KEY] = {};
  }
  return (globalThis as Record<string, unknown>)[COUNTER_GLOBAL_KEY] as CounterData;
}

function setGlobalCounters(data: CounterData): void {
  (globalThis as Record<string, unknown>)[COUNTER_GLOBAL_KEY] = data;
}

function ensureDir(): void {
  try {
    if (!existsSync(COUNTER_DIR)) {
      mkdirSync(COUNTER_DIR, { recursive: true });
    }
  } catch {
    // best effort
  }
}

function loadCounters(): CounterData {
  const cached = getGlobalCounters();
  if (Object.keys(cached).length > 0) {
    return cached;
  }

  try {
    ensureDir();
    if (existsSync(COUNTER_PATH)) {
      const raw = readFileSync(COUNTER_PATH, 'utf8');
      const parsed = JSON.parse(raw) as CounterData;
      setGlobalCounters(parsed);
      return parsed;
    }
  } catch {
    console.warn('[reference-counter] fichier corrompu, reset');
  }
  setGlobalCounters({});
  return {};
}

function saveCounters(data: CounterData): void {
  setGlobalCounters(data);
  try {
    ensureDir();
    writeFileSync(COUNTER_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[reference-counter] erreur écriture :', err);
  }
}

/**
 * Génère la prochaine référence séquentielle pour une entité.
 *
 * @param entiteCode Code de l'entité (IC, GO, VI, VV)
 * @returns Référence au format "{ENTITE}-CR-{YYYY}-{XXXX}"
 *
 * @example
 * getNextReference('IC') // "IC-CR-2026-0001" (premier CR de l'année)
 * getNextReference('IC') // "IC-CR-2026-0002" (deuxième appel)
 */
export function getNextReference(entiteCode: Entite): string {
  const year = new Date().getFullYear();
  const counterKey = `${entiteCode}-${year}`;

  const counters = loadCounters();
  const currentCount = counters[counterKey] ?? 0;
  const nextCount = currentCount + 1;

  counters[counterKey] = nextCount;
  saveCounters(counters);

  const paddedCount = nextCount.toString().padStart(4, '0');
  return `${entiteCode}-CR-${year}-${paddedCount}`;
}
