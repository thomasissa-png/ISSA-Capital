/**
 * Tests vault-scanner S18.2 — exclusions inline tasks.
 *
 * S18.2 ajoute :
 *   - extraction inline `- [ ]` dans tous les .md du vault
 *   - exclusions : Profil/, Archive/, _Inbox/, _Outbox/, AnyaLogs/, AnyaState/
 *   - exclusion frontmatter avec `hide-tcw` (red line §9.6)
 *   - exclusion ligne avec `#hide-tcw` (déjà couverte par parser)
 *
 * On teste les helpers internes (pas réseau-dépendants) pour valider la
 * logique d'exclusion. scanVault complet est testé indirectement via mock.
 */

import { describe, it, expect } from 'vitest';
import {
  extractTasksFromContent,
  _scannerInternals,
} from '../vault-scanner';

const { isExcludedPath, hasHideTagInFrontmatter, EXCLUDED_FOLDER_SEGMENTS } = _scannerInternals;

describe('vault-scanner — isExcludedPath (S18.2)', () => {
  it('exclut Profil/ (case-insensitive)', () => {
    expect(isExcludedPath('Profil/Preferences.md')).toBe(true);
    expect(isExcludedPath('profil/preferences.md')).toBe(true);
    expect(isExcludedPath('PROFIL/preferences.md')).toBe(true);
  });

  it('exclut Archive/ et archive/', () => {
    expect(isExcludedPath('Archive/2024/notes.md')).toBe(true);
    expect(isExcludedPath('archive/old.md')).toBe(true);
    expect(isExcludedPath('02. Projets/Archive/Versi-2023.md')).toBe(true);
  });

  it('exclut _Inbox/, _Outbox/, AnyaLogs/, AnyaState/', () => {
    expect(isExcludedPath('_Inbox/Photos/x.md')).toBe(true);
    expect(isExcludedPath('_Outbox/queue/x.md')).toBe(true);
    expect(isExcludedPath('_Inbox/AnyaLogs/audit.md')).toBe(true);
    expect(isExcludedPath('_Inbox/AnyaState/state.md')).toBe(true);
  });

  it('n\'exclut PAS un path normal', () => {
    expect(isExcludedPath('03. Tâches/Todo.md')).toBe(false);
    expect(isExcludedPath('06. Réunions/2026/05/CR.md')).toBe(false);
    expect(isExcludedPath('02. Projets/01. Perso/Versi.md')).toBe(false);
  });

  it('exclut quand n\'importe quel segment matche (ASCII)', () => {
    expect(isExcludedPath('foo/bar/archive/baz.md')).toBe(true);
    expect(isExcludedPath('a/b/c/d/profil/file.md')).toBe(true);
  });

  it('liste d\'exclusion stable (régression)', () => {
    expect(EXCLUDED_FOLDER_SEGMENTS).toContain('profil');
    expect(EXCLUDED_FOLDER_SEGMENTS).toContain('archive');
    expect(EXCLUDED_FOLDER_SEGMENTS).toContain('_inbox');
    expect(EXCLUDED_FOLDER_SEGMENTS).toContain('anyalogs');
  });
});

describe('vault-scanner — hasHideTagInFrontmatter (S18.2)', () => {
  it('détecte hide-tcw dans frontmatter YAML list', () => {
    const content = `---
title: Réunion
tags: [hide-tcw, perso]
---

# Contenu
- [ ] tâche qui devrait être filtrée
`;
    expect(hasHideTagInFrontmatter(content)).toBe(true);
  });

  it('détecte hide-tcw dans frontmatter YAML inline-string', () => {
    const content = `---
tags: hide-tcw
---
- [ ] tâche
`;
    expect(hasHideTagInFrontmatter(content)).toBe(true);
  });

  it('détecte hide-tcw dans frontmatter YAML block list', () => {
    const content = `---
title: Réunion
tags:
  - perso
  - hide-tcw
---
- [ ] tâche
`;
    expect(hasHideTagInFrontmatter(content)).toBe(true);
  });

  it('NE détecte PAS hide-tcw si juste dans le corps (pas le frontmatter)', () => {
    const content = `# Titre
Texte qui parle de hide-tcw en passant.
- [ ] tâche
`;
    expect(hasHideTagInFrontmatter(content)).toBe(false);
  });

  it('NE détecte PAS hide-tcw si frontmatter absent', () => {
    const content = `# Titre simple\n- [ ] tâche\n`;
    expect(hasHideTagInFrontmatter(content)).toBe(false);
  });

  it('case-insensitive sur la valeur (hide-tcw vs HIDE-TCW)', () => {
    const content = `---
tags: [HIDE-TCW]
---
- [ ] tâche
`;
    expect(hasHideTagInFrontmatter(content)).toBe(true);
  });
});

describe('vault-scanner — extractTasksFromContent (S18.2 filtre frontmatter)', () => {
  it('renvoie [] si frontmatter hide-tcw', () => {
    const content = `---
tags: [hide-tcw]
---
- [ ] visible
- [ ] autre
`;
    expect(extractTasksFromContent('fiche.md', content)).toEqual([]);
  });

  it('extrait normalement si frontmatter sans hide-tcw', () => {
    const content = `---
tags: [perso]
---
- [ ] tâche
`;
    const tasks = extractTasksFromContent('fiche.md', content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('tâche');
  });
});
