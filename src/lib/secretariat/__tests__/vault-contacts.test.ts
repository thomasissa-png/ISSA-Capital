/**
 * Tests vault-contacts — parse fiches contacts Obsidian + cache TTL.
 *
 * Jalon S15.5F — Migration pipeline CR vers vault Drive.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks
// ============================================================

const mockGetAccessToken = vi.fn();
const mockListVaultFolder = vi.fn();
const mockReadFileById = vi.fn();

vi.mock('../drive-upload', () => ({
  getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
}));

vi.mock('../vault-reader', () => ({
  listVaultFolder: (...args: unknown[]) => mockListVaultFolder(...args),
}));

vi.mock('../vault-client/obsidian-file', () => ({
  readFileById: (...args: unknown[]) => mockReadFileById(...args),
}));

// Import APRES les mocks
import {
  getVaultContacts,
  parseContactFile,
  invalidateVaultContactsCache,
} from '../vault-contacts';

// ============================================================
// Fixtures
// ============================================================

const FICHE_GREGORY = `---
type: contact
categorie: ami
date_naissance:
date_anniversaire:
lieu_residence:
adresse:
telephone:
email: gregory.pittet@gmail.com
rencontre_via: Sony
date_derniere_interaction: 2026-04-14
tags:
  - ami
  - pro
  - sony
---

# Grégory Pittet

## Qui c'est
Ancien collègue Sony de [[Thomas Issa]]. Actuellement en congé de reclassement Sony, en phase de transition.
Surnommé "Greg".

## Famille / Liens
- Réseau Sony : [[Nicolas Berg]], [[Tanguy Onfroy]], [[Philippe Remion]]

## Parcours pro
En congé de reclassement (ex-Sony). Phase de transition pro post-Sony.

## Notes
- Foot régulier : Thomas + Greg + Tanguy

## Tonalité de communication
- Canal préféré : Email
- Tu/Vous : Tu
`;

const FICHE_MINIMAL = `---
type: contact
categorie: pro
email: test@example.com
tags: []
---

# Marie Dupont
`;

const FICHE_NO_TYPE = `---
categorie: ami
email: noone@test.com
---

# Personne Sans Type
`;

const FICHE_NO_FRONTMATTER = `# Personne Sans Frontmatter

Juste du texte.
`;

const FICHE_CORRUPTED_YAML = `---
type: contact
this is broken yaml [[[
---

# Broken
`;

const FICHE_WITH_PARCOURS = `---
type: contact
categorie: pro
email: avocat@example.com
---

# Martin Yhuel

## Qui c'est
Avocat de la famille Issa.

## Parcours pro
Avocat associé chez PNM Avocats. Spécialiste droit des sociétés.

## Notes
Basé à Lille. Disponible le mardi.
`;

const FICHE_WITH_SURNOMS = `---
type: contact
categorie: ami
---

# Jean-Pierre Test

## Qui c'est
Ami de longue date. Surnommé "JP". Aussi appelé "Jipé" par ses collègues.
`;

const FICHE_LONG_NOTES = `---
type: contact
categorie: pro
---

# Long Notes Person

## Qui c'est
${'A'.repeat(300)}

## Notes
${'B'.repeat(300)}
`;

// ============================================================
// Tests parseContactFile (unitaire — pas de mock Drive)
// ============================================================

describe('parseContactFile', () => {
  it('parse une fiche complète (Gregory Pittet)', () => {
    const contact = parseContactFile(FICHE_GREGORY, 'Gregory Pittet.md');
    expect(contact).not.toBeNull();
    expect(contact!.prenom).toBe('Grégory');
    expect(contact!.nom).toBe('Pittet');
    expect(contact!.email).toBe('gregory.pittet@gmail.com');
    expect(contact!.categorie).toBe('ami');
    expect(contact!.tags).toEqual(['ami', 'pro', 'sony']);
    expect(contact!.entitesVisibles).toEqual([]);
  });

  it('extrait les surnoms (Greg)', () => {
    const contact = parseContactFile(FICHE_GREGORY, 'Gregory Pittet.md');
    expect(contact).not.toBeNull();
    expect(contact!.surnoms).toContain('Greg');
  });

  it('extrait les notes (Qui c\'est + Notes)', () => {
    const contact = parseContactFile(FICHE_GREGORY, 'Gregory Pittet.md');
    expect(contact).not.toBeNull();
    expect(contact!.notes).toContain('Ancien collègue Sony');
    expect(contact!.notes).toContain('Foot régulier');
  });

  it('extrait titre + société depuis Parcours pro', () => {
    const contact = parseContactFile(FICHE_WITH_PARCOURS, 'Martin Yhuel.md');
    expect(contact).not.toBeNull();
    expect(contact!.titre).toBe('Avocat associé');
    expect(contact!.societe).toBe('PNM Avocats');
  });

  it('parse une fiche minimale (juste frontmatter type:contact + H1)', () => {
    const contact = parseContactFile(FICHE_MINIMAL, 'Marie Dupont.md');
    expect(contact).not.toBeNull();
    expect(contact!.prenom).toBe('Marie');
    expect(contact!.nom).toBe('Dupont');
    expect(contact!.email).toBe('test@example.com');
    expect(contact!.categorie).toBe('pro');
  });

  it('skip une fiche sans type: contact', () => {
    const contact = parseContactFile(FICHE_NO_TYPE, 'no-type.md');
    expect(contact).toBeNull();
  });

  it('skip une fiche sans frontmatter', () => {
    const contact = parseContactFile(FICHE_NO_FRONTMATTER, 'no-fm.md');
    expect(contact).toBeNull();
  });

  it('skip une fiche avec YAML corrompu (ne crashe pas)', () => {
    // Le parser frontmatter existant gère le YAML invalide de manière robuste.
    // L'important c'est que ca ne crashe pas
    expect(() => parseContactFile(FICHE_CORRUPTED_YAML, 'broken.md')).not.toThrow();
  });

  it('extrait les surnoms multiples', () => {
    const contact = parseContactFile(FICHE_WITH_SURNOMS, 'JP Test.md');
    expect(contact).not.toBeNull();
    expect(contact!.surnoms).toContain('JP');
    expect(contact!.surnoms).toContain('Jipé');
    expect(contact!.surnoms).toHaveLength(2);
  });

  it('tronque les notes à 500 caractères', () => {
    const contact = parseContactFile(FICHE_LONG_NOTES, 'long.md');
    expect(contact).not.toBeNull();
    expect(contact!.notes!.length).toBeLessThanOrEqual(500);
    expect(contact!.notes!).toMatch(/\.\.\.$/);
  });

  it('utilise le nom du fichier en fallback si pas de H1', () => {
    const ficheNoH1 = `---
type: contact
categorie: pro
---

Pas de titre H1 ici.
`;
    const contact = parseContactFile(ficheNoH1, 'Fallback Name.md');
    expect(contact).not.toBeNull();
    expect(contact!.prenom).toBe('Fallback');
    expect(contact!.nom).toBe('Name');
  });

  it('retourne titre et societe vides si pas de section Parcours pro', () => {
    const contact = parseContactFile(FICHE_MINIMAL, 'Marie Dupont.md');
    expect(contact).not.toBeNull();
    expect(contact!.titre).toBe('');
    expect(contact!.societe).toBe('');
  });

  it('gère le pattern (ex-Société) dans Parcours pro', () => {
    const contact = parseContactFile(FICHE_GREGORY, 'Gregory Pittet.md');
    expect(contact).not.toBeNull();
    expect(contact!.societe).toBe('Sony');
  });
});

// ============================================================
// Tests getVaultContacts (intégration avec mocks Drive)
// ============================================================

describe('getVaultContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateVaultContactsCache();
    mockGetAccessToken.mockResolvedValue('fake-token');
  });

  it('charge des contacts depuis 2 sous-dossiers (Amis + Pro)', async () => {
    // Amis retourne Gregory
    mockListVaultFolder.mockImplementation(async (folder: string) => {
      if (folder.includes('Amis')) {
        return [{ id: 'file-greg', name: 'Gregory Pittet.md' }];
      }
      if (folder.includes('Pro')) {
        return [{ id: 'file-martin', name: 'Martin Yhuel.md' }];
      }
      return [];
    });

    mockReadFileById.mockImplementation(async (_token: string, fileId: string) => {
      if (fileId === 'file-greg') {
        return { success: true, content: FICHE_GREGORY };
      }
      if (fileId === 'file-martin') {
        return { success: true, content: FICHE_WITH_PARCOURS };
      }
      return { success: false, error: 'not found' };
    });

    const contacts = await getVaultContacts();
    expect(contacts.length).toBe(2);

    const greg = contacts.find((c) => c.nom === 'Pittet');
    expect(greg).toBeDefined();
    expect(greg!.prenom).toBe('Grégory');

    const martin = contacts.find((c) => c.nom === 'Yhuel');
    expect(martin).toBeDefined();
  });

  it('cache TTL : 2 appels < 1h = 1 seul fetch Drive', async () => {
    mockListVaultFolder.mockResolvedValue([]);

    await getVaultContacts();
    await getVaultContacts();

    // listVaultFolder appelé 4 fois (4 dossiers) lors du premier appel seulement
    expect(mockListVaultFolder).toHaveBeenCalledTimes(4);
  });

  it('cache invalide apres invalidateVaultContactsCache()', async () => {
    mockListVaultFolder.mockResolvedValue([]);

    await getVaultContacts();
    invalidateVaultContactsCache();
    await getVaultContacts();

    // 4 dossiers * 2 appels = 8
    expect(mockListVaultFolder).toHaveBeenCalledTimes(8);
  });

  it('stale fallback : si vault indispo apres un chargement reussi (TTL expiré)', async () => {
    // Premier appel : OK
    mockListVaultFolder.mockResolvedValue([
      { id: 'file-greg', name: 'Gregory Pittet.md' },
    ]);
    mockReadFileById.mockResolvedValue({ success: true, content: FICHE_GREGORY });

    const first = await getVaultContacts();
    expect(first.length).toBeGreaterThan(0);

    // Simuler expiration TTL en avancant le temps de 2h
    const originalNow = Date.now;
    Date.now = () => originalNow() + 2 * 60 * 60 * 1_000;

    try {
      // Deuxième appel : Drive en panne (throw dans listVaultFolder)
      mockListVaultFolder.mockRejectedValue(new Error('Drive en panne'));

      const second = await getVaultContacts();
      // Stale fallback : retourne le dernier snapshot
      expect(second.length).toBeGreaterThan(0);
      expect(second[0]!.nom).toBe('Pittet');
    } finally {
      Date.now = originalNow;
    }
  });

  it('retourne [] si vault indispo et pas de cache', async () => {
    mockGetAccessToken.mockResolvedValue(null);

    const contacts = await getVaultContacts();
    expect(contacts).toEqual([]);
  });

  it('skip les fichiers non-.md', async () => {
    mockListVaultFolder.mockImplementation(async (folder: string) => {
      if (folder.includes('Pro')) {
        return [
          { id: 'file-txt', name: 'readme.txt' },
          { id: 'file-md', name: 'Contact.md' },
        ];
      }
      return [];
    });
    mockReadFileById.mockResolvedValue({ success: true, content: FICHE_MINIMAL });

    const contacts = await getVaultContacts();
    expect(contacts.length).toBe(1);
    // Seul Contact.md est traité (readme.txt filtré)
    expect(mockReadFileById).toHaveBeenCalledTimes(1);
    expect(mockReadFileById).toHaveBeenCalledWith('fake-token', 'file-md');
  });

  it('continue si un fichier individuel échoue', async () => {
    mockListVaultFolder.mockImplementation(async (folder: string) => {
      if (folder.includes('Pro')) {
        return [
          { id: 'file-bad', name: 'Broken.md' },
          { id: 'file-ok', name: 'OK.md' },
        ];
      }
      return [];
    });

    mockReadFileById.mockImplementation(async (_token: string, fileId: string) => {
      if (fileId === 'file-bad') {
        throw new Error('Drive timeout');
      }
      return { success: true, content: FICHE_MINIMAL };
    });

    const contacts = await getVaultContacts();
    // Le fichier OK est quand même traité
    expect(contacts.length).toBe(1);
  });
});
