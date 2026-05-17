/**
 * Tests unitaires — handler contact-pro.
 *
 * Vérifie :
 * - Fiche existante : append_historique + update_frontmatter + mark_processed
 * - Fiche non trouvée : create_file + mark_processed
 * - Cible correcte (VAULT_PATHS.contactsPro + slugified name)
 * - Payload append_historique (section, content avec ref Gmail, date, title em-dash)
 * - Payload update_frontmatter (date_derniere_interaction)
 * - Extraction du nom d'affichage depuis From
 * - Fallback local-part si pas de nom
 * - Contenu du nouveau fichier (frontmatter aligné vault réel + historique em-dash + ref Gmail)
 * - mark_processed toujours en dernière position
 * - Slugify filename (accents, apostrophes, caractères interdits)
 *
 * Fix Jalon 4D-1 : paths vault corrigés + em-dash + ref email + slugify.
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

import { handleContactPro } from '../contact-pro';
import { VAULT_PATHS } from '../vault-paths';

// ============================================================
// Fixtures
// ============================================================

function makeEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    source: 'gmail',
    id: 'msg_pro_001',
    from: { email: 'martin@pnmavocats.law', name: 'Martin Yhuel' },
    to: [{ email: 'thomas@issacapital.com' }],
    cc: [],
    subject: 'Suivi dossier immobilier',
    bodyPlain: 'Bonjour Thomas, voici le suivi du dossier.',
    receivedAt: new Date('2026-05-13T14:00:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg_pro_001',
    ...overrides,
  };
}

function makeTriage(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    category: 'contact-pro',
    intent: 'suivi_dossier',
    confidence: 0.92,
    matchedContact: 'Martin Yhuel',
    summary: 'Suivi du dossier immobilier en cours.',
    suggestedActions: [],
    ...overrides,
  };
}

const existingContact = {
  name: 'Martin Yhuel',
  folderPath: '07. Contacts/03. Pro',
  emails: ['martin@pnmavocats.law'],
  content: '---\nnom: Martin Yhuel\n---\n# Martin Yhuel',
  fileId: 'drive_file_123',
};

// ============================================================
// Tests
// ============================================================

describe('handleContactPro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Fiche existante ---

  it('retourne 3 actions si la fiche contact existe', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingContact);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions).toHaveLength(3);
    expect(actions[0]!.type).toBe('append_historique');
    expect(actions[1]!.type).toBe('update_frontmatter');
    expect(actions[2]!.type).toBe('mark_processed');
  });

  it('cible la fiche au bon chemin (folderPath/slugified-name.md)', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingContact);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions[0]!.target).toBe('07. Contacts/03. Pro/Martin Yhuel.md');
    expect(actions[1]!.target).toBe('07. Contacts/03. Pro/Martin Yhuel.md');
  });

  it('payload append_historique contient section, content avec ref Gmail, date ISO et title em-dash', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingContact);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    const payload = actions[0]!.payload;
    expect(payload.section).toBe('suivi_dossier');
    expect(payload.content).toContain('Suivi du dossier immobilier en cours.');
    expect(payload.content).toContain('(cf. thread Gmail msg_pro_001)');
    expect(payload.date).toBe('2026-05-13T14:00:00.000Z');
    expect(payload.title).toBe('### 2026-05-13 — suivi_dossier');
    expect(payload.title).toContain('—');
  });

  it('payload update_frontmatter contient date_derniere_interaction au format YYYY-MM-DD', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingContact);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions[1]!.payload.date_derniere_interaction).toBe('2026-05-13');
  });

  it('cherche le contact par l\'email du From', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    await handleContactPro(makeTriage(), makeEmail());

    expect(mocks.findContactByEmail).toHaveBeenCalledWith('martin@pnmavocats.law');
  });

  // --- Fiche non trouvée ---

  it('retourne 2 actions si la fiche contact n\'existe pas', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions).toHaveLength(2);
    expect(actions[0]!.type).toBe('create_file');
    expect(actions[1]!.type).toBe('mark_processed');
  });

  it('crée le fichier dans 07. Contacts/03. Pro/ (pas 01. Pro)', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions[0]!.target).toBe(`${VAULT_PATHS.contactsPro}/Martin Yhuel.md`);
    expect(actions[0]!.target).toContain('03. Pro');
    expect(actions[0]!.target).not.toContain('01. Pro');
  });

  it('utilise le local-part de l\'email si pas de nom dans From', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const email = makeEmail({
      from: { email: 'jean.dupont@example.com' },
    });
    const actions = await handleContactPro(makeTriage(), email);

    expect(actions[0]!.target).toBe(`${VAULT_PATHS.contactsPro}/Jean Dupont.md`);
  });

  it('le contenu du nouveau fichier contient frontmatter aligné vault réel', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    // Frontmatter aligné Cowork D1
    expect(content).toContain('---');
    expect(content).toContain('type: contact');
    expect(content).toContain('categorie: pro');
    expect(content).toContain('email: martin@pnmavocats.law');
    expect(content).toContain('date_premier_contact: 2026-05-13');
    expect(content).toContain('date_derniere_interaction: 2026-05-13');
    expect(content).toContain('tags:');
    expect(content).toContain('  - pro');

    // Historique avec em-dash
    expect(content).toContain('## Historique');
    expect(content).toContain('### 2026-05-13 — suivi_dossier');
    expect(content).toContain('—');

    // Ref email Gmail
    expect(content).toContain('(cf. thread Gmail msg_pro_001)');
  });

  it('le contenu du nouveau fichier contient le résumé triage', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('Suivi du dossier immobilier en cours.');
  });

  // --- Slugify filename ---

  it('slugifie les accents dans le nom de fichier (nouveau contact)', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const email = makeEmail({
      from: { email: 'francois@test.com', name: 'François Étienne' },
    });
    const actions = await handleContactPro(makeTriage(), email);

    expect(actions[0]!.target).toBe(`${VAULT_PATHS.contactsPro}/Francois Etienne.md`);
  });

  it('slugifie les apostrophes dans le nom de fichier (nouveau contact)', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const email = makeEmail({
      from: { email: 'francois@test.com', name: "François D'Aremberg" },
    });
    const actions = await handleContactPro(makeTriage(), email);

    expect(actions[0]!.target).toBe(`${VAULT_PATHS.contactsPro}/Francois DAremberg.md`);
  });

  it('slugifie le nom dans le target (contact existant avec accents)', async () => {
    mocks.findContactByEmail.mockResolvedValue({
      ...existingContact,
      name: 'Hélla Taoutaou',
      folderPath: '07. Contacts/05. Locataires/01. Actuels',
    });
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions[0]!.target).toContain('Hella Taoutaou.md');
  });

  // --- mark_processed ---

  it('mark_processed est toujours la dernière action avec le messageId', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingContact);
    const email = makeEmail({ id: 'msg_specific_456' });
    const actions = await handleContactPro(makeTriage(), email);

    const last = actions[actions.length - 1]!;
    expect(last.type).toBe('mark_processed');
    expect(last.payload.messageId).toBe('msg_specific_456');
    expect(last.target).toBeNull();
  });

  it('description de l\'action append contient le nom du contact', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingContact);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions[0]!.description).toContain('Martin Yhuel');
    expect(actions[0]!.description).toContain('suivi_dossier');
  });
});
