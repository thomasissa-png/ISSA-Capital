/**
 * Tests vault-scanner — extraction VaultTask depuis le contenu Todo.md.
 *
 * Pour S18.1 (MVP) on teste uniquement extractTasksFromContent qui n'est
 * pas réseau-dépendante. scanVault complet est testé indirectement par
 * les tests d'intégration (mock vault-reader).
 */

import { describe, it, expect } from 'vitest';
import { extractTasksFromContent } from '../vault-scanner';

describe('extractTasksFromContent', () => {
  it('renvoie [] si contenu vide', () => {
    expect(extractTasksFromContent('Todo.md', '')).toEqual([]);
  });

  it('extrait une seule tâche valide', () => {
    const content = `# Inbox\n\n- [ ] première tâche\n`;
    const tasks = extractTasksFromContent('Todo.md', content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('première tâche');
    expect(tasks[0]?.position.lineNumber).toBe(3);
  });

  it('positions correctes pour plusieurs tâches', () => {
    const content =
      'titre\n' +
      'autre\n' +
      '- [ ] t1\n' +
      'milieu\n' +
      '- [x] t2\n';
    const tasks = extractTasksFromContent('Todo.md', content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]?.position.lineNumber).toBe(3);
    expect(tasks[1]?.position.lineNumber).toBe(5);
    expect(tasks[1]?.status).toBe(2);
  });

  it('skip les lignes hide-tcw', () => {
    const content = `- [ ] visible\n- [ ] caché #hide-tcw\n- [ ] autre\n`;
    const tasks = extractTasksFromContent('Todo.md', content);
    expect(tasks.map((t) => t.title)).toEqual(['visible', 'autre']);
  });

  it('gère \\r\\n et \\n indifféremment', () => {
    const crlf = `- [ ] a\r\n- [ ] b\r\n`;
    const lf = `- [ ] a\n- [ ] b\n`;
    expect(extractTasksFromContent('p', crlf)).toHaveLength(2);
    expect(extractTasksFromContent('p', lf)).toHaveLength(2);
  });

  it('préserve vaultPath dans position', () => {
    const content = `- [ ] tâche\n`;
    const tasks = extractTasksFromContent('Reunions/2026/05/x.md', content);
    expect(tasks[0]?.position.vaultPath).toBe('Reunions/2026/05/x.md');
  });

  it('ignore les lignes non-checkbox', () => {
    const content =
      '# Titre\n' +
      '## Section\n' +
      'paragraphe\n' +
      '- liste simple\n' +
      '* item\n' +
      '\n' +
      '- [ ] enfin une tâche\n';
    const tasks = extractTasksFromContent('Todo.md', content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe('enfin une tâche');
  });
});
