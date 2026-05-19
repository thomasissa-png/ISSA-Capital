/**
 * Tests unitaires — ical-feed-reunions.ts (S18.3a)
 *
 * Couvre : parseReunionFile, generateICalFromReunions, listVaultReunions,
 * helpers d'échappement RFC 5545, deep-link Obsidian, UTF-8.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks vault-reader (avant import du module testé)
// ============================================================

const mockListVaultFolder = vi.fn();
const mockReadVaultFile = vi.fn();

vi.mock('../../vault-reader', () => ({
  listVaultFolder: (...args: unknown[]) => mockListVaultFolder(...args),
  readVaultFile: (...args: unknown[]) => mockReadVaultFile(...args),
}));

import {
  parseReunionFile,
  generateICalFromReunions,
  listVaultReunions,
  escapeICalText,
  _internals,
  type VaultReunion,
} from '../ical-feed-reunions';

// ============================================================
// Fixtures
// ============================================================

function fmFile(opts: {
  date?: string;
  title?: string;
  heure?: string;
  duree?: number;
  participants?: string[];
  lieu?: string;
  categorie?: string;
  tags?: string[];
  body?: string;
}): string {
  const lines: string[] = ['---'];
  if (opts.date !== undefined) lines.push(`date: ${opts.date}`);
  if (opts.title !== undefined) lines.push(`title: ${opts.title}`);
  if (opts.heure !== undefined) lines.push(`heure: ${opts.heure}`);
  if (opts.duree !== undefined) lines.push(`duree: ${opts.duree}`);
  if (opts.lieu !== undefined) lines.push(`lieu: ${opts.lieu}`);
  if (opts.categorie !== undefined) lines.push(`categorie: ${opts.categorie}`);
  if (opts.participants !== undefined) {
    lines.push('participants:');
    for (const p of opts.participants) lines.push(`  - ${p}`);
  }
  if (opts.tags !== undefined) {
    lines.push('tags:');
    for (const t of opts.tags) lines.push(`  - ${t}`);
  }
  lines.push('---');
  lines.push(opts.body ?? '');
  return lines.join('\n');
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// parseReunionFile
// ============================================================

describe('parseReunionFile', () => {
  it('parse frontmatter date YYYY-MM-DD valide → VaultReunion correct', () => {
    const content = fmFile({
      date: '2026-05-12',
      title: 'Thomas Maxime - Point Versi',
      participants: ['Thomas Issa', 'Maxime Dupont'],
    });
    const r = parseReunionFile(
      '2026-05-12 - Thomas Maxime.md',
      content,
      '06. Réunions/2026/05/2026-05-12 - Thomas Maxime.md',
    );
    expect(r).not.toBeNull();
    expect(r!.date).toBe('2026-05-12');
    expect(r!.title).toBe('Thomas Maxime - Point Versi');
    expect(r!.participants).toEqual(['Thomas Issa', 'Maxime Dupont']);
  });

  it('utilise nom de fichier comme titre si frontmatter title absent', () => {
    const content = fmFile({ date: '2026-04-01' });
    const r = parseReunionFile(
      '2026-04-01 - Reunion sans title.md',
      content,
      '06. Réunions/2026/04/2026-04-01 - Reunion sans title.md',
    );
    expect(r).not.toBeNull();
    expect(r!.title).toBe('2026-04-01 - Reunion sans title');
  });

  it('skip si date manquante', () => {
    const content = fmFile({ title: 'Sans date' });
    const r = parseReunionFile(
      'sans-date.md',
      content,
      '06. Réunions/2026/05/sans-date.md',
    );
    expect(r).toBeNull();
  });

  it('skip si date format invalide', () => {
    const content = fmFile({ date: '12/05/2026' });
    const r = parseReunionFile('x.md', content, '06. Réunions/2026/05/x.md');
    expect(r).toBeNull();
  });

  it('skip si tag #hide-tcw présent', () => {
    const content = fmFile({
      date: '2026-05-12',
      title: 'Secrète',
      tags: ['#hide-tcw'],
    });
    const r = parseReunionFile('s.md', content, '06. Réunions/2026/05/s.md');
    expect(r).toBeNull();
  });

  it('skip si tag hide-tcw (sans #) présent', () => {
    const content = fmFile({
      date: '2026-05-12',
      title: 'Secrète 2',
      tags: ['hide-tcw'],
    });
    const r = parseReunionFile('s2.md', content, '06. Réunions/2026/05/s2.md');
    expect(r).toBeNull();
  });

  it('parse heure HH:MM correctement', () => {
    const content = fmFile({ date: '2026-05-12', heure: '14:30', duree: 90 });
    const r = parseReunionFile('h.md', content, '06. Réunions/2026/05/h.md');
    expect(r!.startTime).toBe('14:30');
    expect(r!.duration).toBe(90);
  });

  it('pad heure 9:00 → 09:00', () => {
    const content = fmFile({ date: '2026-05-12', heure: '9:00' });
    const r = parseReunionFile('h.md', content, '06. Réunions/2026/05/h.md');
    expect(r!.startTime).toBe('09:00');
  });

  it('startTime undefined si heure invalide', () => {
    const content = fmFile({ date: '2026-05-12', heure: 'invalid' });
    const r = parseReunionFile('h.md', content, '06. Réunions/2026/05/h.md');
    expect(r!.startTime).toBeUndefined();
  });

  it('préserve UTF-8 dans titre et lieu (accents)', () => {
    const content = fmFile({
      date: '2026-05-12',
      title: 'Réunion à Nanterre',
      lieu: 'Café Hélène — 54 rue Henri Barbusse',
    });
    const r = parseReunionFile(
      'r.md',
      content,
      '06. Réunions/2026/05/r.md',
    );
    expect(r!.title).toBe('Réunion à Nanterre');
    expect(r!.lieu).toBe('Café Hélène — 54 rue Henri Barbusse');
  });

  it('extrait description du body (max 200 chars)', () => {
    const content = fmFile({
      date: '2026-05-12',
      body: 'Première ligne importante.\nDeuxième ligne.\n## Heading skipped\nTroisième.',
    });
    const r = parseReunionFile('r.md', content, '06. Réunions/2026/05/r.md');
    expect(r!.description).toContain('Première ligne importante');
    expect(r!.description).not.toContain('Heading skipped');
  });

  it('UID stable (même path → même hash)', () => {
    const content = fmFile({ date: '2026-05-12' });
    const r1 = parseReunionFile('x.md', content, '06. Réunions/2026/05/x.md');
    const r2 = parseReunionFile('x.md', content, '06. Réunions/2026/05/x.md');
    expect(r1!.uid).toBe(r2!.uid);
    expect(r1!.uid).toMatch(/^[0-9a-f]{8}$/);
  });

  it('UID différent pour chemins différents', () => {
    const content = fmFile({ date: '2026-05-12' });
    const r1 = parseReunionFile('a.md', content, '06. Réunions/2026/05/a.md');
    const r2 = parseReunionFile('b.md', content, '06. Réunions/2026/05/b.md');
    expect(r1!.uid).not.toBe(r2!.uid);
  });

  it('catégorie depuis frontmatter `categorie`', () => {
    const content = fmFile({ date: '2026-05-12', categorie: 'visite' });
    const r = parseReunionFile('v.md', content, '06. Réunions/2026/05/v.md');
    expect(r!.categorie).toBe('visite');
  });
});

// ============================================================
// escapeICalText (RFC 5545)
// ============================================================

describe('escapeICalText', () => {
  it('échappe les virgules', () => {
    expect(escapeICalText('Thomas, Maxime')).toBe('Thomas\\, Maxime');
  });

  it('échappe les points-virgules', () => {
    expect(escapeICalText('a;b')).toBe('a\\;b');
  });

  it('échappe les backslashes (en premier)', () => {
    expect(escapeICalText('a\\b')).toBe('a\\\\b');
  });

  it('échappe les retours ligne en \\n littéral', () => {
    expect(escapeICalText('ligne1\nligne2')).toBe('ligne1\\nligne2');
  });

  it('échappe \\r\\n en un seul \\n', () => {
    expect(escapeICalText('a\r\nb')).toBe('a\\nb');
  });

  it('préserve les accents UTF-8', () => {
    expect(escapeICalText('Café Hélène')).toBe('Café Hélène');
  });

  it('combo : backslash + virgule + newline', () => {
    expect(escapeICalText('a\\b,c\nd')).toBe('a\\\\b\\,c\\nd');
  });
});

// ============================================================
// generateICalFromReunions
// ============================================================

describe('generateICalFromReunions', () => {
  function mkR(over: Partial<VaultReunion> = {}): VaultReunion {
    return {
      uid: 'abc12345',
      title: 'Réunion test',
      date: '2026-05-12',
      participants: [],
      vaultPath: '06. Réunions/2026/05/test.md',
      ...over,
    };
  }

  it('génère VCALENDAR vide si aucune réunion', () => {
    const ical = generateICalFromReunions([]);
    expect(ical).toContain('BEGIN:VCALENDAR');
    expect(ical).toContain('END:VCALENDAR');
    expect(ical).not.toContain('BEGIN:VEVENT');
  });

  it('3 réunions → 3 VEVENT', () => {
    const ical = generateICalFromReunions([
      mkR({ uid: 'a', title: 'R1' }),
      mkR({ uid: 'b', title: 'R2' }),
      mkR({ uid: 'c', title: 'R3' }),
    ]);
    const events = ical.split('BEGIN:VEVENT').length - 1;
    expect(events).toBe(3);
  });

  it('all-day event si pas de startTime (DTSTART;VALUE=DATE)', () => {
    const ical = generateICalFromReunions([mkR({ date: '2026-05-12' })]);
    expect(ical).toContain('DTSTART;VALUE=DATE:20260512');
    expect(ical).toContain('DTEND;VALUE=DATE:20260513');
  });

  it('timed event si startTime présent', () => {
    const ical = generateICalFromReunions([
      mkR({ date: '2026-05-12', startTime: '14:30', duration: 60 }),
    ]);
    expect(ical).toContain('DTSTART:20260512T143000');
    expect(ical).toContain('DTEND:20260512T153000');
  });

  it('duration par défaut 60min si startTime sans duration', () => {
    const ical = generateICalFromReunions([
      mkR({ date: '2026-05-12', startTime: '10:00' }),
    ]);
    expect(ical).toContain('DTSTART:20260512T100000');
    expect(ical).toContain('DTEND:20260512T110000');
  });

  it('échappe les virgules dans SUMMARY', () => {
    const ical = generateICalFromReunions([
      mkR({ title: 'Thomas, Maxime, Versi' }),
    ]);
    expect(ical).toContain('SUMMARY:Thomas\\, Maxime\\, Versi');
  });

  it('inclut deep-link Obsidian encodé dans DESCRIPTION', () => {
    const ical = generateICalFromReunions([
      mkR({ vaultPath: '06. Réunions/2026/05/x.md' }),
    ]);
    expect(ical).toContain('obsidian://open?vault=00.%20Me&file=');
    expect(ical).toContain('06.%20R%C3%A9unions');
  });

  it('inclut LOCATION si lieu présent', () => {
    const ical = generateICalFromReunions([mkR({ lieu: 'Nanterre' })]);
    expect(ical).toContain('LOCATION:Nanterre');
  });

  it('inclut CATEGORIES si categorie présente', () => {
    const ical = generateICalFromReunions([mkR({ categorie: 'reunion' })]);
    expect(ical).toContain('CATEGORIES:reunion');
  });

  it('inclut participants dans DESCRIPTION', () => {
    const ical = generateICalFromReunions([
      mkR({ participants: ['Thomas', 'Maxime'] }),
    ]);
    expect(ical).toMatch(/Participants: Thomas\\, Maxime/);
  });

  it('PRODID conforme spec §1', () => {
    const ical = generateICalFromReunions([]);
    expect(ical).toContain('PRODID:-//Anya//Thomas Issa//FR');
  });

  it('UID iCal au format <uid>@anya.thomas-issa', () => {
    const ical = generateICalFromReunions([mkR({ uid: 'deadbeef' })]);
    expect(ical).toContain('UID:deadbeef@anya.thomas-issa');
  });

  it('CRLF séparateurs (RFC 5545)', () => {
    const ical = generateICalFromReunions([mkR()]);
    expect(ical).toContain('\r\n');
  });

  it('ORGANIZER Thomas Issa présent', () => {
    const ical = generateICalFromReunions([mkR()]);
    expect(ical).toContain('ORGANIZER');
    expect(ical).toContain('Thomas Issa');
  });

  it('préserve UTF-8 dans le contenu généré', () => {
    const ical = generateICalFromReunions([
      mkR({ title: 'Café Hélène — Réunion', lieu: 'Nanterre' }),
    ]);
    expect(ical).toContain('Café Hélène');
  });
});

// ============================================================
// listVaultReunions (intégration avec vault-reader mocké)
// ============================================================

describe('listVaultReunions', () => {
  it('tri par date décroissante', async () => {
    // 2 années scannées * 12 mois = beaucoup d'appels. On répond [] sauf 2 dossiers.
    mockListVaultFolder.mockImplementation(async (p: string) => {
      if (p === '06. Réunions/2026/05') {
        return [{ id: 'f1', name: 'a.md' }];
      }
      if (p === '06. Réunions/2026/03') {
        return [{ id: 'f2', name: 'b.md' }];
      }
      return [];
    });
    mockReadVaultFile.mockImplementation(async (_folder: string, name: string) => {
      if (name === 'a.md') {
        return {
          success: true,
          content: fmFile({ date: '2026-05-12', title: 'Mai' }),
        };
      }
      if (name === 'b.md') {
        return {
          success: true,
          content: fmFile({ date: '2026-03-04', title: 'Mars' }),
        };
      }
      return { success: false };
    });

    const reunions = await listVaultReunions(new Date('2026-05-19'));
    expect(reunions).toHaveLength(2);
    expect(reunions[0]!.title).toBe('Mai');
    expect(reunions[1]!.title).toBe('Mars');
  });

  it('skip fichiers non .md', async () => {
    mockListVaultFolder.mockImplementation(async (p: string) => {
      if (p === '06. Réunions/2026/05') {
        return [
          { id: 'f1', name: 'image.png' },
          { id: 'f2', name: 'a.md' },
        ];
      }
      return [];
    });
    mockReadVaultFile.mockResolvedValue({
      success: true,
      content: fmFile({ date: '2026-05-12' }),
    });

    const reunions = await listVaultReunions(new Date('2026-05-19'));
    expect(reunions).toHaveLength(1);
  });

  it('tolère les erreurs de listing dossier', async () => {
    mockListVaultFolder.mockRejectedValue(new Error('Drive down'));
    const reunions = await listVaultReunions(new Date('2026-05-19'));
    expect(reunions).toEqual([]);
  });

  it('skip fichier avec content vide ou erreur', async () => {
    mockListVaultFolder.mockImplementation(async (p: string) => {
      if (p === '06. Réunions/2026/05') {
        return [
          { id: 'f1', name: 'a.md' },
          { id: 'f2', name: 'b.md' },
        ];
      }
      return [];
    });
    mockReadVaultFile.mockImplementation(async (_folder: string, name: string) => {
      if (name === 'a.md') return { success: false };
      if (name === 'b.md')
        return {
          success: true,
          content: fmFile({ date: '2026-05-12', title: 'OK' }),
        };
      return { success: false };
    });

    const reunions = await listVaultReunions(new Date('2026-05-19'));
    expect(reunions).toHaveLength(1);
    expect(reunions[0]!.title).toBe('OK');
  });
});

// ============================================================
// Internals (helpers)
// ============================================================

describe('_internals', () => {
  it('addDays gère les changements de mois', () => {
    expect(_internals.addDays('2026-05-31', 1)).toBe('2026-06-01');
  });

  it('addDays gère les années bissextiles', () => {
    expect(_internals.addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('obsidianEncode préserve les /', () => {
    expect(_internals.obsidianEncode('06. Réunions/2026/05/x.md')).toContain('/');
    expect(_internals.obsidianEncode('06. Réunions/2026/05/x.md')).not.toContain('%2F');
  });

  it('hashPath retourne 8 chars hex', () => {
    const h = _internals.hashPath('test/path/file.md');
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
});
