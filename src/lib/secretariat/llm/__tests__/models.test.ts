/**
 * Tests `models.ts` — constantes + override par env.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  HAIKU_4_5,
  SONNET_4,
  DEEPSEEK_V4_FLASH,
  TASK_MODEL,
  resolveSonnetModel,
  resolveHaikuModel,
  resolveModelByFamily,
  resolveTaskModel,
} from '../models';

describe('models — constantes', () => {
  it('HAIKU_4_5 = claude-haiku-4-5-20251001', () => {
    expect(HAIKU_4_5).toBe('claude-haiku-4-5-20251001');
  });

  it('SONNET_4 = claude-sonnet-4-20250514', () => {
    expect(SONNET_4).toBe('claude-sonnet-4-20250514');
  });
});

describe('models — resolveSonnetModel', () => {
  const original = process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;
    } else {
      process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = original;
    }
  });

  it('retourne SONNET_4 par défaut', () => {
    delete process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;
    expect(resolveSonnetModel()).toBe(SONNET_4);
  });

  it('respecte l override env', () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = 'claude-sonnet-4-6';
    expect(resolveSonnetModel()).toBe('claude-sonnet-4-6');
  });

  it('ignore une valeur vide ou whitespace', () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = '   ';
    expect(resolveSonnetModel()).toBe(SONNET_4);
  });
});

describe('models — resolveHaikuModel', () => {
  const original = process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU;
    } else {
      process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU = original;
    }
  });

  it('retourne HAIKU_4_5 par défaut', () => {
    delete process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU;
    expect(resolveHaikuModel()).toBe(HAIKU_4_5);
  });

  it('respecte l override env', () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU = 'claude-haiku-5-0-20260101';
    expect(resolveHaikuModel()).toBe('claude-haiku-5-0-20260101');
  });
});

describe('models — resolveModelByFamily', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;
    delete process.env.ANTHROPIC_MODEL_OVERRIDE_HAIKU;
  });

  it('sonnet → Sonnet 4 par défaut', () => {
    expect(resolveModelByFamily('sonnet')).toBe(SONNET_4);
  });

  it('haiku → Haiku 4.5 par défaut', () => {
    expect(resolveModelByFamily('haiku')).toBe(HAIKU_4_5);
  });
});

// ============================================================
// Registre tâche → modèle (S22)
// ============================================================

describe('models — DEEPSEEK_V4_FLASH', () => {
  it('vaut deepseek-v4-flash', () => {
    expect(DEEPSEEK_V4_FLASH).toBe('deepseek-v4-flash');
  });
});

describe('models — TASK_MODEL (mapping par défaut)', () => {
  it('route les 5 tâches volume vers DeepSeek', () => {
    for (const task of [
      'inbox-router',
      'email-triage',
      'hot-context-detect',
      'hot-context-modify',
      'email-draft',
    ] as const) {
      expect(TASK_MODEL[task].provider).toBe('deepseek');
      expect(TASK_MODEL[task].model).toBe(DEEPSEEK_V4_FLASH);
    }
  });

  it('route cr vers Anthropic Sonnet', () => {
    expect(TASK_MODEL.cr.provider).toBe('anthropic');
    expect(TASK_MODEL.cr.family).toBe('sonnet');
  });
});

describe('models — resolveTaskModel', () => {
  const envKeys = [
    'LLM_TASK_OVERRIDE_EMAIL_TRIAGE',
    'LLM_TASK_OVERRIDE_CR',
    'LLM_TASK_OVERRIDE_INBOX_ROUTER',
    'ANTHROPIC_MODEL_OVERRIDE_SONNET',
  ];

  beforeEach(() => {
    for (const k of envKeys) delete process.env[k];
  });

  afterEach(() => {
    for (const k of envKeys) delete process.env[k];
  });

  it('email-triage → deepseek + deepseek-v4-flash par défaut', () => {
    expect(resolveTaskModel('email-triage')).toEqual({
      provider: 'deepseek',
      model: DEEPSEEK_V4_FLASH,
    });
  });

  it('cr → anthropic + Sonnet 4 résolu par défaut', () => {
    expect(resolveTaskModel('cr')).toEqual({
      provider: 'anthropic',
      model: SONNET_4,
    });
  });

  it('cr respecte ANTHROPIC_MODEL_OVERRIDE_SONNET via family', () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = 'claude-sonnet-4-6';
    expect(resolveTaskModel('cr')).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
  });

  it('override env format provider:model (anthropic)', () => {
    process.env.LLM_TASK_OVERRIDE_EMAIL_TRIAGE = 'anthropic:claude-haiku-4-5-20251001';
    expect(resolveTaskModel('email-triage')).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
    });
  });

  it('override env format provider:model (deepseek)', () => {
    process.env.LLM_TASK_OVERRIDE_CR = 'deepseek:deepseek-v4-flash';
    expect(resolveTaskModel('cr')).toEqual({
      provider: 'deepseek',
      model: DEEPSEEK_V4_FLASH,
    });
  });

  it('override env modèle seul claude-... → provider anthropic déduit', () => {
    process.env.LLM_TASK_OVERRIDE_EMAIL_TRIAGE = 'claude-sonnet-4-20250514';
    expect(resolveTaskModel('email-triage')).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
    });
  });

  it('override env modèle seul deepseek-... → provider deepseek déduit', () => {
    process.env.LLM_TASK_OVERRIDE_CR = 'deepseek-v4-flash';
    expect(resolveTaskModel('cr')).toEqual({
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    });
  });

  it('ignore un override vide/whitespace', () => {
    process.env.LLM_TASK_OVERRIDE_EMAIL_TRIAGE = '   ';
    expect(resolveTaskModel('email-triage')).toEqual({
      provider: 'deepseek',
      model: DEEPSEEK_V4_FLASH,
    });
  });
});
