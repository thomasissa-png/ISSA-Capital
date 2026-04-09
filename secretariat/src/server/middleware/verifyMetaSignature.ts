/**
 * Middleware Express — vérification de la signature HMAC d'un webhook Meta.
 *
 * Meta signe chaque webhook WhatsApp avec l'App Secret via HMAC-SHA256 et
 * place la signature dans le header `X-Hub-Signature-256: sha256=<hex>`.
 *
 * Ce middleware :
 *  1. Exige le header `X-Hub-Signature-256`.
 *  2. Calcule HMAC-SHA256 sur le raw body en utilisant `env.WHATSAPP_WEBHOOK_SECRET`.
 *  3. Compare en temps constant via `crypto.timingSafeEqual` (anti-timing attack).
 *  4. 401 si header absent / format invalide / signature KO.
 *
 * Dépendance rawBody :
 *  Express parse le body JSON AVANT qu'on arrive ici. Le middleware lit donc
 *  `req.rawBody` — qui doit avoir été capturé en amont par l'option `verify`
 *  passée à `express.json()` dans `index.ts`. Si `rawBody` est absent, on
 *  rejette (401) plutôt que de re-sérialiser (risque de divergence bytes).
 *
 * Sources :
 *  - docs/ia/secretariat-architecture.md Section 7.2 (webhook Meta).
 *  - Meta security : https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads
 */

import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import { getEnv } from '../utils/env';
import { getLogger } from '../utils/logger';

/**
 * Extension typée de `Request` pour exposer le rawBody capturé par
 * `express.json({ verify: ... })`.
 */
export interface RequestWithRawBody extends Request {
  rawBody?: string;
}

/**
 * Vérifie la signature Meta d'un webhook WhatsApp.
 *
 * @param req.headers['x-hub-signature-256'] format attendu : `sha256=<hex>`
 * @param req.rawBody chaîne UTF-8 du body brut, capturé par express.json verify
 */
export function verifyMetaSignature(
  req: RequestWithRawBody,
  res: Response,
  next: NextFunction,
): void {
  const log = getLogger();
  const env = getEnv();

  // --- 0. Configuration présente ? ---
  const secret = env.WHATSAPP_WEBHOOK_SECRET;
  if (
    secret === undefined ||
    secret.trim() === '' ||
    secret === '__TO_FILL__'
  ) {
    log.error('[whatsapp] WHATSAPP_WEBHOOK_SECRET absent — webhook non vérifiable');
    res
      .status(500)
      .json({ error: 'Webhook mal configuré côté serveur', code: 'WEBHOOK_MISCONFIGURED' });
    return;
  }

  // --- 1. Header présent ? ---
  const header = req.headers['x-hub-signature-256'];
  if (typeof header !== 'string' || header.length === 0) {
    log.warn(
      { ip: req.ip, path: req.path },
      '[whatsapp] webhook refusé : header X-Hub-Signature-256 manquant',
    );
    res.status(401).json({ error: 'Signature manquante', code: 'MISSING_SIGNATURE' });
    return;
  }

  // --- 2. Format attendu : "sha256=<hex>" ---
  if (!header.startsWith('sha256=')) {
    log.warn(
      { ip: req.ip, path: req.path },
      '[whatsapp] webhook refusé : format de signature inattendu',
    );
    res.status(401).json({ error: 'Format de signature invalide', code: 'INVALID_SIGNATURE_FORMAT' });
    return;
  }

  const providedHex = header.slice('sha256='.length);
  // Validation format hex pour éviter un crash sur Buffer.from('…', 'hex')
  if (!/^[0-9a-fA-F]{64}$/.test(providedHex)) {
    log.warn(
      { ip: req.ip },
      '[whatsapp] webhook refusé : signature non-hex ou longueur invalide',
    );
    res.status(401).json({ error: 'Signature invalide', code: 'INVALID_SIGNATURE' });
    return;
  }

  // --- 3. rawBody capturé par express.json ? ---
  const rawBody = req.rawBody;
  if (typeof rawBody !== 'string') {
    log.error(
      '[whatsapp] webhook refusé : rawBody absent — express.json verify non configuré',
    );
    res.status(401).json({ error: 'Corps de requête non capturé', code: 'RAW_BODY_MISSING' });
    return;
  }

  // --- 4. Calcul HMAC et comparaison en temps constant ---
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const providedBuf = Buffer.from(providedHex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  if (providedBuf.length !== expectedBuf.length) {
    log.warn({ ip: req.ip }, '[whatsapp] webhook refusé : longueur signature inattendue');
    res.status(401).json({ error: 'Signature invalide', code: 'INVALID_SIGNATURE' });
    return;
  }

  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    log.warn(
      { ip: req.ip, path: req.path },
      '[whatsapp] webhook refusé : signature HMAC invalide',
    );
    res.status(401).json({ error: 'Signature invalide', code: 'INVALID_SIGNATURE' });
    return;
  }

  // Signature valide → propagation au handler suivant
  next();
}
