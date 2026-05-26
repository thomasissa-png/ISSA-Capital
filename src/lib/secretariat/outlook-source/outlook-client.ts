/**
 * Client Microsoft Graph — Outlook (multi-boîtes Sarani / Versi).
 *
 * Auth par compte : refresh token (stocké VPS .env.local) → access token.
 *
 * 🔒 INVARIANT SÉCURITÉ (règle 11) — LECTURE + BROUILLON UNIQUEMENT. Ce module
 * n'expose et n'appelle JAMAIS d'endpoint d'envoi (`/sendMail`, `/send`). Anya
 * ne doit pas pouvoir envoyer d'email via Outlook, comme pour Gmail.
 */

import { loadEnvConfig } from '@next/env';

// Le runtime VPS (`next start`) ne peuple pas process.env depuis .env.local pour
// les accès dynamiques — on force le chargement ici (idempotent, best-effort).
let envLoaded = false;
function ensureEnv(): void {
  if (envLoaded) return;
  try {
    loadEnvConfig(process.cwd());
  } catch {
    /* best-effort */
  }
  envLoaded = true;
}

export type OutlookBox = 'sarani' | 'versi';
export const OUTLOOK_BOXES: readonly OutlookBox[] = ['sarani', 'versi'];

/** Scopes — lecture + brouillon, JAMAIS Mail.Send. */
const SCOPES = 'offline_access User.Read Mail.Read Mail.ReadWrite';

interface BoxCreds {
  clientId?: string;
  tenant: string;
  clientSecret?: string;
  refreshToken?: string;
}

function creds(box: OutlookBox): BoxCreds {
  ensureEnv();
  const s = box.toUpperCase();
  return {
    clientId: process.env[`OUTLOOK_CLIENT_ID_${s}`],
    tenant: process.env[`OUTLOOK_TENANT_ID_${s}`] ?? 'organizations',
    clientSecret: process.env[`OUTLOOK_CLIENT_SECRET_${s}`],
    refreshToken: process.env[`OUTLOOK_REFRESH_TOKEN_${s}`],
  };
}

/** Vrai si la boîte a toutes ses variables (creds + refresh token). */
export function isBoxConfigured(box: OutlookBox): boolean {
  const c = creds(box);
  return Boolean(c.clientId && c.clientSecret && c.refreshToken);
}

/**
 * Échange le refresh token contre un access token (grant refresh_token).
 * @returns access token, ou null si creds manquants / échec.
 */
export async function getAccessToken(box: OutlookBox): Promise<string | null> {
  const c = creds(box);
  if (!c.clientId || !c.clientSecret || !c.refreshToken) return null;

  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(c.tenant)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: c.clientId,
          client_secret: c.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: c.refreshToken,
          scope: SCOPES,
        }),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`[outlook-client] refresh ${box} HTTP ${res.status} — ${txt.slice(0, 200)}`);
      return null;
    }
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch (err) {
    console.warn(`[outlook-client] refresh ${box} erreur : ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

export interface ConnectivityResult {
  ok: boolean;
  email?: string;
  error?: string;
}

/**
 * Vérifie qu'une boîte est joignable : refresh token → access token → GET /me.
 * Lecture seule, aucun envoi.
 */
export async function checkConnectivity(box: OutlookBox): Promise<ConnectivityResult> {
  if (!isBoxConfigured(box)) {
    return { ok: false, error: 'config incomplète (creds ou refresh token manquant)' };
  }
  const token = await getAccessToken(box);
  if (!token) return { ok: false, error: 'échec refresh token' };

  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, error: `/me HTTP ${res.status}` };
    const me = (await res.json()) as { mail?: string; userPrincipalName?: string };
    return { ok: true, email: me.mail ?? me.userPrincipalName ?? '(inconnu)' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
