/**
 * Client Beeper Server (WhatsApp via bridge) — Phase 2 ingestion.
 *
 * Le Beeper Server tourne sur le VPS (127.0.0.1:23374), lien WhatsApp établi
 * (Phase 1, cf. vault `08. Outils/Anya/À développer/beeper-server/`). Anya
 * (même VPS) interroge son API REST locale avec un Bearer token.
 *
 * Token : `BEEPER_ACCESS_TOKEN` dans .env.local (valeur = auth.accessToken de
 * /root/.beeper/targets/server.json, recopiée côté compte `thomas`).
 *
 * 🔒 LECTURE SEULE. Ce module ne fait QUE lire (chats/messages). Aucun envoi
 * (pas de `send`), aucune écriture WhatsApp — cohérent avec l'invariant règle 11.
 */

import { loadEnvConfig } from '@next/env';

let envLoaded = false;
function ensureEnv(): void {
  if (envLoaded) return;
  try {
    loadEnvConfig(process.cwd());
  } catch {
    /* best-effort */
  }
  envLoaded = true;
}

const BEEPER_TIMEOUT_MS = 20_000;

function baseUrl(): string {
  ensureEnv();
  return process.env.BEEPER_API_URL ?? 'http://127.0.0.1:23374';
}

function token(): string | undefined {
  ensureEnv();
  return process.env.BEEPER_ACCESS_TOKEN;
}

export function isBeeperConfigured(): boolean {
  return Boolean(token());
}

/**
 * Sonde de découverte d'API : essaie plusieurs endpoints candidats avec le
 * Bearer token et logue le statut + un extrait de réponse. Sert à identifier
 * les bons chemins REST du Beeper Server (la doc runbook ne couvre que la CLI).
 * Lecture seule.
 */
export async function probeBeeperApi(): Promise<void> {
  const tok = token();
  if (!tok) {
    console.warn('[beeper-probe] BEEPER_ACCESS_TOKEN absent du .env.local — rien à sonder');
    return;
  }
  const base = baseUrl();
  const candidates = [
    '/v1/chats',
    '/api/v1/chats',
    '/v1/accounts',
    '/api/v1/accounts',
    '/v1/get-chats',
    '/v0/get-chats',
    '/v1/me',
    '/',
  ];
  for (const path of candidates) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${tok}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(BEEPER_TIMEOUT_MS),
      });
      const body = await res.text().catch(() => '');
      console.warn(
        `[beeper-probe] GET ${path} → ${res.status} ${res.statusText} :: ${body.slice(0, 180).replace(/\s+/g, ' ')}`,
      );
    } catch (err) {
      console.warn(
        `[beeper-probe] GET ${path} → ERREUR ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
