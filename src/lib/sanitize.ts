/**
 * Sanitization côté serveur sur les strings libres.
 * Volontairement sans dépendance externe (DOMPurify n'est pas adapté côté serveur
 * Node sans jsdom, trop lourd pour notre usage).
 *
 * Règles :
 * - Supprime les caractères de contrôle (sauf \n et \t)
 * - Strip les balises HTML complètes <…>
 * - Trim
 * - Limite la longueur maximale
 *
 * Cette fonction protège contre l'injection HTML dans les emails Resend et le log.
 * La validation de format (email, enum) est faite en amont par Zod.
 */
export function sanitizeString(input: string, maxLength = 2000): string {
  if (typeof input !== 'string') return '';
  // Supprime les balises HTML complètes et leurs contenus dangereux (<script>…</script>).
  const withoutHtml = input.replace(/<\/?[^>]+(>|$)/g, '');
  // Supprime les caractères de contrôle sauf \n (0x0A) et \t (0x09).
  const cleaned = withoutHtml.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
  return cleaned.trim().slice(0, maxLength);
}
