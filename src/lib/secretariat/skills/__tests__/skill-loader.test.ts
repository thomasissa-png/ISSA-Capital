/**
 * Tests skill-loader — fondation migration prompts vault-driven (S20).
 *
 * Couvre 14 cas : cache hit/miss/TTL, invalidation ciblée/globale, fallback repo,
 * intégrité (frontmatter, sections, [À CONFIRMER]), parsing, dédup concurrente.
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
// Fixtures
// ============================================================

const FIXTURE_VALID = `---
skill: cr-reunion
version: 1.0
modeles_llm:
  - sonnet-4 (claude-sonnet-4-20250514)
modules_code:
  - src/lib/secretariat/cr-renderer/
---

# Workflow CR Réunion

## 1. Trigger

Note Telegram > 100 chars.

## 2. Input

Vault entité.

## 3. Étapes

### 3.1 Ack webhook

Ack < 5s.

## 4. Output

### Modifications vault
PDF + section vault.

### Récap (gabarit Telegram envoyé à Thomas)
\`\`\`
CR généré.

Projet : [Nom Projet]
PDF : [webViewLink]
\`\`\`

---

## 5. Méthode

### 5.1 Red lines (interdictions)
- Jamais inventer de participant.
- Jamais hardcoder fileId.

### 5.2 Arbre de décision — mode multi vs solo
\`\`\`
Note > 100 chars
├── tiers identifié → multi
└── solo → array vide
\`\`\`

### 5.3 Critères de qualité
G1 G2 G3.

### 5.4 Exemple complet (cas réel — mode solo)
**Input** : "Visite seul lot 2 Nanterre."

**CR généré** :
\`\`\`markdown
# CR — Visite Lot 2
## Présent
Thomas Issa (seul)
\`\`\`

### 5.5 Maintenance
Owner @ia.
`;

const FIXTURE_NO_FRONTMATTER = FIXTURE_VALID.replace(/^---[\s\S]*?---\n\n/, '');

const FIXTURE_MISSING_51 = FIXTURE_VALID.replace(
  /### 5\.1 Red lines[\s\S]*?### 5\.2/,
  '### 5.2',
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

describe('skill-loader', () => {
  it('test 1: cache miss → fetch vault → cache hit (1 seule lecture pour 2 appels)', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const a = await loadSkill('CR Reunion');
    const b = await loadSkill('CR Reunion');

    expect(mockedReadVault).toHaveBeenCalledTimes(1);
    expect(a.name).toBe('CR Reunion');
    expect(b).toBe(a); // même référence (cache)
  });

  it('test 2: cache TTL expiré → refetch', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T10:00:00Z'));
    await loadSkill('CR Reunion');

    vi.setSystemTime(new Date('2026-05-21T10:00:00Z').getTime() + SKILL_CACHE_TTL_MS + 60_000);
    await loadSkill('CR Reunion');

    expect(mockedReadVault).toHaveBeenCalledTimes(2);
  });

  it('test 3: invalidateSkillCache(name) → refetch ciblé', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    await loadSkill('CR Reunion');
    invalidateSkillCache('CR Reunion');
    await loadSkill('CR Reunion');

    expect(mockedReadVault).toHaveBeenCalledTimes(2);
  });

  it('test 4: invalidateSkillCache() sans arg → flush complet', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    await loadSkill('CR Reunion');
    await loadSkill('Email Ingest');
    invalidateSkillCache();
    await loadSkill('CR Reunion');
    await loadSkill('Email Ingest');

    expect(mockedReadVault).toHaveBeenCalledTimes(4);
  });

  it('test 5: vault down → fallback repo + vaultPath = FALLBACK_REPO_MARKER', async () => {
    mockedReadVault.mockResolvedValue({ success: false, error: 'Drive désactivé' });
    mockedReadFs.mockReturnValue(FIXTURE_VALID);

    const ctx = await loadSkill('CR Reunion');

    expect(ctx.vaultPath).toBe(FALLBACK_REPO_MARKER);
    expect(mockedReadFs).toHaveBeenCalledTimes(1);
    expect(ctx.redLines).toContain('Jamais inventer');
  });

  it('test 6: frontmatter manquant → SkillLoadError', async () => {
    mockedReadVault.mockResolvedValue({
      success: true,
      content: FIXTURE_NO_FRONTMATTER,
    });

    await expect(loadSkill('Broken')).rejects.toBeInstanceOf(SkillLoadError);
  });

  it('test 7: section 5.1 manquante → SkillLoadError', async () => {
    mockedReadVault.mockResolvedValue({
      success: true,
      content: FIXTURE_MISSING_51,
    });

    await expect(loadSkill('Broken2')).rejects.toThrow(/missing_section/);
  });

  it('test 8: [À CONFIRMER] dans 5.1 → warn issue + chargement OK', async () => {
    mockedReadVault.mockResolvedValue({
      success: true,
      content: FIXTURE_WITH_PENDING,
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ctx = await loadSkill('CR Reunion');
    expect(ctx.name).toBe('CR Reunion');

    const issues = await checkSkillIntegrity(FIXTURE_WITH_PENDING);
    expect(issues.some((i) => i.reason === 'pending_confirmation')).toBe(true);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('test 9: frontmatter parsé correctement (skill, version, modules_code)', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const ctx = await loadSkill('CR Reunion');

    expect(ctx.frontmatter.skill).toBe('cr-reunion');
    expect(ctx.frontmatter.version).toBe(1.0);
    expect(Array.isArray(ctx.frontmatter.modules_code)).toBe(true);
  });

  it('test 10: extraction 5.1 propre (pas de débordement sur 5.2)', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const ctx = await loadSkill('CR Reunion');

    expect(ctx.redLines).toContain('Jamais inventer de participant');
    expect(ctx.redLines).toContain('Jamais hardcoder fileId');
    expect(ctx.redLines).not.toContain('Arbre de décision');
    expect(ctx.redLines).not.toContain('### 5.2');
  });

  it('test 11: extraction 5.4 (exemple) avec code blocks préservés', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const ctx = await loadSkill('CR Reunion');

    expect(ctx.example).toContain('Visite seul lot 2 Nanterre');
    expect(ctx.example).toContain('```markdown');
    expect(ctx.example).toContain('Thomas Issa (seul)');
    expect(ctx.example).not.toContain('### 5.5');
  });

  it('test 12: recapTemplate extrait du gabarit Telegram (section 4)', async () => {
    mockedReadVault.mockResolvedValue({ success: true, content: FIXTURE_VALID });

    const ctx = await loadSkill('CR Reunion');

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

    const p1 = loadSkill('CR Reunion');
    const p2 = loadSkill('CR Reunion');
    const p3 = loadSkill('CR Reunion');

    resolveFn({ success: true, content: FIXTURE_VALID });

    const [a, b, c] = await Promise.all([p1, p2, p3]);

    expect(mockedReadVault).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});
