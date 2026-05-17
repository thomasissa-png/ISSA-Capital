/**
 * OAuth TickTick — gestion des tokens (refresh/access).
 *
 * Pattern identique à Google Drive OAuth :
 * - Le refresh token est stocké dans TICKTICK_REFRESH_TOKEN (Replit Secret)
 * - L'access token est rafraîchi automatiquement quand expiré
 * - Un cache in-memory évite les appels token superflus
 *
 * Le flow OAuth initial est déclenché par GET /api/secretariat/ticktick/oauth/init
 * et le callback par GET /api/secretariat/ticktick/oauth/callback.
 *
 * Jalon 5C — Session 15.
 */

import type { TickTickTokens } from './types';

// ============================================================
// Constantes
// ============================================================

const TICKTICK_TOKEN_URL = 'https://ticktick.com/oauth/token';
const TICKTICK_AUTH_URL = 'https://ticktick.com/oauth/authorize';
const TICKTICK_SCOPE = 'tasks:read tasks:write';

/** Marge de sécurité avant expiration (5 minutes) */
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1_000;

// ============================================================
// Cache tokens en mémoire
// ============================================================

let cachedTokens: TickTickTokens | null = null;

/**
 * Construit l'URL d'autorisation OAuth TickTick.
 */
export function buildAuthUrl(redirectUri: string): string {
  const clientId = process.env.TICKTICK_CLIENT_ID;
  if (!clientId) {
    throw new Error('TICKTICK_CLIENT_ID non configuré');
  }

  const url = new URL(TICKTICK_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', TICKTICK_SCOPE);
  url.searchParams.set('state', 'anya-ticktick');

  return url.toString();
}

/**
 * Échange le code d'autorisation contre des tokens (access + refresh).
 */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<TickTickTokens> {
  const clientId = process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TICKTICK_CLIENT_ID ou TICKTICK_CLIENT_SECRET non configuré');
  }

  const response = await fetch(TICKTICK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TickTick token exchange échoué (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };

  const tokens: TickTickTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1_000,
  };

  cachedTokens = tokens;
  return tokens;
}

/**
 * Rafraîchit l'access token via le refresh token.
 */
async function refreshAccessToken(refreshToken: string): Promise<TickTickTokens> {
  const clientId = process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TICKTICK_CLIENT_ID ou TICKTICK_CLIENT_SECRET non configuré');
  }

  const response = await fetch(TICKTICK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`TickTick token refresh échoué (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const tokens: TickTickTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1_000,
  };

  cachedTokens = tokens;
  return tokens;
}

/**
 * Obtient un access token valide (depuis cache ou refresh).
 *
 * @returns access token string, ou null si non configuré.
 */
export async function getTickTickAccessToken(): Promise<string | null> {
  // Vérifier si le cache est encore valide
  if (cachedTokens && cachedTokens.expiresAt > Date.now() + TOKEN_EXPIRY_MARGIN_MS) {
    return cachedTokens.accessToken;
  }

  // Tenter un refresh depuis le token stocké
  const storedRefreshToken = cachedTokens?.refreshToken ?? process.env.TICKTICK_REFRESH_TOKEN;

  if (!storedRefreshToken) {
    console.warn('[ticktick-oauth] Aucun refresh token disponible — OAuth initial requis');
    return null;
  }

  try {
    const tokens = await refreshAccessToken(storedRefreshToken);
    return tokens.accessToken;
  } catch (err) {
    console.warn(
      `[ticktick-oauth] Erreur refresh token : ${err instanceof Error ? err.message : String(err)}`,
    );
    cachedTokens = null;
    return null;
  }
}

/**
 * Invalide le cache de tokens (pour les tests ou re-auth).
 */
export function invalidateTokenCache(): void {
  cachedTokens = null;
}

/**
 * Injecte manuellement des tokens dans le cache (usage interne après OAuth callback).
 */
export function setCachedTokens(tokens: TickTickTokens): void {
  cachedTokens = tokens;
}
