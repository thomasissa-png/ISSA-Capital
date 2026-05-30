/**
 * Sérialisation d'écriture par path (queue).
 *
 * Si deux handlers veulent modifier la même fiche en parallèle,
 * le deuxième attend que le premier ait fini avant de commencer.
 *
 * Implémentation : Map<path, Promise<void>> qui chaîne les opérations.
 * Chaque nouvelle écriture sur un path donné attend la Promise précédente.
 *
 * Pas de dépendance externe — pattern standard de queue par clé.
 */

// ============================================================
// State
// ============================================================

/** Queue d'écriture : path logique → Promise de l'opération en cours */
const writeQueues = new Map<string, Promise<void>>();

/**
 * Borne dure d'une opération sous lock. Une écriture vault = quelques appels
 * Drive bornés à 10 s chacun ; 60 s couvre largement read+write+audit avec marge.
 * Si une op dépasse (await interne non borné, ré-entrance), elle est rejetée →
 * le `finally` libère la gate → AUCUN poison du path (cf. deadlock ré-entrant S26).
 */
const OP_TIMEOUT_MS = 60_000;
/**
 * Borne d'attente de la file. Strictement > OP_TIMEOUT_MS : en régime normal la
 * gate précédente se résout toujours avant, donc pas de concurrence parasite.
 * Ne se déclenche que sur une gate « morte » (héritée d'un poison) → on enchaîne
 * au lieu de geler la file à vie.
 */
const QUEUE_WAIT_MS = 75_000;

/** Promesse qui rejette après `ms`, avec timer nettoyable (pas de fuite de timer). */
function rejectAfter(ms: number, message: string): { promise: Promise<never>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}

// ============================================================
// API publique
// ============================================================

/**
 * Exécute une opération d'écriture avec sérialisation par path.
 *
 * Si une opération est déjà en cours sur le même path, celle-ci
 * attend sa complétion avant de démarrer.
 *
 * @param path Chemin logique du fichier (clé de sérialisation)
 * @param operation Fonction async à exécuter (lecture, modification, écriture)
 * @returns Le résultat de l'opération
 */
export async function withWriteLock<T>(
  path: string,
  operation: () => Promise<T>,
): Promise<T> {
  // Récupérer la Promise en cours sur ce path (ou une resolved si aucune)
  const currentQueue = writeQueues.get(path) ?? Promise.resolve();

  // Créer une nouvelle Promise qui attend la précédente puis exécute
  let resolveGate: () => void;
  const newGate = new Promise<void>((resolve) => {
    resolveGate = resolve;
  });

  // Enregistrer la nouvelle gate AVANT d'attendre (pour que les prochains appelants la voient)
  writeQueues.set(path, newGate);

  // Attendre que l'opération précédente soit terminée — BORNÉ (anti-poison).
  // Une gate précédente jamais résolue (op tuée par un cap externe, ré-entrance…)
  // ne doit JAMAIS geler la file à vie : au-delà de QUEUE_WAIT_MS on enchaîne.
  const waitGuard = rejectAfter(QUEUE_WAIT_MS, `attente file > ${QUEUE_WAIT_MS}ms`);
  try {
    await Promise.race([currentQueue.catch(() => undefined), waitGuard.promise]);
  } catch {
    console.warn(`[write-lock] gate précédente bloquée sur "${path}" — on enchaîne (anti-poison)`);
  } finally {
    waitGuard.cancel();
  }

  // Borne l'opération elle-même : un await interne non borné ne doit jamais
  // consommer tout le budget par-email (120 s) ni empoisonner le path. Le timeout
  // rejette → le `finally` libère TOUJOURS la gate.
  const opGuard = rejectAfter(OP_TIMEOUT_MS, `opération write-lock > ${OP_TIMEOUT_MS}ms sur "${path}"`);
  try {
    return await Promise.race([operation(), opGuard.promise]);
  } finally {
    opGuard.cancel();
    // Libérer la gate pour le prochain
    resolveGate!();

    // Nettoyer la Map si cette gate est toujours la dernière
    if (writeQueues.get(path) === newGate) {
      writeQueues.delete(path);
    }
  }
}

/**
 * Retourne le nombre de paths avec une opération en cours ou en attente.
 * Utile pour les tests et le monitoring.
 */
export function getActiveWriteLockCount(): number {
  return writeQueues.size;
}

/**
 * Vide toutes les queues d'écriture.
 * ATTENTION : uniquement pour les tests. En prod, les opérations en cours
 * seront perdues.
 */
export function clearWriteLocks(): void {
  writeQueues.clear();
}
