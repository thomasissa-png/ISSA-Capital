/**
 * Tests triage.ts — parsing réponse LLM + construction message + validation Zod.
 *
 * Les tests d'évaluation LLM (matrice de confusion) sont dans triage-eval.test.ts.
 * Ici on teste les fonctions pures sans appel API.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  parseTriageResponse,
  buildUserMessage,
  loadTriagePrompt,
  invalidatePromptCache,
} from '../triage';
import type { EmailMessage } from '../../gmail-source/types';
import type { KnownContact } from '../types';
import { triageResultSchema } from '../types';

describe('parseTriageResponse', () => {
  it('parse un JSON valide', () => {
    const json = JSON.stringify({
      category: 'locataire',
      intent: 'demande_quittance_avril',
      confidence: 0.95,
      matchedContact: 'Kenan Beguigneau',
      summary: 'Kenan demande sa quittance.',
      suggestedActions: [
        { type: 'append_historique', target: 'path/to/file.md', payload: {} },
      ],
    });

    const result = parseTriageResponse(json);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('locataire');
    expect(result!.confidence).toBe(0.95);
  });

  it('parse un JSON dans un bloc markdown', () => {
    const raw = '```json\n{"category":"spam","intent":"newsletter","confidence":0.99,"matchedContact":null,"summary":"Newsletter.","suggestedActions":[{"type":"skip","target":null,"payload":{}}]}\n```';

    const result = parseTriageResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('spam');
  });

  it('parse un JSON brut sans markdown', () => {
    const raw = '{"category":"contact-pro","intent":"facture","confidence":0.88,"matchedContact":"Martin Yhuel","summary":"Facture.","suggestedActions":[]}';

    const result = parseTriageResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('contact-pro');
  });

  it('retourne null pour une réponse vide', () => {
    expect(parseTriageResponse('')).toBeNull();
  });

  it('retourne null si pas de JSON', () => {
    expect(parseTriageResponse('Ceci est juste du texte')).toBeNull();
  });

  it('retourne null pour un JSON invalide (mauvaise structure)', () => {
    const result = parseTriageResponse('{"category":"locataire"}');
    expect(result).toBeNull();
  });

  it('override catégorie si confidence < 0.7', () => {
    const json = JSON.stringify({
      category: 'locataire',
      intent: 'demande_vague',
      confidence: 0.55,
      matchedContact: null,
      summary: 'Email vague.',
      suggestedActions: [],
    });

    const result = parseTriageResponse(json);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('a-classifier');
    expect(result!.confidence).toBe(0.55);
  });

  it('ne touche pas a-classifier même si confidence < 0.7', () => {
    const json = JSON.stringify({
      category: 'a-classifier',
      intent: 'inconnu',
      confidence: 0.3,
      matchedContact: null,
      summary: 'Inconnu.',
      suggestedActions: [],
    });

    const result = parseTriageResponse(json);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('a-classifier');
  });

  it('accepte confidence exactement 0.7 sans override', () => {
    const json = JSON.stringify({
      category: 'candidat',
      intent: 'candidature_logement',
      confidence: 0.7,
      matchedContact: null,
      summary: 'Candidature.',
      suggestedActions: [],
    });

    const result = parseTriageResponse(json);
    expect(result).not.toBeNull();
    expect(result!.category).toBe('candidat');
  });

  it('rejette confidence > 1', () => {
    const json = JSON.stringify({
      category: 'spam',
      intent: 'test',
      confidence: 1.5,
      matchedContact: null,
      summary: 'Test.',
      suggestedActions: [],
    });

    const result = parseTriageResponse(json);
    expect(result).toBeNull();
  });

  it('rejette confidence < 0', () => {
    const json = JSON.stringify({
      category: 'spam',
      intent: 'test',
      confidence: -0.1,
      matchedContact: null,
      summary: 'Test.',
      suggestedActions: [],
    });

    const result = parseTriageResponse(json);
    expect(result).toBeNull();
  });

  it('accepte les suggestedActions variées', () => {
    const json = JSON.stringify({
      category: 'locataire',
      intent: 'signalement_incident',
      confidence: 0.92,
      matchedContact: 'Kenan Beguigneau',
      summary: 'Signalement fuite.',
      suggestedActions: [
        { type: 'append_historique', target: 'path.md', payload: { section: 'test' } },
        { type: 'update_frontmatter', target: 'path.md', payload: { status: 'urgent' } },
        { type: 'add_todo', target: null, payload: { task: 'Appeler plombier' } },
      ],
    });

    const result = parseTriageResponse(json);
    expect(result).not.toBeNull();
    expect(result!.suggestedActions).toHaveLength(3);
  });

  it('rejette une catégorie invalide', () => {
    const json = JSON.stringify({
      category: 'invalide',
      intent: 'test',
      confidence: 0.9,
      matchedContact: null,
      summary: 'Test.',
      suggestedActions: [],
    });

    const result = parseTriageResponse(json);
    expect(result).toBeNull();
  });

  it('rejette un type d\'action invalide', () => {
    const json = JSON.stringify({
      category: 'spam',
      intent: 'test',
      confidence: 0.9,
      matchedContact: null,
      summary: 'Test.',
      suggestedActions: [{ type: 'invalid_type', target: null, payload: {} }],
    });

    const result = parseTriageResponse(json);
    expect(result).toBeNull();
  });
});

describe('buildUserMessage', () => {
  const baseEmail: EmailMessage = {
    source: 'gmail',
    id: 'msg-test-1',
    from: { email: 'test@example.com', name: 'Test User' },
    to: [{ email: 'thomas.issa@gmail.com' }],
    cc: [],
    subject: 'Test email',
    bodyPlain: 'Ceci est un email de test.',
    receivedAt: new Date('2026-05-12T10:00:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg-test-1',
  };

  it('construit un message avec les infos de base', () => {
    const msg = buildUserMessage(baseEmail, []);
    expect(msg).toContain('From: Test User <test@example.com>');
    expect(msg).toContain('Subject: Test email');
    expect(msg).toContain('Ceci est un email de test.');
  });

  it('inclut les locataires connus', () => {
    const contacts: KnownContact[] = [
      { name: 'Kenan Beguigneau', email: 'kbeguigneau@gmail.com', type: 'locataire' },
    ];
    const msg = buildUserMessage(baseEmail, contacts);
    expect(msg).toContain('## Locataires actuels');
    expect(msg).toContain('Kenan Beguigneau');
    expect(msg).toContain('kbeguigneau@gmail.com');
  });

  it('inclut les contacts pro connus', () => {
    const contacts: KnownContact[] = [
      { name: 'Martin Yhuel', email: 'martin@cabinet.law', type: 'pro' },
    ];
    const msg = buildUserMessage(baseEmail, contacts);
    expect(msg).toContain('## Contacts pro connus');
    expect(msg).toContain('Martin Yhuel');
  });

  it('sépare locataires et pros', () => {
    const contacts: KnownContact[] = [
      { name: 'Kenan', email: 'kenan@test.com', type: 'locataire' },
      { name: 'Martin', email: 'martin@test.com', type: 'pro' },
    ];
    const msg = buildUserMessage(baseEmail, contacts);
    expect(msg).toContain('## Locataires actuels');
    expect(msg).toContain('## Contacts pro connus');
  });

  it('n\'inclut pas de section contacts si vide', () => {
    const msg = buildUserMessage(baseEmail, []);
    expect(msg).not.toContain('## Locataires actuels');
    expect(msg).not.toContain('## Contacts pro connus');
  });

  it('inclut les CC si présents', () => {
    const emailWithCc = {
      ...baseEmail,
      cc: [{ email: 'cc@test.com' }],
    };
    const msg = buildUserMessage(emailWithCc, []);
    expect(msg).toContain('Cc: cc@test.com');
  });

  it('inclut les pièces jointes si présentes', () => {
    const emailWithAttach = {
      ...baseEmail,
      attachments: [
        { name: 'facture.pdf', mimeType: 'application/pdf', sizeBytes: 1234, id: 'att-1' },
      ],
    };
    const msg = buildUserMessage(emailWithAttach, []);
    expect(msg).toContain('Attachments:');
    expect(msg).toContain('facture.pdf');
  });

  it('tronque le body si > 3000 chars', () => {
    const longEmail = {
      ...baseEmail,
      bodyPlain: 'x'.repeat(5000),
    };
    const msg = buildUserMessage(longEmail, []);
    expect(msg).toContain('[... tronqué]');
    // Le body dans le message devrait être tronqué
    expect(msg.length).toBeLessThan(5500);
  });
});

describe('triageResultSchema (Zod)', () => {
  it('valide un résultat complet', () => {
    const result = triageResultSchema.safeParse({
      category: 'locataire',
      intent: 'demande_quittance',
      confidence: 0.95,
      matchedContact: 'Kenan',
      summary: 'Demande quittance.',
      suggestedActions: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejette intent vide', () => {
    const result = triageResultSchema.safeParse({
      category: 'spam',
      intent: '',
      confidence: 0.9,
      matchedContact: null,
      summary: 'Spam.',
      suggestedActions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejette summary vide', () => {
    const result = triageResultSchema.safeParse({
      category: 'spam',
      intent: 'newsletter',
      confidence: 0.9,
      matchedContact: null,
      summary: '',
      suggestedActions: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepte matchedContact null', () => {
    const result = triageResultSchema.safeParse({
      category: 'spam',
      intent: 'newsletter',
      confidence: 0.9,
      matchedContact: null,
      summary: 'Newsletter.',
      suggestedActions: [],
    });
    expect(result.success).toBe(true);
  });
});

describe('loadTriagePrompt', () => {
  afterEach(() => {
    invalidatePromptCache();
  });

  it('charge le prompt depuis le fichier', () => {
    const prompt = loadTriagePrompt();
    expect(prompt).toContain('Anya');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('contient les catégories requises', () => {
    const prompt = loadTriagePrompt();
    expect(prompt).toContain('locataire');
    expect(prompt).toContain('candidat');
    expect(prompt).toContain('contact-pro');
    expect(prompt).toContain('apporteur');
    expect(prompt).toContain('spam');
    expect(prompt).toContain('a-classifier');
  });

  it('contient les anti-patterns', () => {
    const prompt = loadTriagePrompt();
    expect(prompt).toContain('JAMAIS locataire');
    expect(prompt).toContain('Confiance honnête');
    expect(prompt).toContain('Zéro invention');
  });

  it('cache le résultat (pas de re-lecture)', () => {
    const p1 = loadTriagePrompt();
    const p2 = loadTriagePrompt();
    expect(p1).toBe(p2); // même référence = caché
  });
});
