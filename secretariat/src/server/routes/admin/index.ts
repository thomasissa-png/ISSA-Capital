/**
 * Router agrégateur admin — monté sur `/admin` dans `src/server/index.ts`.
 *
 * Responsabilités :
 *  - Parser les cookies (cookie-parser) pour que `authJwt` puisse lire
 *    `req.cookies.admin_session`
 *  - Servir les HTML statiques : /admin/login.html, /admin/dashboard.html
 *  - Exposer les routes publiques : POST /admin/login (et /admin/logout qu'on
 *    rend public pour qu'il clear le cookie même si expiré)
 *  - Protéger toutes les routes /admin/api/* par authJwt + requireAdmin
 *  - Monter les sous-routers :
 *      /admin/api/contacts       → contactsRouter
 *      /admin/api/drafts         → draftsPublishedRouter (partage router)
 *      /admin/api/published      → draftsPublishedRouter (même router, paths séparés)
 *      /admin/api/logs           → logsRouter
 *      /admin/api/settings       → settingsRouter
 *      /admin/api/me             → login.me (via loginRouter)
 *
 * Hiérarchie des middlewares :
 *   /admin
 *     cookieParser
 *     login.html / dashboard.html (static)
 *     loginRouter (POST /login, POST /logout — public)
 *     authJwt (partout à partir d'ici)
 *       loginRouter (GET /me — protégé)
 *       requireAdmin
 *         /api/contacts, /api/drafts, /api/published, /api/logs, /api/settings
 */

import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { Router, type Request, type Response } from 'express';

import { authJwt } from '../../middleware/authJwt';
import { requireAdmin } from '../../middleware/requireAdmin';
import { contactsRouter } from './contacts';
import { draftsPublishedRouter } from './drafts-published';
import { loginRouter } from './login';
import { logsRouter } from './logs';
import { settingsRouter } from './settings';

export const adminRouter = Router();

// ------------------------------------------------------------
// Middlewares communs à toutes les routes /admin
// ------------------------------------------------------------

adminRouter.use(cookieParser());

// ------------------------------------------------------------
// HTML statique (pages login + dashboard)
// ------------------------------------------------------------
// Ces pages sont publiques (login.html) ou protégées par JS côté client
// (dashboard.html redirige vers /admin/login.html si /admin/api/me renvoie 401).
// Le vrai contrôle d'accès est côté API.

const PUBLIC_ADMIN_DIR = path.join(__dirname, '../../../../public/admin');

adminRouter.get('/', (_req: Request, res: Response): void => {
  res.redirect('/admin/login.html');
});

adminRouter.get('/login.html', (_req: Request, res: Response): void => {
  res.sendFile(path.join(PUBLIC_ADMIN_DIR, 'login.html'));
});

adminRouter.get('/dashboard.html', (_req: Request, res: Response): void => {
  res.sendFile(path.join(PUBLIC_ADMIN_DIR, 'dashboard.html'));
});

// Assets CSS / JS — servis sous /admin/static/*
// (pas besoin de cookie-parser en amont — Express serve static marche tel quel)
adminRouter.use('/static', express.static(PUBLIC_ADMIN_DIR));

// ------------------------------------------------------------
// Routes publiques API (login, logout)
// ------------------------------------------------------------

adminRouter.use('/', loginRouter);
// loginRouter expose :
//   POST /login   → public (génère JWT)
//   POST /logout  → public (clear cookie — même si JWT expiré, pas de 401)
//   GET  /me      → protégé ci-dessous

// ------------------------------------------------------------
// Routes protégées API
// ------------------------------------------------------------

// /admin/api/me est protégée (doit retourner 401 sans cookie valide)
adminRouter.get('/api/me', authJwt, (req: Request, res: Response): void => {
  if (req.admin === undefined) {
    res.status(401).json({ error: 'Non authentifié', code: 'AUTH_REQUIRED' });
    return;
  }
  res.status(200).json({
    sub: req.admin.sub,
    role: req.admin.role,
  });
});

// Routes API protégées
adminRouter.use('/api/contacts', authJwt, requireAdmin, contactsRouter);
adminRouter.use('/api', authJwt, requireAdmin, draftsPublishedRouter);
adminRouter.use('/api/logs', authJwt, requireAdmin, logsRouter);
adminRouter.use('/api/settings', authJwt, requireAdmin, settingsRouter);
