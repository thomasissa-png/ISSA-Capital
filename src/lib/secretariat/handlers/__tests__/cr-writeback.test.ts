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

// ============================================================
// Imports après mocks
// ============================================================

import { writeBackCrToFiche, _internals } from '../cr-writeback';
import { updateFileContent, getAccessToken } from '../../drive-upload';
import { readFileById } from '../../vault-client/obsidian-file';

const mockUpdateFileContent = vi.mocked(updateFileContent);
const mockGetAccessToken = vi.mocked(getAccessToken);
const mockReadFileById = vi.mocked(readFileById);

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

  it('rejette une entité inconnue avec un message explicite', async () => {
    const result = await writeBackCrToFiche({ ...baseInput, entiteCode: 'ZZ' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Entité inconnue "ZZ"/);
    expect(result.error).toMatch(/IC, GO, VI, VV/);
    // Pas d'appel réseau pour une entité invalide
    expect(mockGetAccessToken).not.toHaveBeenCalled();
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
  // Validation des 4 entités hardcodées (R7 P1 #101)
  // ============================================================

  it('reconnaît les 4 codes entités IC/GO/VI/VV', () => {
    const { PROJET_FICHE_FILE_IDS } = _internals;
    expect(Object.keys(PROJET_FICHE_FILE_IDS).sort()).toEqual(['GO', 'IC', 'VI', 'VV']);
    // Tous les fileIds sont des strings non-vides
    for (const id of Object.values(PROJET_FICHE_FILE_IDS)) {
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(10);
    }
  });
});
