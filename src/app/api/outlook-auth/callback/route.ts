/**
 * GET /api/outlook-auth/callback — Réception du code OAuth2 Microsoft + échange.
 *
 * Le param `state` (posé par /api/outlook-auth) indique la boîte → on récupère
 * la bonne app Entra (client_id/secret/tenant) pour l'échange. On affiche le
 * refresh token + l'email détecté + la clé de secret à poser.
 *
 * 🔒 Aucun envoi : scopes Mail.Read + Mail.ReadWrite (brouillons) uniquement.
 */

import {
  OUTLOOK_REDIRECT_URI,
  OUTLOOK_SCOPES,
  outlookTokenUrl,
  resolveOutlookApp,
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
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const oauthError = url.searchParams.get('error');
  const oauthErrorDesc = url.searchParams.get('error_description');

  if (oauthError) {
    return html(`<h1>Erreur Microsoft</h1><p>${oauthError}: ${oauthErrorDesc ?? ''}</p>`);
  }

  const app = resolveOutlookApp(state);
  if (!app) {
    return html(
      '<h1>Boîte inconnue</h1><p>Recommence depuis <a href="/api/outlook-auth">/api/outlook-auth</a> en choisissant Sarani ou Versi.</p>',
    );
  }
  if (!app.clientId || !app.clientSecret) {
    const s = app.box.toUpperCase();
    return html(
      `<h1>Configuration manquante (${app.box})</h1><p>Ajoute <code>OUTLOOK_CLIENT_ID_${s}</code>, <code>OUTLOOK_CLIENT_SECRET_${s}</code> (et <code>OUTLOOK_TENANT_ID_${s}</code>) dans le <code>.env.local</code> du VPS, puis redémarre Anya.</p>`,
    );
  }
  if (!code) {
    return html(
      '<h1>Pas de code</h1><p>Démarre depuis <a href="/api/outlook-auth">/api/outlook-auth</a>.</p>',
    );
  }

  try {
    const tokenResponse = await fetch(outlookTokenUrl(app.tenant), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: app.clientId,
        client_secret: app.clientSecret,
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
        '<h1>Pas de refresh token</h1><p>Microsoft n\'a pas retourné de refresh token. Vérifie que le scope <code>offline_access</code> est accordé, puis réessaie.</p>',
      );
    }

    // Détecter l'email du compte autorisé (info, non critique).
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
      // best-effort
    }

    const granted = tokenData.scope ?? '';
    const hasRead = granted.includes('Mail.Read');
    const hasReadWrite = granted.includes('Mail.ReadWrite');
    const hasSend = granted.includes('Mail.Send');
    const secretKey = `OUTLOOK_REFRESH_TOKEN_${app.box.toUpperCase()}`;

    const scopeColor = hasRead && hasReadWrite && !hasSend ? '#16a34a' : '#dc2626';
    const sendWarn = hasSend
      ? '<p style="color:#dc2626"><strong>⚠️ Mail.Send accordé — à RETIRER dans Entra.</strong></p>'
      : '<p style="color:#16a34a">✅ Pas de Mail.Send (conforme règle 11).</p>';

    return html(
      `<h1 style="color:${scopeColor};">Boîte « ${app.box} » autorisée — ${accountEmail}</h1>
  <div style="background:#f5f5f5;padding:16px;border-left:4px solid ${scopeColor};margin:20px 0;">
    <p><strong>Scopes reçus :</strong> <code>${granted || '(vide)'}</code></p>
    <p>${hasRead ? '✅' : '❌'} Mail.Read &nbsp; ${hasReadWrite ? '✅' : '❌'} Mail.ReadWrite (brouillons)</p>
    ${sendWarn}
  </div>
  <p>Copie ce refresh token dans le <code>.env.local</code> du VPS sous la clé :</p>
  <p><strong>Clé :</strong> <code>${secretKey}</code></p>
  <textarea style="width:100%;height:90px;font-family:monospace;font-size:12px;" readonly onclick="this.select()">${tokenData.refresh_token}</textarea>
  <p style="margin-top:20px;color:#666;">Pour l'autre boîte : <a href="/api/outlook-auth">/api/outlook-auth</a>. Après ajout des secrets, redémarre Anya. Tu peux fermer cette page.</p>`,
    );
  } catch (err) {
    return html(`<h1>Erreur</h1><p>${err instanceof Error ? err.message : String(err)}</p>`);
  }
}
