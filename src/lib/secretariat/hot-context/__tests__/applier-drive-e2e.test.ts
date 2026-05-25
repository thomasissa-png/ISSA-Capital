/**
 * Test E2E `applyPatchToDrive` — application d'un patch hot-context de bout en
 * bout (résolution path → lecture live → PATCH Drive).
 *
 * Régression S22 : `HOT_CONTEXT_FOLDER` valait "00. Me" alors que
 * DRIVE_VAULT_ROOT_ID pointe DÉJÀ sur "00. Me". Le résolveur cherchait donc un
 * sous-dossier "00. Me" dans "00. Me" → « Segment "00. Me" non trouvé ». Ce
 * chemin n'avait jamais de couverture E2E. On verrouille ici : le dossier
 * logique DOIT être vide (fichier à la racine du vault).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../drive-upload', () => ({
  getAccessToken: vi.fn(async () => 'token-test'),
}));

vi.mock('../../vault-client/drive-resolver', () => ({
  resolveFilePath: vi.fn(),
}));

vi.mock('../../vault-client/obsidian-file', () => ({
  readFile: vi.fn(),
  writeFileById: vi.fn(),
}));

vi.mock('../../vault-client/write-lock', () => ({
  withWriteLock: vi.fn(async (_path: string, fn: () => unknown) => fn()),
}));

import {
  applyPatchToDrive,
  HOT_CONTEXT_FOLDER,
  HOT_CONTEXT_FILENAME,
} from '../applier';
import { resolveFilePath } from '../../vault-client/drive-resolver';
import { readFile, writeFileById } from '../../vault-client/obsidian-file';
import type { Patch } from '../types';

const SAMPLE = `## Je bouge sur (cette semaine)
- [[Item A]]
- [[Item B]]

## J'attends
| Quoi | De qui | Depuis | Note |
| --- | --- | --- | --- |
| [[Signature acte]] | [[Maître X]] | 2026-05-15 | deadline |

## Décisions en arbitrage
- **[[Choix A]]** — contexte X

## Maintenance
- Revue hebdo
- Cap warn 500
`;

const FILE_ID = 'hot-context-file-id';

function makePatch(p: Partial<Patch> = {}): Patch {
  return {
    patchId: 'pid-e2e',
    signalId: 'sid-e2e',
    section: 'bouge',
    action: 'add',
    payload: { text: '[[Nouveau item E2E]]' },
    source: 'telegram',
    sourceId: '999',
    proposedAt: '2026-05-25T10:00:00Z',
    rationale: 'test E2E drive',
    ...p,
  };
}

const estimateTokens = (content: string) => Math.ceil(content.length / 4);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveFilePath).mockResolvedValue({ success: true, fileId: FILE_ID });
  vi.mocked(readFile).mockResolvedValue({ success: true, content: SAMPLE, fileId: FILE_ID });
  vi.mocked(writeFileById).mockResolvedValue({ success: true, fileId: FILE_ID });
});

describe('HOT_CONTEXT_FOLDER — convention racine vault', () => {
  it('est une chaîne vide (fichier à la racine de DRIVE_VAULT_ROOT_ID = "00. Me")', () => {
    expect(HOT_CONTEXT_FOLDER).toBe('');
  });
});

describe('applyPatchToDrive — E2E application patch', () => {
  it('résout, lit et PATCH avec le dossier racine (vide), pas "00. Me"', async () => {
    const result = await applyPatchToDrive(makePatch(), estimateTokens);

    expect(result.success).toBe(true);
    expect(result.alreadyApplied).toBeUndefined();

    // Le bug régressé : ces appels DOIVENT passer un dossier vide.
    expect(resolveFilePath).toHaveBeenCalledWith('', HOT_CONTEXT_FILENAME);
    expect(readFile).toHaveBeenCalledWith('', HOT_CONTEXT_FILENAME);
    expect(resolveFilePath).not.toHaveBeenCalledWith('00. Me', HOT_CONTEXT_FILENAME);
  });

  it('écrit le nouveau contenu (ligne ajoutée) via writeFileById sur le bon fileId', async () => {
    const result = await applyPatchToDrive(makePatch(), estimateTokens);

    expect(result.success).toBe(true);
    expect(writeFileById).toHaveBeenCalledTimes(1);
    const [, fileIdArg, contentArg] = vi.mocked(writeFileById).mock.calls[0]!;
    expect(fileIdArg).toBe(FILE_ID);
    expect(contentArg).toContain('Nouveau item E2E');
    // La section protégée Maintenance reste intacte.
    expect(contentArg).toContain('Revue hebdo');
  });

  it('idempotence : ré-ajouter une ligne déjà présente = succès sans PATCH', async () => {
    const result = await applyPatchToDrive(
      makePatch({ payload: { text: '[[Item A]]' } }),
      estimateTokens,
    );

    expect(result.success).toBe(true);
    expect(result.alreadyApplied).toBe(true);
    expect(writeFileById).not.toHaveBeenCalled();
  });

  it('échec de résolution remonte une erreur explicite (pas de crash)', async () => {
    vi.mocked(resolveFilePath).mockResolvedValueOnce({
      success: false,
      error: 'Fichier introuvable',
    });

    const result = await applyPatchToDrive(makePatch(), estimateTokens);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(writeFileById).not.toHaveBeenCalled();
  });
});
