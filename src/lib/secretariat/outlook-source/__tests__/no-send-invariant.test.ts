/**
 * 🔒 Garde-fou SÉCURITÉ (règle 11) — Anya ne DOIT JAMAIS envoyer d'email,
 * Outlook compris. Miroir du test Gmail `gmail-source/__tests__/no-send-invariant`.
 *
 * Verrouille : (a) le client Outlook n'expose aucune fonction d'envoi ;
 * (b) `createReplyDraft` crée un BROUILLON (createReply) et ne tape jamais
 * `/sendMail` ni `/send`.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as outlookClient from '../outlook-client';

describe('Outlook — invariant sécurité : jamais d’envoi (règle 11)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('n’expose AUCUNE fonction d’envoi (send/sendMail/envoi)', () => {
    const sendLike = Object.keys(outlookClient).filter((name) =>
      /send|sendmail|envoi|envoy/i.test(name),
    );
    expect(sendLike).toEqual([]);
  });

  it('createReplyDraft tape /createReply puis PATCH, jamais /sendMail ni /send', async () => {
    // token via refresh : on stub fetch pour TOUT (refresh + graph).
    process.env.OUTLOOK_CLIENT_ID_SARANI = 'cid';
    process.env.OUTLOOK_CLIENT_SECRET_SARANI = 'secret';
    process.env.OUTLOOK_TENANT_ID_SARANI = 'tenant';
    process.env.OUTLOOK_REFRESH_TOKEN_SARANI = 'refresh';

    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: unknown, init?: { method?: string }) => {
      const u = String(url);
      urls.push(`${init?.method ?? 'GET'} ${u}`);
      if (u.includes('/oauth2/v2.0/token')) {
        return { ok: true, json: async () => ({ access_token: 'tok' }), text: async () => '' } as unknown as Response;
      }
      if (u.includes('/createReply')) {
        return { ok: true, json: async () => ({ id: 'draft1', webLink: 'http://x' }), text: async () => '' } as unknown as Response;
      }
      // PATCH body
      return { ok: true, json: async () => ({}), text: async () => '' } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await outlookClient.createReplyDraft('sarani', 'msg123', 'Bonjour, voici ma réponse.');

    expect(res.success).toBe(true);
    expect(urls.some((u) => u.includes('/createReply'))).toBe(true);
    for (const u of urls) {
      expect(u).not.toContain('/sendMail');
      expect(u).not.toMatch(/\/send(\b|$|\?)/);
    }

    delete process.env.OUTLOOK_CLIENT_ID_SARANI;
    delete process.env.OUTLOOK_CLIENT_SECRET_SARANI;
    delete process.env.OUTLOOK_TENANT_ID_SARANI;
    delete process.env.OUTLOOK_REFRESH_TOKEN_SARANI;
  });
});
