/**
 * Tests unitaires du middleware authJwt.
 *
 * Couverture :
 *  - Pas de cookie → 401 AUTH_REQUIRED
 *  - Cookie invalide → 401 AUTH_INVALID
 *  - Cookie valide → req.admin populated + next() appelé
 *  - req.admin contient sub + role
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const SNAPSHOT = { ...process.env };

const VALID_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3001',
  LOG_LEVEL: 'silent',
  ANTHROPIC_API_KEY: 'sk-ant-api03-fake-key-for-tests-only',
  ANTHROPIC_MODEL: 'claude-sonnet-4-5',
  ANTHROPIC_MAX_TOKENS: '2000',
  CRAFT_IC_BASE_URL: 'https://connect.craft.do/links/fake/api/v1',
  CRAFT_IC_KEY: 'pdk_fake_test_key',
  SESSION_TTL_HOURS: '24',
  JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long-for-tests',
  ADMIN_SESSION_TTL_HOURS: '24',
  DB_PATH: '/tmp/authjwt-test-not-used.db',
};

interface MockRequest extends Partial<Request> {
  cookies?: Record<string, string>;
  admin?: { sub: string; role: string };
  path: string;
}

function makeRes(): Response {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res as unknown as Response;
}

describe('middleware/authJwt', () => {
  beforeEach(async () => {
    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, VALID_ENV);

    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    resetEnvForTests();
    resetLoggerForTests();
  });

  afterEach(async () => {
    const { resetEnvForTests } = await import('../../utils/env');
    const { resetLoggerForTests } = await import('../../utils/logger');
    resetEnvForTests();
    resetLoggerForTests();

    for (const key of Object.keys(process.env)) {
      delete process.env[key];
    }
    Object.assign(process.env, SNAPSHOT);
  });

  it('retourne 401 AUTH_REQUIRED si aucun cookie', async () => {
    const { authJwt } = await import('../authJwt');
    const req = { path: '/admin/api/me', cookies: {} } as MockRequest;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authJwt(req as Request, res, next);

    expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    expect((res as unknown as { body: { code: string } }).body.code).toBe(
      'AUTH_REQUIRED',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('retourne 401 AUTH_REQUIRED si req.cookies est undefined', async () => {
    const { authJwt } = await import('../authJwt');
    const req = { path: '/admin/api/me' } as MockRequest;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authJwt(req as Request, res, next);

    expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    expect((res as unknown as { body: { code: string } }).body.code).toBe(
      'AUTH_REQUIRED',
    );
  });

  it('retourne 401 AUTH_INVALID si cookie invalide', async () => {
    const { authJwt } = await import('../authJwt');
    const req = {
      path: '/admin/api/me',
      cookies: { admin_session: 'bidon' },
    } as MockRequest;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authJwt(req as Request, res, next);

    expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    expect((res as unknown as { body: { code: string } }).body.code).toBe(
      'AUTH_INVALID',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('next() appelé et req.admin populé avec un cookie valide', async () => {
    const { generateJwt } = await import('../../services/auth');
    const { authJwt } = await import('../authJwt');
    const { token } = generateJwt('thomas', 'admin');

    const req = {
      path: '/admin/api/me',
      cookies: { admin_session: token },
    } as MockRequest;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authJwt(req as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.admin).toEqual({ sub: 'thomas', role: 'admin' });
  });

  it('next() appelé avec rôle superadmin', async () => {
    const { generateJwt } = await import('../../services/auth');
    const { authJwt } = await import('../authJwt');
    const { token } = generateJwt('thomas', 'superadmin');

    const req = {
      path: '/admin/api/me',
      cookies: { admin_session: token },
    } as MockRequest;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authJwt(req as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.admin?.role).toBe('superadmin');
  });

  it('retourne 401 si token expiré', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { authJwt } = await import('../authJwt');

    const expiredToken = jwt.sign(
      { sub: 'thomas', role: 'admin' },
      VALID_ENV.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: -10 },
    );

    const req = {
      path: '/admin/api/me',
      cookies: { admin_session: expiredToken },
    } as MockRequest;
    const res = makeRes();
    const next = vi.fn() as unknown as NextFunction;

    authJwt(req as Request, res, next);

    expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
    expect((res as unknown as { body: { code: string } }).body.code).toBe(
      'AUTH_INVALID',
    );
  });
});
