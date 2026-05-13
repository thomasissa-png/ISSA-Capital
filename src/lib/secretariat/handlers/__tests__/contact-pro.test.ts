/**
 * Tests unitaires — handler contact-pro.
 *
 * Vérifie :
 * - Fiche existante : append_historique + update_frontmatter + mark_processed
 * - Fiche non trouvée : create_file + mark_processed
 * - Cible correcte (folderPath/nom.md)
 * - Payload append_historique (section, content, date)
 * - Payload update_frontmatter (date_derniere_interaction)
 * - Extraction du nom d'affichage depuis From
 * - Fallback local-part si pas de nom
 * - Contenu du nouveau fichier (frontmatter + historique)
 * - mark_processed toujours en dernière position
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
  folderPath: '07. Contacts/01. Pro',
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

  it('cible la fiche au bon chemin (folderPath/nom.md)', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingContact);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions[0]!.target).toBe('07. Contacts/01. Pro/Martin Yhuel.md');
    expect(actions[1]!.target).toBe('07. Contacts/01. Pro/Martin Yhuel.md');
  });

  it('payload append_historique contient section, content et date ISO', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingContact);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    const payload = actions[0]!.payload;
    expect(payload.section).toBe('suivi_dossier');
    expect(payload.content).toBe('Suivi du dossier immobilier en cours.');
    expect(payload.date).toBe('2026-05-13T14:00:00.000Z');
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

  it('crée le fichier dans 07. Contacts/01. Pro/ avec le bon nom', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions[0]!.target).toBe('07. Contacts/01. Pro/Martin Yhuel.md');
  });

  it('utilise le local-part de l\'email si pas de nom dans From', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const email = makeEmail({
      from: { email: 'jean.dupont@example.com' },
    });
    const actions = await handleContactPro(makeTriage(), email);

    expect(actions[0]!.target).toBe('07. Contacts/01. Pro/Jean Dupont.md');
  });

  it('le contenu du nouveau fichier contient frontmatter + historique', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    // Frontmatter
    expect(content).toContain('---');
    expect(content).toContain('nom: "Martin Yhuel"');
    expect(content).toContain('email: "martin@pnmavocats.law"');
    expect(content).toContain('type: pro');
    expect(content).toContain('date_creation: 2026-05-13');
    expect(content).toContain('source: email-ingest');

    // Historique
    expect(content).toContain('## Historique');
    expect(content).toContain('### 2026-05-13 — suivi_dossier');
    expect(content).toContain('Suivi du dossier immobilier en cours.');
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
