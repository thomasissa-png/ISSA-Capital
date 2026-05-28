import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLM = vi.fn();
vi.mock('../../llm/client', () => ({
  callLLM: (...args: unknown[]) => mockCallLLM(...args),
}));

import { polishUserContext } from '../polish-user-context';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('polishUserContext', () => {
  it('texte trop court (< 8 car.) → retourné tel quel, pas d\'appel LLM', async () => {
    const r = await polishUserContext({ rawText: 'ok', contactName: 'X', type: 'pro' });
    expect(r).toBe('ok');
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it('texte vide après trim → retourné tel quel, pas d\'appel LLM', async () => {
    const r = await polishUserContext({ rawText: '   ', contactName: 'X', type: 'pro' });
    expect(r).toBe('');
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it('LLM renvoie un texte → utilisé (trim)', async () => {
    mockCallLLM.mockResolvedValue({ text: '\n\nAvocat Sarani, pilote la GAPD.\n' });
    const r = await polishUserContext({
      rawText: 'avocat sarani il pilote la gapd',
      contactName: 'Martin Yhuel',
      type: 'pro',
    });
    expect(r).toBe('Avocat Sarani, pilote la GAPD.');
    expect(mockCallLLM).toHaveBeenCalledTimes(1);
    expect(mockCallLLM.mock.calls[0]![0].task).toBe('contact-context-polish');
  });

  it('LLM renvoie un texte vide → fallback texte brut', async () => {
    mockCallLLM.mockResolvedValue({ text: '   ' });
    const r = await polishUserContext({
      rawText: 'Marc m\'a parlé du projet',
      contactName: 'Marc',
      type: 'pro',
    });
    expect(r).toBe('Marc m\'a parlé du projet');
  });

  it('LLM throw → fallback texte brut (jamais bloquant)', async () => {
    mockCallLLM.mockRejectedValue(new Error('LLM 500'));
    const r = await polishUserContext({
      rawText: 'Karim apporteur sur Henri Barbusse',
      contactName: 'Karim Mokhtar',
      type: 'pro',
    });
    expect(r).toBe('Karim apporteur sur Henri Barbusse');
  });

  it('sortie tronquée (sans ponctuation finale) → fallback texte brut (S24 nuit, audit)', async () => {
    // Cas réel : Haiku atteint MAX_TOKENS et coupe au milieu d'une phrase.
    mockCallLLM.mockResolvedValue({
      text: 'Avocat Sarani, pilote la GAPD. Référent juridique. Son téléphone est 06 74',
    });
    const r = await polishUserContext({
      rawText: 'Marc avocat sarani pilote gapd, son tel : 0674582100 et email m@cabinet.fr',
      contactName: 'Marc',
      type: 'pro',
    });
    // Pas de ponctuation finale → suspect tronqué → fallback brut
    expect(r).toBe('Marc avocat sarani pilote gapd, son tel : 0674582100 et email m@cabinet.fr');
  });

  it('sortie avec ponctuation finale → utilisée', async () => {
    mockCallLLM.mockResolvedValue({ text: 'Avocat Sarani, pilote la GAPD.' });
    const r = await polishUserContext({
      rawText: 'marc avocat sarani gapd',
      contactName: 'Marc',
      type: 'pro',
    });
    expect(r).toBe('Avocat Sarani, pilote la GAPD.');
  });

  it('inclut le nom + type dans le prompt user', async () => {
    mockCallLLM.mockResolvedValue({ text: 'polished' });
    await polishUserContext({
      rawText: 'note utile sur la personne',
      contactName: 'Ihssane Haddadi',
      type: 'pro',
    });
    const userMsg = mockCallLLM.mock.calls[0]![0].messages[0].content as string;
    expect(userMsg).toContain('Ihssane Haddadi');
    expect(userMsg).toContain('pro');
    expect(userMsg).toContain('note utile sur la personne');
  });
});
