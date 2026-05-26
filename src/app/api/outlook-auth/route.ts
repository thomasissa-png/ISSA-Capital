/**
 * GET /api/outlook-auth — Autorisation OAuth2 Microsoft Graph (one-time setup).
 *
 * Calqué sur /api/drive-auth (Google), pour brancher une boîte Outlook 365.
 * Thomas visite cette URL UNE FOIS PAR BOÎTE (Sarani, Versi) :
 *  1. Redirigé vers Microsoft pour choisir le compte + autoriser
 *  2. Microsoft redirige vers /api/outlook-auth/callback?code=XXX
 *  3. La callback échange le code et affiche le refresh token + l'email détecté
 *  4. Thomas copie le refresh token dans les secrets VPS (clé par boîte)
 *
 * 🔒 INVARIANT SÉCURITÉ (règle 11) — scopes EN LECTURE/BROUILLON UNIQUEMENT
 * (voir oauth-shared.ts). JAMAIS `Mail.Send`.
 */

import {
  OUTLOOK_REDIRECT_URI,
  OUTLOOK_SCOPES,
  outlookAuthorizeUrl,
} from './oauth-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const tenant = process.env.OUTLOOK_TENANT_ID ?? 'common';

  if (!clientId) {
    return new Response(
      '<h1>Configuration manquante</h1><p>Ajoute <code>OUTLOOK_CLIENT_ID</code> (et <code>OUTLOOK_TENANT_ID</code>, <code>OUTLOOK_CLIENT_SECRET</code>) dans les secrets VPS (.env.local), puis redéploie.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const url = new URL(outlookAuthorizeUrl(tenant));
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', OUTLOOK_REDIRECT_URI);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', OUTLOOK_SCOPES);
  // select_account : permet de choisir la boîte (Sarani puis Versi) à chaque passage.
  url.searchParams.set('prompt', 'select_account');

  return Response.redirect(url.toString());
}
