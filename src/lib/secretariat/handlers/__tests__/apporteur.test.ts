/**
 * Tests unitaires — handler apporteur.
 *
 * Vérifie :
 * - Extraction regex : adresse, prix, surface, rendement
 * - Création fichier stub dans VAULT_PATHS.opportunitesApporteurs
 * - Nom du stub slugifié avec date + adresse courte
 * - Stub sans adresse → "Bien a identifier" (slugified)
 * - Infos manquantes (adresse ou prix) → add_todo
 * - Infos complètes → pas d'add_todo
 * - Contenu du frontmatter (statut, source, apporteur, etc.)
 * - Section Historique avec em-dash + ref Gmail
 * - mark_processed en dernière position
 * - Extraction patterns variés (150k €, 850k €, 7.5%, 85 m²)
 *
 * Fix Jalon 4D-1 : path corrigé + slugify + em-dash + ref email.
 */

import { describe, it, expect } from 'vitest';
import { handleApporteur, extractBienInfos } from '../apporteur';
import { VAULT_PATHS } from '../vault-paths';
import type { TriageResult } from '../../triage/types';
import type { EmailMessage } from '../../gmail-source/types';

// ============================================================
// Fixtures
// ============================================================

function makeEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    source: 'gmail',
    id: 'msg_apport_001',
    from: { email: 'carl@apporteur.com', name: 'Carl Delacroix' },
    to: [{ email: 'thomas@issacapital.com' }],
    cc: [],
    subject: 'Nouvelle opportunité - Immeuble Lyon 3',
    bodyPlain: [
      'Bonjour Thomas,',
      '',
      'Je te propose un immeuble intéressant :',
      'Adresse : 15 rue de la République, 69003 Lyon',
      'Prix : 850k €',
      'Surface : 320 m²',
      'Rendement brut : 7,5 %',
      '',
      'Cordialement,',
      'Carl',
    ].join('\n'),
    receivedAt: new Date('2026-05-13T16:00:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg_apport_001',
    ...overrides,
  };
}

function makeTriage(overrides: Partial<TriageResult> = {}): TriageResult {
  return {
    category: 'apporteur',
    intent: 'proposition_bien',
    confidence: 0.88,
    matchedContact: null,
    summary: 'Proposition d\'immeuble à Lyon 3, 850k€, 320m², rendement 7,5%.',
    suggestedActions: [],
    ...overrides,
  };
}

// ============================================================
// Tests — extractBienInfos (fonction exportée)
// ============================================================

describe('extractBienInfos', () => {
  it('extrait l\'adresse depuis une ligne avec mot-clé "adresse"', () => {
    const body = 'Bonjour\nAdresse : 15 rue de la République, 69003 Lyon\nCordialement';
    const infos = extractBienInfos(body);
    expect(infos.adresse).toBe('15 rue de la République, 69003 Lyon');
  });

  it('extrait l\'adresse depuis une ligne avec mot-clé "rue"', () => {
    const body = 'Le bien est au 42 rue Victor Hugo 75016 Paris';
    const infos = extractBienInfos(body);
    expect(infos.adresse).toContain('rue Victor Hugo');
  });

  it('extrait l\'adresse depuis une ligne avec code postal 5 chiffres', () => {
    const body = 'Bonjour\n12 allée des Tilleuls 33000 Bordeaux\nMerci';
    const infos = extractBienInfos(body);
    expect(infos.adresse).toContain('33000 Bordeaux');
  });

  it('extrait le prix au format 150k €', () => {
    const body = 'C\'est proposé à 150k €';
    const infos = extractBienInfos(body);
    expect(infos.prix).toBe('150k €');
  });

  it('extrait le prix au format 850k €', () => {
    const body = 'Prix demandé : 850k €';
    const infos = extractBienInfos(body);
    expect(infos.prix).toBe('850k €');
  });

  it('extrait le prix au format 1200k €', () => {
    const body = 'Prix : 1200k €';
    const infos = extractBienInfos(body);
    expect(infos.prix).toBe('1200k €');
  });

  it('extrait le prix au format millions (150 000 000 €)', () => {
    const body = 'Prix : 150 000 000 €';
    const infos = extractBienInfos(body);
    expect(infos.prix).toBe('150 000 000 €');
  });

  it('ne matche pas un prix à 6 chiffres avec espaces (limité au pattern regex)', () => {
    const body = 'Prix demandé : 850 000 €';
    const infos = extractBienInfos(body);
    expect(infos.prix).toBeNull();
  });

  it('extrait la surface au format 320 m²', () => {
    const body = 'Surface totale : 320 m²';
    const infos = extractBienInfos(body);
    expect(infos.surface).toBe('320 m²');
  });

  it('extrait la surface au format 85m2', () => {
    const body = 'Appartement de 85m2 environ';
    const infos = extractBienInfos(body);
    expect(infos.surface).toBe('85m2');
  });

  it('extrait le rendement au format 7,5 %', () => {
    const body = 'Rendement brut : 7,5 %';
    const infos = extractBienInfos(body);
    expect(infos.rendement).toBe('7,5 %');
  });

  it('extrait le rendement au format 8.2%', () => {
    const body = 'Rendement estimé à 8.2%';
    const infos = extractBienInfos(body);
    expect(infos.rendement).toBe('8.2%');
  });

  it('retourne null pour chaque champ si aucun pattern ne matche', () => {
    const body = 'Bonjour, je vous contacte pour un projet intéressant. Rappellez-moi.';
    const infos = extractBienInfos(body);
    expect(infos.adresse).toBeNull();
    expect(infos.prix).toBeNull();
    expect(infos.surface).toBeNull();
    expect(infos.rendement).toBeNull();
  });
});

