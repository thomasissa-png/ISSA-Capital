/**
 * GET /api/outlook-auth?box=sarani|versi — Autorisation OAuth2 Microsoft.
 *
 * UNE app Entra PAR boîte (orgas différentes). On choisit la boîte via ?box=…,
 * on redirige vers Microsoft, et on transporte la boîte dans `state` pour que
 * la callback sache quelle app utiliser à l'échange du code.
 *
 * 🔒 Scopes lecture/brouillon uniquement — JAMAIS `Mail.Send` (règle 11).
 */

import {
  OUTLOOK_BOXES,
  OUTLOOK_REDIRECT_URI,
  OUTLOOK_SCOPES,
  outlookAuthorizeUrl,
  resolveOutlookApp,
} from './oauth-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function html(body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;max-width:680px;margin:40px auto;padding:20px;">${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export async function GET(request: Request): Promise<Response> {
  const box = new URL(request.url).searchParams.get('box') ?? '';
  const app = resolveOutlookApp(box);

  if (!app) {
    const links = OUTLOOK_BOXES.map(
      (b) => `<li><a href="/api/outlook-auth?box=${b}">Autoriser la boîte ${b}</a></li>`,
    ).join('');
    return html(`<h1>Choisis la boîte à autoriser</h1><ul>${links}</ul>`);
  }

  if (!app.clientId) {
    const s = app.box.toUpperCase();
    return html(
      `<h1>Configuration manquante (${app.box})</h1><p>Ajoute dans le <code>.env.local</code> du VPS : <code>OUTLOOK_CLIENT_ID_${s}</code>, <code>OUTLOOK_TENANT_ID_${s}</code>, <code>OUTLOOK_CLIENT_SECRET_${s}</code>, puis redémarre Anya.</p>`,
    );
  }

  const url = new URL(outlookAuthorizeUrl(app.tenant));
  url.searchParams.set('client_id', app.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', OUTLOOK_REDIRECT_URI);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', OUTLOOK_SCOPES);
  url.searchParams.set('prompt', 'select_account');
  // Transporte la boîte jusqu'à la callback (échange avec la bonne app).
  url.searchParams.set('state', app.box);

  return Response.redirect(url.toString());
}
