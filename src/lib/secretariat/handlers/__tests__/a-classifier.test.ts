/**
 * Tests unitaires — handler a-classifier.
 *
 * Vérifie :
 * - Création du fichier dans VAULT_PATHS.notesAClassifier
 * - Nom de fichier avec date + em-dash + sujet slugifié
 * - Contenu YAML frontmatter valide
 * - Sujet slugifié (accents retirés, caractères interdits retirés)
 * - Corps tronqué si > 1000 caractères
 * - Sujet vide → fallback "sans-objet"
 * - mark_processed en dernière action
 * - Infos triage (intent, confidence) dans le frontmatter
 * - Référence email Gmail dans le résumé triage
 *
 * Fix Jalon 4D-1 : path via VAULT_PATHS, slugify, em-dash, ref email.
 */

import { describe, it, expect } from 'vitest';
import { handleAClassifier } from '../a-classifier';
import { VAULT_PATHS, EM_DASH } from '../vault-paths';
import type { TriageResult } from '../../triage/types';
import type { EmailMessage } from '../../gmail-source/types';

// ============================================================
// Fixtures
// ============================================================

function makeEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    source: 'gmail',
    id: 'msg_001',
    from: { email: 'inconnu@example.com', name: 'Jean Inconnu' },
    to: [{ email: 'thomas@issacapital.com' }],
    cc: [],
    subject: 'Proposition de service',
    bodyPlain: 'Bonjour, je vous propose mes services de conseil.',
    receivedAt: new Date('2026-05-13T10:30:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg_001',
    ...overrides,
  };
}

function makeTriage(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    category: 'a-classifier',
    intent: 'proposition_service',
    confidence: 0.4,
    matchedContact: null,
    summary: 'Proposition de services de conseil non sollicitée.',
    suggestedActions: [],
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('handleAClassifier', () => {
  it('retourne exactement 2 actions (create_file + mark_processed)', async () => {
    const actions = await handleAClassifier(makeTriage(), makeEmail());
    expect(actions).toHaveLength(2);
    expect(actions[0]!.type).toBe('create_file');
    expect(actions[1]!.type).toBe('mark_processed');
  });

  it('crée le fichier dans VAULT_PATHS.notesAClassifier avec em-dash et sujet slugifié', async () => {
    const actions = await handleAClassifier(makeTriage(), makeEmail());
    const target = actions[0]!.target as string;

    expect(target).toContain(VAULT_PATHS.notesAClassifier);
    expect(target).toContain('05. Notes/A classifier');
    expect(target).toContain(`2026-05-13 ${EM_DASH} Proposition de service.md`);
  });

  it('contient le frontmatter YAML avec les champs triage', async () => {
    const actions = await handleAClassifier(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('---');
    expect(content).toContain('source: gmail');
    expect(content).toContain('triage_intent: proposition_service');
    expect(content).toContain('triage_confidence: 0.4');
    expect(content).toContain('date: 2026-05-13');
  });

  it('inclut le from avec nom et email dans le contenu', async () => {
    const actions = await handleAClassifier(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('Jean Inconnu <inconnu@example.com>');
  });

  it('slugifie les caractères interdits et accents dans le nom de fichier', async () => {
    const email = makeEmail({ subject: 'Re: Offre "spéciale" <urgent>' });
    const actions = await handleAClassifier(makeTriage(), email);

    const target = actions[0]!.target as string;
    expect(target).not.toContain('<');
    expect(target).not.toContain('>');
    expect(target).not.toContain('"');
    // slugifyVaultFilename retire accents : spéciale → speciale
    expect(target).toContain('Re Offre speciale urgent');
  });

  it('utilise "sans-objet" si le sujet est vide', async () => {
    const email = makeEmail({ subject: '' });
    const actions = await handleAClassifier(makeTriage(), email);

    const target = actions[0]!.target as string;
    expect(target).toContain('sans-objet');
  });

  it('tronque le corps à 1000 caractères avec indicateur [... tronqué]', async () => {
    const longBody = 'A'.repeat(2000);
    const email = makeEmail({ bodyPlain: longBody });
    const actions = await handleAClassifier(makeTriage(), email);
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('[... tronqué]');
    // Le preview est de 1000 chars, pas le body complet
    expect(content).not.toContain('A'.repeat(2000));
  });

  it('ne tronque pas si le corps fait moins de 1000 caractères', async () => {
    const shortBody = 'Corps court de test.';
    const email = makeEmail({ bodyPlain: shortBody });
    const actions = await handleAClassifier(makeTriage(), email);
    const content = actions[0]!.payload.content as string;

    expect(content).not.toContain('[... tronqué]');
    expect(content).toContain(shortBody);
  });

  it('mark_processed contient le messageId de l\'email', async () => {
    const email = makeEmail({ id: 'msg_specific_123' });
    const actions = await handleAClassifier(makeTriage(), email);

    const markProcessed = actions[1]!;
    expect(markProcessed.type).toBe('mark_processed');
    expect(markProcessed.payload.messageId).toBe('msg_specific_123');
    expect(markProcessed.target).toBeNull();
  });

  it('slugifie le sujet à max 80 caractères dans le nom de fichier', async () => {
    const longSubject = 'A'.repeat(100);
    const email = makeEmail({ subject: longSubject });
    const actions = await handleAClassifier(makeTriage(), email);

    const target = actions[0]!.target as string;
    const filename = target.split('/').pop()!;
    // "2026-05-13 — " (prefix) + slugified subject (max 80) + ".md" (3)
    // slugifyVaultFilename truncates to 80, so subject part ≤ 80
    const parts = filename.replace('.md', '').split(` ${EM_DASH} `);
    expect(parts[1]!.length).toBeLessThanOrEqual(80);
  });

  it('inclut la référence email Gmail dans le résumé triage', async () => {
    const triage = makeTriage({ summary: 'Résumé test spécifique.' });
    const email = makeEmail({ id: 'msg_gmail_ref_test' });
    const actions = await handleAClassifier(triage, email);
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('Résumé test spécifique.');
    expect(content).toContain('(cf. thread Gmail msg_gmail_ref_test)');
  });

  it('inclut le lien rawRef dans le contenu', async () => {
    const email = makeEmail({ rawRef: 'https://mail.google.com/special' });
    const actions = await handleAClassifier(makeTriage(), email);
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('https://mail.google.com/special');
  });

  it('utilise le from.email seul si from.name est absent', async () => {
    const email = makeEmail({
      from: { email: 'noname@example.com' },
    });
    const actions = await handleAClassifier(makeTriage(), email);
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('from: "noname@example.com"');
    expect(content).toContain('**De** : noname@example.com');
  });
});
