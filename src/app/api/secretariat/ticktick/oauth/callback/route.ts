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

    // TickTick ne retourne PAS de refresh_token (stratégie 180j sur access_token).
    // On affiche l'access_token : c'est ce que Thomas stocke dans Replit Secrets.
    const expiresInDays = Math.round((tokens.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return new Response(
      `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>TickTick OAuth — Succès</title></head>
<body style="font-family:system-ui;max-width:600px;margin:40px auto;padding:20px">
  <h1 style="color:green">TickTick autorisé avec succès</h1>
  <p><strong>Note importante</strong> : TickTick ne retourne pas de refresh_token. L'access_token ci-dessous est valide ~${expiresInDays} jours (~180j en général). À ré-autoriser tous les ~5 mois.</p>
  <h3>TICKTICK_ACCESS_TOKEN</h3>
  <textarea readonly rows="4" cols="60" style="font-family:monospace" onclick="this.select()">${tokens.accessToken}</textarea>
  <h3>Vérification</h3>
  <ul>
    <li>Access token obtenu : ${tokens.accessToken ? 'oui' : 'NON — problème'}</li>
    <li>Expiration : ~${expiresInDays} jours (${new Date(tokens.expiresAt).toISOString()})</li>
    <li>Refresh token : ${tokens.refreshToken ? 'oui (rare, à stocker aussi)' : 'non (normal, TickTick n\'en émet pas)'}</li>
  </ul>
  <p><strong>Action Thomas :</strong> Replit → Tools → Secrets → ajouter <code>TICKTICK_ACCESS_TOKEN</code> avec la valeur ci-dessus. Puis redeploy.</p>
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
