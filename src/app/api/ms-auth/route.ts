/**
 * GET /api/ms-auth?box=sarani|versi — Autorisation OAuth2 Microsoft (init).
 *
 * Chemin NEUF (S23) : l'ancien /api/outlook-auth a été figé dans un cache
 * persistant du VPS (page "config manquante" mise en cache AVANT le fix env,
 * impurgeable sans shell). Ce chemin n'a jamais été caché → réponse live.
 * Réponses en no-store pour ne PAS être cachées à leur tour.
 *
 * UNE app Entra PAR boîte. Redirige vers Microsoft avec redirect_uri pointant
 * sur la callback existante /api/outlook-auth/callback (enregistrée dans Entra).
 *
 * 🔒 Scopes lecture/brouillon uniquement — JAMAIS `Mail.Send` (règle 11).
 */

import {
  OUTLOOK_BOXES,
  OUTLOOK_REDIRECT_URI,
  OUTLOOK_SCOPES,
  outlookAuthorizeUrl,
  resolveOutlookApp,
} from '../outlook-auth/oauth-shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOSTORE = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
} as const;

function html(body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;max-width:680px;margin:40px auto;padding:20px;">${body}<hr><small>build live-v4 (ms-auth)</small></body></html>`,
    { headers: NOSTORE },
  );
}

export async function GET(request: Request): Promise<Response> {
  const box = new URL(request.url).searchParams.get('box') ?? '';
  const app = resolveOutlookApp(box);

  if (!app) {
    const links = OUTLOOK_BOXES.map(
      (b) => `<li><a href="/api/ms-auth?box=${b}">Autoriser la boîte ${b}</a></li>`,
    ).join('');
    return html(`<h1>Choisis la boîte à autoriser</h1><ul>${links}</ul>`);
  }

  if (!app.clientId) {
    const s = app.box.toUpperCase();
    return html(
      `<h1>Configuration manquante (${app.box})</h1><p>Ajoute <code>OUTLOOK_CLIENT_ID_${s}</code>, <code>OUTLOOK_TENANT_ID_${s}</code>, <code>OUTLOOK_CLIENT_SECRET_${s}</code> dans le .env.local du VPS.</p>`,
    );
  }

  const url = new URL(outlookAuthorizeUrl(app.tenant));
  url.searchParams.set('client_id', app.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', OUTLOOK_REDIRECT_URI);
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', OUTLOOK_SCOPES);
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', app.box);

  return Response.redirect(url.toString());
}
