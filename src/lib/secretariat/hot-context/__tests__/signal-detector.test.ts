/**
 * Tests signal-detector — Haiku 4.5 mocké.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  detectSignal,
  passesHeuristicPrefilter,
  buildSignalId,
} from '../signal-detector';
import type { Signal } from '../types';

vi.mock('../../llm/client', () => ({
  callAnthropic: vi.fn(),
}));

import { callAnthropic } from '../../llm/client';

afterEach(() => {
  vi.clearAllMocks();
});

const EMAIL_SIGNAL: Signal = {
  source: 'email',
  sourceId: 'msg-001',
  contentExcerpt: "Maître Dupont : j'attends votre signature avant vendredi 22/05.",
  contextMeta: { from: 'dupont@cabinet.fr', subject: 'Acte XYZ' },
};

const TG_SIGNAL: Signal = {
  source: 'telegram',
  sourceId: '12345',
  contentExcerpt: '#hotcontext priorité semaine = finaliser [[Pacte associés]]',
  contextMeta: {},
};

const CR_SIGNAL: Signal = {
  source: 'cr',
  sourceId: '06. Réunions/2026/05/2026-05-19 X.md',
  contentExcerpt:
    "## Décisions\nOn tranche entre fournisseur A et B avant fin du mois. [[Choix fournisseur]]",
  contextMeta: { titre: '2026-05-19 X' },
};

const BRUIT_SIGNAL: Signal = {
  source: 'email',
  sourceId: 'msg-bruit',
  contentExcerpt: 'Newsletter hebdomadaire — ouvrez pour voir les dernières actus.',
  contextMeta: { from: 'newsletter@x.com' },
};

describe('signal-detector — email pertinent', () => {
  it('renvoie un patch attends quand Haiku détecte une attente', async () => {
    vi.mocked(callAnthropic).mockResolvedValueOnce({
      message: {} as never,
      text: JSON.stringify({
        patch: {
          section: 'attends',
          action: 'add',
          payload: {
            quoi: 'Signature acte [[XYZ]]',
            deQui: '[[Maître Dupont]]',
            depuis: '2026-05-19',
            note: 'deadline 22/05',
          },
          rationale: 'Email explicite attente signature',
        },
        confidence: 0.92,
        reason_if_null: '',
      }),
      networkRetries: 0,
      jsonRetryUsed: false,
    });

    const result = await detectSignal(EMAIL_SIGNAL);
    expect(result.patch).not.toBeNull();
    expect(result.patch!.section).toBe('attends');
    expect(result.patch!.action).toBe('add');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.patch!.patchId).toBeTruthy();
    expect(result.patch!.signalId).toBeTruthy();
  });
});

describe('signal-detector — email bruit', () => {
  it('renvoie null quand Haiku indique pas pertinent', async () => {
    vi.mocked(callAnthropic).mockResolvedValueOnce({
      message: {} as never,
      text: JSON.stringify({
        patch: null,
        confidence: 0.1,
        reason_if_null: 'newsletter non actionable',
      }),
      networkRetries: 0,
      jsonRetryUsed: false,
    });
    const result = await detectSignal(BRUIT_SIGNAL);
    expect(result.patch).toBeNull();
    expect(result.reasonIfNull).toContain('newsletter');
  });
});

describe('signal-detector — Telegram #hotcontext', () => {
  it('renvoie un patch bouge quand Thomas signale une priorité', async () => {
    vi.mocked(callAnthropic).mockResolvedValueOnce({
      message: {} as never,
      text: JSON.stringify({
        patch: {
          section: 'bouge',
          action: 'add',
          payload: { text: 'Finaliser [[Pacte associés]]' },
          rationale: 'Thomas signale priorité via #hotcontext',
        },
        confidence: 0.95,
        reason_if_null: '',
      }),
      networkRetries: 0,
      jsonRetryUsed: false,
    });

    const result = await detectSignal(TG_SIGNAL);
    expect(result.patch).not.toBeNull();
    expect(result.patch!.section).toBe('bouge');
    expect(result.patch!.source).toBe('telegram');
  });

  it('rejette payload sans wikilink (red line 2)', async () => {
    vi.mocked(callAnthropic).mockResolvedValueOnce({
      message: {} as never,
      text: JSON.stringify({
        patch: {
          section: 'bouge',
          action: 'add',
          payload: { text: 'Finaliser pacte associés' }, // sans [[...]]
          rationale: 'priorite',
        },
        confidence: 0.9,
        reason_if_null: '',
      }),
      networkRetries: 0,
      jsonRetryUsed: false,
    });

    const result = await detectSignal(TG_SIGNAL);
    expect(result.patch).toBeNull();
    expect(result.reasonIfNull).toBe('red_line_no_wikilink_in_payload');
  });
});

describe('signal-detector — CR réunion', () => {
  it('renvoie un patch arbitrage quand CR mentionne décision à trancher', async () => {
    vi.mocked(callAnthropic).mockResolvedValueOnce({
      message: {} as never,
      text: JSON.stringify({
        patch: {
          section: 'arbitrage',
          action: 'add',
          payload: {
            sujet: 'Choix fournisseur A/B [[Choix fournisseur]]',
            contexte: 'arbitrage avant fin mai',
          },
          rationale: 'CR mentionne arbitrage explicite',
        },
        confidence: 0.88,
        reason_if_null: '',
      }),
      networkRetries: 0,
      jsonRetryUsed: false,
    });

    const result = await detectSignal(CR_SIGNAL);
    expect(result.patch).not.toBeNull();
    expect(result.patch!.section).toBe('arbitrage');
    expect(result.patch!.source).toBe('cr');
  });
});

describe('passesHeuristicPrefilter', () => {
  it('passe quand keywords FR/EN matchent', () => {
    expect(passesHeuristicPrefilter(EMAIL_SIGNAL)).toBe(true);
    expect(passesHeuristicPrefilter(CR_SIGNAL)).toBe(true);
  });

  it('Telegram #hotcontext passe toujours', () => {
    expect(passesHeuristicPrefilter(TG_SIGNAL)).toBe(true);
  });

  it('bruit sans keyword est filtré', () => {
    expect(passesHeuristicPrefilter(BRUIT_SIGNAL)).toBe(false);
  });
});

describe('buildSignalId', () => {
  it('produit un id stable pour le même input', () => {
    const a = buildSignalId('email', 'msg-1', 'attends', 'add', {
      quoi: 'X',
      deQui: 'Y',
      depuis: '2026',
    });
    const b = buildSignalId('email', 'msg-1', 'attends', 'add', {
      quoi: 'X',
      deQui: 'Y',
      depuis: '2026',
    });
    expect(a).toBe(b);
  });

  it('change si la source change', () => {
    const a = buildSignalId('email', 'X', 'bouge', 'add', { text: 'hello' });
    const b = buildSignalId('telegram', 'X', 'bouge', 'add', { text: 'hello' });
    expect(a).not.toBe(b);
  });
});
