/**
 * Tests anthropic-usage — health-monitor.
 *
 * Utilise /tmp/issa-data/ (fallback via mock existsSync('/home/runner') → false).
 * Jalon S15.5E — Task B.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// Mock existsSync pour forcer fallback /tmp/issa-data/
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (p: string) => {
      if (p === '/home/runner') return false;
      return actual.existsSync(p);
    },
  };
});

describe('anthropic-usage', () => {
  const STORE_PATH = resolve('/tmp/issa-data', 'anthropic-usage.json');

  let backupExists = false;
  let backupContent = '';

  beforeEach(() => {
    // Sauvegarder l'état existant
    try {
      if (existsSync(STORE_PATH)) {
        backupExists = true;
        backupContent = readFileSync(STORE_PATH, 'utf-8');
      }
    } catch {
      backupExists = false;
    }
    // Nettoyer
    try {
      rmSync(STORE_PATH, { force: true });
    } catch {
      // ignore
    }
    // Réinitialiser les modules pour que les imports soient frais
    vi.resetModules();
    // Nettoyer les env vars
    delete process.env.ANTHROPIC_MONTHLY_BUDGET_EUR;
  });

  afterEach(() => {
    // Restaurer l'état
    if (backupExists) {
      if (!existsSync('/tmp/issa-data')) {
        mkdirSync('/tmp/issa-data', { recursive: true });
      }
      writeFileSync(STORE_PATH, backupContent, 'utf-8');
    } else {
      try {
        rmSync(STORE_PATH, { force: true });
      } catch {
        // ignore
      }
    }
  });

  async function getModule() {
    return import('../anthropic-usage');
  }

  function readStore(): Record<string, unknown> {
    if (!existsSync(STORE_PATH)) return {};
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8'));
  }

  // ----------------------------------------------------------
  // recordAnthropicUsage
  // ----------------------------------------------------------

  it('crée le fichier avec le bon format au premier appel', async () => {
    const { recordAnthropicUsage } = await getModule();

    recordAnthropicUsage({
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const store = readStore();
    expect(store).toHaveProperty('month');
    expect(store).toHaveProperty('totalEur');
    expect(store).toHaveProperty('calls', 1);
    expect(store).toHaveProperty('byModel');
  });

  it('calcule le coût Haiku 3.5 correctement en EUR', async () => {
    const { recordAnthropicUsage } = await getModule();

    // 1M input tokens = $0.80 → 0.736 EUR
    // 1M output tokens = $4.00 → 3.68 EUR
    // Total = 4.416 EUR
    recordAnthropicUsage({
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });

    const store = readStore();
    const expected = (0.80 + 4.00) * 0.92; // 4.416
    expect(store.totalEur).toBeCloseTo(expected, 4);
  });

  it('calcule le coût Sonnet 4 correctement en EUR', async () => {
    const { recordAnthropicUsage } = await getModule();

    // 1M input = $3.00 → 2.76 EUR
    // 1M output = $15.00 → 13.80 EUR
    // Total = 16.56 EUR
    recordAnthropicUsage({
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });

    const store = readStore();
    const expected = (3.00 + 15.00) * 0.92; // 16.56
    expect(store.totalEur).toBeCloseTo(expected, 4);
  });

  it('calcule le coût avec cache read tokens (90% off)', async () => {
    const { recordAnthropicUsage } = await getModule();

    // Haiku: 1M cache read = $0.08 → 0.0736 EUR
    recordAnthropicUsage({
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 1_000_000,
    });

    const store = readStore();
    const expected = 0.08 * 0.92; // 0.0736
    expect(store.totalEur).toBeCloseTo(expected, 4);
  });

  it('cumule les appels correctement', async () => {
    const { recordAnthropicUsage } = await getModule();

    recordAnthropicUsage({
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 500_000,
      outputTokens: 100_000,
    });
    recordAnthropicUsage({
      model: 'claude-sonnet-4-20250514',
      inputTokens: 200_000,
      outputTokens: 50_000,
    });

    const store = readStore();
    expect(store.calls).toBe(2);
    expect(typeof store.totalEur).toBe('number');
    expect((store.totalEur as number)).toBeGreaterThan(0);

    // byModel doit contenir les deux modèles
    const byModel = store.byModel as Record<string, number>;
    expect(byModel).toHaveProperty('haiku-4-5');
    expect(byModel).toHaveProperty('sonnet-4');
  });

  it('reset quand le mois change', async () => {
    const { recordAnthropicUsage } = await getModule();

    // Écrire un store avec un mois passé
    if (!existsSync('/tmp/issa-data')) {
      mkdirSync('/tmp/issa-data', { recursive: true });
    }
    writeFileSync(
      STORE_PATH,
      JSON.stringify({
        month: '2025-01',
        totalEur: 42.5,
        calls: 100,
        byModel: { 'haiku-4-5': 42.5 },
      }),
      'utf-8',
    );

    // Nouvel appel → mois courant différent de 2025-01 → reset
    recordAnthropicUsage({
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const store = readStore();
    expect(store.calls).toBe(1); // Reset, pas 101
    expect((store.totalEur as number)).toBeLessThan(1); // Micro-coût, pas 42.5+
  });

  it('ignore les modèles inconnus (coût = 0)', async () => {
    const { recordAnthropicUsage } = await getModule();

    recordAnthropicUsage({
      model: 'claude-opus-5-20261001',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });

    const store = readStore();
    expect(store.calls).toBe(1);
    expect(store.totalEur).toBe(0);
  });

  // ----------------------------------------------------------
  // getMonthlyUsageEur
  // ----------------------------------------------------------

  it('getMonthlyUsageEur retourne 0 si pas de fichier', async () => {
    const { getMonthlyUsageEur } = await getModule();
    const usage = await getMonthlyUsageEur();
    expect(usage).toBe(0);
  });

  it('getMonthlyUsageEur retourne le total du mois courant', async () => {
    const { recordAnthropicUsage, getMonthlyUsageEur } = await getModule();

    recordAnthropicUsage({
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });

    const usage = await getMonthlyUsageEur();
    expect(usage).toBeGreaterThan(0);
    expect(usage).toBeCloseTo((0.80 + 4.00) * 0.92, 4);
  });

  // ----------------------------------------------------------
  // getMonthlyBudgetEur
  // ----------------------------------------------------------

  it('getMonthlyBudgetEur retourne 50 par défaut', async () => {
    const { getMonthlyBudgetEur } = await getModule();
    expect(getMonthlyBudgetEur()).toBe(50);
  });

  it('getMonthlyBudgetEur respecte ANTHROPIC_MONTHLY_BUDGET_EUR', async () => {
    process.env.ANTHROPIC_MONTHLY_BUDGET_EUR = '100';
    const { getMonthlyBudgetEur } = await getModule();
    expect(getMonthlyBudgetEur()).toBe(100);
  });
});
