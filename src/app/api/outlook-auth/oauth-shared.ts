/**
 * Constantes + résolution de config partagées du flow OAuth2 Microsoft.
 *
 * Hors `route.ts` car un fichier de route Next.js ne peut exporter que des
 * handlers (GET/POST…) — pas de constantes nommées.
 *
 * Deux boîtes = DEUX apps Entra distinctes (une par organisation). Chaque app
 * a ses propres client_id / tenant_id / client_secret, lus depuis des secrets
 * suffixés par boîte : OUTLOOK_<CHAMP>_SARANI / _VERSI.
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

export const OUTLOOK_BOXES = ['sarani', 'versi'] as const;
export type OutlookBox = (typeof OUTLOOK_BOXES)[number];

export interface OutlookAppConfig {
  box: OutlookBox;
  clientId?: string;
  tenant: string;
  clientSecret?: string;
}

/**
 * Résout la config d'une app Entra à partir du nom de boîte (?box=… ou state).
 * Retourne null si la boîte n'est pas reconnue. Les valeurs viennent des secrets
 * OUTLOOK_CLIENT_ID_<BOX> / OUTLOOK_TENANT_ID_<BOX> / OUTLOOK_CLIENT_SECRET_<BOX>.
 */
export function resolveOutlookApp(rawBox: string): OutlookAppConfig | null {
  const box = rawBox.trim().toLowerCase();
  if (!OUTLOOK_BOXES.includes(box as OutlookBox)) return null;
  const suffix = box.toUpperCase();
  return {
    box: box as OutlookBox,
    clientId: process.env[`OUTLOOK_CLIENT_ID_${suffix}`],
    tenant: process.env[`OUTLOOK_TENANT_ID_${suffix}`] ?? 'organizations',
    clientSecret: process.env[`OUTLOOK_CLIENT_SECRET_${suffix}`],
  };
}

export function outlookAuthorizeUrl(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`;
}

export function outlookTokenUrl(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}
