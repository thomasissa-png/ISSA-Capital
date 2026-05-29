/**
 * Tests `citation.ts` — recherche Drive, exclusion stubs redirect, sélection
 * déterministe, distillation Flash. Drive + readFileById + callLLM mockés.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  searchDriveFiles: vi.fn(),
  readFileById: vi.fn(),
  callLLM: vi.fn(),
}));

vi.mock('../../drive-upload', () => ({
  getAccessToken: mocks.getAccessToken,
  searchDriveFiles: mocks.searchDriveFiles,
}));

vi.mock('../../vault-client/obsidian-file', () => ({
  readFileById: mocks.readFileById,
}));

vi.mock('../../llm/client', () => ({
  callLLM: mocks.callLLM,
}));

import { pickDailyCitation, listReadingFiches } from '../citation';

const REAL_FICHE = '# Atomic Habits\n\nLes habitudes composées font la différence.';
const REDIRECT_STUB = '---\ntype: redirect\ntarget: vraie-fiche\n---\nVoir ailleurs.';

describe('listReadingFiches — exclusion stubs redirect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exclut les fiches frontmatter type: redirect', async () => {
    mocks.searchDriveFiles.mockResolvedValue([
      { id: '1', name: '[Livre] Atomic Habits.md' },
      { id: '2', name: '[Livre] Stub.md' },
    ]);
    mocks.readFileById.mockImplementation((_t: string, id: string) =>
      Promise.resolve({
        success: true,
        content: id === '2' ? REDIRECT_STUB : REAL_FICHE,
      }),
    );
    const real = await listReadingFiches('token');
    expect(real.map((f) => f.id)).toEqual(['1']);
  });

  it('retourne [] si aucune fiche', async () => {
    mocks.searchDriveFiles.mockResolvedValue([]);
    const real = await listReadingFiches('token');
    expect(real).toEqual([]);
  });
});

describe('pickDailyCitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockResolvedValue('token');
  });

  it('sélection déterministe par dayOfYear et distille via Flash', async () => {
    mocks.searchDriveFiles.mockResolvedValue([
      { id: 'a', name: '[Livre] Alpha.md' },
      { id: 'b', name: '[Livre] Beta.md' },
    ]);
    mocks.readFileById.mockResolvedValue({ success: true, content: REAL_FICHE });
    mocks.callLLM.mockResolvedValue({ text: 'Petits gains, grands effets.' });

    // dayOfYear=2 → 2 % 2 = 0 → fiche triée index 0 = Alpha.
    const res = await pickDailyCitation(2);
    expect(res).not.toBeNull();
    expect(res!.book).toBe('Alpha');
    expect(res!.text).toBe('Petits gains, grands effets.');
    expect(mocks.callLLM).toHaveBeenCalledOnce();
    expect(mocks.callLLM.mock.calls[0]![0].task).toBe('morning-citation');
  });

  it('dayOfYear impair → autre fiche (rotation)', async () => {
    mocks.searchDriveFiles.mockResolvedValue([
      { id: 'a', name: '[Livre] Alpha.md' },
      { id: 'b', name: '[Livre] Beta.md' },
    ]);
    mocks.readFileById.mockResolvedValue({ success: true, content: REAL_FICHE });
    mocks.callLLM.mockResolvedValue({ text: 'Insight beta.' });

    // dayOfYear=3 → 3 % 2 = 1 → Beta.
    const res = await pickDailyCitation(3);
    expect(res!.book).toBe('Beta');
  });

  it('aucune fiche trouvée → null', async () => {
    mocks.searchDriveFiles.mockResolvedValue([]);
    const res = await pickDailyCitation(1);
    expect(res).toBeNull();
    expect(mocks.callLLM).not.toHaveBeenCalled();
  });

  it('LLM échoue → fallback ligne de la fiche (pas de crash, citation présente)', async () => {
    mocks.searchDriveFiles.mockResolvedValue([{ id: 'a', name: '[Livre] Alpha.md' }]);
    mocks.readFileById.mockResolvedValue({ success: true, content: REAL_FICHE });
    mocks.callLLM.mockRejectedValue(new Error('LLM down'));
    const res = await pickDailyCitation(1);
    expect(res).not.toBeNull();
    expect(res!.book).toBe('Alpha');
    expect(res!.text).toBe('Les habitudes composées font la différence.');
  });

  it('LLM renvoie vide → fallback ligne de la fiche', async () => {
    mocks.searchDriveFiles.mockResolvedValue([{ id: 'a', name: '[Livre] Alpha.md' }]);
    mocks.readFileById.mockResolvedValue({ success: true, content: REAL_FICHE });
    mocks.callLLM.mockResolvedValue({ text: '   ' });
    const res = await pickDailyCitation(1);
    expect(res).not.toBeNull();
    expect(res!.text).toBe('Les habitudes composées font la différence.');
  });

  it('LLM vide ET fiche sans ligne exploitable → null', async () => {
    mocks.searchDriveFiles.mockResolvedValue([{ id: 'a', name: '[Livre] Alpha.md' }]);
    mocks.readFileById.mockResolvedValue({ success: true, content: '# Titre\n\n- \n## Autre' });
    mocks.callLLM.mockResolvedValue({ text: '' });
    const res = await pickDailyCitation(1);
    expect(res).toBeNull();
  });

  it('Drive indisponible (pas de token) → null', async () => {
    mocks.getAccessToken.mockResolvedValue(null);
    const res = await pickDailyCitation(1);
    expect(res).toBeNull();
  });

  // S26 — Bug observé prod 29/05 : fiche Jay Abraham commence par
  // `*[à compléter au fil d'une relecture]*` → fallback prenait cette ligne.
  it('S26 — fiche commence par un placeholder rédactionnel → skip et prend la ligne suivante', async () => {
    const ficheAvecPlaceholder = [
      '# Titre',
      '',
      "*[à compléter au fil d'une relecture]*",
      '',
      'Voici la vraie première phrase utile du livre.',
    ].join('\n');
    mocks.searchDriveFiles.mockResolvedValue([{ id: 'a', name: '[Livre] Alpha.md' }]);
    mocks.readFileById.mockResolvedValue({ success: true, content: ficheAvecPlaceholder });
    mocks.callLLM.mockResolvedValue({ text: '' });
    const res = await pickDailyCitation(1);
    expect(res).not.toBeNull();
    expect(res!.text).toBe('Voici la vraie première phrase utile du livre.');
    expect(res!.text).not.toContain('à compléter');
  });

  it('S26 — LLM renvoie un placeholder → rejeté, fallback fiche', async () => {
    const fiche = '# Titre\n\nLa vraie ligne de la fiche est ici.';
    mocks.searchDriveFiles.mockResolvedValue([{ id: 'a', name: '[Livre] Alpha.md' }]);
    mocks.readFileById.mockResolvedValue({ success: true, content: fiche });
    mocks.callLLM.mockResolvedValue({ text: "[à compléter au fil d'une relecture]" });
    const res = await pickDailyCitation(1);
    expect(res).not.toBeNull();
    expect(res!.text).toBe('La vraie ligne de la fiche est ici.');
  });
});

describe('isPlaceholder (S26)', () => {
  // Import dynamique pour éviter pollution mocks au top-level.
  it('détecte les placeholders rédactionnels typiques', async () => {
    const { isPlaceholder } = await import('../citation');
    expect(isPlaceholder("*[à compléter au fil d'une relecture]*")).toBe(true);
    expect(isPlaceholder('[à remplir]')).toBe(true);
    expect(isPlaceholder('[TODO: écrire]')).toBe(true);
    expect(isPlaceholder('[à rédiger]')).toBe(true);
    expect(isPlaceholder('[XXX]')).toBe(true);
    expect(isPlaceholder('  *[placeholder]*  ')).toBe(true);
  });

  it('n\'aspire pas les vraies phrases qui contiennent des crochets de citation', async () => {
    const { isPlaceholder } = await import('../citation');
    expect(isPlaceholder('La vraie ligne du livre.')).toBe(false);
    expect(isPlaceholder('Comme [le souligne Drucker], ...')).toBe(false);
  });
});
