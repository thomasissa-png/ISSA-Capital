/**
 * Tests handler Telegram cal-projet-confirm — désambiguïsation projet (S23).
 *
 * R4 : test E2E du callback `calproj:` (parsing + dispatch enrich/none/expired).
 * Le store Drive est simulé via mock de getAccessToken + fetch global. Zéro réseau réel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetAccessToken = vi.fn();
const mockEnrichProjet = vi.fn();
const mockAnswerCallback = vi.fn(async () => undefined);
const mockSendWithButtons = vi.fn(async () => ({ success: true, messageId: 42 }));
const mockEditMessageText = vi.fn(async () => true);

vi.mock('../../../drive-upload', () => ({
  getAccessToken: (...a: unknown[]) => (mockGetAccessToken as (...x: unknown[]) => unknown)(...a),
  getOrCreateSubfolder: vi.fn(async () => 'folder_state'),
}));

vi.mock('../../../vault-client/drive-resolver', () => ({
  resolvePath: vi.fn(async () => ({ success: true, fileId: 'folder_state' })),
}));

vi.mock('../../../telegram', () => ({
  answerCallbackQuery: (...a: unknown[]) => (mockAnswerCallback as (...x: unknown[]) => unknown)(...a),
  sendTelegramMessageWithButtons: (...a: unknown[]) =>
    (mockSendWithButtons as (...x: unknown[]) => unknown)(...a),
}));

vi.mock('../../telegram-cards', () => ({
  editMessageText: (...a: unknown[]) => (mockEditMessageText as (...x: unknown[]) => unknown)(...a),
}));

vi.mock('../../../calendar-ingest/projet-enricher', () => ({
  enrichProjetHistorique: (...a: unknown[]) => (mockEnrichProjet as (...x: unknown[]) => unknown)(...a),
}));

import {
  parseCalProjetCallback,
  buildCalProjetCardText,
  buildCalProjetKeyboard,
  handleCalProjetCallback,
  _resetCalProjetLockForTests,
  CAL_PROJET_CALLBACK_PREFIX,
  type CalProjetPending,
} from '../cal-projet-confirm';
import type { EventProjection } from '../../../calendar-ingest/types';

function makeProjection(over: Partial<EventProjection> = {}): EventProjection {
  return {
    date: '2026-05-22',
    sujet: 'Sync multi-projets',
    googleHtmlLink: 'https://calendar.google.com/x',
    projectCodes: ['GO', 'VI'],
    ...over,
  };
}

function makePending(over: Partial<CalProjetPending> = {}): CalProjetPending {
  return {
    id: 'evt_ambig',
    candidateCodes: ['GO', 'VI'],
    candidateNames: { GO: 'Gradient One', VI: 'Versi Immobilier' },
    projection: makeProjection(),
    createdAt: new Date().toISOString(),
    ...over,
  };
}

/** Simule un store Drive contenant `pendings` via fetch mocké. */
function mockStoreFetch(pendings: Record<string, CalProjetPending>) {
  const store = { version: 1, pendings };
  global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    // findStoreFileId → renvoie un fichier existant
    if (u.includes('/drive/v3/files?') && u.includes('q=')) {
      return new Response(JSON.stringify({ files: [{ id: 'store_file' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    // readStore (alt=media)
    if (u.includes('alt=media')) {
      return new Response(JSON.stringify(store), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    // writeStore (PATCH) ou create
    if (init?.method === 'PATCH' || init?.method === 'POST') {
      return new Response(JSON.stringify({ id: 'store_file' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetCalProjetLockForTests();
  mockGetAccessToken.mockResolvedValue('token');
});

describe('parseCalProjetCallback', () => {
  it('parse calproj:<id>:<code>', () => {
    expect(parseCalProjetCallback('calproj:evt_1:VI')).toEqual({
      pendingId: 'evt_1',
      choice: 'VI',
    });
  });

  it('parse choix none', () => {
    expect(parseCalProjetCallback('calproj:evt_1:none')).toEqual({
      pendingId: 'evt_1',
      choice: 'none',
    });
  });

  it('gère un eventId contenant des deux-points (lastIndexOf)', () => {
    expect(parseCalProjetCallback('calproj:abc:def:VI')).toEqual({
      pendingId: 'abc:def',
      choice: 'VI',
    });
  });

  it('retourne null si mauvais préfixe', () => {
    expect(parseCalProjetCallback('autre:x:y')).toBeNull();
  });
});

describe('buildCalProjetCardText / buildCalProjetKeyboard', () => {
  it('carte mentionne les noms canoniques', () => {
    const text = buildCalProjetCardText(makePending());
    expect(text).toContain('Gradient One');
    expect(text).toContain('Versi Immobilier');
    expect(text).toContain('Sync multi-projets');
  });

  it('clavier = 1 bouton par projet + Aucun', () => {
    const kb = buildCalProjetKeyboard(makePending());
    expect(kb).toHaveLength(3);
    expect(kb[0]![0]!.callback_data).toBe(`${CAL_PROJET_CALLBACK_PREFIX}evt_ambig:GO`);
    expect(kb[2]![0]!.callback_data).toBe(`${CAL_PROJET_CALLBACK_PREFIX}evt_ambig:none`);
  });
});

describe('handleCalProjetCallback', () => {
  it('choix d\'un projet → enrichProjetHistorique + edit message', async () => {
    mockStoreFetch({ evt_ambig: makePending() });
    mockEnrichProjet.mockResolvedValue({
      code: 'VI',
      status: 'enriched',
      ficheName: 'Versi Immobilier',
    });

    const code = await handleCalProjetCallback({
      callback_query_id: 'cb1',
      data: 'calproj:evt_ambig:VI',
      message_id: 10,
      chat_id: 99,
    });

    expect(code).toBe('enriched');
    expect(mockEnrichProjet).toHaveBeenCalledWith('VI', expect.any(Object), 'evt_ambig');
    expect(mockEditMessageText).toHaveBeenCalled();
  });

  it('choix « Aucun » → pas d\'enrich, message clair', async () => {
    mockStoreFetch({ evt_ambig: makePending() });

    const code = await handleCalProjetCallback({
      callback_query_id: 'cb2',
      data: 'calproj:evt_ambig:none',
      message_id: 10,
      chat_id: 99,
    });

    expect(code).toBe('none');
    expect(mockEnrichProjet).not.toHaveBeenCalled();
  });

  it('pending introuvable/expiré → message expired', async () => {
    mockStoreFetch({}); // store vide

    const code = await handleCalProjetCallback({
      callback_query_id: 'cb3',
      data: 'calproj:evt_inconnu:VI',
      message_id: 10,
      chat_id: 99,
    });

    expect(code).toBe('expired');
    expect(mockEnrichProjet).not.toHaveBeenCalled();
  });

  it('choix d\'un code hors candidats → invalid', async () => {
    mockStoreFetch({ evt_ambig: makePending() });

    const code = await handleCalProjetCallback({
      callback_query_id: 'cb4',
      data: 'calproj:evt_ambig:IC',
      message_id: 10,
      chat_id: 99,
    });

    expect(code).toBe('invalid');
    expect(mockEnrichProjet).not.toHaveBeenCalled();
  });
});
