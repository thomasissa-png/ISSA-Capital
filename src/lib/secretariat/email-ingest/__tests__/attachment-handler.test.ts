/**
 * Tests attachment-handler — copie PJ email vers vault (S23).
 *
 * Mocks : gmail-client (download), vault-reader (fiche projet), vault-client
 * (contact), drive-resolver (resolvePath), drive-upload (token/subfolder/upload).
 * Zéro réseau.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDownloadAttachment = vi.fn();
const mockFindProjetFiche = vi.fn();
const mockFindContact = vi.fn();
const mockResolvePath = vi.fn();
const mockGetAccessToken = vi.fn();
const mockGetOrCreateChildFolder = vi.fn();
const mockUploadBinary = vi.fn();

vi.mock('../../gmail-source/gmail-client', () => ({
  downloadAttachment: (...a: unknown[]) => mockDownloadAttachment(...a),
}));
vi.mock('../../vault-reader', () => ({
  findProjetFicheByEntite: (...a: unknown[]) => mockFindProjetFiche(...a),
}));
vi.mock('../../vault-client', () => ({
  findContactByEmail: (...a: unknown[]) => mockFindContact(...a),
}));
vi.mock('../../vault-client/drive-resolver', () => ({
  resolvePath: (...a: unknown[]) => mockResolvePath(...a),
}));
vi.mock('../../drive-upload', () => ({
  getAccessToken: (...a: unknown[]) => mockGetAccessToken(...a),
  getOrCreateChildFolder: (...a: unknown[]) => mockGetOrCreateChildFolder(...a),
  uploadBinaryToFolder: (...a: unknown[]) => mockUploadBinary(...a),
}));

import {
  resolveAttachmentDestination,
  selectAttachmentsToKeep,
  executeCopyAttachment,
  ATTACHMENT_SUBFOLDER,
} from '../attachment-handler';
import type { EmailAttachment } from '../../gmail-source/types';

function att(over: Partial<EmailAttachment> = {}): EmailAttachment {
  return { name: 'facture.pdf', mimeType: 'application/pdf', sizeBytes: 50_000, id: 'att1', ...over };
}

beforeEach(() => vi.clearAllMocks());

describe('selectAttachmentsToKeep', () => {
  it('retient les PJ listées par le triage (match case-insensitive)', () => {
    const out = selectAttachmentsToKeep([att({ name: 'Facture.PDF' })], ['facture.pdf']);
    expect(out).toHaveLength(1);
  });

  it('rien à garder si liste vide/undefined (dans le doute, on ne copie pas)', () => {
    expect(selectAttachmentsToKeep([att()], undefined)).toHaveLength(0);
    expect(selectAttachmentsToKeep([att()], [])).toHaveLength(0);
  });

  it('garde-fou taille : exclut les PJ < 15 Ko même si listées (pixel/signature)', () => {
    const out = selectAttachmentsToKeep([att({ name: 'pixel.png', sizeBytes: 800 })], ['pixel.png']);
    expect(out).toHaveLength(0);
  });
});

describe('resolveAttachmentDestination', () => {
  it('projet détecté → fiche projet (priorité)', async () => {
    mockFindProjetFiche.mockResolvedValue({
      fileId: 'f1',
      ficheName: 'Versi Immobilier',
      resolvedFilename: 'Versi Immobilier.md',
      folderPath: '02. Projets/02. Pro',
    });
    const dest = await resolveAttachmentDestination('VI', 'x@y.com');
    expect(dest).toEqual({
      kind: 'projet',
      baseFolderPath: '02. Projets/02. Pro',
      subfolder: ATTACHMENT_SUBFOLDER,
      label: 'Versi Immobilier',
    });
    expect(mockFindContact).not.toHaveBeenCalled();
  });

  it('pas de projet → fallback contact connu', async () => {
    mockFindContact.mockResolvedValue({
      name: 'Cabinet Dupont',
      folderPath: '07. Contacts/01. Pro',
      emails: ['compta@cabinet-dupont.fr'],
      content: '',
      fileId: 'c1',
    });
    const dest = await resolveAttachmentDestination(undefined, 'compta@cabinet-dupont.fr');
    expect(dest?.kind).toBe('contact');
    expect(dest?.baseFolderPath).toBe('07. Contacts/01. Pro');
  });

  it('ni projet ni contact → null (aucun sujet suivi, pas de dépotoir)', async () => {
    mockFindContact.mockResolvedValue(null);
    const dest = await resolveAttachmentDestination(undefined, 'inconnu@nowhere.com');
    expect(dest).toBeNull();
  });

  it('fiche projet introuvable → fallback contact', async () => {
    mockFindProjetFiche.mockResolvedValue(null);
    mockFindContact.mockResolvedValue({
      name: 'Cabinet Dupont',
      folderPath: '07. Contacts/01. Pro',
      emails: [],
      content: '',
      fileId: 'c1',
    });
    const dest = await resolveAttachmentDestination('VI', 'compta@cabinet-dupont.fr');
    expect(dest?.kind).toBe('contact');
  });
});

describe('executeCopyAttachment', () => {
  const destination = { baseFolderPath: '02. Projets/02. Pro', subfolder: 'Documents' };

  it('happy path : download → resolvePath → subfolder → upload', async () => {
    mockDownloadAttachment.mockResolvedValue(Buffer.from('PDFDATA'));
    mockGetAccessToken.mockResolvedValue('tok');
    mockResolvePath.mockResolvedValue({ success: true, fileId: 'base-folder-id' });
    mockGetOrCreateChildFolder.mockResolvedValue('sub-folder-id');
    mockUploadBinary.mockResolvedValue({ success: true, fileId: 'new-file-id' });

    const res = await executeCopyAttachment(
      'msg1',
      { name: 'facture.pdf', mimeType: 'application/pdf', id: 'att1' },
      destination,
    );

    expect(res.ok).toBe(true);
    expect(res.fileId).toBe('new-file-id');
    // S23 : getOrCreateChildFolder (PAS getOrCreateSubfolder) — évite l'env-map inbox
    expect(mockGetOrCreateChildFolder).toHaveBeenCalledWith('tok', 'base-folder-id', 'Documents');
    expect(mockUploadBinary).toHaveBeenCalledWith(
      expect.any(Buffer),
      'facture.pdf',
      'application/pdf',
      'sub-folder-id',
    );
  });

  it('download échoué → ok false, pas d upload', async () => {
    mockDownloadAttachment.mockResolvedValue(null);
    const res = await executeCopyAttachment(
      'msg1',
      { name: 'facture.pdf', mimeType: 'application/pdf', id: 'att1' },
      destination,
    );
    expect(res.ok).toBe(false);
    expect(mockUploadBinary).not.toHaveBeenCalled();
  });

  it('dossier de base introuvable → ok false', async () => {
    mockDownloadAttachment.mockResolvedValue(Buffer.from('x'));
    mockGetAccessToken.mockResolvedValue('tok');
    mockResolvePath.mockResolvedValue({ success: false });
    const res = await executeCopyAttachment(
      'msg1',
      { name: 'f.pdf', mimeType: 'application/pdf', id: 'att1' },
      destination,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toContain('dossier de base');
  });

  it('upload échoué → propage l erreur', async () => {
    mockDownloadAttachment.mockResolvedValue(Buffer.from('x'));
    mockGetAccessToken.mockResolvedValue('tok');
    mockResolvePath.mockResolvedValue({ success: true, fileId: 'base' });
    mockGetOrCreateChildFolder.mockResolvedValue('sub');
    mockUploadBinary.mockResolvedValue({ success: false, error: 'Drive 503' });
    const res = await executeCopyAttachment(
      'msg1',
      { name: 'f.pdf', mimeType: 'application/pdf', id: 'att1' },
      destination,
    );
    expect(res.ok).toBe(false);
    expect(res.error).toBe('Drive 503');
  });
});
