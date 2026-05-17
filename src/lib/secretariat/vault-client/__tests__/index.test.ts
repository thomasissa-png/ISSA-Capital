/**
 * Tests d'intégration vault-client — API publique.
 *
 * Teste findContactByEmail, appendToHistorique, updateFrontmatter
 * avec mocks Drive complets.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  findContactByEmail,
  appendToHistorique,
  updateFrontmatter,
  parseObsidianFile,
  clearWriteLocks,
} from '../index';

// ============================================================
// Mocks
// ============================================================

// Mock getAccessToken
vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  getOrCreateSubfolder: vi.fn().mockResolvedValue('logs-folder-id'),
}));

// Mock drive-resolver pour contrôler la résolution de chemins
vi.mock('../drive-resolver', async () => {
  const actual = await vi.importActual<typeof import('../drive-resolver')>('../drive-resolver');
  return {
    ...actual,
    resolvePath: vi.fn(),
    resolveFilePath: vi.fn(),
    listMarkdownFiles: vi.fn(),
    invalidateAllCache: vi.fn(),
    invalidateCache: vi.fn(),
    getCacheSize: vi.fn().mockReturnValue(0),
  };
});

// Mock obsidian-file pour contrôler lecture/écriture
vi.mock('../obsidian-file', async () => {
  const actual = await vi.importActual<typeof import('../obsidian-file')>('../obsidian-file');
  return {
    ...actual,
    readFile: vi.fn(),
    readFileById: vi.fn(),
    writeFile: vi.fn(),
    writeFileById: vi.fn(),
    createFile: vi.fn(),
  };
});

// Mock audit-log pour ne pas toucher Drive dans les tests
vi.mock('../audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(true),
  buildAuditEntry: vi.fn().mockImplementation(
    (op: string, target: string, trigger: string, payload: Record<string, unknown>, status = 'pending') => ({
      ts: '2026-05-13T12:00:00Z',
      op,
      target,
      trigger,
      payload,
      status,
    }),
  ),
}));

// Import mocked modules
import { listMarkdownFiles } from '../drive-resolver';
import { readFile, readFileById, writeFile } from '../obsidian-file';

// ============================================================
// Setup
// ============================================================

const originalEnv = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  clearWriteLocks();
  process.env = { ...originalEnv, DRIVE_VAULT_ROOT_ID: 'root-id' };
});

afterEach(() => {
  process.env = originalEnv;
});

// ============================================================
// Fixtures
// ============================================================

const FIXTURE_LOCATAIRE_KENAN = `---
civilite: Monsieur
nom_officiel: Kenan Beguigneau
adresse_bien: 2 bis boulevard de la Seine, Studio 7, 92000 Nanterre
montant_loyer: 590
montant_charges: 100
date_entree_bail: 2024-05-23
email: kbeguigneau@gmail.com
alias_email:
  - kenanbe@gmail.com
  - kenan.b@outlook.fr
date_dernière_interaction: 2026-05-06
---

# Kenan Beguigneau

## Qui c'est

Locataire du Studio 7.

## Historique

### 2026-05-06 — Confirmation virement
Kenan confirme le virement du loyer de mai 2026.

### 2026-04-03 — Entrée dans les lieux
Signature du bail et remise des clés.

## Notes

Paiement par virement bancaire.
`;

const FIXTURE_CONTACT_PRO = `---
type: contact
société: PNM Avocats
rôle: Avocat Associé
email: martin.yhuel@pnmavocats.law
tags:
  - pro
date_dernière_interaction: 2026-04-15
---

# Martin Yhuel

## Qui c'est

Avocat de la famille Issa.

## Notes

Accès toutes entités.
`;

// ============================================================
// Tests : findContactByEmail
// ============================================================

describe('findContactByEmail', () => {
  it('trouve un locataire par email principal', async () => {
    vi.mocked(listMarkdownFiles).mockResolvedValueOnce([
      { id: 'kenan-id', name: 'Kenan Beguigneau.md' },
    ]);
    vi.mocked(readFileById).mockResolvedValueOnce({
      success: true,
      content: FIXTURE_LOCATAIRE_KENAN,
      fileId: 'kenan-id',
    });

    const result = await findContactByEmail('kbeguigneau@gmail.com');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Kenan Beguigneau');
    expect(result!.emails).toContain('kbeguigneau@gmail.com');
  });

  it('trouve un locataire par alias email', async () => {
    vi.mocked(listMarkdownFiles).mockResolvedValueOnce([
      { id: 'kenan-id', name: 'Kenan Beguigneau.md' },
    ]);
    vi.mocked(readFileById).mockResolvedValueOnce({
      success: true,
      content: FIXTURE_LOCATAIRE_KENAN,
      fileId: 'kenan-id',
    });

    const result = await findContactByEmail('kenanbe@gmail.com');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Kenan Beguigneau');
  });

  it('normalise l\'email en lowercase avant la recherche', async () => {
    vi.mocked(listMarkdownFiles).mockResolvedValueOnce([
      { id: 'kenan-id', name: 'Kenan Beguigneau.md' },
    ]);
    vi.mocked(readFileById).mockResolvedValueOnce({
      success: true,
      content: FIXTURE_LOCATAIRE_KENAN,
      fileId: 'kenan-id',
    });

    const result = await findContactByEmail('KBeguigneau@Gmail.COM');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Kenan Beguigneau');
  });

  it('cherche dans les contacts pro si pas trouvé chez les locataires', async () => {
    // Locataires actuels : rien
    vi.mocked(listMarkdownFiles)
      .mockResolvedValueOnce([]) // locataires actuels
      .mockResolvedValueOnce([]) // candidats
      .mockResolvedValueOnce([  // contacts pro
        { id: 'martin-id', name: 'Martin Yhuel.md' },
      ])
      .mockResolvedValueOnce([]); // contacts famille

    vi.mocked(readFileById).mockResolvedValueOnce({
      success: true,
      content: FIXTURE_CONTACT_PRO,
      fileId: 'martin-id',
    });

    const result = await findContactByEmail('martin.yhuel@pnmavocats.law');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Martin Yhuel');
    expect(result!.folderPath).toBe('07. Contacts/03. Pro');
  });

  it('retourne null si aucun contact ne match', async () => {
    // CONTACT_SEARCH_PATHS scan 7 dossiers : actuels, candidats, pro, amis, famille, anciens, autres
    vi.mocked(listMarkdownFiles)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await findContactByEmail('inconnu@example.com');
    expect(result).toBeNull();
  });

  it('retourne null pour un email invalide (pas de @)', async () => {
    const result = await findContactByEmail('pas-un-email');
    expect(result).toBeNull();
  });
});

// ============================================================
// Tests : appendToHistorique (intégration)
// ============================================================

describe('appendToHistorique', () => {
  it('ajoute une entrée dans l\'historique et préserve le frontmatter', async () => {
    vi.mocked(readFile).mockResolvedValueOnce({
      success: true,
      content: FIXTURE_LOCATAIRE_KENAN,
      fileId: 'kenan-id',
    });

    let writtenContent = '';
    vi.mocked(writeFile).mockImplementationOnce(async (_folder, _file, content) => {
      writtenContent = content;
      return { success: true, fileId: 'kenan-id' };
    });

    const result = await appendToHistorique(
      '07. Contacts/05. Locataires/01. Actuels',
      'Kenan Beguigneau.md',
      {
        title: '2026-05-13 — Demande quittance mai',
        content: 'Kenan demande la quittance de mai.',
        trigger: 'gmail_thread_123',
        updateLastInteraction: true,
      },
    );

    expect(result).toBe(true);

    // Vérifier le contenu écrit
    expect(writtenContent).toContain('### 2026-05-13 — Demande quittance mai');
    expect(writtenContent).toContain('Kenan demande la quittance de mai.');

    // Vérifier chrono inverse (nouvelle entrée AVANT les anciennes)
    const idx13 = writtenContent.indexOf('### 2026-05-13');
    const idx06 = writtenContent.indexOf('### 2026-05-06');
    expect(idx13).toBeLessThan(idx06);

    // Vérifier que date_dernière_interaction a été mise à jour
    const parsed = parseObsidianFile(writtenContent);
    const dateField = parsed.frontmatter!.fields['date_dernière_interaction'];
    // La date devrait être aujourd'hui (format YYYY-MM-DD)
    expect(dateField).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // Vérifier que les autres champs frontmatter sont intacts
    expect(parsed.frontmatter!.fields['nom_officiel']).toBe('Kenan Beguigneau');
    expect(parsed.frontmatter!.fields['montant_loyer']).toBe(590);
  });

  it('crée la section Historique si elle n\'existe pas', async () => {
    const contentWithoutHistorique = `---
type: contact
email: test@example.com
---

# Test Contact

## Notes

Quelques notes.
`;

    vi.mocked(readFile).mockResolvedValueOnce({
      success: true,
      content: contentWithoutHistorique,
      fileId: 'test-id',
    });

    let writtenContent = '';
    vi.mocked(writeFile).mockImplementationOnce(async (_f, _n, content) => {
      writtenContent = content;
      return { success: true, fileId: 'test-id' };
    });

    const result = await appendToHistorique(
      '07. Contacts/03. Pro',
      'Test Contact.md',
      {
        title: '2026-05-13 — Premier contact',
        content: 'Premier échange.',
        trigger: 'email_123',
      },
    );

    expect(result).toBe(true);
    expect(writtenContent).toContain('## Historique');
    expect(writtenContent).toContain('### 2026-05-13 — Premier contact');
  });

  it('retourne false si la lecture échoue', async () => {
    vi.mocked(readFile).mockResolvedValueOnce({
      success: false,
      error: 'Fichier non trouvé',
    });

    const result = await appendToHistorique(
      '07. Contacts/03. Pro',
      'Inexistant.md',
      {
        title: '2026-05-13 — Test',
        content: 'Test.',
        trigger: 'test',
      },
    );

    expect(result).toBe(false);
  });
});

// ============================================================
// Tests : updateFrontmatter
// ============================================================

describe('updateFrontmatter', () => {
  it('met à jour un champ frontmatter sans toucher les autres', async () => {
    vi.mocked(readFile).mockResolvedValueOnce({
      success: true,
      content: FIXTURE_CONTACT_PRO,
      fileId: 'martin-id',
    });

    let writtenContent = '';
    vi.mocked(writeFile).mockImplementationOnce(async (_f, _n, content) => {
      writtenContent = content;
      return { success: true, fileId: 'martin-id' };
    });

    const result = await updateFrontmatter({
      folderPath: '07. Contacts/03. Pro',
      filename: 'Martin Yhuel.md',
      fields: { 'date_dernière_interaction': '2026-05-13' },
      trigger: 'email_456',
    });

    expect(result).toBe(true);

    const parsed = parseObsidianFile(writtenContent);
    expect(parsed.frontmatter!.fields['date_dernière_interaction']).toBe('2026-05-13');
    expect(parsed.frontmatter!.fields['société']).toBe('PNM Avocats');
    expect(parsed.frontmatter!.fields['rôle']).toBe('Avocat Associé');
  });

  it('met à jour plusieurs champs en une seule opération', async () => {
    vi.mocked(readFile).mockResolvedValueOnce({
      success: true,
      content: FIXTURE_CONTACT_PRO,
      fileId: 'martin-id',
    });

    let writtenContent = '';
    vi.mocked(writeFile).mockImplementationOnce(async (_f, _n, content) => {
      writtenContent = content;
      return { success: true, fileId: 'martin-id' };
    });

    const result = await updateFrontmatter({
      folderPath: '07. Contacts/03. Pro',
      filename: 'Martin Yhuel.md',
      fields: {
        'date_dernière_interaction': '2026-05-13',
        'rôle': 'Associé Senior',
      },
      trigger: 'manual',
    });

    expect(result).toBe(true);

    const parsed = parseObsidianFile(writtenContent);
    expect(parsed.frontmatter!.fields['date_dernière_interaction']).toBe('2026-05-13');
    expect(parsed.frontmatter!.fields['rôle']).toBe('Associé Senior');
    // Non modifié
    expect(parsed.frontmatter!.fields['société']).toBe('PNM Avocats');
  });
});

// ============================================================
// Tests : conflit d'écriture (sérialisation via write-lock)
// ============================================================

describe('conflict resolution', () => {
  it('sérialise deux writes simultanés sur la même fiche', async () => {
    const writeOrder: string[] = [];

    // Première lecture
    vi.mocked(readFile)
      .mockResolvedValueOnce({
        success: true,
        content: FIXTURE_LOCATAIRE_KENAN,
        fileId: 'kenan-id',
      })
      .mockResolvedValueOnce({
        success: true,
        content: FIXTURE_LOCATAIRE_KENAN,
        fileId: 'kenan-id',
      });

    vi.mocked(writeFile)
      .mockImplementationOnce(async (_f, _n, _content) => {
        writeOrder.push('write1');
        return { success: true, fileId: 'kenan-id' };
      })
      .mockImplementationOnce(async (_f, _n, _content) => {
        writeOrder.push('write2');
        return { success: true, fileId: 'kenan-id' };
      });

    // Lancer deux appends en parallèle sur la même fiche
    const [result1, result2] = await Promise.all([
      appendToHistorique(
        '07. Contacts/05. Locataires/01. Actuels',
        'Kenan Beguigneau.md',
        {
          title: '2026-05-13 — Email 1',
          content: 'Premier email.',
          trigger: 'email_1',
        },
      ),
      appendToHistorique(
        '07. Contacts/05. Locataires/01. Actuels',
        'Kenan Beguigneau.md',
        {
          title: '2026-05-13 — Email 2',
          content: 'Deuxième email.',
          trigger: 'email_2',
        },
      ),
    ]);

    expect(result1).toBe(true);
    expect(result2).toBe(true);

    // Les writes doivent être sérialisés (pas entrelacés)
    expect(writeOrder).toEqual(['write1', 'write2']);
  });
});
