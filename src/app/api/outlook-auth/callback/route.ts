/**
 * GET /api/outlook-auth/callback — Réception du code OAuth2 Microsoft + échange.
 *
 * Microsoft redirige ici après autorisation. On échange le code contre un
 * refresh token, on détecte l'email du compte (Graph /me), et on affiche le
 * refresh token pour que Thomas le copie dans les secrets VPS, avec une clé
 * suggérée par boîte (OUTLOOK_REFRESH_TOKEN_SARANI / _VERSI).
 *
 * 🔒 Aucun envoi : on demande uniquement Mail.Read + Mail.ReadWrite (brouillons).
 */

import {
  OUTLOOK_REDIRECT_URI,
  OUTLOOK_SCOPES,
  outlookTokenUrl,
} from '../oauth-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function html(body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Outlook — autorisation</title></head>` +
      `<body style="font-family: sans-serif; max-width: 720px; margin: 40px auto; padding: 20px;">${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(request: Request): Promise<Response> {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
  const tenant = process.env.OUTLOOK_TENANT_ID ?? 'common';

  if (!clientId || !clientSecret) {
    return html(
      '<h1>Configuration manquante</h1><p>Ajoute <code>OUTLOOK_CLIENT_ID</code>, <code>OUTLOOK_CLIENT_SECRET</code> (et <code>OUTLOOK_TENANT_ID</code>) dans les secrets VPS, puis redéploie.</p>',
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');
  const oauthErrorDesc = url.searchParams.get('error_description');

  if (oauthError) {
    return html(`<h1>Erreur Microsoft</h1><p>${oauthError}: ${oauthErrorDesc ?? ''}</p>`);
  }
  if (!code) {
    return html(
      '<h1>Pas de code</h1><p>Démarre l\'autorisation depuis <a href="/api/outlook-auth">/api/outlook-auth</a>.</p>',
    );
  }

  try {
    const tokenResponse = await fetch(outlookTokenUrl(tenant), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: OUTLOOK_REDIRECT_URI,
        grant_type: 'authorization_code',
        scope: OUTLOOK_SCOPES,
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
      return html(`<h1>Erreur token Microsoft</h1><p>${tokenData.error}: ${tokenData.error_description ?? ''}</p>`);
    }
    if (!tokenData.refresh_token) {
      return html(
        '<h1>Pas de refresh token</h1><p>Microsoft n\'a pas retourné de refresh token. Vérifie que le scope <code>offline_access</code> est bien accordé, puis réessaie.</p>',
      );
    }

    // Détecter l'email du compte autorisé (pour la clé de secret par boîte).
    let accountEmail = '(inconnu)';
    try {
      const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token ?? ''}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as { mail?: string; userPrincipalName?: string };
        accountEmail = me.mail ?? me.userPrincipalName ?? accountEmail;
      }
    } catch {
      // best-effort : l'email n'est pas critique pour stocker le token
    }

    const granted = tokenData.scope ?? '';
    const hasRead = granted.includes('Mail.Read');
    const hasReadWrite = granted.includes('Mail.ReadWrite');
    const hasSend = granted.includes('Mail.Send');
    const lower = accountEmail.toLowerCase();
    const suggestedKey = lower.includes('sarani')
      ? 'OUTLOOK_REFRESH_TOKEN_SARANI'
      : lower.includes('versi')
        ? 'OUTLOOK_REFRESH_TOKEN_VERSI'
        : 'OUTLOOK_REFRESH_TOKEN_<BOITE>';

    const scopeColor = hasRead && hasReadWrite && !hasSend ? '#16a34a' : '#dc2626';
    const sendWarn = hasSend
      ? '<p style="color:#dc2626"><strong>⚠️ Mail.Send accordé — à RETIRER dans Entra.</strong> Anya ne doit pas pouvoir envoyer.</p>'
      : '<p style="color:#16a34a">✅ Pas de Mail.Send — Anya ne pourra pas envoyer (conforme règle 11).</p>';

    return html(
      `<h1 style="color:${scopeColor};">Boîte autorisée — ${accountEmail}</h1>
  <div style="background:#f5f5f5;padding:16px;border-left:4px solid ${scopeColor};margin:20px 0;">
    <p><strong>Scopes reçus :</strong> <code>${granted || '(vide)'}</code></p>
    <p>${hasRead ? '✅' : '❌'} Mail.Read &nbsp; ${hasReadWrite ? '✅' : '❌'} Mail.ReadWrite (brouillons)</p>
    ${sendWarn}
  </div>
  <p>Copie ce refresh token dans les <strong>secrets VPS</strong> (<code>.env.local</code>) sous la clé :</p>
  <p><strong>Clé :</strong> <code>${suggestedKey}</code></p>
  <textarea style="width:100%;height:90px;font-family:monospace;font-size:12px;" readonly onclick="this.select()">${tokenData.refresh_token}</textarea>
  <p style="margin-top:20px;color:#666;">Recommence depuis <a href="/api/outlook-auth">/api/outlook-auth</a> pour l'autre boîte. Après avoir ajouté les secrets, redéploie. Tu peux fermer cette page.</p>`,
    );
  } catch (err) {
    return html(`<h1>Erreur</h1><p>${err instanceof Error ? err.message : String(err)}</p>`);
  }
}