// ============================================================
// Tests — handleApporteur
// ============================================================

describe('handleApporteur', () => {
  it('crée le fichier stub dans VAULT_PATHS.opportunitesApporteurs', async () => {
    const actions = await handleApporteur(makeTriage(), makeEmail());

    expect(actions[0]!.type).toBe('create_file');
    expect(actions[0]!.target).toContain(VAULT_PATHS.opportunitesApporteurs);
    expect(actions[0]!.target).toContain('02. Projets/01. Perso/Immobilier Direct/Opportunités');
    expect(actions[0]!.target).not.toContain('Pipeline');
  });

  it('nom du stub contient la date et l\'adresse courte (slugified)', async () => {
    const actions = await handleApporteur(makeTriage(), makeEmail());
    const target = actions[0]!.target as string;

    expect(target).toContain('2026-05-13');
    expect(target).toContain('rue de la Republique');
  });

  it('utilise "Bien a identifier" si pas d\'adresse (slugified)', async () => {
    const email = makeEmail({
      bodyPlain: 'Bonjour, j\'ai un bien intéressant pour vous. Appelez-moi.',
    });
    const actions = await handleApporteur(makeTriage(), email);
    const target = actions[0]!.target as string;

    expect(target).toContain('Bien a identifier');
  });

  it('pas d\'add_todo si adresse ET prix sont présents', async () => {
    const actions = await handleApporteur(makeTriage(), makeEmail());
    const types = actions.map((a) => a.type);

    expect(types).not.toContain('add_todo');
  });

  it('add_todo si adresse manquante', async () => {
    const email = makeEmail({
      bodyPlain: 'Prix : 500k €\nRendement : 6%',
    });
    const actions = await handleApporteur(makeTriage(), email);
    const todoAction = actions.find((a) => a.type === 'add_todo');

    expect(todoAction).toBeDefined();
    expect(todoAction!.payload.task).toContain('adresse');
  });

  it('add_todo si prix manquant', async () => {
    const email = makeEmail({
      bodyPlain: 'Adresse : 10 rue Pasteur 75015 Paris\nSurface : 120 m²',
    });
    const actions = await handleApporteur(makeTriage(), email);
    const todoAction = actions.find((a) => a.type === 'add_todo');

    expect(todoAction).toBeDefined();
    expect(todoAction!.payload.task).toContain('prix');
  });

  it('add_todo mentionne les deux champs si adresse ET prix manquants', async () => {
    const email = makeEmail({
      bodyPlain: 'J\'ai un bien très rentable, appelez-moi.',
    });
    const actions = await handleApporteur(makeTriage(), email);
    const todoAction = actions.find((a) => a.type === 'add_todo');

    expect(todoAction).toBeDefined();
    expect(todoAction!.payload.task).toContain('adresse');
    expect(todoAction!.payload.task).toContain('prix');
  });

  it('contenu du stub contient frontmatter avec statut, source, apporteur', async () => {
    const actions = await handleApporteur(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('statut: a qualifier');
    expect(content).toContain('source: email-ingest');
    expect(content).toContain('apporteur: "Carl Delacroix <carl@apporteur.com>"');
    expect(content).toContain('date_reception: 2026-05-13');
  });

  it('contenu du stub contient les informations clés extraites', async () => {
    const actions = await handleApporteur(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('## Informations clés');
    expect(content).toContain('850k €');
    expect(content).toContain('320 m²');
    expect(content).toContain('7,5 %');
  });

  it('contenu du stub contient une section Historique avec em-dash et ref Gmail', async () => {
    const actions = await handleApporteur(makeTriage(), makeEmail());
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('## Historique');
    expect(content).toContain('### 2026-05-13 — Réception opportunité');
    expect(content).toContain('—');
    expect(content).toContain('(cf. thread Gmail msg_apport_001)');
  });

  it('mark_processed est toujours la dernière action', async () => {
    const actions = await handleApporteur(makeTriage(), makeEmail());
    const last = actions[actions.length - 1]!;

    expect(last.type).toBe('mark_processed');
    expect(last.payload.messageId).toBe('msg_apport_001');
    expect(last.target).toBeNull();
  });

  it('utilise from.email seul si from.name est absent', async () => {
    const email = makeEmail({
      from: { email: 'noname@broker.com' },
    });
    const actions = await handleApporteur(makeTriage(), email);
    const content = actions[0]!.payload.content as string;

    expect(content).toContain('apporteur: "noname@broker.com"');
  });
});
