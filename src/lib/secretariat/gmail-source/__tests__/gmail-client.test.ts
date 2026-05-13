/**
 * Tests gmail-client.ts — extraction headers, body, attachments, address parsing.
 *
 * Mock de fetch pour simuler les réponses Gmail API.
 * Pas de mock getAccessToken() — on le laisse retourner null (tests purs).
 */

import { describe, it, expect } from 'vitest';
import {
  parseEmailAddress,
  parseEmailAddresses,
  getHeader,
  extractBodyPlain,
  extractAttachments,
  type GmailMessageRaw,
} from '../gmail-client';

// ============================================================
// parseEmailAddress
// ============================================================

describe('parseEmailAddress', () => {
  it('parse adresse simple', () => {
    const result = parseEmailAddress('test@example.com');
    expect(result).toEqual({ email: 'test@example.com' });
  });

  it('parse format "Nom <email>"', () => {
    const result = parseEmailAddress('Jean Dupont <jean@example.com>');
    expect(result).toEqual({ name: 'Jean Dupont', email: 'jean@example.com' });
  });

  it('parse format avec guillemets', () => {
    const result = parseEmailAddress('"Dupont, Jean" <jean@example.com>');
    expect(result).toEqual({ name: 'Dupont, Jean', email: 'jean@example.com' });
  });

  it('normalise email en lowercase', () => {
    const result = parseEmailAddress('TEST@EXAMPLE.COM');
    expect(result.email).toBe('test@example.com');
  });

  it('trim les espaces', () => {
    const result = parseEmailAddress('  test@example.com  ');
    expect(result.email).toBe('test@example.com');
  });
});

// ============================================================
// parseEmailAddresses
// ============================================================

describe('parseEmailAddresses', () => {
  it('retourne vide pour null', () => {
    expect(parseEmailAddresses(null)).toEqual([]);
  });

  it('retourne vide pour string vide', () => {
    expect(parseEmailAddresses('')).toEqual([]);
  });

  it('parse une seule adresse', () => {
    const result = parseEmailAddresses('test@example.com');
    expect(result).toHaveLength(1);
    expect(result[0]!.email).toBe('test@example.com');
  });

  it('parse plusieurs adresses', () => {
    const result = parseEmailAddresses('a@test.com, b@test.com');
    expect(result).toHaveLength(2);
    expect(result[0]!.email).toBe('a@test.com');
    expect(result[1]!.email).toBe('b@test.com');
  });

  it('parse mix nom + email', () => {
    const result = parseEmailAddresses(
      'Jean <jean@test.com>, Marie <marie@test.com>',
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe('Jean');
    expect(result[1]!.name).toBe('Marie');
  });

  it('gère les virgules dans les noms entre < >', () => {
    const result = parseEmailAddresses(
      '"Dupont, Jean" <jean@test.com>, Marie <marie@test.com>',
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.email).toBe('jean@test.com');
    expect(result[1]!.email).toBe('marie@test.com');
  });
});

// ============================================================
// getHeader
// ============================================================

describe('getHeader', () => {
  const msg: GmailMessageRaw = {
    id: 'test-id',
    payload: {
      headers: [
        { name: 'From', value: 'sender@test.com' },
        { name: 'Subject', value: 'Test email' },
        { name: 'Date', value: 'Mon, 12 May 2026 10:00:00 +0200' },
      ],
    },
  };

  it('trouve un header existant', () => {
    expect(getHeader(msg, 'From')).toBe('sender@test.com');
  });

  it('matching case-insensitive', () => {
    expect(getHeader(msg, 'from')).toBe('sender@test.com');
    expect(getHeader(msg, 'FROM')).toBe('sender@test.com');
  });

  it('retourne null pour header manquant', () => {
    expect(getHeader(msg, 'Cc')).toBeNull();
  });

  it('retourne null si pas de payload', () => {
    expect(getHeader({ id: 'x' }, 'From')).toBeNull();
  });
});

// ============================================================
// extractBodyPlain
// ============================================================

describe('extractBodyPlain', () => {
  function encodeBase64Url(text: string): string {
    return Buffer.from(text, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  it('extrait text/plain simple', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'text/plain',
        body: { data: encodeBase64Url('Bonjour, ceci est un test.') },
      },
    };
    expect(extractBodyPlain(msg)).toBe('Bonjour, ceci est un test.');
  });

  it('extrait text/plain depuis multipart', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'multipart/alternative',
        parts: [
          {
            mimeType: 'text/plain',
            body: { data: encodeBase64Url('Texte brut') },
          },
          {
            mimeType: 'text/html',
            body: { data: encodeBase64Url('<p>HTML</p>') },
          },
        ],
      },
    };
    expect(extractBodyPlain(msg)).toBe('Texte brut');
  });

  it('fallback text/html → strip tags', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'multipart/alternative',
        parts: [
          {
            mimeType: 'text/html',
            body: { data: encodeBase64Url('<p>Bonjour <strong>Thomas</strong></p>') },
          },
        ],
      },
    };
    const body = extractBodyPlain(msg);
    expect(body).toContain('Bonjour');
    expect(body).toContain('Thomas');
    expect(body).not.toContain('<p>');
    expect(body).not.toContain('<strong>');
  });

  it('retourne vide si aucun body', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: { mimeType: 'multipart/mixed' },
    };
    expect(extractBodyPlain(msg)).toBe('');
  });

  it('gère les caractères UTF-8 accentués', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'text/plain',
        body: { data: encodeBase64Url('Réception de la quittance — merci beaucoup !') },
      },
    };
    expect(extractBodyPlain(msg)).toBe('Réception de la quittance — merci beaucoup !');
  });

  it('strip les balises style et script', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'text/html',
        body: {
          data: encodeBase64Url(
            '<html><head><style>body{color:red}</style></head><body><script>alert(1)</script><p>Contenu</p></body></html>',
          ),
        },
      },
    };
    const body = extractBodyPlain(msg);
    expect(body).toBe('Contenu');
    expect(body).not.toContain('style');
    expect(body).not.toContain('script');
    expect(body).not.toContain('alert');
  });

  it('décode les entités HTML', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'text/html',
        body: {
          data: encodeBase64Url('<p>Loyer &amp; charges &lt;500&euro;</p>'),
        },
      },
    };
    const body = extractBodyPlain(msg);
    expect(body).toContain('Loyer & charges <500');
  });
});

