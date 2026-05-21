/**
 * Régression Bug 2 (S20.1) — vérifie que le webhook ne route plus vers
 * `handleInboxMessage` (router Calendar/Todo.md).
 *
 * On évite de charger réellement le webhook (trop de dépendances : secret,
 * restoreFromGoogleDrive, callAnthropic…). À la place, on fait un grep
 * statique sur le source du webhook : si quelqu'un re-introduit un appel à
 * `handleInboxMessage(`, ce test échoue et la PR est bloquée.
 *
 * Approche identique au pattern S18 kill-switch (vérification de l'absence
 * de l'appel obsolète plutôt que de tester le comportement runtime).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WEBHOOK_SOURCE = resolve(
  process.cwd(),
  'src/app/api/telegram/webhook/route.ts',
);

describe('Bug 2 regression — handleInboxMessage retiré du webhook', () => {
  const source = readFileSync(WEBHOOK_SOURCE, 'utf8');

  it('le webhook n\'importe plus `handleInboxMessage`', () => {
    // Soit l'import a disparu, soit `handleInboxMessage` n'est plus dans la
    // liste d'imports active. On accepte uniquement la mention dans les
    // commentaires de déprécation (chaîne `handleInboxMessage` peut subsister
    // dans un commentaire d'historique).
    //
    // Règle : aucun `handleInboxMessage,` ni `import { handleInboxMessage`.
    expect(source).not.toMatch(/^\s*handleInboxMessage,\s*$/m);
    expect(source).not.toMatch(/import\s*\{\s*[^}]*handleInboxMessage[^}]*\}/);
  });

  it('le webhook n\'appelle plus `handleInboxMessage(` (call site)', () => {
    // Seul un commentaire (// ...) peut le mentionner.
    const callSites = source
      .split('\n')
      .filter((line) => /\bhandleInboxMessage\s*\(/.test(line))
      .filter((line) => !line.trim().startsWith('//'))
      .filter((line) => !line.trim().startsWith('*'));
    expect(callSites).toEqual([]);
  });

  it('le webhook importe `previewAddTaskFromTelegram` (remplaçant)', () => {
    expect(source).toMatch(/previewAddTaskFromTelegram/);
  });

  it('le webhook importe `looksLikeTask` (heuristique Bug 2)', () => {
    expect(source).toMatch(/looksLikeTask/);
  });

  it('le webhook importe `findLatestAwaitingEditForChat` (modify text flow)', () => {
    expect(source).toMatch(/findLatestAwaitingEditForChat/);
  });

  it('le module router est marqué @deprecated S20.1', () => {
    const router = readFileSync(
      resolve(
        process.cwd(),
        'src/lib/secretariat/workflows/inbox-message-router.ts',
      ),
      'utf8',
    );
    expect(router).toMatch(/@deprecated\s+S20\.1/);
  });
});

describe('Bug 2 regression — task_* prefixes dispatch (R4)', () => {
  const source = readFileSync(WEBHOOK_SOURCE, 'utf8');

  it('TASK_CALLBACK_PREFIX dispatch présent dans le webhook (R4 strict)', () => {
    // Le dispatch task_* doit rester actif — il route ensuite vers
    // handleTaskCallback qui gère les 4 sous-actions (validate, modify,
    // cancel_preview, cancel).
    expect(source).toMatch(/startsWith\(TASK_CALLBACK_PREFIX\)/);
    expect(source).toMatch(/handleTaskCallback\(/);
  });
});
