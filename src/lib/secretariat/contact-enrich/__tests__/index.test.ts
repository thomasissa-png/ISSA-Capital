import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGatherAll = vi.fn();
const mockParseName = vi.fn();
const mockSynth = vi.fn();
const mockLookupSociete = vi.fn();

vi.mock('../cross-mailbox-gather', () => ({
  gatherContactEmailsAllSources: (...a: unknown[]) => mockGatherAll(...a),
}));
vi.mock('../name-parser', () => ({
  parseContactName: (...a: unknown[]) => mockParseName(...a),
}));
vi.mock('../domains', () => ({
  lookupSocieteByEmail: (...a: unknown[]) => mockLookupSociete(...a),
}));
vi.mock('../../telegram-validation/contact-fiche-synth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../telegram-validation/contact-fiche-synth')>();
  return {
    ...actual,
    synthesizeContactFiche: (...a: unknown[]) => mockSynth(...a),
  };
});

import { enrichContact, buildEnrichPreviewLines } from '../index';

beforeEach(() => {
  mockGatherAll.mockReset();
  mockParseName.mockReset();
  mockSynth.mockReset();
  mockLookupSociete.mockReset();
  mockGatherAll.mockResolvedValue({
    emails: [{ date: '2026-05-20', subject: 'X', excerpt: 'corps', direction: 'from' }],
    scanned: 3,
    sources: ['gmail', 'outlook:sarani'],
  });
  mockParseName.mockResolvedValue(null);
  mockSynth.mockResolvedValue(null);
  mockLookupSociete.mockReturnValue(null);
});

const baseInput = {
  email: 'marc@sarani.studio',
  nameFrom: 'Marc OMS',
  type: 'pro' as const,
  today: '2026-05-27',
  emailThreadRef: '[[ref]]',
};

describe('enrichContact', () => {
  it('scan vide → null (fallback stub côté appelant)', async () => {
    mockGatherAll.mockResolvedValue({ emails: [], scanned: 0, sources: [] });
    expect(await enrichContact(baseInput)).toBeNull();
  });

  it('le nom parsé prime sur le header et alimente le displayName', async () => {
    mockParseName.mockResolvedValue({ displayName: 'Marc Gernot', notes: 'code: OMS' });
    const r = await enrichContact(baseInput);
    expect(r).not.toBeNull();
    expect(r!.displayName).toBe('Marc Gernot');
    expect(r!.data.nomComplet).toBe('Marc Gernot');
    expect(r!.data.nameNotes).toBe('code: OMS');
    expect(r!.content).toContain('# Marc Gernot');
    expect(r!.content).toContain('Note (nom)');
  });

  it('société déduite du domaine en fallback quand la synthèse n’en a pas', async () => {
    mockSynth.mockResolvedValue({ role: 'Directeur' });
    mockLookupSociete.mockReturnValue('Sarani');
    const r = await enrichContact(baseInput);
    expect(r!.data.societe).toBe('Sarani');
    expect(r!.content).toContain('societe: Sarani');
  });

  it('la société synthétisée prime sur celle du domaine', async () => {
    mockSynth.mockResolvedValue({ societe: 'Sarani Studio SAS' });
    mockLookupSociete.mockReturnValue('Sarani');
    const r = await enrichContact(baseInput);
    expect(r!.data.societe).toBe('Sarani Studio SAS');
  });

  it('expose les sources dans la note d’historique', async () => {
    const r = await enrichContact(baseInput);
    expect(r!.content).toContain('gmail, outlook:sarani');
    expect(r!.sources).toEqual(['gmail', 'outlook:sarani']);
  });
});

describe('buildEnrichPreviewLines', () => {
  it('liste les champs présents', () => {
    const lines = buildEnrichPreviewLines({
      role: 'Directeur',
      societe: 'Sarani',
      telephone: '+33 6 00',
      sujets: ['a', 'b', 'c', 'd'],
    });
    expect(lines.join('\n')).toContain('Rôle : Directeur');
    expect(lines.join('\n')).toContain('Société : Sarani');
    expect(lines.join('\n')).toContain('Tél : +33 6 00');
    expect(lines.join('\n')).toContain('a, b, c'); // cap 3 sujets
  });

  it('vide si rien', () => {
    expect(buildEnrichPreviewLines({})).toEqual([]);
  });
});
