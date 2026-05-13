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

  // Attendre que l'opération précédente soit terminée
  await currentQueue;

  try {
    // Exécuter l'opération
    const result = await operation();
    return result;
  } finally {
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
