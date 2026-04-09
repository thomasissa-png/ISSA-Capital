/**
 * Tests unitaires — middleware rateLimitWhatsApp (Phase 6).
 *
 * Couverture (5 tests) :
 *  - Premier appel → allowed, compteurs à 1
 *  - 5 appels en moins de 1 min → le 6e est bloqué (rate_limit_1min)
 *  - Dépassement 1 min réinitialisé après 61s (injection de now)
 *  - 20 appels en moins de 1h → le 21e bloqué (rate_limit_1hour)
 *  - Numéros différents → compteurs indépendants
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  checkWhatsAppRateLimit,
  resetRateLimitForTests,
} from '../rateLimitWhatsApp';
import { makeTempDbPath, cleanupTempDb } from '../../routes/admin/__tests__/_helpers';

const SNAPSHOT = { ...process.env };

const VALID_BASE_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake',
  SESSION_TTL_HOURS: '24',
};

describe('rateLimitWhatsApp', () => {
  let tempDbPath: string;

  beforeEach(async () => {
    tempDbPath = makeTempDbPath();
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_BASE_ENV, { DB_PATH: tempDbPath });

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    const { resetDbForTests, initDatabase } = await import(
      '../../db/connection'
    );
    resetEnvForTests();
    resetLoggerForTests();
    resetDbForTests();
    initDatabase();
    resetRateLimitForTests();
  });

  afterEach(async () => {
    resetRateLimitForTests();
    const { resetDbForTests } = await import('../../db/connection');
    resetDbForTests();
    cleanupTempDb(tempDbPath);

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);
    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    resetEnvForTests();
    resetLoggerForTests();
  });

  it('premier appel → allowed, compteurs à 1', () => {
    const result = checkWhatsAppRateLimit('+33612345678');
    expect(result.allowed).toBe(true);
    expect(result.count1min).toBe(1);
    expect(result.count1hour).toBe(1);
    expect(result.reason).toBeUndefined();
  });

  it('5 appels en < 1 min → le 6e est bloqué (rate_limit_1min)', () => {
    const phone = '+33612345678';
    const t0 = new Date('2026-04-09T10:00:00Z');

    // 5 appels OK
    for (let i = 0; i < 5; i++) {
      const res = checkWhatsAppRateLimit(phone, new Date(t0.getTime() + i * 1000));
      expect(res.allowed).toBe(true);
    }

    // 6ème → bloqué
    const res6 = checkWhatsAppRateLimit(phone, new Date(t0.getTime() + 5500));
    expect(res6.allowed).toBe(false);
    expect(res6.reason).toBe('rate_limit_1min');
    expect(res6.count1min).toBe(5);
  });

  it('après 61 secondes le compteur 1 min est réinitialisé', () => {
    const phone = '+33612345678';
    const t0 = new Date('2026-04-09T10:00:00Z');

    // 5 appels dans la première seconde
    for (let i = 0; i < 5; i++) {
      checkWhatsAppRateLimit(phone, new Date(t0.getTime() + i * 100));
    }

    // 61 secondes plus tard : le 6e doit passer (fenêtre 1 min expirée)
    const t1 = new Date(t0.getTime() + 61 * 1000);
    const res = checkWhatsAppRateLimit(phone, t1);
    expect(res.allowed).toBe(true);
    expect(res.count1min).toBe(1); // nouveau compteur 1 min
    expect(res.count1hour).toBe(6); // mais 1 h accumulés
  });

  it('20 appels en < 1 h → le 21ème bloqué (rate_limit_1hour)', () => {
    const phone = '+33612345678';
    const t0 = new Date('2026-04-09T10:00:00Z');

    // 20 appels étalés sur 1h (toutes les 3 minutes → 0, 180, 360, ... 3420s)
    // Ainsi chaque appel est dans une fenêtre 1 min vide → pas de blocage 1 min.
    for (let i = 0; i < 20; i++) {
      const ts = new Date(t0.getTime() + i * 3 * 60 * 1000);
      const res = checkWhatsAppRateLimit(phone, ts);
      expect(res.allowed).toBe(true);
    }

    // 21ème appel à t0 + 58 min (toujours dans la fenêtre 1 h)
    const t21 = new Date(t0.getTime() + 58 * 60 * 1000 + 30 * 1000);
    const res = checkWhatsAppRateLimit(phone, t21);
    expect(res.allowed).toBe(false);
    expect(res.reason).toBe('rate_limit_1hour');
    expect(res.count1hour).toBe(20);
  });

  it('numéros différents ont des compteurs indépendants', () => {
    const a = '+33600000001';
    const b = '+33600000002';
    const t0 = new Date('2026-04-09T10:00:00Z');

    // 5 appels sur A → 5 OK
    for (let i = 0; i < 5; i++) {
      const res = checkWhatsAppRateLimit(a, new Date(t0.getTime() + i * 1000));
      expect(res.allowed).toBe(true);
    }

    // A le 6e → bloqué
    const aBlocked = checkWhatsAppRateLimit(a, new Date(t0.getTime() + 5500));
    expect(aBlocked.allowed).toBe(false);

    // B le premier → OK (compteur indépendant)
    const bFirst = checkWhatsAppRateLimit(b, new Date(t0.getTime() + 6000));
    expect(bFirst.allowed).toBe(true);
    expect(bFirst.count1min).toBe(1);
  });
});
