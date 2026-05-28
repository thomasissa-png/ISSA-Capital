import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Participant } from '../../types';

// ---- Mocks ----
const mockGetVaultContacts = vi.fn();
const mockAppendToHistorique = vi.fn();
const mockReadFile = vi.fn();

vi.mock('../../vault-contacts', () => ({
  getVaultContacts: (...a: unknown[]) => mockGetVaultContacts(...a),
}));
vi.mock('../../vault-client', () => ({
  appendToHistorique: (...a: unknown[]) => mockAppendToHistorique(...a),
}));
vi.mock('../../vault-client/obsidian-file', () => ({
  readFile: (...a: unknown[]) => mockReadFile(...a),
}));

import { writeBackCrToContacts } from '../cr-contact-writeback';

function p(prenom: string, nom: string, qualite = 'Avocat', societe = 'PNM Avocats'): Participant {
  return { prenom, nom, titre: 'Maître', societe, qualite_relation: qualite };
}

const CR_INPUT_BASE = {
  crDate: '2026-05-27',
  crTitle: 'Point GAPD Sarani',
  crWebViewLink: 'https://drive.google.com/file/d/CR-001/view',
  crFilename: 'IC-CR-2026-0042.pdf',
  entiteCode: 'IC',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockReadFile.mockResolvedValue({ success: true, content: '## Historique\n' });
  mockAppendToHistorique.mockResolvedValue(true);
});

describe('writeBackCrToContacts', () => {
  it('aucun participant → enriched=0, jamais d\'appel', async () => {
    mockGetVaultContacts.mockResolvedValue([]);
    const r = await writeBackCrToContacts({ ...CR_INPUT_BASE, participants: [] });
    expect(r.enriched).toBe(0);
    expect(mockAppendToHistorique).not.toHaveBeenCalled();
  });

  it('participant matché → 1 append (avec lien PDF, qualité, updateLastInteraction)', async () => {
    mockGetVaultContacts.mockResolvedValue([
      { prenom: 'Martin', nom: 'Yhuel', folderPath: '07. Contacts/03. Pro', filename: 'Martin Yhuel.md' },
    ]);
    const r = await writeBackCrToContacts({
      ...CR_INPUT_BASE,
      participants: [p('Martin', 'Yhuel')],
    });
    expect(r.enriched).toBe(1);
    expect(r.notMatched).toEqual([]);
    expect(mockAppendToHistorique).toHaveBeenCalledTimes(1);
    const call = mockAppendToHistorique.mock.calls[0]!;
    expect(call[0]).toBe('07. Contacts/03. Pro');
    expect(call[1]).toBe('Martin Yhuel.md');
    const opts = call[2] as { title: string; content: string; updateLastInteraction: boolean };
    expect(opts.title).toBe('2026-05-27 — Réunion : Point GAPD Sarani');
    expect(opts.content).toContain('https://drive.google.com/file/d/CR-001/view');
    expect(opts.content).toContain('Rôle : Avocat');
    expect(opts.content).toContain('projet IC');
    expect(opts.updateLastInteraction).toBe(true);
  });

  it('participant inconnu → notMatched, pas d\'append (zéro invention)', async () => {
    mockGetVaultContacts.mockResolvedValue([
      { prenom: 'Martin', nom: 'Yhuel', folderPath: '07. Contacts/03. Pro', filename: 'Martin Yhuel.md' },
    ]);
    const r = await writeBackCrToContacts({
      ...CR_INPUT_BASE,
      participants: [p('Inconnu', 'Personne')],
    });
    expect(r.enriched).toBe(0);
    expect(r.notMatched).toContain('Inconnu Personne');
    expect(mockAppendToHistorique).not.toHaveBeenCalled();
  });

  it('participant ambigu (>1 match exact) → ambiguous, pas d\'append', async () => {
    // Deux fiches au MÊME nom complet (cas réel : homonymes dans des sous-dossiers
    // différents). matchContacts les renvoie toutes les deux → ambigu → skip.
    mockGetVaultContacts.mockResolvedValue([
      { prenom: 'Marc', nom: 'Dupont', folderPath: '07. Contacts/03. Pro', filename: 'Marc Dupont.md' },
      { prenom: 'Marc', nom: 'Dupont', folderPath: '07. Contacts/01. Famille', filename: 'Marc Dupont.md' },
    ]);
    const r = await writeBackCrToContacts({
      ...CR_INPUT_BASE,
      participants: [p('Marc', 'Dupont')],
    });
    expect(r.enriched).toBe(0);
    expect(r.ambiguous).toContain('Marc Dupont');
    expect(mockAppendToHistorique).not.toHaveBeenCalled();
  });

  it('idempotent : lien déjà dans la fiche → skip', async () => {
    mockGetVaultContacts.mockResolvedValue([
      { prenom: 'Martin', nom: 'Yhuel', folderPath: '07. Contacts/03. Pro', filename: 'Martin Yhuel.md' },
    ]);
    mockReadFile.mockResolvedValue({
      success: true,
      content: '## Historique\n\n### 2026-05-27 — Réunion : Point GAPD Sarani\n[Compte rendu PDF](https://drive.google.com/file/d/CR-001/view) — projet IC\n',
    });
    const r = await writeBackCrToContacts({
      ...CR_INPUT_BASE,
      participants: [p('Martin', 'Yhuel')],
    });
    expect(r.skippedIdempotent).toBe(1);
    expect(r.enriched).toBe(0);
    expect(mockAppendToHistorique).not.toHaveBeenCalled();
  });

  it('plusieurs participants : un matché + un inconnu → résultats indépendants', async () => {
    mockGetVaultContacts.mockResolvedValue([
      { prenom: 'Martin', nom: 'Yhuel', folderPath: '07. Contacts/03. Pro', filename: 'Martin Yhuel.md' },
    ]);
    const r = await writeBackCrToContacts({
      ...CR_INPUT_BASE,
      participants: [p('Martin', 'Yhuel'), p('Inconnu', 'Personne')],
    });
    expect(r.enriched).toBe(1);
    expect(r.notMatched).toEqual(['Inconnu Personne']);
  });

  it('échec chargement contacts → errors=1, pas d\'append', async () => {
    mockGetVaultContacts.mockRejectedValue(new Error('Drive down'));
    const r = await writeBackCrToContacts({
      ...CR_INPUT_BASE,
      participants: [p('Martin', 'Yhuel')],
    });
    expect(r.errors).toBe(1);
    expect(mockAppendToHistorique).not.toHaveBeenCalled();
  });

  it('appendToHistorique throw sur un participant → errors+1, suite traitée', async () => {
    mockGetVaultContacts.mockResolvedValue([
      { prenom: 'A', nom: 'X', folderPath: '07. Contacts/03. Pro', filename: 'A X.md' },
      { prenom: 'B', nom: 'Y', folderPath: '07. Contacts/03. Pro', filename: 'B Y.md' },
    ]);
    mockAppendToHistorique
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(true);
    const r = await writeBackCrToContacts({
      ...CR_INPUT_BASE,
      participants: [p('A', 'X'), p('B', 'Y')],
    });
    expect(r.errors).toBe(1);
    expect(r.enriched).toBe(1);
  });
});
