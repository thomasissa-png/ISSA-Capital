/**
 * Constantes partagées du flow OAuth2 Microsoft (init + callback).
 *
 * Hors `route.ts` car un fichier de route Next.js ne peut exporter que des
 * handlers (GET/POST…) + `runtime`/`dynamic` — pas de constantes nommées.
 *
 * 🔒 Scopes EN LECTURE/BROUILLON UNIQUEMENT — JAMAIS `Mail.Send` (règle 11).
 */

export const OUTLOOK_REDIRECT_URI = 'https://issa-capital.com/api/outlook-auth/callback';

/** Scopes délégués Microsoft Graph — lecture + brouillon, JAMAIS d'envoi. */
export const OUTLOOK_SCOPES = [
  'offline_access',
  'User.Read',
  'Mail.Read',
  'Mail.ReadWrite',
].join(' ');

export function outlookAuthorizeUrl(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`;
}

export function outlookTokenUrl(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}
