/**
 * Tests write-lock — sérialisation d'écriture par path.
 *
 * Vérifie que deux opérations simultanées sur le même path sont sérialisées
 * (pas de corruption), et que des opérations sur des paths différents
 * s'exécutent en parallèle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  withWriteLock,
  getActiveWriteLockCount,
  clearWriteLocks,
} from '../write-lock';

beforeEach(() => {
  clearWriteLocks();
});

describe('withWriteLock', () => {
  it('exécute une opération simple et retourne le résultat', async () => {
    const result = await withWriteLock('test/path', async () => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it('sérialise deux opérations sur le même path', async () => {
    const executionOrder: number[] = [];
    let resolveFn1: (() => void) | undefined;
    let resolveFn2: (() => void) | undefined;

    // Première opération : attend un signal avant de finir
    const op1 = withWriteLock('same/path', async () => {
      executionOrder.push(1);
      await new Promise<void>((resolve) => {
        resolveFn1 = resolve;
      });
      executionOrder.push(2);
      return 'op1';
    });

    // Petite attente pour que op1 démarre
    await new Promise((r) => setTimeout(r, 10));

    // Deuxième opération : doit attendre que op1 finisse
    const op2 = withWriteLock('same/path', async () => {
      executionOrder.push(3);
      await new Promise<void>((resolve) => {
        resolveFn2 = resolve;
      });
      executionOrder.push(4);
      return 'op2';
    });

    // Vérifier que op1 a commencé mais op2 pas encore
    expect(executionOrder).toEqual([1]);

    // Libérer op1
    resolveFn1!();
    await new Promise((r) => setTimeout(r, 10));

    // Op1 est terminée, op2 a commencé
    expect(executionOrder).toContain(2);
    expect(executionOrder).toContain(3);

    // Libérer op2
    resolveFn2!();

    const [result1, result2] = await Promise.all([op1, op2]);
    expect(result1).toBe('op1');
    expect(result2).toBe('op2');
    expect(executionOrder).toEqual([1, 2, 3, 4]);
  });

  it('exécute en parallèle des opérations sur des paths différents', async () => {
    const executionOrder: string[] = [];

    const op1 = withWriteLock('path/A', async () => {
      executionOrder.push('A-start');
      await new Promise((r) => setTimeout(r, 50));
      executionOrder.push('A-end');
      return 'A';
    });

    const op2 = withWriteLock('path/B', async () => {
      executionOrder.push('B-start');
      await new Promise((r) => setTimeout(r, 50));
      executionOrder.push('B-end');
      return 'B';
    });

    const [result1, result2] = await Promise.all([op1, op2]);
    expect(result1).toBe('A');
    expect(result2).toBe('B');

    // Les deux opérations doivent avoir démarré avant que l'une finisse
    const aStartIdx = executionOrder.indexOf('A-start');
    const bStartIdx = executionOrder.indexOf('B-start');
    const aEndIdx = executionOrder.indexOf('A-end');

    expect(aStartIdx).toBeLessThan(aEndIdx);
    expect(bStartIdx).toBeLessThan(aEndIdx); // B a démarré avant que A finisse
  });

  it('libère le lock même si l\'opération throw', async () => {
    // Op1 qui throw
    await expect(
      withWriteLock('error/path', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // Op2 sur le même path doit pouvoir s'exécuter (lock libéré)
    const result = await withWriteLock('error/path', async () => {
      return 'recovered';
    });
    expect(result).toBe('recovered');
  });

  it('sérialise 3 opérations consécutives', async () => {
    const results: number[] = [];

    const ops = [1, 2, 3].map((n) =>
      withWriteLock('sequential/path', async () => {
        results.push(n);
        await new Promise((r) => setTimeout(r, 10));
        return n;
      }),
    );

    const values = await Promise.all(ops);
    expect(values).toEqual([1, 2, 3]);
    expect(results).toEqual([1, 2, 3]);
  });
});

describe('getActiveWriteLockCount', () => {
  it('retourne 0 quand aucun lock n\'est actif', () => {
    expect(getActiveWriteLockCount()).toBe(0);
  });

  it('retourne le nombre de locks actifs', async () => {
    let releaseFn: (() => void) | undefined;

    const op = withWriteLock('active/path', async () => {
      await new Promise<void>((resolve) => {
        releaseFn = resolve;
      });
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(getActiveWriteLockCount()).toBe(1);

    releaseFn!();
    await op;
    expect(getActiveWriteLockCount()).toBe(0);
  });
});
