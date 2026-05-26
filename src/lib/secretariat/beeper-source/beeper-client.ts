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
async function getJson(path: string): Promise<{ status: number; text: string }> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(BEEPER_TIMEOUT_MS),
  });
  return { status: res.status, text: await res.text().catch(() => '') };
}

export async function probeBeeperApi(): Promise<void> {
  // L'API interne /api/v1/* est accessible en localhost sans Bearer (le token
  // server.json est un token Matrix, refusé par /v1/*). On explore /api/v1/.
  const chatPaths = ['/api/v1/chats?limit=3', '/api/v1/chats', '/api/v1/accounts'];
  let firstChatId: string | undefined;
  for (const p of chatPaths) {
    try {
      const { status, text } = await getJson(p);
      console.warn(`[beeper-probe] GET ${p} → ${status} :: ${text.slice(0, 700).replace(/\s+/g, ' ')}`);
      if (!firstChatId && status === 200 && text.trim()) {
        try {
          const data = JSON.parse(text) as unknown;
          const items = Array.isArray(data)
            ? data
            : ((data as Record<string, unknown>).items as unknown[]) ??
              ((data as Record<string, unknown>).chats as unknown[]) ??
              [];
          const first = items[0] as Record<string, unknown> | undefined;
          firstChatId = (first?.id ?? first?.chatID ?? first?.guid) as string | undefined;
        } catch {
          /* pas du JSON parseable */
        }
      }
    } catch (err) {
      console.warn(`[beeper-probe] GET ${p} → ERREUR ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // Découverte de l'endpoint messages à partir d'un chat id réel.
  if (firstChatId) {
    const enc = encodeURIComponent(firstChatId);
    for (const p of [
      `/api/v1/chats/${enc}/messages?limit=2`,
      `/api/v1/messages?chatID=${enc}&limit=2`,
      `/api/v1/messages?chat_id=${enc}&limit=2`,
    ]) {
      try {
        const { status, text } = await getJson(p);
        console.warn(`[beeper-probe] GET ${p} → ${status} :: ${text.slice(0, 500).replace(/\s+/g, ' ')}`);
      } catch (err) {
        console.warn(`[beeper-probe] GET ${p} → ERREUR ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else {
    console.warn('[beeper-probe] aucun chat id extrait — schéma /api/v1/chats à inspecter');
  }
}
