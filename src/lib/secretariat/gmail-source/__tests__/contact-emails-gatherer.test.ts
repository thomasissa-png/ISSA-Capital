/**
 * Tests `gatherContactEmails` — scan boîte d'un expéditeur (S23).
 *
 * Mocks : gmail-client (listMessages/getMessage/extractBodyPlain/getHeader).
 * Aucun appel réseau réel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GmailMessageRaw } from '../gmail-client';
import { gatherContactEmails } from '../contact-emails-gatherer';

// ============================================================
// Mocks gmail-client
// ============================================================

const mockListMessages = vi.fn();
const mockGetMessage = vi.fn();

vi.mock('../gmail-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../gmail-client')>();
  return {
    ...actual, // garde getHeader / extractBodyPlain (fonctions pures)
    listMessages: (...args: unknown[]) => mockListMessages(...args),
    getMessage: (...args: unknown[]) => mockGetMessage(...args),
  };
});

// ============================================================
// Fixtures
// ============================================================

function makeRaw(opts: {
  id: string;
  from: string;
  to?: string;
  subject: string;
  body: string;
  internalDate?: string;
}): GmailMessageRaw {
  const bodyB64 = Buffer.from(opts.body, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return {
    id: opts.id,
    internalDate: opts.internalDate,
    payload: {
      mimeType: 'text/plain',
      headers: [
        { name: 'From', value: opts.from },
        { name: 'To', value: opts.to ?? 'thomas@issa-capital.com' },
        { name: 'Subject', value: opts.subject },
      ],
      body: { data: bodyB64 },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// Tests
// ============================================================

describe('gatherContactEmails', () => {
  it('email invalide (sans @) → liste vide sans appel API', async () => {
    const res = await gatherContactEmails('pas-un-email');
    expect(res.emails).toEqual([]);
    expect(res.scanned).toBe(0);
    expect(mockListMessages).not.toHaveBeenCalled();
  });

  it('aucun message trouvé → liste vide', async () => {
    mockListMessages.mockResolvedValue([]);
    const res = await gatherContactEmails('jean@exemple.com');
    expect(res.emails).toEqual([]);
    expect(res.scanned).toBe(0);
  });

  it('query inclut from: ET to: avec l email normalisé minuscule', async () => {
    mockListMessages.mockResolvedValue([]);
    await gatherContactEmails('Jean@Exemple.COM', 15);
    expect(mockListMessages).toHaveBeenCalledWith(
      'from:jean@exemple.com OR to:jean@exemple.com',
      15,
    );
  });

  it('rassemble plusieurs emails, tri récent → ancien', async () => {
    mockListMessages.mockResolvedValue([
      { id: 'm1' },
      { id: 'm2' },
      { id: 'm3' },
    ]);
    mockGetMessage.mockImplementation(async (id: string) => {
      const map: Record<string, GmailMessageRaw> = {
        m1: makeRaw({ id: 'm1', from: 'Jean <jean@exemple.com>', subject: 'Ancien', body: 'corps 1', internalDate: '1715000000000' }),
        m2: makeRaw({ id: 'm2', from: 'Jean <jean@exemple.com>', subject: 'Récent', body: 'corps 2', internalDate: '1716000000000' }),
        m3: makeRaw({ id: 'm3', from: 'thomas@issa-capital.com', to: 'jean@exemple.com', subject: 'Envoyé', body: 'corps 3', internalDate: '1715500000000' }),
      };
      return map[id] ?? null;
    });

    const res = await gatherContactEmails('jean@exemple.com');
    expect(res.scanned).toBe(3);
    expect(res.emails).toHaveLength(3);
    // Tri décroissant par date.
    expect(res.emails[0]!.subject).toBe('Récent');
    expect(res.emails[1]!.subject).toBe('Envoyé');
    expect(res.emails[2]!.subject).toBe('Ancien');
  });

  it('classe la direction from/to selon le header From', async () => {
    mockListMessages.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    mockGetMessage.mockImplementation(async (id: string) => {
      if (id === 'm1') {
        return makeRaw({ id: 'm1', from: 'Jean <jean@exemple.com>', subject: 'Reçu', body: 'x', internalDate: '1716000000000' });
      }
      return makeRaw({ id: 'm2', from: 'thomas@issa-capital.com', to: 'jean@exemple.com', subject: 'Écrit', body: 'y', internalDate: '1715000000000' });
    });

    const res = await gatherContactEmails('jean@exemple.com');
    const recu = res.emails.find((e) => e.subject === 'Reçu');
    const ecrit = res.emails.find((e) => e.subject === 'Écrit');
    expect(recu!.direction).toBe('from');
    expect(ecrit!.direction).toBe('to');
  });

  it('getMessage qui renvoie null est ignoré sans bloquer', async () => {
    mockListMessages.mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]);
    mockGetMessage.mockImplementation(async (id: string) =>
      id === 'm1'
        ? makeRaw({ id: 'm1', from: 'jean@exemple.com', subject: 'OK', body: 'corps', internalDate: '1716000000000' })
        : null,
    );

    const res = await gatherContactEmails('jean@exemple.com');
    expect(res.scanned).toBe(1);
    expect(res.emails).toHaveLength(1);
    expect(res.emails[0]!.subject).toBe('OK');
  });

  it('garde début + fin (signature) et effondre les espaces', async () => {
    // Signature en FIN de mail (rôle/tél) : le head+tail doit la conserver.
    const longBody =
      'Bonjour   Thomas.\n\n\nVoici  un texte ' + 'A'.repeat(1000) + '\nCordialement, Jean — Directeur, +33 6 00 00';
    mockListMessages.mockResolvedValue([{ id: 'm1' }]);
    mockGetMessage.mockResolvedValue(
      makeRaw({ id: 'm1', from: 'jean@exemple.com', subject: 'Long', body: longBody, internalDate: '1716000000000' }),
    );

    const res = await gatherContactEmails('jean@exemple.com');
    const excerpt = res.emails[0]!.excerpt;
    expect(excerpt.length).toBeLessThanOrEqual(601);
    expect(excerpt).not.toContain('\n');
    expect(excerpt).not.toContain('   ');
    // head+tail : début ET fin (signature) présents, séparés par l'ellipse.
    expect(excerpt).toContain('Bonjour Thomas');
    expect(excerpt).toContain('[…]');
    expect(excerpt).toContain('+33 6 00 00');
  });

  it('listMessages qui throw → liste vide (jamais d exception)', async () => {
    mockListMessages.mockRejectedValue(new Error('HTTP 401'));
    const res = await gatherContactEmails('jean@exemple.com');
    expect(res.emails).toEqual([]);
    expect(res.scanned).toBe(0);
  });

  it('respecte le cap passé en paramètre', async () => {
    mockListMessages.mockResolvedValue([]);
    await gatherContactEmails('jean@exemple.com', 5);
    expect(mockListMessages).toHaveBeenCalledWith(expect.any(String), 5);
  });
});
