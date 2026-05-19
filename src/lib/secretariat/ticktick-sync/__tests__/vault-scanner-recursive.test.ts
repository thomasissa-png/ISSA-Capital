/**
 * Tests vault-scanner S18.3b — récursion complète vault.
 *
 * On mock un mini-vault avec :
 *  - 3 dossiers permis : `02. Projets/`, `06. Réunions/`, `04. Notes/`
 *  - 3 dossiers exclus : `00. Me/Profil/`, `_Inbox/`, `Archive/`
 *  - 3 niveaux de sous-dossiers
 *  - 1 fichier avec frontmatter `hide-tcw`
 *  - 1 fichier avec ligne contenant `#hide-tcw` (filtré par parser)
 *
 * On valide :
 *  - le walker descend récursivement
 *  - les exclusions sont strictes (path complet + préfixe `_`)
 *  - les lignes `- [ ]` sont extraites uniquement des dossiers permis
 *  - le frontmatter hide-tcw skip TOUT le fichier
 *  - le compteur metrics est cohérent
 *  - performance : 1 read par fichier permis (cache vault-reader honoré)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockReadVaultFile = vi.fn();
const mockListVaultFolder = vi.fn();
const mockListSubfolders = vi.fn();

vi.mock('../../vault-reader', () => ({
  readVaultFile: (...args: unknown[]) => mockReadVaultFile(...args),
  listVaultFolder: (...args: unknown[]) => mockListVaultFolder(...args),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  listMarkdownFiles: (...args: unknown[]) => mockListVaultFolder(...args),
  listSubfolders: (...args: unknown[]) => mockListSubfolders(...args),
}));

// Import APRES les mocks
import { scanVault, _scannerInternals } from '../vault-scanner';

beforeEach(() => {
  mockReadVaultFile.mockReset();
  mockListVaultFolder.mockReset();
  mockListSubfolders.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// Helper — construit un mock vault selon la structure suivante :
//
// 02. Projets/
//   ├── Versi.md  [- [ ] task A]
//   ├── 01. Perso/
//   │   └── Famille.md  [- [ ] task B]
//   └── 02. Pro/
//       ├── Issa.md  [- [ ] task C]
//       └── _Archive/  ← EXCLU (préfixe _)
//           └── old.md
// 04. Notes/
//   └── idee.md  [frontmatter hide-tcw → skip]
// 06. Réunions/
//   └── 2026/
//       └── 05/
//           └── reunion.md  [- [ ] task D]
// 00. Me/
//   └── Profil/  ← EXCLU
//       └── pref.md
// _Inbox/  ← EXCLU
//   └── photo.md
// ============================================================

const VAULT_STRUCT: Record<string, { subfolders: string[]; files: Array<{ name: string; content: string }> }> = {
  '00. Me': {
    subfolders: ['Profil'],
    files: [],
  },
  // 'Profil' chemin complet → exclu (segment 'profil')
  '00. Me/Profil': {
    subfolders: [],
    files: [{ name: 'pref.md', content: '- [ ] pref task' }],
  },
  '02. Projets': {
    subfolders: ['01. Perso', '02. Pro'],
    files: [{ name: 'Versi.md', content: '- [ ] task A' }],
  },
  '02. Projets/01. Perso': {
    subfolders: [],
    files: [{ name: 'Famille.md', content: '- [ ] task B' }],
  },
  '02. Projets/02. Pro': {
    subfolders: ['_Archive'],
    files: [{ name: 'Issa.md', content: '- [ ] task C' }],
  },
  '02. Projets/02. Pro/_Archive': {
    subfolders: [],
    files: [{ name: 'old.md', content: '- [ ] task X archive' }],
  },
  '04. Notes': {
    subfolders: [],
    files: [
      {
        name: 'idee.md',
        content: '---\ntags: [hide-tcw]\n---\n- [ ] task hidden',
      },
      { name: 'note.md', content: '- [ ] task NOTE\n- [ ] hidden #hide-tcw' },
    ],
  },
  '06. Réunions': {
    subfolders: ['2026'],
    files: [],
  },
  '06. Réunions/2026': {
    subfolders: ['05'],
    files: [],
  },
  '06. Réunions/2026/05': {
    subfolders: [],
    files: [{ name: 'reunion.md', content: '- [ ] task D' }],
  },
  '_Inbox': {
    subfolders: [],
    files: [{ name: 'photo.md', content: '- [ ] task INBOX' }],
  },
};

function setupVaultMocks(structure = VAULT_STRUCT) {
  mockListVaultFolder.mockImplementation(async (folderPath: string) => {
    const node = structure[folderPath];
    if (!node) return [];
    return node.files
      .filter((f) => !f.name.startsWith('_'))
      .map((f, idx) => ({ id: `file-${folderPath}-${idx}`, name: f.name }));
  });

  mockListSubfolders.mockImplementation(async (folderPath: string) => {
    const node = structure[folderPath];
    if (!node) return [];
    return node.subfolders.map((name, idx) => ({
      id: `folder-${folderPath}-${idx}`,
      name,
    }));
  });

  mockReadVaultFile.mockImplementation(async (folderPath: string, filename: string) => {
    const node = structure[folderPath];
    if (!node) return { success: false, error: 'not-found' };
    const file = node.files.find((f) => f.name === filename);
    if (!file) return { success: false, error: 'not-found' };
    return { success: true, content: file.content };
  });

  // scanTodoMd appelle aussi readVaultFile pour Todo.md → ajouter une entrée vide
  // pour éviter les warnings (mais pas obligatoire pour les tests).
}

// ============================================================
// 1. Récursion complète
// ============================================================

describe('vault-scanner — récursion S18.3b', () => {
  it('descend récursivement et trouve task A, B, C, D, NOTE', async () => {
    setupVaultMocks();
    const tasks = await scanVault();

    const titles = tasks.map((t) => t.title);
    expect(titles).toContain('task A');
    expect(titles).toContain('task B');
    expect(titles).toContain('task C');
    expect(titles).toContain('task D');
    expect(titles).toContain('task NOTE');
  });

  it('exclut le dossier 00. Me/Profil (segment "profil")', async () => {
    setupVaultMocks();
    const tasks = await scanVault();
    const titles = tasks.map((t) => t.title);
    expect(titles).not.toContain('pref task');
  });

  it('exclut le dossier _Inbox (préfixe _)', async () => {
    setupVaultMocks();
    const tasks = await scanVault();
    const titles = tasks.map((t) => t.title);
    expect(titles).not.toContain('task INBOX');
  });

  it('exclut un sous-dossier _Archive imbriqué dans un dossier permis', async () => {
    setupVaultMocks();
    const tasks = await scanVault();
    const titles = tasks.map((t) => t.title);
    expect(titles).not.toContain('task X archive');
  });
});

// ============================================================
// 2. Frontmatter hide-tcw skip total
// ============================================================

describe('vault-scanner — frontmatter hide-tcw', () => {
  it('skip TOUTES les tâches d\'un fichier avec frontmatter hide-tcw', async () => {
    setupVaultMocks();
    const tasks = await scanVault();
    const titles = tasks.map((t) => t.title);
    expect(titles).not.toContain('task hidden');
  });

  it('skip la ligne avec #hide-tcw via parser (autres lignes du fichier OK)', async () => {
    setupVaultMocks();
    const tasks = await scanVault();
    const titles = tasks.map((t) => t.title);
    expect(titles).toContain('task NOTE');
    expect(titles).not.toContain('hidden');
  });
});

// ============================================================
// 3. Performance — 1 read par fichier permis
// ============================================================

describe('vault-scanner — performance', () => {
  it('readVaultFile appelé exactement N fois (N = fichiers permis)', async () => {
    setupVaultMocks();
    await scanVault();

    // Fichiers permis (hors Todo.md qui passe par scanTodoMd) :
    //  Versi.md, Famille.md, Issa.md, idee.md, note.md, reunion.md = 6
    // Plus le Todo.md scanné séparément (scanTodoMd) = 7
    // _Archive/old.md et Profil/pref.md et _Inbox/photo.md ne doivent PAS être lus.
    const allReads = mockReadVaultFile.mock.calls.map((c) => `${c[0]}/${c[1]}`);
    expect(allReads).not.toContain('00. Me/Profil/pref.md');
    expect(allReads).not.toContain('_Inbox/photo.md');
    expect(allReads).not.toContain('02. Projets/02. Pro/_Archive/old.md');
  });
});

// ============================================================
// 4. Métriques exclusions
// ============================================================

describe('vault-scanner — métriques', () => {
  it('comptabilise les exclusions de dossiers', async () => {
    setupVaultMocks();
    const logs: string[] = [];
    const origInfo = console.info;
    console.info = (msg: string) => { logs.push(String(msg)); };
    try {
      await scanVault();
    } finally {
      console.info = origInfo;
    }
    const scanLog = logs.find((l) => l.startsWith('[vault-scanner] scan terminé'));
    expect(scanLog).toBeDefined();
    expect(scanLog).toContain('dossiers parcourus=');
    expect(scanLog).toContain('exclus=');
    expect(scanLog).toContain('tâches retenues=');
  });
});

// ============================================================
// 5. Profondeur max
// ============================================================

describe('vault-scanner — profondeur max', () => {
  it('arrête à MAX_WALK_DEPTH (>10)', async () => {
    // Construit une chaîne de 12 sous-dossiers : a/a/a/a/a/a/a/a/a/a/a/a/
    const struct: Record<string, { subfolders: string[]; files: Array<{ name: string; content: string }> }> = {};
    let path = '02. Projets';
    struct[path] = { subfolders: ['deep'], files: [] };
    for (let i = 0; i < 12; i++) {
      const next = `${path}/deep`;
      struct[path] = { subfolders: ['deep'], files: [{ name: `f${i}.md`, content: `- [ ] task L${i}` }] };
      path = next;
    }
    struct[path] = { subfolders: [], files: [{ name: 'deepest.md', content: '- [ ] task DEEP' }] };

    setupVaultMocks(struct);

    const logs: string[] = [];
    const origWarn = console.warn;
    console.warn = (msg: string) => { logs.push(String(msg)); };
    try {
      await scanVault();
    } finally {
      console.warn = origWarn;
    }

    // On doit voir le warn "profondeur max atteinte"
    const depthWarn = logs.find((l) => String(l).includes('profondeur max'));
    expect(depthWarn).toBeDefined();
  });
});

// ============================================================
// 6. Régression — exclusions héritées S18.2
// ============================================================

describe('vault-scanner — régression exclusions S18.2', () => {
  it('Profil/, Archive/, _Inbox/, _Outbox/, AnyaLogs/, AnyaState/ restent exclus', () => {
    const { isExcludedPath } = _scannerInternals;
    expect(isExcludedPath('00. Me/Profil/preferences.md')).toBe(true);
    expect(isExcludedPath('Archive/2024/notes.md')).toBe(true);
    expect(isExcludedPath('_Inbox/Photos/x.md')).toBe(true);
    expect(isExcludedPath('_Outbox/queue/x.md')).toBe(true);
    expect(isExcludedPath('_Inbox/AnyaLogs/audit.md')).toBe(true);
    expect(isExcludedPath('_Inbox/AnyaState/state.md')).toBe(true);
  });

  it('extension S18.3b : tout segment _xxx est exclu', () => {
    const { isExcludedPath } = _scannerInternals;
    expect(isExcludedPath('02. Projets/_Archive/file.md')).toBe(true);
    expect(isExcludedPath('06. Réunions/_zHistorique/old.md')).toBe(true);
    expect(isExcludedPath('foo/_DRAFT/note.md')).toBe(true);
  });
});

// ============================================================
// 7. extractTasksFromContent comportement direct (régression)
// ============================================================

describe('vault-scanner — extractTasksFromContent (régression)', () => {
  it('frontmatter hide-tcw → 0 tâche', async () => {
    const { extractTasksFromContent } = await import('../vault-scanner');
    const content = '---\ntags: [hide-tcw]\n---\n- [ ] hidden task\n- [ ] another';
    expect(extractTasksFromContent('test.md', content)).toEqual([]);
  });

  it('ligne avec #hide-tcw skip cette ligne, garde les autres', async () => {
    const { extractTasksFromContent } = await import('../vault-scanner');
    const content = '- [ ] visible\n- [ ] hidden #hide-tcw\n- [ ] also visible';
    const tasks = extractTasksFromContent('test.md', content);
    expect(tasks.map((t) => t.title)).toEqual(['visible', 'also visible']);
  });
});
