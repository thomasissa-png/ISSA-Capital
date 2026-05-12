/**
 * GET /api/drive-auth — Autorisation OAuth2 Google Drive (one-time setup).
 *
 * Thomas visite cette URL UNE FOIS pour :
 *  1. Être redirigé vers Google pour autoriser l'accès Drive
 *  2. Google redirige vers /api/drive-auth?code=XXX
 *  3. On échange le code contre un refresh token
 *  4. Thomas copie le refresh token dans Replit Secrets
 *
 * Après ça, cette route n'est plus nécessaire.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = 'https://www.googleapis.com/auth/drive';

export async function GET(request: Request): Promise<Response> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(
      '<h1>Configuration manquante</h1><p>Ajoute GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET dans les Secrets Replit.</p>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const redirectUri = 'https://issa-capital.com/api/drive-auth';
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  // Étape 1 : pas de code → rediriger vers Google pour autorisation
  if (!code) {
    const authUrl = new URL(AUTH_URL);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');

    return Response.redirect(authUrl.toString());
  }

  // Étape 2 : code reçu → échanger contre refresh token
  try {
    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error) {
      return new Response(
        `<h1>Erreur Google</h1><p>${tokenData.error}: ${tokenData.error_description}</p>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }

    if (!tokenData.refresh_token) {
      return new Response(
        '<h1>Pas de refresh token</h1><p>Google n\'a pas retourné de refresh token. Supprime l\'accès dans <a href="https://myaccount.google.com/connections">myaccount.google.com/connections</a> puis réessaie.</p>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }

    // Vérification du scope effectif via tokeninfo
    const grantedScope = tokenData.scope ?? '';
    const isFullDrive = grantedScope.includes('https://www.googleapis.com/auth/drive') &&
      !grantedScope.includes('drive.file') &&
      !grantedScope.includes('drive.readonly');
    const isLimitedFile = grantedScope.includes('drive.file');
    const scopeRequested = SCOPES;
    const scopeColor = isFullDrive ? '#16a34a' : '#dc2626';
    const scopeStatus = isFullDrive
      ? '<strong style="color:#16a34a">✅ SCOPE OK</strong> — Anya peut lire toutes tes fiches Obsidian.'
      : isLimitedFile
        ? '<strong style="color:#dc2626">❌ SCOPE INSUFFISANT</strong> — Tu as reçu drive.file (lecture limitée aux fichiers créés par l\'app). Anya ne pourra PAS lire tes fiches locataires. <br><br>Cause probable : le code Replit déployé demande encore l\'ancien scope. <strong>NE COPIE PAS ce token.</strong> Redéploie Replit (commit récent doit être actif) puis recommence cette procédure.'
        : '<strong style="color:#dc2626">⚠️ SCOPE INATTENDU</strong> — Vérifie avec l\'admin avant de continuer.';

    return new Response(
      `<!DOCTYPE html>
<html>
<head><title>Drive autorisé</title></head>
<body style="font-family: sans-serif; max-width: 700px; margin: 40px auto; padding: 20px;">
  <h1 style="color: ${scopeColor};">Autorisation reçue — vérification du scope</h1>

  <div style="background: #f5f5f5; padding: 16px; border-left: 4px solid ${scopeColor}; margin: 20px 0;">
    <p><strong>Scope demandé par le code :</strong> <code>${scopeRequested}</code></p>
    <p><strong>Scope effectivement reçu de Google :</strong> <code style="color:${scopeColor}">${grantedScope || '(vide)'}</code></p>
    <p style="margin-top:12px">${scopeStatus}</p>
  </div>

  <p>Copie ce refresh token et ajoute-le dans les <strong>Secrets Replit</strong> :</p>
  <p><strong>Clé :</strong> GOOGLE_REFRESH_TOKEN</p>
  <p><strong>Valeur :</strong></p>
  <textarea style="width: 100%; height: 80px; font-family: monospace; font-size: 12px;" readonly onclick="this.select()">${tokenData.refresh_token}</textarea>
  <p style="margin-top: 20px; color: #666;">Après avoir ajouté le secret, redéploie le site. Tu peux fermer cette page.</p>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  } catch (err) {
    return new Response(
      `<h1>Erreur</h1><p>${err instanceof Error ? err.message : String(err)}</p>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}
