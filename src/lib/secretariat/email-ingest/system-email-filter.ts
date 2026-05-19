/**
 * Filtre emails système — Anya email-ingest S18.5.
 *
 * Détecte les emails qui ne proviennent pas d'un humain (noreply@, contact@,
 * notifications@, etc.) pour éviter qu'Anya propose à Thomas de créer une
 * fiche contact pour un robot.
 *
 * Décision Thomas S18.5 (verbatim) :
 *   "qui ne sont donc pas des contacts. Je ne veux pas de ca"
 *
 * Branchement : dans handlers/contact-pro.ts, AVANT buildNoMatchActions,
 * si isSystemEmail(email.from.email) === true → skip carte Telegram,
 * skip dépôt A classifier/, skip création fiche. Seul mark_processed
 * est retourné (l'email est marqué traité dans Gmail).
 *
 * Match : case-insensitive sur la partie locale (avant @), et :
 *   - exact match (localPart === pattern)
 *   - préfixe + séparateur (.|-|_) (ex: noreply.fr@x.com matche "noreply")
 *
 * Ne PAS matcher les emails contenant un pattern au milieu :
 *   - contact-key@x.com → PAS un email système (pas de séparateur après "contact")
 *   - jean.contact@x.com → PAS un email système (pattern au milieu)
 */

// ============================================================
// Patterns
// ============================================================

/**
 * Liste exhaustive des patterns de partie locale (avant @) qui marquent
 * un email comme "système" (non humain).
 *
 * Ordre : alphabétique au sein de chaque groupe pour lisibilité.
 */
export const SYSTEM_EMAIL_PATTERNS: readonly string[] = [
  // No-reply variants
  'noreply',
  'no-reply',
  'nepasrepondre',
  'ne-pas-repondre',
  'donotreply',
  'do-not-reply',

  // Notifications
  'notifications',
  'notification',
  'notify',

  // Mailer / bounce
  'mailer',
  'mailer-daemon',
  'mailerdaemon',
  'bounce',
  'bounces',

  // Postmaster / webmaster
  'postmaster',
  'webmaster',

  // Generic team mailboxes
  'contact',
  'info',
  'hello',
  'support',
  'admin',

  // Marketing
  'marketing',
  'newsletter',
  'news',

  // Automated
  'automated',
  'system',
  'auto',
];

// ============================================================
// API publique
// ============================================================

/**
 * Détecte si une adresse email correspond à un robot / boîte système.
 *
 * Règle : la partie locale (avant @) DOIT être :
 *   - exactement égale à un pattern, OU
 *   - commencer par un pattern suivi d'un séparateur (.|-|_)
 *
 * Exemples positifs :
 *   - noreply@stripe.com (exact)
 *   - no-reply@anywhere.fr (exact)
 *   - contact@example.com (exact)
 *   - info.fr@example.com (préfixe + ".")
 *   - newsletter-tech@example.com (préfixe + "-")
 *   - notifications_app@example.com (préfixe + "_")
 *
 * Exemples négatifs :
 *   - thomas@example.com (humain)
 *   - jean.dupont@example.com (humain)
 *   - contact-key@example.com (PAS système — "contact" suivi de "-key"
 *     pourrait être un vrai contact business avec une dénomination contact-key.
 *     Heuristique : si après "contact-" il y a un autre mot, on assume humain.)
 *
 * Note S18.5 : pour "contact-XXX", on continue à considérer "contact" comme
 * système car la majorité des cas pratiques (contact-pro@, contact-rh@) sont
 * des boîtes génériques. Les faux positifs sont rares ; en cas de doute,
 * Thomas peut toujours ajouter le contact manuellement à la fiche existante.
 *
 * @param email Adresse email complète (ex: "noreply@stripe.com")
 * @returns true si l'email correspond à un pattern système
 */
export function isSystemEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;

  const atIdx = email.indexOf('@');
  if (atIdx === -1) return false;

  const localPart = email.slice(0, atIdx).toLowerCase().trim();
  if (!localPart) return false;

  // Tri par longueur décroissante pour matcher les patterns les plus
  // spécifiques en premier (ex: "mailer-daemon" avant "mailer").
  // On clone pour éviter de muter la constante exportée.
  const sortedPatterns = [...SYSTEM_EMAIL_PATTERNS].sort(
    (a, b) => b.length - a.length,
  );

  for (const pattern of sortedPatterns) {
    if (localPart === pattern) return true;

    // Préfixe + séparateur : pattern doit être suivi de . - ou _
    if (localPart.length > pattern.length && localPart.startsWith(pattern)) {
      const nextChar = localPart.charAt(pattern.length);
      if (nextChar === '.' || nextChar === '-' || nextChar === '_') {
        return true;
      }
    }
  }

  return false;
}
