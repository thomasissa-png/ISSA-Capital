/**
 * Tests coherence-actions — actions de cohérence email-ingest (S23).
 *
 * Deps injectées (resolveAttachmentDestination, detectSignal, prefilter) → zéro
 * réseau, zéro appel LLM réel.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildProjetHistoriqueAction,
  buildCopyAttachmentActions,
  buildHotContextAction,
  buildCoherenceActions,
  type CoherenceDeps,
} from '../coherence-actions';
import type { EmailMessage } from '../../gmail-source/types';
import type { TriageResult } from '../../triage/types';
import type { AttachmentDestination } from '../attachment-handler';
import type { DetectSignalResult, Patch } from '../../hot-context/types';

function makeEmail(over: Partial<EmailMessage> = {}): EmailMessage {
  return {
    source: 'gmail',
    id: 'msg1',
    from: { email: 'compta@cabinet-dupont.fr', name: 'Cabinet Dupont' },
    to: [{ email: 'thomas@issa.com' }],
    cc: [],
    subject: 'Facture travaux Versi Immobilier',
    bodyPlain: 'Veuillez trouver ci-joint la facture. J\'attends votre signature avant vendredi.',
    receivedAt: new Date('2026-05-25T10:00:00Z'),
    attachments: [
      { name: 'facture.pdf', mimeType: 'application/pdf', sizeBytes: 80_000, id: 'att1' },
    ],
    rawRef: 'https://mail.google.com/x',
    ...over,
  };
}

function makeTriage(over: Partial<TriageResult> = {}): TriageResult {
  return {
    category: 'contact-pro',
    intent: 'facture',
    confidence: 0.96,
    matchedContact: 'Cabinet Dupont',
    summary: 'Facture de travaux Versi Immobilier.',
    suggestedActions: [],
    ...over,
  };
}

function makePatch(): Patch {
  return {
    patchId: 'p1',
    signalId: 's1',
    section: 'attends',
    action: 'add',
    payload: { quoi: 'Signature [[Versi Immobilier]]', deQui: '[[Cabinet Dupont]]', depuis: '2026-05-25' },
    source: 'email',
    sourceId: 'msg1',
    proposedAt: '2026-05-25T10:00:00Z',
    rationale: 'attente explicite',
  };
}

const projetDest: AttachmentDestination = {
  kind: 'projet',
  baseFolderPath: '02. Projets/02. Pro',
  subfolder: 'Documents',
  label: 'Versi Immobilier',
};

function makeDeps(over: Partial<CoherenceDeps> = {}): CoherenceDeps {
  return {
    resolveAttachmentDestination: vi.fn().mockResolvedValue(projetDest),
    detectSignal: vi.fn().mockResolvedValue({ patch: null, confidence: 0, reasonIfNull: 'none' } as DetectSignalResult),
    passesHeuristicPrefilter: vi.fn().mockReturnValue(false),
    ...over,
  };
}

describe('buildProjetHistoriqueAction', () => {
  it('projet défini → action autoExecute avec ligne « Email »', () => {
    const action = buildProjetHistoriqueAction(makeEmail(), makeTriage({ projet: 'VI' }));
    expect(action).not.toBeNull();
    expect(action!.type).toBe('append_projet_historique');
    expect(action!.autoExecute).toBe(true);
    expect(action!.payload['projetCode']).toBe('VI');
    expect(action!.payload['title']).toContain('Email : Facture travaux Versi Immobilier');
    expect(action!.payload['title']).toContain('Cabinet Dupont');
  });

  it('pas de projet → null (pas de bruit)', () => {
    expect(buildProjetHistoriqueAction(makeEmail(), makeTriage())).toBeNull();
  });
});

describe('buildCopyAttachmentActions', () => {
  it('PJ pertinente + destination → action proposée (autoExecute false)', async () => {
    const deps = makeDeps();
    const actions = await buildCopyAttachmentActions(
      makeEmail(),
      makeTriage({ projet: 'VI', attachments_to_keep: ['facture.pdf'] }),
      deps,
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]!.type).toBe('copy_attachment');
    expect(actions[0]!.autoExecute).toBe(false);
    expect(actions[0]!.payload['attachmentId']).toBe('att1');
    expect(actions[0]!.payload['baseFolderPath']).toBe('02. Projets/02. Pro');
  });

  it('aucune PJ à garder → aucune action', async () => {
    const actions = await buildCopyAttachmentActions(makeEmail(), makeTriage({ projet: 'VI' }), makeDeps());
    expect(actions).toHaveLength(0);
  });

  it('PJ pertinente MAIS aucun sujet suivi → aucune action (pas de dépotoir)', async () => {
    const deps = makeDeps({ resolveAttachmentDestination: vi.fn().mockResolvedValue(null) });
    const actions = await buildCopyAttachmentActions(
      makeEmail(),
      makeTriage({ attachments_to_keep: ['facture.pdf'] }),
      deps,
    );
    expect(actions).toHaveLength(0);
  });
});

describe('buildHotContextAction', () => {
  it('prefilter false → pas d appel detectSignal, null', async () => {
    const deps = makeDeps({ passesHeuristicPrefilter: vi.fn().mockReturnValue(false) });
    const action = await buildHotContextAction(makeEmail(), deps);
    expect(action).toBeNull();
    expect(deps.detectSignal).not.toHaveBeenCalled();
  });

  it('signal détecté → action update_hot_context (validé, transporte le patch)', async () => {
    const patch = makePatch();
    const deps = makeDeps({
      passesHeuristicPrefilter: vi.fn().mockReturnValue(true),
      detectSignal: vi.fn().mockResolvedValue({ patch, confidence: 0.9, reasonIfNull: '' }),
    });
    const action = await buildHotContextAction(makeEmail(), deps);
    expect(action).not.toBeNull();
    expect(action!.type).toBe('update_hot_context');
    expect(action!.autoExecute).toBe(false);
    expect(action!.payload['patch']).toEqual(patch);
  });

  it('detectSignal sans patch → null', async () => {
    const deps = makeDeps({
      passesHeuristicPrefilter: vi.fn().mockReturnValue(true),
      detectSignal: vi.fn().mockResolvedValue({ patch: null, confidence: 0.2, reasonIfNull: 'rien' }),
    });
    expect(await buildHotContextAction(makeEmail(), deps)).toBeNull();
  });

  it('detectSignal throw → null gracieux (best-effort)', async () => {
    const deps = makeDeps({
      passesHeuristicPrefilter: vi.fn().mockReturnValue(true),
      detectSignal: vi.fn().mockRejectedValue(new Error('LLM down')),
    });
    expect(await buildHotContextAction(makeEmail(), deps)).toBeNull();
  });
});

describe('buildCoherenceActions (agrégation)', () => {
  it('scénario complet : histo projet (auto) + PJ (proposé) — plus de hot-context inline (S24)', async () => {
    const deps = makeDeps({
      passesHeuristicPrefilter: vi.fn().mockReturnValue(true),
      detectSignal: vi.fn().mockResolvedValue({ patch: makePatch(), confidence: 0.9, reasonIfNull: '' }),
    });
    const actions = await buildCoherenceActions(
      makeEmail(),
      makeTriage({ projet: 'VI', attachments_to_keep: ['facture.pdf'] }),
      deps,
    );
    const types = actions.map((a) => a.type);
    expect(types).toContain('append_projet_historique');
    expect(types).toContain('copy_attachment');
    // S24 : la voie hot-context inline est supprimée → jamais d'action update_hot_context.
    expect(types).not.toContain('update_hot_context');
    expect(deps.detectSignal).not.toHaveBeenCalled();
    expect(actions.find((a) => a.type === 'append_projet_historique')!.autoExecute).toBe(true);
    expect(actions.find((a) => a.type === 'copy_attachment')!.autoExecute).toBe(false);
  });

  it('email perso sans projet/PJ/signal → aucune action (anti-bruit)', async () => {
    const deps = makeDeps();
    const actions = await buildCoherenceActions(
      makeEmail({ attachments: [], from: { email: 'pote@gmail.com', name: 'Pote' } }),
      makeTriage({ category: 'a-classifier' }),
      deps,
    );
    expect(actions).toHaveLength(0);
  });
});
