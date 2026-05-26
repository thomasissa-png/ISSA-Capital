/**
 * 🔒 Garde-fou SÉCURITÉ (règle 11) — Anya ne DOIT JAMAIS envoyer d'email.
 *
 * Ce test verrouille l'invariant : le client Gmail n'expose aucune capacité
 * d'envoi, et `createDraft` écrit bien sur `/drafts` (création de brouillon),
 * jamais sur un endpoint d'envoi (`messages/send`, `drafts/send`).
 *
 * Si quelqu'un ajoute un jour une fonction d'envoi ou pointe createDraft vers
 * `/send`, ce test échoue. Seul Thomas envoie, manuellement, depuis Gmail.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn(async () => 'fake-token'),
}));
vi.mock('../../health-monitor/oauth-timestamps', () => ({
  recordOAuthUsage: vi.fn(),
}));

import * as gmailClient from '../gmail-client';
import { createDraft } from '../gmail-client';

describe('Gmail — invariant sécurité : jamais d’envoi (règle 11)', () => {
  it('n’expose AUCUNE fonction d’envoi d’email', () => {
    const sendLike = Object.keys(gmailClient).filter((name) =>
      /send|envoi|envoy/i.test(name),
    );
    expect(sendLike).toEqual([]);
  });

  it('createDraft cible /drafts (création), jamais un endpoint d’envoi', async () => {
    const urls: string[] = [];
    const fetchMock = vi.fn(async (url: unknown) => {
      urls.push(String(url));
      return {
        ok: true,
        json: async () => ({ id: 'draft_1', message: { id: 'msg_1' } }),
        text: async () => '',
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createDraft({ to: 'a@b.c', subject: 'Test', body: 'corps' });

    expect(result.success).toBe(true);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toContain('/drafts');
      expect(url).not.toContain('/send');
    }

    vi.unstubAllGlobals();
  });
});
