/**
 * Tests unitaires — vault-paths.ts
 *
 * Vérifie :
 * - VAULT_PATHS contient les chemins vérifiés (scan Drive 2026-05-17)
 * - slugifyVaultFilename : accents, apostrophes, caractères interdits, espaces, troncature
 * - buildEmailRef : formats Gmail et Outlook
 * - buildHistoriqueTitle : em-dash U+2014
 * - reunionsPath : année + mois zéro-paddé
 */

import { describe, it, expect } from 'vitest';
import {
  VAULT_PATHS,
  slugifyVaultFilename,
  buildEmailRef,
  buildHistoriqueTitle,
  reunionsPath,
  EM_DASH,
} from '../vault-paths';

// ============================================================
// VAULT_PATHS — chemins corrects
// ============================================================

describe('VAULT_PATHS', () => {
  it('contactsPro pointe vers 03. Pro (pas 01. Pro)', () => {
    expect(VAULT_PATHS.contactsPro).toBe('07. Contacts/03. Pro');
  });

  it('locatairesActuels pointe vers le chemin complet', () => {
    expect(VAULT_PATHS.locatairesActuels).toBe(
      '07. Contacts/05. Locataires/01. Actuels',
    );
  });

  it('candidatsLocataires pointe vers _Candidats', () => {
    expect(VAULT_PATHS.candidatsLocataires).toBe(
      '07. Contacts/05. Locataires/_Candidats',
    );
  });

  it('opportunitesApporteurs pointe vers le chemin validé Thomas', () => {
    expect(VAULT_PATHS.opportunitesApporteurs).toBe(
      '02. Projets/01. Perso/Immobilier Direct/Opportunités',
    );
  });

  it('todoMd pointe vers 03. Tâches/Todo.md', () => {
    expect(VAULT_PATHS.todoMd).toBe('03. Tâches/Todo.md');
  });

  it('notesAClassifier pointe vers _Inbox/A classifier (dossier réel S23)', () => {
    expect(VAULT_PATHS.notesAClassifier).toBe('_Inbox/A classifier');
  });

  it('biensExistants pointe vers Immobilier Direct/Biens', () => {
    expect(VAULT_PATHS.biensExistants).toBe(
      '02. Projets/01. Perso/Immobilier Direct/Biens',
    );
  });
});

// ============================================================
// slugifyVaultFilename
// ============================================================

describe('slugifyVaultFilename', () => {
  it('retire les accents (NFD)', () => {
    expect(slugifyVaultFilename('François Étienne')).toBe('Francois Etienne');
  });

  it('retire les apostrophes', () => {
    expect(slugifyVaultFilename("François D'Aremberg")).toBe(
      'Francois DAremberg',
    );
  });

  it('retire les caractères interdits / \\ : * ? " < > |', () => {
    expect(slugifyVaultFilename('Re: Offre "spéciale" <urgent>')).toBe(
      'Re Offre speciale urgent',
    );
  });

  it('compresse les espaces multiples', () => {
    expect(slugifyVaultFilename('Jean   Pierre   Dupont')).toBe(
      'Jean Pierre Dupont',
    );
  });

  it('tronque à 80 caractères', () => {
    const long = 'A'.repeat(100);
    const result = slugifyVaultFilename(long);
    expect(result.length).toBeLessThanOrEqual(80);
  });

  it('retourne "sans-nom" pour une chaîne vide', () => {
    expect(slugifyVaultFilename('')).toBe('sans-nom');
  });

  it('retourne "sans-nom" si tous les caractères sont interdits', () => {
    expect(slugifyVaultFilename('***???')).toBe('sans-nom');
  });

  it('gère la cédille', () => {
    expect(slugifyVaultFilename('Françoise Ça')).toBe('Francoise Ca');
  });

  it('préserve les chiffres', () => {
    expect(slugifyVaultFilename('2026-05-14 - 74 rue Myrha')).toBe(
      '2026-05-14 - 74 rue Myrha',
    );
  });

  it('trim les espaces en début et fin', () => {
    expect(slugifyVaultFilename('  Dupont  ')).toBe('Dupont');
  });
});

// ============================================================
// buildEmailRef
// ============================================================

describe('buildEmailRef', () => {
  it('format Gmail avec thread ID', () => {
    expect(buildEmailRef('gmail', '19abc123def')).toBe(
      '(cf. thread Gmail 19abc123def)',
    );
  });

  it('format Outlook avec internetMessageId', () => {
    expect(buildEmailRef('outlook', '<msg-id@outlook.com>')).toBe(
      '(cf. email Outlook <msg-id@outlook.com>)',
    );
  });
});

// ============================================================
// buildHistoriqueTitle
// ============================================================

describe('buildHistoriqueTitle', () => {
  it('utilise em-dash U+2014 (pas tiret simple)', () => {
    const title = buildHistoriqueTitle(
      '2026-05-14',
      'Demande validation clause bail',
    );
    expect(title).toBe(
      '### 2026-05-14 — Demande validation clause bail',
    );
    expect(title).toContain('—');
    expect(title).not.toContain(' - ');
  });

  it('contient le préfixe H3', () => {
    const title = buildHistoriqueTitle('2026-01-01', 'Test');
    expect(title.startsWith('### ')).toBe(true);
  });
});

// ============================================================
// EM_DASH
// ============================================================

describe('EM_DASH', () => {
  it('est le caractère U+2014', () => {
    expect(EM_DASH).toBe('—');
    expect(EM_DASH).toBe('—');
  });
});

// ============================================================
// reunionsPath
// ============================================================

describe('reunionsPath', () => {
  it('format année/mois zéro-paddé', () => {
    expect(reunionsPath(2026, 5)).toBe('06. Réunions/2026/05');
  });

  it('mois à 2 chiffres sans padding supplémentaire', () => {
    expect(reunionsPath(2026, 12)).toBe('06. Réunions/2026/12');
  });

  it('mois janvier zéro-paddé', () => {
    expect(reunionsPath(2026, 1)).toBe('06. Réunions/2026/01');
  });
});
