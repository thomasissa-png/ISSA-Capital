/**
 * Tests contact-enricher — enrichissement automatique fiches contacts.
 *
 * Mock findContactByEmail + appendToHistorique pour isoler la logique.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enrichContactsFromEvent,
  countEnriched,
  countNoContact,
} from '../contact-enricher';
import * as vaultClient from '../../vault-client';
import type { CalendarEvent } from '../types';

vi.mock('../../vault-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../vault-client')>();
  return {
    ...actual,
    findContactByEmail: vi.fn(),
    appendToHistorique: vi.fn(),
  };
});

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt_enrich_001',
    status: 'confirmed',
    htmlLink: 'https://calendar.google.com/event?eid=evt_enrich_001',
    updated: '2026-05-19T10:00:00Z',
    summary: 'Point Versi',
    startDateTime: '2026-05-22T14:00:00+02:00',
    endDateTime: '2026-05-22T15:00:00+02:00',
    attendees: [
      { email: 'thomas@issa-capital.com', self: true },
      { email: 'maxime@versi.com', displayName: 'Maxime Durand' },
    ],
    isAllDay: false,
    ...overrides,
  };
}

describe('enrichContactsFromEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enrichit la fiche d\'un contact existant', async () => {
    vi.mocked(vaultClient.findContactByEmail).mockResolvedValue({
      name: 'Maxime Durand',
      folderPath: '07. Contacts/02. Amis',
      emails: ['maxime@versi.com'],
      content: '---\nfile content\n---\n',
      fileId: 'file_abc',
    });
    vi.mocked(vaultClient.appendToHistorique).mockResolvedValue(true);

    const results = await enrichContactsFromEvent(
      makeEvent(),
      '2026-05-22',
      'Point Versi',
    );

    expect(results).toHaveLength(2);
    const enriched = results.find((r) => r.email === 'maxime@versi.com');
    expect(enriched?.status).toBe('enriched');
    expect(enriched?.contactPath).toBe('07. Contacts/02. Amis/Maxime Durand.md');

    expect(vaultClient.appendToHistorique).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(vaultClient.appendToHistorique).mock.calls[0];
    expect(callArgs![2].updateLastInteraction).toBe(true);
    expect(callArgs![2].title).toContain('2026-05-22');
    expect(callArgs![2].title).toContain('Point Versi');
  });

  it('skip Thomas (self)', async () => {
    vi.mocked(vaultClient.findContactByEmail).mockResolvedValue(null);

    const results = await enrichContactsFromEvent(
      makeEvent(),
      '2026-05-22',
      'Point Versi',
    );

    const selfResult = results.find((r) => r.email === 'thomas@issa-capital.com');
    expect(selfResult?.status).toBe('skipped-self');
    expect(vaultClient.findContactByEmail).not.toHaveBeenCalledWith(
      'thomas@issa-capital.com',
    );
  });

  it('skip emails système (resource.calendar.google.com)', async () => {
    const ev = makeEvent({
      attendees: [
        { email: 'thomas@i.com', self: true },
        { email: 'paris-room@resource.calendar.google.com' },
        { email: 'noreply@google.com' },
      ],
    });

    const results = await enrichContactsFromEvent(ev, '2026-05-22', 'Test');
    expect(
      results.find((r) => r.email === 'paris-room@resource.calendar.google.com')
        ?.status,
    ).toBe('skipped-system');
    expect(
      results.find((r) => r.email === 'noreply@google.com')?.status,
    ).toBe('skipped-system');
    expect(vaultClient.findContactByEmail).not.toHaveBeenCalled();
  });

  it('retourne no-contact si findContactByEmail null', async () => {
    vi.mocked(vaultClient.findContactByEmail).mockResolvedValue(null);

    const results = await enrichContactsFromEvent(
      makeEvent(),
      '2026-05-22',
      'Point Versi',
    );

    const maxResult = results.find((r) => r.email === 'maxime@versi.com');
    expect(maxResult?.status).toBe('no-contact');
    expect(vaultClient.appendToHistorique).not.toHaveBeenCalled();
  });

  it('marque error si appendToHistorique throw', async () => {
    vi.mocked(vaultClient.findContactByEmail).mockResolvedValue({
      name: 'Maxime Durand',
      folderPath: '07. Contacts/02. Amis',
      emails: ['maxime@versi.com'],
      content: '',
      fileId: 'file_abc',
    });
    vi.mocked(vaultClient.appendToHistorique).mockRejectedValue(
      new Error('Drive timeout'),
    );

    const results = await enrichContactsFromEvent(
      makeEvent(),
      '2026-05-22',
      'Point Versi',
    );
    const maxResult = results.find((r) => r.email === 'maxime@versi.com');
    expect(maxResult?.status).toBe('error');
    expect(maxResult?.error).toContain('Drive timeout');
  });

  it('enrichit plusieurs contacts en parallèle', async () => {
    const ev = makeEvent({
      attendees: [
        { email: 'thomas@i.com', self: true },
        { email: 'maxime@versi.com', displayName: 'Maxime Durand' },
        { email: 'leo@versi.com', displayName: 'Léo Martin' },
      ],
    });

    vi.mocked(vaultClient.findContactByEmail).mockImplementation(async (email) => {
      if (email === 'maxime@versi.com') {
        return {
          name: 'Maxime Durand',
          folderPath: '07. Contacts/02. Amis',
          emails: [email],
          content: '',
          fileId: 'fid_max',
        };
      }
      if (email === 'leo@versi.com') {
        return {
          name: 'Leo Martin',
          folderPath: '07. Contacts/03. Pro',
          emails: [email],
          content: '',
          fileId: 'fid_leo',
        };
      }
      return null;
    });
    vi.mocked(vaultClient.appendToHistorique).mockResolvedValue(true);

    const results = await enrichContactsFromEvent(ev, '2026-05-22', 'Point');
    expect(countEnriched(results)).toBe(2);
    expect(countNoContact(results)).toBe(0);
  });
});
