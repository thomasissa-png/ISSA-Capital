/**
 * Tests unitaires — handler candidat.
 *
 * Vérifie :
 * - Fiche trouvée : append_historique + update_frontmatter + mark_processed
 * - Fiche non trouvée : create_file dans _Candidats/ + mark_processed
 * - Frontmatter stub correct (type, categorie, statut, email, dates, tags)
 * - Sections markdown (Contact, Bien souhaité, Dossier locatif, Historique)
 * - Slugify filename (accents, apostrophes)
 * - Em-dash dans titre Historique
 * - Ref Gmail dans contenu
 * - Extraction display name (from.name ou fallback local-part)
 * - mark_processed toujours dernière action
 * - Path cible VAULT_PATHS.candidatsLocataires
 *
 * Créé Jalon 4D-1 (2026-05-17).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TriageResult } from '../../triage/types';
import type { EmailMessage } from '../../gmail-source/types';

// ============================================================
// Mocks — déclarés AVANT les imports
// ============================================================

const mocks = vi.hoisted(() => ({
  findContactByEmail: vi.fn(),
}));

vi.mock('../../vault-client', () => ({
  findContactByEmail: mocks.findContactByEmail,
}));

// ============================================================
// Imports (après mocks)
// ============================================================

import { handleCandidat } from '../candidat';
import { VAULT_PATHS } from '../vault-paths';

// ============================================================
// Fixtures
// ============================================================

function makeEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    source: 'gmail',
    id: 'msg_cand_001',
    from: { email: 'jean.candidat@gmail.com', name: 'Jean Candidat' },
    to: [{ email: 'thomas@issacapital.com' }],
    cc: [],
    subject: 'Candidature logement rue Myrha',
    bodyPlain: 'Bonjour, je suis intéressé par votre logement au 74 rue Myrha.',
    receivedAt: new Date('2026-05-15T11:00:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg_cand_001',
    ...overrides,
  };
}

function makeTriage(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    category: 'candidat',
    intent: 'candidature_logement',
    confidence: 0.87,
    matchedContact: null,
    summary: 'Candidature pour le logement au 74 rue Myrha.',
    suggestedActions: [],
    ...overrides,
  };
}

const existingCandidat = {
  name: 'Jean Candidat',
  folderPath: '07. Contacts/05. Locataires/_Candidats',
  emails: ['jean.candidat@gmail.com'],
  content: '---\ntype: contact\ncategorie: locataire\nstatut: candidat\n---\n# Jean Candidat',
  fileId: 'drive_file_cand_001',
};

// ============================================================
// Tests — Candidat existant
// ============================================================

describe('handleCandidat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne 3 actions si la fiche candidat existe', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingCandidat);
    const actions = await handleCandidat(makeTriage(), makeEmail());

    expect(actions).toHaveLength(3);
    expect(actions[0]!.type).toBe('append_historique');
    expect(actions[1]!.type).toBe('update_frontmatter');
    expect(actions[2]!.type).toBe('mark_processed');
  });

  it('cible la fiche au bon chemin (folderPath/slugified-name.md)', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingCandidat);
    const actions = await handleCandidat(makeTriage(), makeEmail());

    expect(actions[0]!.target).toBe(
      '07. Contacts/05. Locataires/_Candidats/Jean Candidat.md',
    );
    expect(actions[1]!.target).toBe(
      '07. Contacts/05. Locataires/_Candidats/Jean Candidat.md',
    );
  });

  it('payload append_historique contient title em-dash, content avec ref Gmail, date ISO', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingCandidat);
    const actions = await handleCandidat(makeTriage(), makeEmail());

    const payload = actions[0]!.payload;
    expect(payload.title).toBe('### 2026-05-15 — candidature_logement');
    expect(payload.title).toContain('—');
    expect(payload.content).toContain('Candidature pour le logement au 74 rue Myrha.');
    expect(payload.content).toContain('(cf. thread Gmail msg_cand_001)');
    expect(payload.date).toBe('2026-05-15T11:00:00.000Z');
  });

  it('payload update_frontmatter contient date_derniere_interaction', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingCandidat);
    const actions = await handleCandidat(makeTriage(), makeEmail());

    expect(actions[1]!.payload.date_derniere_interaction).toBe('2026-05-15');
  });

  it('cherche le contact par l\'email du From', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    await handleCandidat(makeTriage(), makeEmail());

    expect(mocks.findContactByEmail).toHaveBeenCalledWith('jean.candidat@gmail.com');
  });

  // ============================================================
  // Tests — Nouveau candidat
  // ============================================================

  it('retourne 2 actions si la fiche candidat n\'existe pas', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleCandidat(makeTriage(), makeEmail());

    expect(actions).toHaveLength(2);
    expect(actions[0]!.type).toBe('create_file');
    expect(actions[1]!.type).toBe('mark_processed');
  });

  it('crée le fichier dans VAULT_PATHS.candidatsLocataires', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleCandidat(makeTriage(), makeEmail());

    expect(actions[0]!.target).toBe(
      `${VAULT_PATHS.candidatsLocataires}/Jean Candidat.md`,
    );
    expect(actions[0]!.target).toContain('_Candidats');
  });

  it('frontmatter stub contient type, categorie, statut, email, dates, tags', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleCandidat(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('type: contact');
    expect(content).toContain('categorie: locataire');
    expect(content).toContain('statut: candidat');
    expect(content).toContain('email: jean.candidat@gmail.com');
    expect(content).toContain('date_premier_contact: 2026-05-15');
    expect(content).toContain('date_derniere_interaction: 2026-05-15');
    expect(content).toContain('tags:');
    expect(content).toContain('  - locataire');
    expect(content).toContain('  - candidat');
  });

  it('contenu contient les sections Contact, Bien souhaité, Dossier locatif, Historique', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleCandidat(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('## Contact');
    expect(content).toContain('## Bien souhaité');
    expect(content).toContain('## Dossier locatif');
    expect(content).toContain('## Historique');
  });

  it('historique contient em-dash et ref Gmail dans le contenu', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleCandidat(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('### 2026-05-15 — candidature_logement');
    expect(content).toContain('—');
    expect(content).toContain('(cf. thread Gmail msg_cand_001)');
    expect(content).toContain('Candidature pour le logement au 74 rue Myrha.');
  });

  // ============================================================
  // Tests — Slugify et display name
  // ============================================================

  it('slugifie les accents dans le nom de fichier (nouveau candidat)', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const email = makeEmail({
      from: { email: 'francois@test.com', name: 'François Étienne' },
    });
    const actions = await handleCandidat(makeTriage(), email);

    expect(actions[0]!.target).toBe(
      `${VAULT_PATHS.candidatsLocataires}/Francois Etienne.md`,
    );
  });

  it('slugifie les apostrophes dans le nom de fichier (nouveau candidat)', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const email = makeEmail({
      from: { email: 'test@test.com', name: "Aïcha M'Barka" },
    });
    const actions = await handleCandidat(makeTriage(), email);

    expect(actions[0]!.target).toContain('Aicha MBarka.md');
  });

  it('utilise le local-part de l\'email si from.name est absent', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const email = makeEmail({
      from: { email: 'marie.dupont@gmail.com' },
    });
    const actions = await handleCandidat(makeTriage(), email);

    expect(actions[0]!.target).toContain('Marie Dupont.md');
  });

  it('slugifie le nom pour un candidat existant avec accents', async () => {
    mocks.findContactByEmail.mockResolvedValue({
      ...existingCandidat,
      name: 'Hélla Taoutaou',
    });
    const actions = await handleCandidat(makeTriage(), makeEmail());

    expect(actions[0]!.target).toContain('Hella Taoutaou.md');
  });

  // ============================================================
  // Tests — mark_processed
  // ============================================================

  it('mark_processed est toujours la dernière action (candidat existant)', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingCandidat);
    const email = makeEmail({ id: 'msg_cand_specific' });
    const actions = await handleCandidat(makeTriage(), email);

    const last = actions[actions.length - 1]!;
    expect(last.type).toBe('mark_processed');
    expect(last.payload.messageId).toBe('msg_cand_specific');
    expect(last.target).toBeNull();
  });

  it('mark_processed est toujours la dernière action (nouveau candidat)', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const email = makeEmail({ id: 'msg_cand_new' });
    const actions = await handleCandidat(makeTriage(), email);

    const last = actions[actions.length - 1]!;
    expect(last.type).toBe('mark_processed');
    expect(last.payload.messageId).toBe('msg_cand_new');
    expect(last.target).toBeNull();
  });

  it('description contient le nom du contact (candidat existant)', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingCandidat);
    const actions = await handleCandidat(makeTriage(), makeEmail());

    expect(actions[0]!.description).toContain('Jean Candidat');
  });
});
