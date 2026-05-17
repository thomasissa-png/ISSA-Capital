/**
 * GET /api/secretariat/ticktick/oauth/init
 *
 * Démarre le flow OAuth TickTick.
 * Thomas visite cette URL une seule fois pour autoriser Anya à accéder à TickTick.
 * Redirige vers TickTick pour consentement, puis callback vers /oauth/callback.
 *
 * Jalon 5C — Session 15.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { buildAuthUrl } from '@/lib/secretariat/ticktick/oauth';

export async function GET(): Promise<Response> {
  const clientId = process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(
      '<h1>Configuration manquante</h1>' +
      '<p>Ajoute TICKTICK_CLIENT_ID et TICKTICK_CLIENT_SECRET dans les Secrets Replit.</p>' +
      '<p>Créer une app sur <a href="https://developer.ticktick.com">developer.ticktick.com</a></p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 500 },
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://issa-capital.com'}/api/secretariat/ticktick/oauth/callback`;

  try {
    const authUrl = buildAuthUrl(redirectUri);
    return Response.redirect(authUrl, 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      `<h1>Erreur</h1><p>${message}</p>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 500 },
    );
  }
}
