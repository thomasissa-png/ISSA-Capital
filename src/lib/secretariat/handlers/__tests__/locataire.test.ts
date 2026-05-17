/**
 * Tests unitaires — handler locataire.
 *
 * Vérifie :
 * - Fiche trouvée : append_historique + update_frontmatter + mark_processed
 * - Intent quittance → add_todo supplémentaire avec target VAULT_PATHS.todoMd
 * - Intent non-quittance → pas d'add_todo
 * - Locataire inconnu (no-match Jalon 4D-2) : create_file A classifier +
 *   prompt_create_contact_choice (defaultType=autres) + mark_processed
 * - Cibles et payloads corrects (slugified, em-dash, ref Gmail)
 * - mark_processed toujours en dernière position
 * - Regex quittance case-insensitive
 * - Description humaine correcte dans chaque action
 *
 * Fix Jalon 4D-1 : paths via VAULT_PATHS, slugify, em-dash, ref email.
 * Fix Jalon 4D-2 : no-match → A classifier + prompt 5 boutons (plus de add_todo seul).
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

import { handleLocataire } from '../locataire';
import { VAULT_PATHS } from '../vault-paths';

// ============================================================
// Fixtures
// ============================================================

function makeEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    source: 'gmail',
    id: 'msg_loc_001',
    from: { email: 'alice.martin@gmail.com', name: 'Alice Martin' },
    to: [{ email: 'thomas@issacapital.com' }],
    cc: [],
    subject: 'Demande de quittance mai',
    bodyPlain: 'Bonjour, pourriez-vous me transmettre la quittance de mai ?',
    receivedAt: new Date('2026-05-13T09:00:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg_loc_001',
    ...overrides,
  };
}

function makeTriage(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    category: 'locataire',
    intent: 'demande_quittance_mai',
    confidence: 0.95,
    matchedContact: 'Alice Martin',
    summary: 'Demande de quittance pour le mois de mai 2026.',
    suggestedActions: [],
    ...overrides,
  };
}

const existingLocataire = {
  name: 'Alice Martin',
  folderPath: '07. Contacts/05. Locataires/01. Actuels',
  emails: ['alice.martin@gmail.com'],
  content: '---\nnom: Alice Martin\n---\n# Alice Martin',
  fileId: 'drive_file_loc_001',
};

// ============================================================
// Tests
// ============================================================

describe('handleLocataire', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Locataire connu, intent quittance ---

  it('retourne 4 actions si locataire connu + intent quittance', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const actions = await handleLocataire(makeTriage(), makeEmail());

    expect(actions).toHaveLength(4);
    expect(actions[0]!.type).toBe('append_historique');
    expect(actions[1]!.type).toBe('update_frontmatter');
    expect(actions[2]!.type).toBe('add_todo');
    expect(actions[3]!.type).toBe('mark_processed');
  });

  it('add_todo contient le nom du contact et l\'intent quittance', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const actions = await handleLocataire(makeTriage(), makeEmail());

    const todoAction = actions[2]!;
    expect(todoAction.type).toBe('add_todo');
    expect(todoAction.payload.task).toContain('Alice Martin');
    expect(todoAction.payload.task).toContain('demande_quittance_mai');
    expect(todoAction.payload.priority).toBe('P1');
  });

  it('add_todo cible 03. Tâches/Todo.md (pas null)', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const actions = await handleLocataire(makeTriage(), makeEmail());

    const todoAction = actions[2]!;
    expect(todoAction.target).toBe(VAULT_PATHS.todoMd);
    expect(todoAction.target).toBe('03. Tâches/Todo.md');
  });

  // --- Locataire connu, intent non-quittance ---

  it('retourne 3 actions si locataire connu + intent non-quittance', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const triage = makeTriage({ intent: 'signalement_probleme' });
    const actions = await handleLocataire(triage, makeEmail());

    expect(actions).toHaveLength(3);
    expect(actions[0]!.type).toBe('append_historique');
    expect(actions[1]!.type).toBe('update_frontmatter');
    expect(actions[2]!.type).toBe('mark_processed');
  });

  it('cible la fiche locataire au bon chemin (slugified)', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const actions = await handleLocataire(makeTriage(), makeEmail());

    const expectedTarget = '07. Contacts/05. Locataires/01. Actuels/Alice Martin.md';
    expect(actions[0]!.target).toBe(expectedTarget);
    expect(actions[1]!.target).toBe(expectedTarget);
  });

  it('payload append_historique contient section, content avec ref Gmail, date ISO et title em-dash', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const actions = await handleLocataire(makeTriage(), makeEmail());

    const payload = actions[0]!.payload;
    expect(payload.section).toBe('demande_quittance_mai');
    expect(payload.content).toContain('Demande de quittance pour le mois de mai 2026.');
    expect(payload.content).toContain('(cf. thread Gmail msg_loc_001)');
    expect(payload.date).toBe('2026-05-13T09:00:00.000Z');
    expect(payload.title).toBe('### 2026-05-13 — demande_quittance_mai');
    expect(payload.title).toContain('—');
  });

  it('payload update_frontmatter contient la date YYYY-MM-DD', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const actions = await handleLocataire(makeTriage(), makeEmail());

    expect(actions[1]!.payload.date_derniere_interaction).toBe('2026-05-13');
  });

  // --- Slugify filename ---

  it('slugifie les accents dans le nom de fichier', async () => {
    mocks.findContactByEmail.mockResolvedValue({
      ...existingLocataire,
      name: 'Hélla Taoutaou',
    });
    const actions = await handleLocataire(makeTriage(), makeEmail());

    expect(actions[0]!.target).toContain('Hella Taoutaou.md');
  });

  // --- Détection quittance case-insensitive ---

  it('détecte l\'intent quittance en majuscules', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const triage = makeTriage({ intent: 'DEMANDE_QUITTANCE_JUIN' });
    const actions = await handleLocataire(triage, makeEmail());

    const types = actions.map((a) => a.type);
    expect(types).toContain('add_todo');
  });

  it('ne déclenche pas add_todo pour un intent "quittance" sans le préfixe demande_quittance_', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const triage = makeTriage({ intent: 'envoi_quittance_mai' });
    const actions = await handleLocataire(triage, makeEmail());

    const types = actions.map((a) => a.type);
    expect(types).not.toContain('add_todo');
  });

  // --- Locataire inconnu (no-match Jalon 4D-2) ---

  it('retourne 3 actions si locataire non trouvé (create_file + prompt + mark_processed)', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleLocataire(makeTriage(), makeEmail());

    expect(actions).toHaveLength(3);
    expect(actions[0]!.type).toBe('create_file');
    expect(actions[1]!.type).toBe('prompt_create_contact_choice');
    expect(actions[2]!.type).toBe('mark_processed');
  });

  it('locataire inconnu : dépôt dans A classifier', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleLocataire(makeTriage(), makeEmail());

    expect(actions[0]!.target).toContain(VAULT_PATHS.notesAClassifier);
    expect(actions[0]!.target).toContain('05. Notes/A classifier');
  });

  it('locataire inconnu : defaultType est "autres" (pas "locataire")', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleLocataire(makeTriage(), makeEmail());

    const prompt = actions[1]!;
    expect(prompt.payload.defaultType).toBe('autres');
    expect(prompt.payload.emailFrom).toBe('alice.martin@gmail.com');
    expect(prompt.payload.nameFrom).toBe('Alice Martin');
  });

  it('locataire inconnu : contenu A classifier contient triage_category locataire', async () => {
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions = await handleLocataire(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('triage_category: locataire');
    expect(content).toContain('triage_intent: demande_quittance_mai');
    expect(content).toContain('Demande de quittance pour le mois de mai 2026.');
  });

  // --- mark_processed ---

  it('mark_processed est toujours la dernière action', async () => {
    // Cas locataire connu + quittance (4 actions)
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const actions = await handleLocataire(makeTriage(), makeEmail());
    expect(actions[actions.length - 1]!.type).toBe('mark_processed');

    // Cas locataire inconnu (3 actions)
    mocks.findContactByEmail.mockResolvedValue(null);
    const actions2 = await handleLocataire(makeTriage(), makeEmail());
    expect(actions2[actions2.length - 1]!.type).toBe('mark_processed');
  });

  it('mark_processed contient le messageId', async () => {
    mocks.findContactByEmail.mockResolvedValue(existingLocataire);
    const email = makeEmail({ id: 'msg_loc_specific' });
    const actions = await handleLocataire(makeTriage(), email);

    const last = actions[actions.length - 1]!;
    expect(last.payload.messageId).toBe('msg_loc_specific');
    expect(last.target).toBeNull();
  });
});
