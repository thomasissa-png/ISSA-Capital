/**
 * Tests unitaires — cr-writeback handler.
 *
 * Couvre :
 *   - Validation inputs (entiteCode, crWebViewLink, crDate)
 *   - Lookup entité inconnue → erreur explicite
 *   - upsertCrSection : création section / append section / idempotence
 *   - Idempotence end-to-end : skip si le lien existe déjà
 *   - Format de ligne markdown
 *
 * Jalon S16 Q3 — write-back CR vers fiche Projet vault.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks
// ============================================================

vi.mock('../../drive-upload', () => ({
  updateFileContent: vi.fn(),
  getAccessToken: vi.fn(),
}));

vi.mock('../../vault-client/obsidian-file', () => ({
  readFileById: vi.fn(),
}));

vi.mock('../../vault-reader', () => ({
  findProjetFicheByEntite: vi.fn(),
}));

// ============================================================
// Imports après mocks
// ============================================================

import { writeBackCrToFiche, _internals } from '../cr-writeback';
import { updateFileContent, getAccessToken } from '../../drive-upload';
import { readFileById } from '../../vault-client/obsidian-file';
import { findProjetFicheByEntite } from '../../vault-reader';

const mockUpdateFileContent = vi.mocked(updateFileContent);
const mockGetAccessToken = vi.mocked(getAccessToken);
const mockReadFileById = vi.mocked(readFileById);
const mockFindProjetFicheByEntite = vi.mocked(findProjetFicheByEntite);

// ============================================================
// Constantes test
// ============================================================

const ISSA_CAPITAL_FILE_ID = '1l8oTuQDUePowMPCks-vDIdwLeBru-IRZ';
const FAKE_CR_FILE_ID = 'cr-pdf-file-id-123';
const FAKE_CR_LINK = 'https://drive.google.com/file/d/cr-pdf-file-id-123/view';
const FAKE_CR_DATE = '2026-05-18';
const FAKE_CR_TITLE = 'Réunion préparation closing T2';
const FAKE_TOKEN = 'ya29.fake-token';

const baseInput = {
  entiteCode: 'IC',
  crFileId: FAKE_CR_FILE_ID,
  crFilename: '2026-05-18-CR-IC-001.pdf',
  crWebViewLink: FAKE_CR_LINK,
  crDate: FAKE_CR_DATE,
  crTitle: FAKE_CR_TITLE,
};

// ============================================================
// upsertCrSection — tests purs (pas de fetch)
// ============================================================

describe('upsertCrSection — manipulation markdown', () => {
  const { upsertCrSection, formatCrLine } = _internals;

  it('crée la section si elle est absente', () => {
    const body = '# Fiche Projet ISSA Capital\n\nDescription du projet.\n';
    const crLine = formatCrLine('2026-05-18', 'CR Test', 'https://link');
    const { newBody, sectionCreated } = upsertCrSection(body, crLine);

    expect(sectionCreated).toBe(true);
    expect(newBody).toContain('## Comptes Rendus');
    expect(newBody).toContain('- [2026-05-18] [CR Test](https://link)');
    // Section ajoutée en fin de fichier
    expect(newBody.indexOf('Description')).toBeLessThan(newBody.indexOf('## Comptes Rendus'));
  });

  it('append à une section existante sans dupliquer le heading', () => {
    const body = `# Fiche

## Comptes Rendus

- [2026-04-01] [Ancien CR](https://old)
`;
    const crLine = formatCrLine('2026-05-18', 'Nouveau CR', 'https://new');
    const { newBody, sectionCreated } = upsertCrSection(body, crLine);

    expect(sectionCreated).toBe(false);
    // Le heading n'est présent qu'une seule fois
    const occurrences = newBody.match(/## Comptes Rendus/g) ?? [];
    expect(occurrences.length).toBe(1);
    // La nouvelle ligne est présente
    expect(newBody).toContain('- [2026-05-18] [Nouveau CR](https://new)');
    // L'ancienne ligne est préservée
    expect(newBody).toContain('- [2026-04-01] [Ancien CR](https://old)');
  });

  it('insère la nouvelle ligne juste après le heading (le plus récent en premier)', () => {
    const body = `# Fiche

## Comptes Rendus

- [2026-04-01] [Ancien CR](https://old)
`;
    const crLine = formatCrLine('2026-05-18', 'Nouveau CR', 'https://new');
    const { newBody } = upsertCrSection(body, crLine);

    const idxNew = newBody.indexOf('https://new');
    const idxOld = newBody.indexOf('https://old');
    expect(idxNew).toBeGreaterThan(0);
    expect(idxOld).toBeGreaterThan(0);
    expect(idxNew).toBeLessThan(idxOld);
  });

  it('formate correctement la ligne markdown', () => {
    const line = _internals.formatCrLine('2026-05-18', 'Mon titre', 'https://drive.google.com/x');
    expect(line).toBe('- [2026-05-18] [Mon titre](https://drive.google.com/x)');
  });
});

// ============================================================
// writeBackCrToFiche — end-to-end avec mocks
// ============================================================

describe('writeBackCrToFiche — handler complet', () => {
  beforeEach(() => {
    mockUpdateFileContent.mockReset();
    mockGetAccessToken.mockReset();
    mockReadFileById.mockReset();
    mockFindProjetFicheByEntite.mockReset();
    // Par défaut : IC résout vers ISSA Capital (mocké pour ne pas dépendre du vault live)
    mockFindProjetFicheByEntite.mockImplementation(async (code: string) => {
      const upper = code.toUpperCase().trim();
      if (upper === 'IC') {
        return {
          fileId: ISSA_CAPITAL_FILE_ID,
          ficheName: 'ISSA Capital',
          resolvedFilename: 'ISSA Capital.md',
          folderPath: '02. Projets/02. Pro',
        };
      }
      return null;
    });
  });

  // ============================================================
  // Validation
  // ============================================================

  it('rejette si entiteCode est absent', async () => {
    const result = await writeBackCrToFiche({ ...baseInput, entiteCode: '' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/entiteCode/);
  });

  it('rejette si crWebViewLink est absent', async () => {
    const result = await writeBackCrToFiche({ ...baseInput, crWebViewLink: '' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/crWebViewLink/);
  });

  it('rejette une crDate au mauvais format', async () => {
    const result = await writeBackCrToFiche({ ...baseInput, crDate: '18/05/2026' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/crDate invalide/);
  });

  // ============================================================
  // Lookup entité
  // ============================================================

  it('rejette une entité inconnue avec un message explicite (fiche introuvable via vault-reader)', async () => {
    // Le mock par défaut renvoie null pour toute entité ≠ IC → simule "non trouvée"
    const result = await writeBackCrToFiche({ ...baseInput, entiteCode: 'ZZ' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Fiche Projet non trouvée pour entité "ZZ"/);
    expect(mockFindProjetFicheByEntite).toHaveBeenCalledWith('ZZ');
    // Pas de PATCH ni lecture quand la fiche est introuvable
    expect(mockGetAccessToken).not.toHaveBeenCalled();
    expect(mockReadFileById).not.toHaveBeenCalled();
    expect(mockUpdateFileContent).not.toHaveBeenCalled();
  });

  // ============================================================
  // Création section
  // ============================================================

  it('crée la section "## Comptes Rendus" si absente et PATCH la fiche', async () => {
    mockGetAccessToken.mockResolvedValue(FAKE_TOKEN);
    mockReadFileById.mockResolvedValue({
      success: true,
      content: '# Fiche ISSA Capital\n\nDescription.\n',
      fileId: ISSA_CAPITAL_FILE_ID,
    });
    mockUpdateFileContent.mockResolvedValue({
      success: true,
      fileId: ISSA_CAPITAL_FILE_ID,
      webViewLink: 'https://drive.google.com/x',
    });

    const result = await writeBackCrToFiche(baseInput);

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.sectionCreated).toBe(true);
    expect(result.ficheFileId).toBe(ISSA_CAPITAL_FILE_ID);

    // Vérifier que le PATCH a été fait avec le bon mimeType
    expect(mockUpdateFileContent).toHaveBeenCalledTimes(1);
    const [calledFileId, calledContent, calledMime] = mockUpdateFileContent.mock.calls[0]!;
    expect(calledFileId).toBe(ISSA_CAPITAL_FILE_ID);
    expect(calledMime).toBe('text/markdown');
    expect(calledContent).toContain('## Comptes Rendus');
    expect(calledContent).toContain(FAKE_CR_LINK);
    expect(calledContent).toContain(FAKE_CR_DATE);
    expect(calledContent).toContain(FAKE_CR_TITLE);
  });

  // ============================================================
  // Append section existante
  // ============================================================

  it('append à une section existante (sectionCreated=false)', async () => {
    const existing = `# Fiche

## Comptes Rendus

- [2026-04-01] [CR avril](https://old-link)
`;
    mockGetAccessToken.mockResolvedValue(FAKE_TOKEN);
    mockReadFileById.mockResolvedValue({
      success: true,
      content: existing,
      fileId: ISSA_CAPITAL_FILE_ID,
    });
    mockUpdateFileContent.mockResolvedValue({
      success: true,
      fileId: ISSA_CAPITAL_FILE_ID,
    });

    const result = await writeBackCrToFiche(baseInput);

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.sectionCreated).toBe(false);

    const [, calledContent] = mockUpdateFileContent.mock.calls[0]!;
    // L'ancienne ligne est toujours là
    expect(calledContent).toContain('https://old-link');
    // La nouvelle ligne est ajoutée
    expect(calledContent).toContain(FAKE_CR_LINK);
  });

  // ============================================================
  // Idempotence
  // ============================================================

  it('skip (modified=false) si le webViewLink est déjà présent dans la fiche', async () => {
    const existing = `# Fiche

## Comptes Rendus

- [2026-05-18] [Déjà là](${FAKE_CR_LINK})
`;
    mockGetAccessToken.mockResolvedValue(FAKE_TOKEN);
    mockReadFileById.mockResolvedValue({
      success: true,
      content: existing,
      fileId: ISSA_CAPITAL_FILE_ID,
    });

    const result = await writeBackCrToFiche(baseInput);

    expect(result.success).toBe(true);
    expect(result.modified).toBe(false);
    expect(result.ficheFileId).toBe(ISSA_CAPITAL_FILE_ID);
    // Aucun PATCH si idempotent
    expect(mockUpdateFileContent).not.toHaveBeenCalled();
  });

  // ============================================================
  // Erreurs en cascade
  // ============================================================

  it('échoue proprement si getAccessToken renvoie null', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    const result = await writeBackCrToFiche(baseInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Credentials OAuth2 manquants/);
    expect(mockReadFileById).not.toHaveBeenCalled();
  });

  it('échoue proprement si la lecture de la fiche échoue', async () => {
    mockGetAccessToken.mockResolvedValue(FAKE_TOKEN);
    mockReadFileById.mockResolvedValue({
      success: false,
      error: 'Fichier non trouvé (404)',
    });

    const result = await writeBackCrToFiche(baseInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Lecture fiche Projet échouée/);
    expect(result.ficheFileId).toBe(ISSA_CAPITAL_FILE_ID);
    expect(mockUpdateFileContent).not.toHaveBeenCalled();
  });

  it('remonte l\'erreur PATCH si updateFileContent échoue', async () => {
    mockGetAccessToken.mockResolvedValue(FAKE_TOKEN);
    mockReadFileById.mockResolvedValue({
      success: true,
      content: '# Fiche\n',
      fileId: ISSA_CAPITAL_FILE_ID,
    });
    mockUpdateFileContent.mockResolvedValue({
      success: false,
      error: 'Drive PATCH 500: Internal Server Error',
    });

    const result = await writeBackCrToFiche(baseInput);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/PATCH fiche Projet échoué/);
    expect(result.error).toMatch(/500/);
  });

  // ============================================================
  // Fallback titre depuis filename
  // ============================================================

  it('utilise crFilename (sans .pdf) si crTitle est vide', async () => {
    mockGetAccessToken.mockResolvedValue(FAKE_TOKEN);
    mockReadFileById.mockResolvedValue({
      success: true,
      content: '# Fiche\n',
      fileId: ISSA_CAPITAL_FILE_ID,
    });
    mockUpdateFileContent.mockResolvedValue({
      success: true,
      fileId: ISSA_CAPITAL_FILE_ID,
    });

    await writeBackCrToFiche({ ...baseInput, crTitle: '' });

    const [, calledContent] = mockUpdateFileContent.mock.calls[0]!;
    expect(calledContent).toContain('2026-05-18-CR-IC-001');
    expect(calledContent).not.toContain('.pdf]');
  });

  // ============================================================
  // Résolution dynamique fiche Projet (R7 — vault-reader live)
  // ============================================================

  it('appelle findProjetFicheByEntite avec le code entité fourni', async () => {
    mockGetAccessToken.mockResolvedValue(FAKE_TOKEN);
    mockReadFileById.mockResolvedValue({
      success: true,
      content: '# Fiche\n',
      fileId: ISSA_CAPITAL_FILE_ID,
    });
    mockUpdateFileContent.mockResolvedValue({ success: true, fileId: ISSA_CAPITAL_FILE_ID });

    await writeBackCrToFiche(baseInput);

    expect(mockFindProjetFicheByEntite).toHaveBeenCalledTimes(1);
    expect(mockFindProjetFicheByEntite).toHaveBeenCalledWith('IC');
  });

  it('utilise le fileId renvoyé par vault-reader (suit les renommages Obsidian)', async () => {
    // Scénario : Thomas renomme "Gradient One.md" — vault-reader trouve toujours par nom canonique,
    // renvoie un fileId qui correspond à la fiche actuelle (même fileId, nom de fichier différent).
    const GO_FILE_ID = 'go-renamed-but-same-fileid';
    mockFindProjetFicheByEntite.mockResolvedValueOnce({
      fileId: GO_FILE_ID,
      ficheName: 'Gradient One',
      resolvedFilename: 'Gradient One.md',
      folderPath: '02. Projets/02. Pro',
    });
    mockGetAccessToken.mockResolvedValue(FAKE_TOKEN);
    mockReadFileById.mockResolvedValue({
      success: true,
      content: '# Gradient One\n',
      fileId: GO_FILE_ID,
    });
    mockUpdateFileContent.mockResolvedValue({ success: true, fileId: GO_FILE_ID });

    const result = await writeBackCrToFiche({ ...baseInput, entiteCode: 'GO' });

    expect(result.success).toBe(true);
    expect(result.modified).toBe(true);
    expect(result.ficheFileId).toBe(GO_FILE_ID);
    // Vérifie que la lecture et le PATCH ont utilisé le fileId résolu dynamiquement
    expect(mockReadFileById).toHaveBeenCalledWith(FAKE_TOKEN, GO_FILE_ID);
    const [calledFileId] = mockUpdateFileContent.mock.calls[0]!;
    expect(calledFileId).toBe(GO_FILE_ID);
  });

  it('plus aucun PROJET_FICHE_FILE_IDS exporté dans _internals (R7)', () => {
    // Vérifie que la dette R7 a été retirée : pas de mapping hardcoded exporté
    expect((_internals as Record<string, unknown>).PROJET_FICHE_FILE_IDS).toBeUndefined();
  });
});
