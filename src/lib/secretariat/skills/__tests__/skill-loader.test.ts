/**
 * Tests skill-loader — migration prompts vault-driven (S20 → S21).
 *
 * Couvre : cache hit/miss/TTL, invalidation ciblée/globale, fallback repo,
 * intégrité (frontmatter, sections H2 + H3), parsing nouveau format SKILL.md,
 * dédup concurrente.
 *
 * Format vault attendu (S21) :
 *  - Frontmatter YAML : `name` + `description`
 *  - 5 sections H2 : `## 1. Trigger` / `## 2. Input` / `## 3. Étapes` /
 *    `## 4. Output` / `## 5. Méthode`
 *  - Sections H3 dans 5 : `### 5.1 Red lines`, `### 5.2 Arbre de décision`,
 *    `### 5.3 Critères de qualité`, optionnellement `### 5.4 Exemple complet`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mocks DOIVENT être déclarés AVANT l'import du module testé
vi.mock('../../vault-client/obsidian-file', () => ({
  readFile: vi.fn(),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

import { readFile as readVaultFile } from '../../vault-client/obsidian-file';
import { readFileSync } from 'fs';
import {
  loadSkill,
  invalidateSkillCache,
  checkSkillIntegrity,
  SKILL_CACHE_TTL_MS,
  FALLBACK_REPO_MARKER,
} from '../skill-loader';
import { SkillLoadError } from '../types';

// ============================================================
// Fixtures (nouveau format SKILL.md S21)
// ============================================================

const FIXTURE_VALID = `---
name: cr-reunion
description: "Produit un CR PDF à partir d'une note de réunion."
---

# Skill cr-reunion

## 1. Trigger

Note Telegram > 100 chars ou « fais le CR ».

## 2. Input

Fiche entité, contacts, note, photos.

## 3. Étapes

### 3.1 Identifier l'entité et le mode
### 3.2 Attribuer la référence
### 3.3 Rédiger le CRDraft

## 4. Output

PDF légal dans Comptes Rendus + propagation fiche entité.

### Récap (gabarit Telegram)
\`\`\`
CR généré.

Projet : [Nom Projet]
PDF : [webViewLink]
\`\`\`

## 5. Méthode

### 5.1 Red lines

- Jamais inventer de participant.
- Jamais hardcoder fileId.

### 5.2 Arbre de décision — solo vs multi

\`\`\`
Note de réunion
├── tiers nommé → multi
└── solo → array vide
\`\`\`

### 5.3 Critères de qualité

4 sections + en-tête + participants, aucune donnée inventée.

### 5.4 Exemple complet (cas réel — mode solo)

**Input** : "Visite seul lot 2 Nanterre."

**CR généré** :
\`\`\`markdown
# CR — Visite Lot 2
## Présent
Thomas Issa (seul)
\`\`\`
`;

const FIXTURE_NO_FRONTMATTER = FIXTURE_VALID.replace(/^---[\s\S]*?---\n\n/, '');

const FIXTURE_MISSING_51 = FIXTURE_VALID.replace(
  /### 5\.1 Red lines[\s\S]*?### 5\.2/,
  '### 5.2',
);

const FIXTURE_MISSING_H2_INPUT = FIXTURE_VALID.replace(
  /## 2\. Input[\s\S]*?## 3\. Étapes/,
  '## 3. Étapes',
);

const FIXTURE_WITH_PENDING = FIXTURE_VALID.replace(
  '- Jamais inventer de participant.',
  '- Jamais inventer de participant. [À CONFIRMER]',
);

const mockedReadVault = readVaultFile as unknown as ReturnType<typeof vi.fn>;
const mockedReadFs = readFileSync as unknown as ReturnType<typeof vi.fn>;

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  invalidateSkillCache();
  mockedReadVault.mockReset();
  mockedReadFs.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================
// Tests
// ============================================================

describe('skill-loader (S21 — format SKILL.md)', () => {
  it('test 1: cache miss → fetch vault → cache hit (1 seule lecture pour 2 appels)', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const a = await loadSkill('cr-reunion');
    const b = await loadSkill('cr-reunion');

    expect(mockedReadVault).toHaveBeenCalledTimes(1);
    expect(a.name).toBe('cr-reunion');
    expect(b).toBe(a); // même référence (cache)
  });

  it('test 2: cache TTL expiré → refetch', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T10:00:00Z'));
    await loadSkill('cr-reunion');

    vi.setSystemTime(new Date('2026-05-21T10:00:00Z').getTime() + SKILL_CACHE_TTL_MS + 60_000);
    await loadSkill('cr-reunion');

    expect(mockedReadVault).toHaveBeenCalledTimes(2);
  });

  it('test 3: invalidateSkillCache(name) → refetch ciblé', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    await loadSkill('cr-reunion');
    invalidateSkillCache('cr-reunion');
    await loadSkill('cr-reunion');

    expect(mockedReadVault).toHaveBeenCalledTimes(2);
  });

  it('test 4: invalidateSkillCache() sans arg → flush complet', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    await loadSkill('cr-reunion');
    await loadSkill('fin-de-bail');
    invalidateSkillCache();
    await loadSkill('cr-reunion');
    await loadSkill('fin-de-bail');

    expect(mockedReadVault).toHaveBeenCalledTimes(4);
  });

  it('test 5: vault down → fallback repo + vaultPath = FALLBACK_REPO_MARKER', async () => {
    mockedReadVault.mockResolvedValue({ success: false, error: 'Drive désactivé' });
    mockedReadFs.mockReturnValue(FIXTURE_VALID);

    const ctx = await loadSkill('cr-reunion');

    expect(ctx.vaultPath).toBe(FALLBACK_REPO_MARKER);
    expect(mockedReadFs).toHaveBeenCalledTimes(1);
    expect(ctx.redLines).toContain('Jamais inventer');
  });

  it('test 6: frontmatter manquant → SkillLoadError', async () => {
    mockedReadVault.mockResolvedValue({
      success: true,
      content: FIXTURE_NO_FRONTMATTER,
    });

    await expect(loadSkill('broken')).rejects.toBeInstanceOf(SkillLoadError);
  });

  it('test 7: section 5.1 manquante → SkillLoadError', async () => {
    mockedReadVault.mockResolvedValue({
      success: true,
      content: FIXTURE_MISSING_51,
    });

    await expect(loadSkill('broken2')).rejects.toThrow(/missing_section/);
  });

  it('test 7bis: section H2 obligatoire (## 2. Input) manquante → SkillLoadError', async () => {
    mockedReadVault.mockResolvedValue({
      success: true,
      content: FIXTURE_MISSING_H2_INPUT,
    });

    await expect(loadSkill('broken3')).rejects.toThrow(/missing_section/);
  });

  it('test 8: [À CONFIRMER] dans 5.1 → warn issue + chargement OK', async () => {
    mockedReadVault.mockResolvedValue({
      success: true,
      content: FIXTURE_WITH_PENDING,
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ctx = await loadSkill('cr-reunion');
    expect(ctx.name).toBe('cr-reunion');

    const issues = await checkSkillIntegrity(FIXTURE_WITH_PENDING);
    expect(issues.some((i) => i.reason === 'pending_confirmation')).toBe(true);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('test 9: frontmatter parsé correctement (name + description)', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const ctx = await loadSkill('cr-reunion');

    expect(ctx.frontmatter.name).toBe('cr-reunion');
    expect(typeof ctx.frontmatter.description).toBe('string');
  });

  it('test 10: extraction 5.1 propre (pas de débordement sur 5.2)', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const ctx = await loadSkill('cr-reunion');

    expect(ctx.redLines).toContain('Jamais inventer de participant');
    expect(ctx.redLines).toContain('Jamais hardcoder fileId');
    expect(ctx.redLines).not.toContain('Arbre de décision');
    expect(ctx.redLines).not.toContain('### 5.2');
  });

  it('test 11: extraction 5.4 (exemple) avec code blocks préservés', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const ctx = await loadSkill('cr-reunion');

    expect(ctx.example).toContain('Visite seul lot 2 Nanterre');
    expect(ctx.example).toContain('```markdown');
    expect(ctx.example).toContain('Thomas Issa (seul)');
  });

  it('test 12: recapTemplate extrait du gabarit Telegram (section 4)', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const ctx = await loadSkill('cr-reunion');

    expect(ctx.recapTemplate).toContain('CR généré');
    expect(ctx.recapTemplate).toContain('Projet : [Nom Projet]');
    expect(ctx.recapTemplate).not.toContain('```');
    expect(ctx.recapTemplate).not.toContain('## 5. Méthode');
  });

  it('test 13: skill inconnu (vault + repo échouent) → SkillLoadError', async () => {
    mockedReadVault.mockResolvedValue({ success: false, error: 'not found' });
    mockedReadFs.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    await expect(loadSkill('nonexistent')).rejects.toBeInstanceOf(SkillLoadError);
    await expect(loadSkill('nonexistent')).rejects.toThrow(/introuvable/);
  });

  it('test 14: concurrent loads → 1 seule lecture vault, retours identiques', async () => {
    let resolveFn: (v: { success: boolean; content: string }) => void = () => {};
    const slow = new Promise<{ success: boolean; content: string }>((res) => {
      resolveFn = res;
    });
    mockedReadVault.mockReturnValue(slow);

    const p1 = loadSkill('cr-reunion');
    const p2 = loadSkill('cr-reunion');
    const p3 = loadSkill('cr-reunion');

    resolveFn({ success: true, content: FIXTURE_VALID });

    const [a, b, c] = await Promise.all([p1, p2, p3]);

    expect(mockedReadVault).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('test 15: loadSkill("cr-reunion") parse correctement les 5 sections du SKILL.md vault', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const ctx = await loadSkill('cr-reunion');

    // Frontmatter parsé
    expect(ctx.frontmatter.name).toBe('cr-reunion');
    // Sections H3 5.1 + 5.2 extraites
    expect(ctx.redLines.length).toBeGreaterThan(20);
    expect(ctx.decisionTree).toContain('tiers nommé');
    // Section 5.4 optionnelle présente
    expect(ctx.example.length).toBeGreaterThan(10);
    // Intégrité PASS (pas d'issue error)
    const issues = await checkSkillIntegrity(FIXTURE_VALID);
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });
});
