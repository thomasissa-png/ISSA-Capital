/**
 * Error handler Express — capture toutes les erreurs non gérées.
 *
 * Principes :
 *  - Les stack traces NE sont JAMAIS renvoyées au client (fuite d'info)
 *  - Les erreurs sont loggées via pino avec redaction automatique des secrets
 *  - Les erreurs attendues (AppError) ont un code HTTP et un message safe
 *  - Les erreurs inattendues retournent 500 + message générique
 */

import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { getLogger } from '../utils/logger';

/**
 * Erreur applicative typée. Les erreurs non-AppError sont traitées comme 500.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

interface ErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Middleware Express de gestion d'erreur.
 * DOIT être monté APRÈS toutes les routes : `app.use(errorHandler)`.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const log = getLogger();

  // Erreur Zod (validation input) → 400
  if (err instanceof ZodError) {
    const body: ErrorResponse = {
      error: 'Requête invalide',
      code: 'VALIDATION_ERROR',
      details: {
        issues: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    };
    log.warn({ path: req.path, issues: err.issues }, 'validation échouée');
    res.status(400).json(body);
    return;
  }

  // Erreur applicative typée → status défini par le code
  if (err instanceof AppError) {
    const body: ErrorResponse = {
      error: err.message,
      code: err.code,
    };
    if (err.details) {
      body.details = err.details;
    }
    log.warn(
      { path: req.path, code: err.code, statusCode: err.statusCode },
      'AppError',
    );
    res.status(err.statusCode).json(body);
    return;
  }

  // Erreur inattendue → 500 générique (pas de fuite de stack)
  const body: ErrorResponse = {
    error: 'Erreur interne du serveur',
    code: 'INTERNAL_ERROR',
  };

  log.error({ err, path: req.path, method: req.method }, 'erreur non gérée');
  res.status(500).json(body);
}

/**
 * Handler 404 — monté en dernier middleware avant `errorHandler`.
 * Transforme toute route inconnue en AppError(404).
 */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ErrorResponse = {
    error: `Route introuvable : ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
  };
  res.status(404).json(body);
}
