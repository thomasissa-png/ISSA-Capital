/**
 * Tests unitaires — template-loader.
 *
 * Couvre :
 *  - Parse OK : structure live retournée depuis Drive, ordre des clés et
 *    sections respecté ; coupure au `<!--` (commentaire d'instructions).
 *  - Drive down (resolvePath échoue, readFileById échoue, accessToken null) :
 *    fallback hardcodé, jamais de throw.
 *  - Cache 1h : 2 appels successifs ne relisent Drive qu'une fois ; après
 *    `_clearTemplateCache()`, Drive est relu.
 *  - Parse vide (ni clés ni sections) → fallback.
 *
 * S25 (2026-05-29) P1 #3 — création initiale.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks
// ============================================================

vi.mock('../../vault-client/drive-resolver', () => ({
  resolvePath: vi.fn(),
}));

vi.mock('../../vault-client/obsidian-file', () => ({
  readFileById: vi.fn(),
}));

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn(),
}));

// ============================================================
// Imports après mocks
// ============================================================

import {
  loadTemplate,
  _clearTemplateCache,
  parseTemplateStructure,
} from '../template-loader';
import { resolvePath } from '../../vault-client/drive-resolver';
import { readFileById } from '../../vault-client/obsidian-file';
import { getAccessToken } from '../../drive-upload';

const mockResolvePath = vi.mocked(resolvePath);
const mockReadFileById = vi.mocked(readFileById);
const mockGetAccessToken = vi.mocked(getAccessToken);

// ============================================================
// Fixtures
// ============================================================

const CONTACT_PRO_TEMPLATE = `---
type: contact
categorie: pro
sous_categorie:
societe:
role:
email:
telephone:
langue: fr
rencontre_via:
date_premier_contact:
date_derniere_interaction:
canal_préféré:
fréquence_échanges:
entites_visibles: []
classification:
tags:
  - pro
---

# {{title}}

## Qui c'est

## Statut courant

## Projets liés

## Notes

## Tonalité de communication

- Canal préféré :
- Tu/Vous :
- Langue :
- Ton :
- À éviter :

## Historique

<!--
Instructions Anya : ce template définit la structure attendue.
## Ne pas parser cette section (à l'intérieur du commentaire).
## Vraiment pas.
-->
`;

const CONTACT_REL_TEMPLATE = `---
type: contact
categorie: famille
sous_categorie:
date_naissance:
date_anniversaire:
lieu_residence:
adresse:
telephone:
email:
langue: fr
rencontre_via:
date_derniere_interaction:
canal_préféré:
fréquence_échanges:
tags:
  - famille
---

# {{title}}

## Qui c'est

## Famille / Liens

## Notes

## Tonalité de communication

## Historique

<!-- Instructions… -->
`;

// ============================================================
// Tests
// ============================================================

describe('template-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _clearTemplateCache();
    mockGetAccessToken.mockResolvedValue('fake-access-token');
  });

  describe('parseTemplateStructure (unit)', () => {
    it('parse correct du frontmatter (ordre des clés top-level)', () => {
      const { frontmatterKeys } = parseTemplateStructure(CONTACT_PRO_TEMPLATE);
      expect(frontmatterKeys).toEqual([
        'type',
        'categorie',
        'sous_categorie',
        'societe',
        'role',
        'email',
        'telephone',
        'langue',
        'rencontre_via',
        'date_premier_contact',
        'date_derniere_interaction',
        'canal_préféré',
        'fréquence_échanges',
        'entites_visibles',
        'classification',
        'tags',
      ]);
    });

    it('parse correct des sections H2 (ordre)', () => {
      const { sections } = parseTemplateStructure(CONTACT_PRO_TEMPLATE);
      expect(sections).toEqual([
        "Qui c'est",
        'Statut courant',
        'Projets liés',
        'Notes',
        'Tonalité de communication',
        'Historique',
      ]);
    });

    it('arrête le parsing des sections au premier `<!--`', () => {
      const tpl = `---
type: contact
---

## Avant commentaire

<!--
## Section parasite dans un commentaire
-->

## Après commentaire (ne doit PAS apparaître)
`;
      const { sections } = parseTemplateStructure(tpl);
      expect(sections).toEqual(['Avant commentaire']);
    });

    it('ignore les sous-items YAML (lignes indentées, listes)', () => {
      const tpl = `---
type: contact
tags:
  - pro
  - vip
nested:
  key: val
top_level: x
---
## S1
`;
      const { frontmatterKeys } = parseTemplateStructure(tpl);
      // `nested` est top-level, `key: val` est indenté → ignoré.
      expect(frontmatterKeys).toEqual(['type', 'tags', 'nested', 'top_level']);
    });

    it('frontmatter absent → frontmatterKeys vide', () => {
      const tpl = `# Titre\n\n## S1\n`;
      const { frontmatterKeys, sections } = parseTemplateStructure(tpl);
      expect(frontmatterKeys).toEqual([]);
      expect(sections).toEqual(['S1']);
    });
  });

  describe('loadTemplate — chemin live (Drive OK)', () => {
    it('Contact pro : structure live retournée, source=drive', async () => {
      mockResolvePath.mockResolvedValue({ success: true, fileId: 'pro-id' });
      mockReadFileById.mockResolvedValue({
        success: true,
        content: CONTACT_PRO_TEMPLATE,
        fileId: 'pro-id',
      });

      const result = await loadTemplate('Contact pro');

      expect(result.source).toBe('drive');
      expect(result.frontmatterKeys).toContain('societe');
      expect(result.frontmatterKeys).toContain('entites_visibles');
      expect(result.sections).toContain('Statut courant');
      expect(result.sections).toContain('Projets liés');
      expect(mockResolvePath).toHaveBeenCalledWith('Templates/Contact pro.md', true);
    });

    it('Contact relationnel : structure live retournée, source=drive', async () => {
      mockResolvePath.mockResolvedValue({ success: true, fileId: 'rel-id' });
      mockReadFileById.mockResolvedValue({
        success: true,
        content: CONTACT_REL_TEMPLATE,
        fileId: 'rel-id',
      });

      const result = await loadTemplate('Contact relationnel');

      expect(result.source).toBe('drive');
      expect(result.frontmatterKeys).toContain('date_naissance');
      expect(result.frontmatterKeys).not.toContain('societe');
      expect(result.sections).toContain('Famille / Liens');
      expect(result.sections).not.toContain('Statut courant');
    });
  });

  describe('loadTemplate — fallback (Drive KO)', () => {
    it('resolvePath échec → fallback hardcodé, source=fallback', async () => {
      mockResolvePath.mockResolvedValue({ success: false, error: 'not found' });

      const result = await loadTemplate('Contact pro');

      expect(result.source).toBe('fallback');
      expect(result.frontmatterKeys).toContain('societe');
      expect(result.sections).toContain('Statut courant');
      // readFileById NE doit PAS avoir été appelé.
      expect(mockReadFileById).not.toHaveBeenCalled();
    });

    it('readFileById échec → fallback', async () => {
      mockResolvePath.mockResolvedValue({ success: true, fileId: 'pro-id' });
      mockReadFileById.mockResolvedValue({
        success: false,
        error: 'drive 500',
        fileId: 'pro-id',
      });

      const result = await loadTemplate('Contact pro');
      expect(result.source).toBe('fallback');
    });

    it('getAccessToken null → fallback', async () => {
      mockResolvePath.mockResolvedValue({ success: true, fileId: 'pro-id' });
      mockGetAccessToken.mockResolvedValue(null);

      const result = await loadTemplate('Contact pro');
      expect(result.source).toBe('fallback');
      expect(mockReadFileById).not.toHaveBeenCalled();
    });

    it('contenu vide (ni clés ni sections) → fallback', async () => {
      mockResolvePath.mockResolvedValue({ success: true, fileId: 'pro-id' });
      mockReadFileById.mockResolvedValue({
        success: true,
        content: '# Juste un titre\n',
        fileId: 'pro-id',
      });

      const result = await loadTemplate('Contact pro');
      expect(result.source).toBe('fallback');
    });

    it('readFileById throw → fallback (pas de propagation)', async () => {
      mockResolvePath.mockResolvedValue({ success: true, fileId: 'pro-id' });
      mockReadFileById.mockRejectedValue(new Error('network blip'));

      const result = await loadTemplate('Contact pro');
      expect(result.source).toBe('fallback');
    });

    it('fallback Contact relationnel correct (structures distinctes)', async () => {
      mockResolvePath.mockResolvedValue({ success: false, error: 'no' });
      const result = await loadTemplate('Contact relationnel');
      expect(result.source).toBe('fallback');
      expect(result.frontmatterKeys).toContain('date_naissance');
      expect(result.frontmatterKeys).not.toContain('societe');
      expect(result.sections).toContain('Famille / Liens');
      expect(result.sections).not.toContain('Projets liés');
    });
  });

  describe('loadTemplate — cache', () => {
    it('2e appel ne relit pas Drive (cache hit)', async () => {
      mockResolvePath.mockResolvedValue({ success: true, fileId: 'pro-id' });
      mockReadFileById.mockResolvedValue({
        success: true,
        content: CONTACT_PRO_TEMPLATE,
        fileId: 'pro-id',
      });

      const r1 = await loadTemplate('Contact pro');
      const r2 = await loadTemplate('Contact pro');

      expect(r1.source).toBe('drive');
      expect(r2.source).toBe('drive');
      expect(mockReadFileById).toHaveBeenCalledTimes(1);
      expect(mockResolvePath).toHaveBeenCalledTimes(1);
    });

    it('_clearTemplateCache → relit Drive', async () => {
      mockResolvePath.mockResolvedValue({ success: true, fileId: 'pro-id' });
      mockReadFileById.mockResolvedValue({
        success: true,
        content: CONTACT_PRO_TEMPLATE,
        fileId: 'pro-id',
      });

      await loadTemplate('Contact pro');
      _clearTemplateCache();
      await loadTemplate('Contact pro');

      expect(mockReadFileById).toHaveBeenCalledTimes(2);
    });

    it('fallback PAS cacheé (re-tente Drive au prochain appel)', async () => {
      // 1er appel : Drive KO → fallback.
      mockResolvePath.mockResolvedValueOnce({ success: false, error: 'no' });
      const r1 = await loadTemplate('Contact pro');
      expect(r1.source).toBe('fallback');

      // 2e appel : Drive OK → doit retourner live (le fallback ne doit pas
      // empoisonner le cache pendant 1h).
      mockResolvePath.mockResolvedValueOnce({ success: true, fileId: 'pro-id' });
      mockReadFileById.mockResolvedValueOnce({
        success: true,
        content: CONTACT_PRO_TEMPLATE,
        fileId: 'pro-id',
      });
      const r2 = await loadTemplate('Contact pro');
      expect(r2.source).toBe('drive');
    });
  });
});
