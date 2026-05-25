/**
 * Tests `models.ts` — constantes + override par env.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  HAIKU_4_5,
  SONNET_4,
  SONNET_4_6,
  DEEPSEEK_V4_FLASH,
  DEEPSEEK_V4_PRO,
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

  it('SONNET_4 (legacy) = claude-sonnet-4-20250514', () => {
    expect(SONNET_4).toBe('claude-sonnet-4-20250514');
  });

  it('SONNET_4_6 = claude-sonnet-4-6', () => {
    expect(SONNET_4_6).toBe('claude-sonnet-4-6');
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

  it('retourne SONNET_4_6 (courant) par défaut', () => {
    delete process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET;
    expect(resolveSonnetModel()).toBe(SONNET_4_6);
  });

  it('respecte l override env (rollback legacy)', () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = SONNET_4;
    expect(resolveSonnetModel()).toBe(SONNET_4);
  });

  it('ignore une valeur vide ou whitespace', () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = '   ';
    expect(resolveSonnetModel()).toBe(SONNET_4_6);
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

  it('sonnet → Sonnet 4.6 par défaut', () => {
    expect(resolveModelByFamily('sonnet')).toBe(SONNET_4_6);
  });

  it('haiku → Haiku 4.5 par défaut', () => {
    expect(resolveModelByFamily('haiku')).toBe(HAIKU_4_5);
  });
});

// ============================================================
// Registre tâche → modèle (S22)
// ============================================================

describe('models — constantes DeepSeek', () => {
  it('DEEPSEEK_V4_FLASH vaut deepseek-v4-flash', () => {
    expect(DEEPSEEK_V4_FLASH).toBe('deepseek-v4-flash');
  });

  it('DEEPSEEK_V4_PRO vaut deepseek-v4-pro', () => {
    expect(DEEPSEEK_V4_PRO).toBe('deepseek-v4-pro');
  });
});

describe('models — TASK_MODEL (mapping par défaut)', () => {
  it('route le CLASSEMENT/EXTRACTION vers DeepSeek V4 Flash (S23)', () => {
    for (const task of [
      'inbox-router',
      'email-triage',
      'hot-context-detect',
      'hot-context-modify',
    ] as const) {
      expect(TASK_MODEL[task].provider).toBe('deepseek');
      expect(TASK_MODEL[task].model).toBe(DEEPSEEK_V4_FLASH);
    }
  });

  it('route la RÉDACTION (email-draft) vers DeepSeek V4 Pro (S23)', () => {
    expect(TASK_MODEL['email-draft'].provider).toBe('deepseek');
    expect(TASK_MODEL['email-draft'].model).toBe(DEEPSEEK_V4_PRO);
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

  it('email-triage → deepseek + deepseek-v4-flash par défaut (S23 classement)', () => {
    expect(resolveTaskModel('email-triage')).toEqual({
      provider: 'deepseek',
      model: DEEPSEEK_V4_FLASH,
    });
  });

  it('email-draft → deepseek + deepseek-v4-pro par défaut (S23 rédaction)', () => {
    expect(resolveTaskModel('email-draft')).toEqual({
      provider: 'deepseek',
      model: DEEPSEEK_V4_PRO,
    });
  });

  it('cr → anthropic + Sonnet 4.6 résolu par défaut (S23)', () => {
    expect(resolveTaskModel('cr')).toEqual({
      provider: 'anthropic',
      model: SONNET_4_6,
    });
  });

  it('cr respecte ANTHROPIC_MODEL_OVERRIDE_SONNET via family (rollback legacy)', () => {
    process.env.ANTHROPIC_MODEL_OVERRIDE_SONNET = SONNET_4;
    expect(resolveTaskModel('cr')).toEqual({
      provider: 'anthropic',
      model: SONNET_4,
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
