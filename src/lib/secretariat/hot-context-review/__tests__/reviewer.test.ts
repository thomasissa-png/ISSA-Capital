import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockReadFileById = vi.fn();
const mockListRecent = vi.fn();
const mockGetAccessToken = vi.fn();
const mockParisParts = vi.fn();
const mockCollectCalendar = vi.fn();
const mockWriteAudit = vi.fn();
const mockCallAnthropic = vi.fn();
const mockCallLLM = vi.fn();
const mockSendTelegram = vi.fn();

vi.mock('../../vault-client/obsidian-file', () => ({
  readFile: (...a: unknown[]) => mockReadFile(...a),
  writeFile: (...a: unknown[]) => mockWriteFile(...a),
  readFileById: (...a: unknown[]) => mockReadFileById(...a),
}));
vi.mock('../../vault-client/drive-resolver', () => ({
  listRecentlyModifiedFiles: (...a: unknown[]) => mockListRecent(...a),
}));
vi.mock('../../drive-upload', () => ({ getAccessToken: (...a: unknown[]) => mockGetAccessToken(...a) }));
vi.mock('../../hot-context/applier', () => ({ HOT_CONTEXT_FOLDER: '', HOT_CONTEXT_FILENAME: 'hot-context.md' }));
vi.mock('../../hot-context-staleness/staleness', () => ({
  parisParts: (...a: unknown[]) => mockParisParts(...a),
  bumpFrontmatter: (content: string) => content, // passthrough
}));
vi.mock('../../morning-brief/collect-calendar', () => ({
  collectCalendar: (...a: unknown[]) => mockCollectCalendar(...a),
}));
vi.mock('../../vault-client/audit-log', () => ({ writeAuditLog: (...a: unknown[]) => mockWriteAudit(...a) }));
vi.mock('../../llm/client', () => ({
  callAnthropic: (...a: unknown[]) => mockCallAnthropic(...a),
  callLLM: (...a: unknown[]) => mockCallLLM(...a),
}));
vi.mock('../../telegram', () => ({ sendTelegramMessage: (...a: unknown[]) => mockSendTelegram(...a) }));

import { runReview } from '../reviewer';

const HOT_CONTEXT = [
  '---',
  'semaine: 2026-W21',
  'date_mise_a_jour: 2026-05-25',
  '---',
  '',
  '# Hot Context — Semaine du 19 mai',
  '',
  '## Je bouge sur',
  '- truc',
  '',
  '## Maintenance',
  '- zone Thomas (immuable)',
  '',
].join('\n');

const GOOD_EDITABLE = '# Hot Context — Semaine du 26 mai\n\n## Je bouge sur\n- nouveau truc\n';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_CHAT_ID_THOMAS = '42';
  delete process.env.HOT_CONTEXT_REVIEW_MODEL_DEEP;
  mockReadFile.mockImplementation((folder: string, filename: string) => {
    if (filename === 'hot-context.md') return Promise.resolve({ success: true, content: HOT_CONTEXT });
    if (folder.includes('Profil')) return Promise.resolve({ success: true, content: '---\n---\nThomas : long-terme, famille, patrimoine.' });
    if (filename.endsWith('.jsonl')) return Promise.resolve({ success: true, content: '{"trigger":"email","payload":{"subject":"Test"}}' });
    return Promise.resolve({ success: false });
  });
  mockWriteFile.mockResolvedValue({ success: true });
  mockReadFileById.mockResolvedValue({ success: true, content: '---\n---\nContenu de fiche enrichie cette semaine.' });
  mockListRecent.mockResolvedValue([{ id: 'f1', name: 'Marc Gernot.md', modifiedTime: '2026-05-26T10:00:00Z' }]);
  mockGetAccessToken.mockResolvedValue('tok');
  mockCollectCalendar.mockResolvedValue({ events: [] });
  mockWriteAudit.mockResolvedValue(undefined);
  mockSendTelegram.mockResolvedValue({ success: true });
  mockCallAnthropic.mockResolvedValue({ text: JSON.stringify({ editable: GOOD_EDITABLE, changes: ['maj'] }) });
  mockCallLLM.mockResolvedValue({ text: JSON.stringify({ editable: GOOD_EDITABLE, changes: ['maj'] }) });
});

describe('runReview — fenêtre horaire', () => {
  it('hors 22h Paris (sans force) → ne procède pas', async () => {
    mockParisParts.mockReturnValue({ dateStr: '2026-05-26', isoWeekStr: '2026-W22', weekday: 2, hour: 15 });
    const r = await runReview();
    expect(r.proceeded).toBe(false);
    expect(mockCallAnthropic).not.toHaveBeenCalled();
    expect(mockCallLLM).not.toHaveBeenCalled();
  });
});

