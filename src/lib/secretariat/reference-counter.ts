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

// Répertoire persistant du compteur de références (registre fiscal — doit
// survivre aux redéploiements/reboots, sinon la numérotation reset à 0001 et
// collisionne avec des CR existants → risque Art. 39-1 CGI).
//
// P1-B (review S25) : l'ancien chemin `/home/runner/issa-data` (héritage Replit)
// n'existe pas sur le VPS Anya → on tombait sur `/tmp/issa-secretariat`, effacé
// à chaque reboot. Ordre de préférence :
//   1. CR_COUNTER_DIR (override explicite, prioritaire),
//   2. /home/thomas/issa-data (VPS Anya — persistant),
//   3. /home/runner/issa-data (legacy Replit, si jamais présent),
//   4. /tmp/issa-secretariat (CI / tests — éphémère, acceptable hors prod).
//
// ⚠️ SUIVI (fix définitif, P1) : dériver le prochain numéro du MAX(ref) réel
// dans le vault par (entité, année) au boot, plutôt que d'un fichier local —
// le vault est la SOT (R1). Ce fichier reste un cache d'accélération.
function resolveCounterDir(): string {
  const override = process.env.CR_COUNTER_DIR;
  if (override) return override;
  if (existsSync('/home/thomas')) return '/home/thomas/issa-data';
  if (existsSync('/home/runner')) return '/home/runner/issa-data';
  return '/tmp/issa-secretariat';
}

const COUNTER_DIR = resolveCounterDir();
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
