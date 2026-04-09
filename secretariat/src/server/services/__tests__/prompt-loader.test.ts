/**
 * Tests unitaires — services/prompt-loader.ts
 *
 * Stratégie :
 *  - Test 1 : lecture réelle du fichier docs/ia/secretariat-system-prompt.md
 *             (valide que le chemin relatif calculé est correct)
 *  - Test 2 : cache singleton — 2 appels consécutifs ne relisent pas le disque
 *  - Test 3 : erreur explicite si le fichier est absent (mock fs.existsSync)
 */

import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSystemPromptPath,
  loadSystemPrompt,
  resetPromptCacheForTests,
} from '../prompt-loader';

describe('services/prompt-loader', () => {
  beforeEach(() => {
    resetPromptCacheForTests();
  });

  afterEach(() => {
    resetPromptCacheForTests();
    vi.restoreAllMocks();
  });

  it('charge le system prompt depuis le fichier réel', () => {
    const prompt = loadSystemPrompt();

    // Vérifications fortes : le prompt contient des marqueurs attendus
    expect(prompt.length).toBeGreaterThan(500);
    expect(prompt).toContain('ISSA Capital');
    expect(prompt).toContain('Art. 39-1 du CGI');
    expect(prompt).toContain('needs_clarification');
    // Les 15 formules F1-F15 (au moins quelques marqueurs)
    expect(prompt).toContain('Il a été convenu que');
    expect(prompt).toContain('Il a été acté que');
    // Les 12 formules bannies
    expect(prompt).toContain('globalement');
  });

  it('utilise un cache singleton (2e appel = pas de re-read disque)', () => {
    const readFileSpy = vi.spyOn(fs, 'readFileSync');

    // Reset cache et premier appel → lit le disque
    resetPromptCacheForTests();
    const first = loadSystemPrompt();
    const firstCallCount = readFileSpy.mock.calls.length;
    expect(firstCallCount).toBeGreaterThanOrEqual(1);

    // Deuxième appel → ne doit PAS relire le disque
    const second = loadSystemPrompt();
    const secondCallCount = readFileSpy.mock.calls.length;

    expect(second).toBe(first);
    expect(secondCallCount).toBe(firstCallCount);
  });

  it('throw explicite si le fichier source est absent', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    resetPromptCacheForTests();
    expect(() => loadSystemPrompt()).toThrow(/fichier source introuvable/);

    existsSpy.mockRestore();
  });

  it('expose le chemin résolu via getSystemPromptPath()', () => {
    const promptPath = getSystemPromptPath();
    expect(promptPath).toContain('docs/ia/secretariat-system-prompt.md');
    // Chemin absolu attendu
    expect(promptPath.startsWith('/')).toBe(true);
  });

  it('throw explicite si le fichier ne contient pas la section attendue', () => {
    const readSpy = vi
      .spyOn(fs, 'readFileSync')
      .mockReturnValue('Un markdown sans la section 2.' as unknown as string);
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);

    resetPromptCacheForTests();
    expect(() => loadSystemPrompt()).toThrow(/section.*System prompt complet/);

    readSpy.mockRestore();
    existsSpy.mockRestore();
  });
});
