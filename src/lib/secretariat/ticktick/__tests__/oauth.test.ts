/**
 * Tests unitaires — OAuth TickTick (buildAuthUrl, exchangeCode, getTickTickAccessToken).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks
// ============================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Env vars
vi.stubEnv('TICKTICK_CLIENT_ID', 'test-client-id');
vi.stubEnv('TICKTICK_CLIENT_SECRET', 'test-client-secret');
vi.stubEnv('TICKTICK_REFRESH_TOKEN', 'stored-refresh-token');

// ============================================================
// Import du module testé
// ============================================================

import {
  buildAuthUrl,
  exchangeCode,
  getTickTickAccessToken,
  invalidateTokenCache,
} from '../oauth';

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  invalidateTokenCache();
});

// ============================================================
// Tests
// ============================================================

describe('TickTick OAuth', () => {
  describe('buildAuthUrl', () => {
    it('construit une URL d\'autorisation valide', () => {
      const url = buildAuthUrl('https://example.com/callback');

      expect(url).toContain('https://ticktick.com/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=tasks%3Aread+tasks%3Awrite');
    });

    it('throw si TICKTICK_CLIENT_ID manquant', () => {
      const original = process.env.TICKTICK_CLIENT_ID;
      delete process.env.TICKTICK_CLIENT_ID;

      expect(() => buildAuthUrl('https://example.com/cb')).toThrow('TICKTICK_CLIENT_ID non configuré');

      process.env.TICKTICK_CLIENT_ID = original;
    });
  });

  describe('exchangeCode', () => {
    it('échange un code contre des tokens', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
          token_type: 'bearer',
        }),
      });

      const tokens = await exchangeCode('auth-code-123', 'https://example.com/cb');

      expect(tokens.accessToken).toBe('new-access');
      expect(tokens.refreshToken).toBe('new-refresh');
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());

      // Vérifie l'appel fetch
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://ticktick.com/oauth/token');
      expect(options.method).toBe('POST');
      const body = new URLSearchParams(options.body as string);
      expect(body.get('code')).toBe('auth-code-123');
      expect(body.get('grant_type')).toBe('authorization_code');
    });

    it('throw si la réponse est en erreur', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      });

      await expect(exchangeCode('bad-code', 'https://ex.com/cb')).rejects.toThrow('échoué (400)');
    });
  });

  describe('getTickTickAccessToken', () => {
    it('utilise le refresh token stocké en env pour obtenir un access token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'fresh-access',
          expires_in: 7200,
        }),
      });

      const token = await getTickTickAccessToken();

      expect(token).toBe('fresh-access');
    });

    it('retourne le token depuis le cache si non expiré', async () => {
      // Premier appel : refresh
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'cached-access',
          expires_in: 7200,
        }),
      });

      await getTickTickAccessToken();
      vi.clearAllMocks();

      // Deuxième appel : pas de fetch
      const token = await getTickTickAccessToken();

      expect(token).toBe('cached-access');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retourne null si aucun refresh token disponible', async () => {
      invalidateTokenCache();
      const original = process.env.TICKTICK_REFRESH_TOKEN;
      delete process.env.TICKTICK_REFRESH_TOKEN;

      const token = await getTickTickAccessToken();

      expect(token).toBeNull();

      process.env.TICKTICK_REFRESH_TOKEN = original;
    });

    it('retourne null si le refresh échoue', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'token_revoked',
      });

      const token = await getTickTickAccessToken();

      expect(token).toBeNull();
    });
  });
});
