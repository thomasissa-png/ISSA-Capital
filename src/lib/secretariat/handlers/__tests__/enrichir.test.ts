import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetVaultContacts = vi.fn();
const mockEnrichContact = vi.fn();
const mockUpdateFrontmatter = vi.fn();
const mockSendTelegram = vi.fn();

vi.mock('../../vault-contacts', () => ({
  getVaultContacts: (...a: unknown[]) => mockGetVaultContacts(...a),
}));
vi.mock('../../contact-enrich', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../contact-enrich')>();
  return {
    ...actual,
    enrichContact: (...a: unknown[]) => mockEnrichContact(...a),
  };
});
vi.mock('../../vault-client', () => ({
  updateFrontmatter: (...a: unknown[]) => mockUpdateFrontmatter(...a),
}));
vi.mock('../../telegram', () => ({
  sendTelegramMessage: (...a: unknown[]) => mockSendTelegram(...a),
}));

import { handleEnrichirCommand, matchContacts } from '../enrichir';

const CHAT = 123;

function contact(over: Partial<Record<string, unknown>> = {}) {
  return {
    prenom: 'Marc',
    nom: 'Gernot',
    titre: '',
    societe: '',
    entitesVisibles: [],
    email: 'marc.gernot@exemple.com',
    telephone: '',
    categorie: 'pro',
    folderPath: '07. Contacts/03. Pro',
    filename: 'Marc Gernot.md',
    ...over,
  };
}

beforeEach(() => {
  mockGetVaultContacts.mockReset();
  mockEnrichContact.mockReset();
  mockUpdateFrontmatter.mockReset();
  mockSendTelegram.mockReset();
  mockGetVaultContacts.mockResolvedValue([contact()]);
  mockEnrichContact.mockResolvedValue({
    displayName: 'Marc Gernot',
    content: '',
    data: { role: 'Directeur', societe: 'Gernot Capital', telephone: '+33 6 12' },
    sources: ['gmail'],
    scanned: 3,
  });
  mockUpdateFrontmatter.mockResolvedValue(true);
  mockSendTelegram.mockResolvedValue({ success: true });
});

describe('matchContacts (fuzzy)', () => {
  const list = [
    contact(),
    contact({ prenom: 'Jean', nom: 'Dupont', filename: 'Jean Dupont.md' }),
  ] as never[];

  it('match par nom complet, prénom seul, nom seul, accents/casse', () => {
    expect(matchContacts(list, 'marc gernot')).toHaveLength(1);
    expect(matchContacts(list, 'GERNOT')).toHaveLength(1);
    expect(matchContacts(list, 'marc')).toHaveLength(1);
    expect(matchContacts(list, 'inconnu')).toHaveLength(0);
  });
});

describe('handleEnrichirCommand', () => {
  it('query vide → message d’usage', async () => {
    await handleEnrichirCommand(CHAT, '   ');
    expect(mockSendTelegram.mock.calls[0]![1]).toContain('Usage');
    expect(mockEnrichContact).not.toHaveBeenCalled();
  });

  it('aucun match → message « aucune fiche »', async () => {
    mockGetVaultContacts.mockResolvedValue([contact()]);
    await handleEnrichirCommand(CHAT, 'Zorro');
    expect(mockSendTelegram.mock.calls[0]![1]).toContain('Aucune fiche');
  });

  it('plusieurs matchs → demande de préciser, pas d’enrichissement', async () => {
    mockGetVaultContacts.mockResolvedValue([
      contact(),
      contact({ nom: 'Gernotier', filename: 'Marc Gernotier.md' }),
    ]);
    await handleEnrichirCommand(CHAT, 'Marc');
    expect(mockSendTelegram.mock.calls[0]![1]).toContain('Plusieurs fiches');
    expect(mockEnrichContact).not.toHaveBeenCalled();
  });

  it('1 match → enrichit et complète les champs vides uniquement', async () => {
    await handleEnrichirCommand(CHAT, 'Marc Gernot');
    expect(mockEnrichContact).toHaveBeenCalledOnce();
    expect(mockUpdateFrontmatter).toHaveBeenCalledOnce();
    const opts = mockUpdateFrontmatter.mock.calls[0]![0] as { fields: Record<string, string> };
    expect(opts.fields).toEqual({ societe: 'Gernot Capital', role: 'Directeur', telephone: '+33 6 12' });
    const reply = mockSendTelegram.mock.calls.at(-1)![1] as string;
    expect(reply).toContain('Champs complétés');
  });

  it('ne remplace PAS un champ déjà renseigné (idempotent/non destructif)', async () => {
    mockGetVaultContacts.mockResolvedValue([
      contact({ societe: 'Déjà rempli', titre: 'CEO', telephone: '+33 1' }),
    ]);
    await handleEnrichirCommand(CHAT, 'Marc Gernot');
    expect(mockUpdateFrontmatter).not.toHaveBeenCalled();
    const reply = mockSendTelegram.mock.calls.at(-1)![1] as string;
    expect(reply).toContain('déjà renseignés');
  });

  it('contact sans email → pas d’enrichissement', async () => {
    mockGetVaultContacts.mockResolvedValue([contact({ email: undefined })]);
    await handleEnrichirCommand(CHAT, 'Marc Gernot');
    expect(mockEnrichContact).not.toHaveBeenCalled();
    expect(mockSendTelegram.mock.calls.at(-1)![1]).toContain("pas d'email");
  });

  it('enrichContact null → message « rien à enrichir »', async () => {
    mockEnrichContact.mockResolvedValue(null);
    await handleEnrichirCommand(CHAT, 'Marc Gernot');
    expect(mockUpdateFrontmatter).not.toHaveBeenCalled();
    expect(mockSendTelegram.mock.calls.at(-1)![1]).toContain('rien à enrichir');
  });
});