describe('runReview — mode léger (semaine, DeepSeek)', () => {
  it('mardi → light : DeepSeek (task hot-context-review-light), pas de fiches/profil, écrit', async () => {
    mockParisParts.mockReturnValue({ dateStr: '2026-05-26', isoWeekStr: '2026-W22', weekday: 2, hour: 22 });
    const r = await runReview();
    expect(r.mode).toBe('light');
    expect(r.written).toBe(true);
    // Léger = DeepSeek via callLLM, pas Anthropic, pas de relecture.
    expect(mockCallLLM).toHaveBeenCalledTimes(1);
    expect(mockCallLLM.mock.calls[0]![0].task).toBe('hot-context-review-light');
    expect(mockCallAnthropic).not.toHaveBeenCalled();
    expect(mockListRecent).not.toHaveBeenCalled(); // pas de fiches en light
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile.mock.calls[0]![2] as string).toContain('## Maintenance');
  });

  it('DeepSeek renvoie editable avec frontmatter/fences parasites → nettoyé et écrit', async () => {
    mockParisParts.mockReturnValue({ dateStr: '2026-05-26', isoWeekStr: '2026-W22', weekday: 2, hour: 22 });
    // DeepSeek emballe : bloc ```json + frontmatter en tête de l'editable.
    mockCallLLM.mockResolvedValue({
      text: '```json\n' + JSON.stringify({ editable: `---\nsemaine: 2026-W22\n---\n${GOOD_EDITABLE}`, changes: ['maj'] }) + '\n```',
    });
    const r = await runReview();
    expect(r.written).toBe(true);
    const written = mockWriteFile.mock.calls[0]![2] as string;
    // Le frontmatter parasite a été retiré (un seul frontmatter, celui d'origine).
    expect(written).toContain('# Hot Context');
    expect(written).toContain('## Maintenance');
  });
});

describe('runReview — mode profond (dimanche, Sonnet)', () => {
  it('dimanche → deep : Sonnet, lit profil + fiches semaine, relecture OK, écrit', async () => {
    mockParisParts.mockReturnValue({ dateStr: '2026-05-31', isoWeekStr: '2026-W22', weekday: 0, hour: 22 });
    // 1er appel = réécriture ; 2e = relecture (ok).
    mockCallAnthropic
      .mockResolvedValueOnce({ text: JSON.stringify({ editable: GOOD_EDITABLE, changes: ['maj', 'Oubli rattrapé : RDV X'] }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ ok: true, issues: [], corrected: null }) });

    const r = await runReview();
    expect(r.mode).toBe('deep');
    expect(r.written).toBe(true);
    expect(mockCallAnthropic).toHaveBeenCalledTimes(2); // réécriture + relecture
    expect(mockCallAnthropic.mock.calls[0]![0].family).toBe('sonnet');
    expect(mockListRecent).toHaveBeenCalledTimes(1); // relecture des fiches de la semaine
    expect(r.changes.some((c) => c.includes('Relecture OK'))).toBe(true);
  });

  it('deep : relecture KO sans correction valide → n’écrit pas + alerte', async () => {
    mockParisParts.mockReturnValue({ dateStr: '2026-05-31', isoWeekStr: '2026-W22', weekday: 0, hour: 22 });
    mockCallAnthropic
      .mockResolvedValueOnce({ text: JSON.stringify({ editable: GOOD_EDITABLE, changes: ['maj'] }) })
      .mockResolvedValueOnce({ text: JSON.stringify({ ok: false, issues: ['a inventé un RDV'], corrected: null }) });

    const r = await runReview();
    expect(r.written).toBe(false);
    expect(r.reason).toBe('relecture KO');
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockSendTelegram).toHaveBeenCalled();
  });
});

describe('runReview — garde-fou sortie invalide', () => {
  it('zone éditable invalide → n’écrit pas', async () => {
    mockParisParts.mockReturnValue({ dateStr: '2026-05-26', isoWeekStr: '2026-W22', weekday: 2, hour: 22 });
    // mardi = light → c'est callLLM (DeepSeek) qui produit la sortie.
    mockCallLLM.mockResolvedValue({ text: JSON.stringify({ editable: 'trop court', changes: [] }) });
    const r = await runReview();
    expect(r.written).toBe(false);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});