// ============================================================
// extractAttachments
// ============================================================

describe('extractAttachments', () => {
  it('extrait les pièces jointes', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'multipart/mixed',
        parts: [
          { mimeType: 'text/plain', body: { data: 'dGVzdA' } },
          {
            mimeType: 'application/pdf',
            filename: 'facture.pdf',
            body: { attachmentId: 'att-1', size: 12345 },
          },
          {
            mimeType: 'image/jpeg',
            filename: 'photo.jpg',
            body: { attachmentId: 'att-2', size: 54321 },
          },
        ],
      },
    };

    const attachments = extractAttachments(msg);
    expect(attachments).toHaveLength(2);
    expect(attachments[0]).toEqual({
      name: 'facture.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12345,
      id: 'att-1',
    });
    expect(attachments[1]).toEqual({
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 54321,
      id: 'att-2',
    });
  });

  it('retourne vide si pas de pièces jointes', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'text/plain',
        body: { data: 'dGVzdA' },
      },
    };
    expect(extractAttachments(msg)).toEqual([]);
  });

  it('ignore les parts sans attachmentId', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'multipart/mixed',
        parts: [
          {
            mimeType: 'application/pdf',
            filename: 'inline.pdf',
            body: { size: 100 }, // pas d'attachmentId
          },
        ],
      },
    };
    expect(extractAttachments(msg)).toEqual([]);
  });

  it('ignore les parts sans filename', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'multipart/mixed',
        parts: [
          {
            mimeType: 'application/pdf',
            body: { attachmentId: 'att-1', size: 100 },
          },
        ],
      },
    };
    expect(extractAttachments(msg)).toEqual([]);
  });

  it('gère les multipart imbriqués (nested parts)', () => {
    const msg: GmailMessageRaw = {
      id: 'test',
      payload: {
        mimeType: 'multipart/mixed',
        parts: [
          {
            mimeType: 'multipart/alternative',
            parts: [
              { mimeType: 'text/plain', body: { data: 'dGVzdA' } },
            ],
          },
          {
            mimeType: 'application/pdf',
            filename: 'nested.pdf',
            body: { attachmentId: 'att-deep', size: 999 },
          },
        ],
      },
    };

    const attachments = extractAttachments(msg);
    expect(attachments).toHaveLength(1);
    expect(attachments[0]!.name).toBe('nested.pdf');
  });
});
