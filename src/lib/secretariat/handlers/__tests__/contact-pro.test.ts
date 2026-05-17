/**
 * Tests unitaires — handler contact-pro.
 *
 * Vérifie :
 * - Fiche existante : append_historique + update_frontmatter + mark_processed
 * - Fiche non trouvée (no-match Jalon 4D-2) : create_file A classifier +
 *   prompt_create_contact_choice + mark_processed
 * - Cible correcte (VAULT_PATHS.contactsPro + slugified name)
 * - Payload append_historique (section, content avec ref Gmail, date, title em-dash)
 * - Payload update_frontmatter (date_derniere_interaction)
 * - Payload prompt_create_contact_choice (emailFrom, nameFrom, defaultType=pro)
 * - mark_processed toujours en dernière position
 * - Slugify filename (accents, apostrophes, caractères interdits)
 *
 * Fix Jalon 4D-1 : paths vault corrigés + em-dash + ref email + slugify.
 * Fix Jalon 4D-2 : no-match → A classifier + prompt 5 boutons (plus de fiche stub auto).
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

  // --- Fiche non trouvée (no-match Jalon 4D-2) ---

  it('retourne 3 actions si la fiche contact n\'existe pas (create_file + prompt + mark_processed)', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions).toHaveLength(3);
    expect(actions[0]!.type).toBe('create_file');
    expect(actions[1]!.type).toBe('prompt_create_contact_choice');
    expect(actions[2]!.type).toBe('mark_processed');
  });

  it('dépôt dans A classifier (pas dans 03. Pro)', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions[0]!.target).toContain(VAULT_PATHS.notesAClassifier);
    expect(actions[0]!.target).toContain('05. Notes/A classifier');
    expect(actions[0]!.target).not.toContain('03. Pro');
  });

  it('le fichier A classifier contient la date et le sujet dans le nom', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions[0]!.target).toContain('2026-05-13');
    expect(actions[0]!.target).toContain('Suivi dossier immobilier');
  });

  it('le contenu du fichier A classifier contient les infos triage', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('source: gmail');
    expect(content).toContain('triage_intent: suivi_dossier');
    expect(content).toContain('triage_category: contact-pro');
    expect(content).toContain('Suivi du dossier immobilier en cours.');
    expect(content).toContain('(cf. thread Gmail msg_pro_001)');
  });

  it('prompt_create_contact_choice a defaultType "pro"', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    const prompt = actions[1]!;
    expect(prompt.type).toBe('prompt_create_contact_choice');
    expect(prompt.target).toBeNull();
    expect(prompt.payload.emailFrom).toBe('martin@pnmavocats.law');
    expect(prompt.payload.nameFrom).toBe('Martin Yhuel');
    expect(prompt.payload.defaultType).toBe('pro');
    expect(prompt.payload.emailMessageId).toBe('msg_pro_001');
    expect(prompt.payload.emailThreadRef).toContain('thread Gmail msg_pro_001');
  });

  it('nameFrom est null si pas de nom dans From', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const email = makeEmail({
      from: { email: 'jean.dupont@example.com' },
    });
    const actions = await handleContactPro(makeTriage(), email);

    expect(actions[1]!.payload.nameFrom).toBeNull();
  });

  // --- Slugify filename (contact existant) ---

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

  it('mark_processed est la dernière action pour no-match aussi', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const email = makeEmail({ id: 'msg_nomatch_789' });
    const actions = await handleContactPro(makeTriage(), email);

    const last = actions[actions.length - 1]!;
    expect(last.type).toBe('mark_processed');
    expect(last.payload.messageId).toBe('msg_nomatch_789');
  });

  it('description de l\'action append contient le nom du contact', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingContact);
    const actions = await handleContactPro(makeTriage(), makeEmail());

    expect(actions[0]!.description).toContain('Martin Yhuel');
    expect(actions[0]!.description).toContain('suivi_dossier');
  });
});
