/**
 * GET /api/secretariat/ticktick/oauth/callback
 *
 * Callback OAuth TickTick. Reçoit le code d'autorisation, l'échange contre
 * des tokens (access + refresh), et affiche le refresh token pour que Thomas
 * le copie dans Replit Secrets.
 *
 * Pattern identique à /api/drive-auth (one-time setup).
 *
 * Jalon 5C — Session 15.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { exchangeCode } from '@/lib/secretariat/ticktick/oauth';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return new Response(
      `<h1>Erreur TickTick OAuth</h1><p>${error}: ${url.searchParams.get('error_description') ?? ''}</p>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 400 },
    );
  }

  if (!code) {
    return new Response(
      '<h1>Erreur</h1><p>Aucun code d\'autorisation reçu.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 400 },
    );
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://issa-capital.com'}/api/secretariat/ticktick/oauth/callback`;

  try {
    const tokens = await exchangeCode(code, redirectUri);

    // Afficher le refresh token pour copie dans Replit Secrets
    return new Response(
      `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>TickTick OAuth — Succès</title></head>
<body style="font-family:system-ui;max-width:600px;margin:40px auto;padding:20px">
  <h1 style="color:green">TickTick autorisé avec succès</h1>
  <p>Copie le refresh token ci-dessous dans Replit Secrets :</p>
  <h3>TICKTICK_REFRESH_TOKEN</h3>
  <textarea readonly rows="4" cols="60" style="font-family:monospace">${tokens.refreshToken}</textarea>
  <h3>Vérification</h3>
  <ul>
    <li>Access token obtenu : oui (expire dans ~${Math.round((tokens.expiresAt - Date.now()) / 60_000)} min)</li>
    <li>Refresh token obtenu : ${tokens.refreshToken ? 'oui' : 'NON — problème'}</li>
  </ul>
  <p><strong>Action Thomas :</strong> dans Replit → Secrets → ajouter <code>TICKTICK_REFRESH_TOKEN</code> avec la valeur ci-dessus.</p>
  <p>Cette page n'est plus nécessaire après la configuration. Tu peux la fermer.</p>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      `<h1>Erreur token exchange</h1><p>${message}</p>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 500 },
    );
  }
}
