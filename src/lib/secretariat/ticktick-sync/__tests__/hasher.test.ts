/**
 * Tests hasher — SHA-1 stable et sensible aux changements.
 */

import { describe, it, expect } from 'vitest';
import { hashLine } from '../hasher';

describe('hashLine', () => {
  it('produit le même hash pour la même entrée', () => {
    const line = '- [ ] Appeler Maxime 📅 2026-05-19 #versi';
    expect(hashLine(line)).toBe(hashLine(line));
  });

  it('change si le contenu change', () => {
    const a = '- [ ] Appeler Maxime 📅 2026-05-19';
    const b = '- [ ] Appeler Maxime 📅 2026-05-20';
    expect(hashLine(a)).not.toBe(hashLine(b));
  });

  it('ignore les espaces de fin (newline tolérance)', () => {
    expect(hashLine('- [ ] hello')).toBe(hashLine('- [ ] hello   '));
    expect(hashLine('- [ ] hello\n')).toBe(hashLine('- [ ] hello'));
  });

  it('préserve les caractères UTF-8 (accents)', () => {
    const h1 = hashLine('- [ ] Préparer réunion équipe');
    const h2 = hashLine('- [ ] Preparer reunion equipe');
    expect(h1).not.toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{40}$/);
  });
});
