/**
 * Tests projet-enricher — enrichissement historique fiche Projet (S23).
 *
 * Mocks : vault-reader (findProjetFicheByEntite) + vault-client (appendToHistorique).
 * Zéro réseau.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindProjetFiche = vi.fn();
const mockAppendToHistorique = vi.fn();

vi.mock('../../vault-reader', () => ({
  findProjetFicheByEntite: (...args: unknown[]) => mockFindProjetFiche(...args),
}));

vi.mock('../../vault-client', () => ({
  appendToHistorique: (...args: unknown[]) => mockAppendToHistorique(...args),
}));

import { enrichProjetHistorique, appendProjetHistoriqueLine } from '../projet-enricher';
import type { EventProjection } from '../types';

function makeProjection(over: Partial<EventProjection> = {}): EventProjection {
  return {
    date: '2026-05-22',
    heure: '14:00',
    sujet: 'Point Versi Immobilier',
    googleHtmlLink: 'https://calendar.google.com/x',
    projectCodes: ['VI'],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('enrichProjetHistorique', () => {
  it('fiche trouvée → appendToHistorique avec folderPath + resolvedFilename', async () => {
    mockFindProjetFiche.mockResolvedValue({
      fileId: 'f1',
      ficheName: 'Versi Immobilier',
      resolvedFilename: 'Versi Immobilier.md',
      folderPath: '02. Projets/02. Pro',
    });
    mockAppendToHistorique.mockResolvedValue(true);

    const res = await enrichProjetHistorique('VI', makeProjection(), 'evt_1');

    expect(res.status).toBe('enriched');
    expect(res.ficheName).toBe('Versi Immobilier');
    expect(mockAppendToHistorique).toHaveBeenCalledWith(
      '02. Projets/02. Pro',
      'Versi Immobilier.md',
      expect.objectContaining({
        title: '2026-05-22 — Réunion : Point Versi Immobilier',
        trigger: 'calendar-ingest:evt_1',
        updateLastInteraction: false,
      }),
    );
  });

  it('fiche en sous-dossier → folderPath = sous-dossier', async () => {
    mockFindProjetFiche.mockResolvedValue({
      fileId: 'f2',
      ficheName: 'Versi Immobilier',
      resolvedFilename: 'Versi Immobilier.md',
      folderPath: '02. Projets/02. Pro/Versi Immobilier',
    });
    mockAppendToHistorique.mockResolvedValue(true);

    await enrichProjetHistorique('VI', makeProjection(), 'evt_2');

    expect(mockAppendToHistorique).toHaveBeenCalledWith(
      '02. Projets/02. Pro/Versi Immobilier',
      'Versi Immobilier.md',
      expect.any(Object),
    );
  });

  it('fiche introuvable → no-fiche, jamais de création (red line)', async () => {
    mockFindProjetFiche.mockResolvedValue(null);

    const res = await enrichProjetHistorique('VI', makeProjection(), 'evt_3');

    expect(res.status).toBe('no-fiche');
    expect(mockAppendToHistorique).not.toHaveBeenCalled();
  });

  it('appendToHistorique false → error', async () => {
    mockFindProjetFiche.mockResolvedValue({
      fileId: 'f1',
      ficheName: 'Versi Immobilier',
      resolvedFilename: 'Versi Immobilier.md',
      folderPath: '02. Projets/02. Pro',
    });
    mockAppendToHistorique.mockResolvedValue(false);

    const res = await enrichProjetHistorique('VI', makeProjection(), 'evt_4');
    expect(res.status).toBe('error');
  });

  it('exception findProjetFiche → error gracieux (pas de throw)', async () => {
    mockFindProjetFiche.mockRejectedValue(new Error('Drive down'));

    const res = await enrichProjetHistorique('VI', makeProjection(), 'evt_5');
    expect(res.status).toBe('error');
    expect(res.error).toContain('Drive down');
  });
});

describe('appendProjetHistoriqueLine (S23 — email-ingest)', () => {
  it('fiche trouvée → append avec title/content custom + updateLastInteraction false', async () => {
    mockFindProjetFiche.mockResolvedValue({
      fileId: 'f1',
      ficheName: 'Versi Immobilier',
      resolvedFilename: 'Versi Immobilier.md',
      folderPath: '02. Projets/02. Pro',
    });
    mockAppendToHistorique.mockResolvedValue(true);

    const res = await appendProjetHistoriqueLine('VI', {
      title: '2026-05-25 — Email : Facture travaux (de Cabinet Dupont)',
      content: 'Facture reçue.',
      trigger: 'email_ingest:auto:msg_1',
    });

    expect(res.status).toBe('enriched');
    expect(mockAppendToHistorique).toHaveBeenCalledWith(
      '02. Projets/02. Pro',
      'Versi Immobilier.md',
      expect.objectContaining({
        title: '2026-05-25 — Email : Facture travaux (de Cabinet Dupont)',
        content: 'Facture reçue.',
        trigger: 'email_ingest:auto:msg_1',
        updateLastInteraction: false,
      }),
    );
  });

  it('fiche introuvable → no-fiche, jamais de création (red line)', async () => {
    mockFindProjetFiche.mockResolvedValue(null);
    const res = await appendProjetHistoriqueLine('VM', {
      title: 't',
      content: 'c',
      trigger: 'tr',
    });
    expect(res.status).toBe('no-fiche');
    expect(mockAppendToHistorique).not.toHaveBeenCalled();
  });

  it('append false → error', async () => {
    mockFindProjetFiche.mockResolvedValue({
      fileId: 'f1',
      ficheName: 'Versimo',
      resolvedFilename: 'Versimo.md',
      folderPath: '02. Projets/02. Pro',
    });
    mockAppendToHistorique.mockResolvedValue(false);
    const res = await appendProjetHistoriqueLine('VM', { title: 't', content: 'c', trigger: 'tr' });
    expect(res.status).toBe('error');
  });
});
