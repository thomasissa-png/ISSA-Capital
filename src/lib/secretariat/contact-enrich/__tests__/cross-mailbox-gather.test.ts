import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGatherGmail = vi.fn();
const mockSearchOutlook = vi.fn();
const mockIsBoxConfigured = vi.fn();

vi.mock('../../gmail-source/contact-emails-gatherer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../gmail-source/contact-emails-gatherer')>();
  return {
    ...actual,
    gatherContactEmails: (...args: unknown[]) => mockGatherGmail(...args),
  };
});

vi.mock('../../outlook-source/outlook-client', () => ({
  OUTLOOK_BOXES: ['sarani', 'versi'] as const,
  isBoxConfigured: (...args: unknown[]) => mockIsBoxConfigured(...args),
  searchMessagesByAddress: (...args: unknown[]) => mockSearchOutlook(...args),
}));

import { gatherContactEmailsAllSources } from '../cross-mailbox-gather';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  mockGatherGmail.mockReset();
  mockSearchOutlook.mockReset();
  mockIsBoxConfigured.mockReset();
  process.env = { ...ORIGINAL_ENV };
  mockGatherGmail.mockResolvedValue({ emails: [], scanned: 0 });
  mockSearchOutlook.mockResolvedValue([]);
  mockIsBoxConfigured.mockReturnValue(false);
});
afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('gatherContactEmailsAllSources', () => {
  it('email invalide → vide', async () => {
    const r = await gatherContactEmailsAllSources('pas-un-email');
    expect(r.emails).toEqual([]);
    expect(r.sources).toEqual([]);
  });

  it('fusionne Gmail + Outlook, trie récent→ancien, marque les sources', async () => {
    mockGatherGmail.mockResolvedValue({
      emails: [{ date: '2026-05-10', subject: 'Gmail mail', excerpt: 'g', direction: 'from' }],
      scanned: 1,
    });
    mockIsBoxConfigured.mockImplementation((b: string) => b === 'sarani');
    mockSearchOutlook.mockResolvedValue([
      {
        id: '1',
        subject: 'Outlook plus récent',
        from: { emailAddress: { address: 'marc@exemple.com' } },
        receivedDateTime: '2026-05-20T10:00:00Z',
        body: { content: 'corps outlook' },
      },
    ]);

    const r = await gatherContactEmailsAllSources('marc@exemple.com');
    expect(r.sources).toContain('gmail');
    expect(r.sources).toContain('outlook:sarani');
    expect(r.emails).toHaveLength(2);
    expect(r.emails[0]!.subject).toBe('Outlook plus récent'); // tri récent d'abord
    expect(r.scanned).toBe(2);
  });

  it('respecte le cap ENRICH_MAX_EMAILS', async () => {
    process.env.ENRICH_MAX_EMAILS = '1';
    mockGatherGmail.mockResolvedValue({
      emails: [
        { date: '2026-05-10', subject: 'A', excerpt: 'a', direction: 'from' },
        { date: '2026-05-09', subject: 'B', excerpt: 'b', direction: 'from' },
      ],
      scanned: 2,
    });
    const r = await gatherContactEmailsAllSources('marc@exemple.com');
    expect(r.emails).toHaveLength(1);
  });

  it('dédup les doublons (même date|direction|sujet)', async () => {
    mockGatherGmail.mockResolvedValue({
      emails: [{ date: '2026-05-10', subject: 'Même fil', excerpt: 'g', direction: 'from' }],
      scanned: 1,
    });
    mockIsBoxConfigured.mockReturnValue(true);
    mockSearchOutlook.mockResolvedValue([
      {
        id: '1',
        subject: 'Même fil',
        from: { emailAddress: { address: 'marc@exemple.com' } },
        receivedDateTime: '2026-05-10T08:00:00Z',
        body: { content: 'x' },
      },
    ]);
    const r = await gatherContactEmailsAllSources('marc@exemple.com');
    expect(r.emails).toHaveLength(1);
  });

  it('source lente (timeout) → ignorée, pas de blocage', async () => {
    process.env.ENRICH_TIMEOUT_MS = '20';
    mockGatherGmail.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ emails: [{ date: '2026-05-10', subject: 'lent', excerpt: 'x', direction: 'from' }], scanned: 1 }), 200)),
    );
    const r = await gatherContactEmailsAllSources('marc@exemple.com');
    expect(r.emails).toEqual([]); // Gmail a timeout → ignoré
  });
});
