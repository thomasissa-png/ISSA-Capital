/**
 * Intégration TickTick ← email-ingest.
 *
 * Quand un email est classé comme actionnable (non-spam), crée automatiquement
 * une tâche TickTick avec :
 *   - Titre = sujet de l'email
 *   - Description = résumé du triage + lien Gmail
 *   - Priorité = mappée depuis la catégorie triage
 *   - Tags = catégorie triage
 *
 * Non bloquant : si TickTick est inaccessible (pas d'OAuth, API down),
 * le pipeline continue normalement. La tâche TickTick est un bonus opérationnel.
 *
 * Jalon 5C — Session 15.
 */

import type { EmailMessage } from '../gmail-source/types';
import type { TriageResult } from '../triage/types';
import { getTickTickAccessToken } from '../ticktick/oauth';
import { createTask } from '../ticktick/ticktick-client';

// ============================================================
// Mapping catégorie → priorité TickTick
// ============================================================

/**
 * Priorité TickTick : 0=none, 1=low, 3=medium, 5=high
 */
function mapCategoryToPriority(category: string): number {
  switch (category) {
    case 'locataire': return 5;    // Haute — locataire = urgent
    case 'candidat': return 3;     // Medium — candidature
    case 'contact-pro': return 3;  // Medium — contact professionnel
    case 'apporteur': return 3;    // Medium — apporteur d'affaires
    case 'a-classifier': return 1; // Basse — à trier
    default: return 0;             // Pas de priorité
  }
}

// ============================================================
// API publique
// ============================================================

/**
 * Crée une tâche TickTick à partir d'un email trié.
 *
 * Skip silencieusement si :
 *   - TickTick non configuré (pas d'OAuth)
 *   - Catégorie spam (ne devrait pas arriver ici mais safety check)
 *
 * @throws Si l'API TickTick renvoie une erreur (le caller catch)
 */
export async function createTickTickTaskForEmail(
  email: EmailMessage,
  triage: TriageResult,
): Promise<void> {
  // Ne pas créer de tâche pour le spam
  if (triage.category === 'spam') return;

  // Vérifier que TickTick est configuré
  const token = await getTickTickAccessToken();
  if (!token) {
    // TickTick pas configuré — skip silencieusement
    return;
  }

  const priority = mapCategoryToPriority(triage.category);

  // Construire la description : résumé triage + lien Gmail
  const descLines = [
    triage.summary,
    '',
    `De : ${email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email}`,
    `Catégorie : ${triage.category}`,
    `Confiance : ${Math.round(triage.confidence * 100)}%`,
  ];

  if (email.rawRef) {
    descLines.push('', `Gmail : ${email.rawRef}`);
  }

  await createTask({
    title: `[Email] ${email.subject}`,
    desc: descLines.join('\n'),
    priority,
    tags: [`anya-${triage.category}`],
  });
}
