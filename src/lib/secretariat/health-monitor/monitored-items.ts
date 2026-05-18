/**
 * Registre des items surveillés par le health-monitor.
 *
 * V1 : 3 items OAuth (ticktick, gmail, drive).
 * Task B/C ajouteront d'autres catégories.
 *
 * Jalon S15.5E — Task A.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import * as tls from 'tls';
import type { MonitoredItem } from './types';
import { getExpiresAt } from './oauth-timestamps';
import { getMonthlyUsageEur, getMonthlyBudgetEur } from './anthropic-usage';

// ============================================================
// Items surveillés
// ============================================================

export const MONITORED_ITEMS: MonitoredItem[] = [
  {
    id: 'ticktick_access_token',
    label: 'TickTick Access Token',
    category: 'oauth',
    thresholdsDays: [30, 7, 1],
    getExpiresAt: async () => getExpiresAt('ticktick'),
    renewalUrl:
      'https://issa-capital.com/api/secretariat/ticktick/oauth/init',
    renewalInstructions:
      'Ouvrir lien, autoriser TickTick, copier TICKTICK_ACCESS_TOKEN dans Replit Secrets, redeploy',
  },
  {
    id: 'gmail_oauth_consent',
    label: 'Gmail OAuth Consent',
    category: 'oauth',
    thresholdsDays: [60, 14, 3],
    getExpiresAt: async () => getExpiresAt('gmail'),
    renewalInstructions:
      'Google révoque consent OAuth après 180j sans usage. Vérifier que cron email-ingest tourne.',
  },
  {
    id: 'drive_oauth_consent',
    label: 'Drive OAuth Consent',
    category: 'oauth',
    thresholdsDays: [60, 14, 3],
    getExpiresAt: async () => getExpiresAt('drive'),
    renewalInstructions:
      'Google révoque consent OAuth après 180j sans usage. Vérifier que pipeline candidat/quittance/CR tourne.',
  },

  // ============================================================
  // Items 4-7 — Task B
  // ============================================================

  {
    id: 'telegram_bot_token',
    label: 'Telegram Bot Token',
    category: 'token',
    thresholdsDays: [],
    getExpiresAt: async () => null,
    getHealthCheck: async () => checkTelegramBot(),
    renewalInstructions:
      'Le bot Telegram ne répond pas. Vérifier TELEGRAM_BOT_TOKEN dans Replit Secrets, et que le bot @AnyaIssaBot existe toujours. Si révoqué : créer nouveau bot via @BotFather, mettre à jour TELEGRAM_BOT_TOKEN.',
  },
  {
    id: 'anthropic_monthly_quota',
    label: 'Quota Anthropic mensuel',
    category: 'quota',
    thresholdsDays: [],
    getExpiresAt: async () => null,
    getHealthCheck: async () => {
      const used = await getMonthlyUsageEur();
      const budget = getMonthlyBudgetEur();
      const ratio = budget > 0 ? used / budget : 0;
      if (ratio >= 0.95) {
        return {
          ok: false,
          reason: `${used.toFixed(2)}€ / ${budget}€ (${(ratio * 100).toFixed(0)}%) — CRITIQUE`,
        };
      }
      if (ratio >= 0.80) {
        return {
          ok: false,
          reason: `${used.toFixed(2)}€ / ${budget}€ (${(ratio * 100).toFixed(0)}%) — WARN`,
        };
      }
      return { ok: true };
    },
    renewalInstructions:
      'Quota Anthropic mensuel atteint. Soit augmenter ANTHROPIC_MONTHLY_BUDGET_EUR dans Replit Secrets, soit attendre le 1er du mois (reset auto).',
  },
  {
    id: 'domain_renewal',
    label: 'Renouvellement domaine issa-capital.com',
    category: 'domain',
    thresholdsDays: [60, 30, 7],
    getExpiresAt: async () => {
      const env = process.env.DOMAIN_RENEWAL_DATE;
      if (!env) return null;
      const date = new Date(env);
      return isNaN(date.getTime()) ? null : date;
    },
    renewalInstructions:
      'Le domaine issa-capital.com arrive à expiration. Renouveler chez le registrar (probablement OVH ou Gandi). Mettre à jour DOMAIN_RENEWAL_DATE dans Replit Secrets après renouvellement.',
  },
  {
    id: 'ssl_certificate',
    label: 'Certificat SSL issa-capital.com',
    category: 'cert',
    thresholdsDays: [30, 14, 7],
    getExpiresAt: async () => checkSslExpiry('issa-capital.com'),
    renewalInstructions:
      'Le certificat SSL d\'issa-capital.com arrive à expiration. Normalement renouvelé auto par Replit/Let\'s Encrypt. Si pas renouvelé : vérifier dans Replit Deployments > Settings > Custom Domain.',
  },
];

// ============================================================
// Helpers — Telegram bot health check (item 4)
// ============================================================

/** Répertoire de persistance pour le compteur de fails Telegram */
const TELEGRAM_HEALTH_DIR = existsSync('/home/runner')
  ? '/home/runner/issa-data'
  : '/tmp/issa-data';
const TELEGRAM_HEALTH_PATH = resolve(TELEGRAM_HEALTH_DIR, 'telegram-health.json');

interface TelegramHealthStore {
  consecutiveFails: number;
}

function loadTelegramHealth(): TelegramHealthStore {
  try {
    if (!existsSync(TELEGRAM_HEALTH_PATH)) return { consecutiveFails: 0 };
    const raw = readFileSync(TELEGRAM_HEALTH_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as TelegramHealthStore;
    return typeof parsed.consecutiveFails === 'number' ? parsed : { consecutiveFails: 0 };
  } catch {
    return { consecutiveFails: 0 };
  }
}

function saveTelegramHealth(store: TelegramHealthStore): void {
  if (!existsSync(TELEGRAM_HEALTH_DIR)) {
    mkdirSync(TELEGRAM_HEALTH_DIR, { recursive: true });
  }
  const tmpPath = `${TELEGRAM_HEALTH_PATH}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(store), 'utf-8');
  renameSync(tmpPath, TELEGRAM_HEALTH_PATH);
}

/**
 * Vérifie que le bot Telegram répond via getMe.
 * Alerte 'critical' seulement si 2 fails consécutifs (évite les faux positifs réseau).
 */
async function checkTelegramBot(): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, reason: 'TELEGRAM_BOT_TOKEN non défini dans les Secrets' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.ok) {
      // Reset compteur sur succès
      saveTelegramHealth({ consecutiveFails: 0 });
      return { ok: true };
    }

    // Fail — incrémenter le compteur
    const store = loadTelegramHealth();
    store.consecutiveFails += 1;
    saveTelegramHealth(store);

    if (store.consecutiveFails >= 2) {
      return {
        ok: false,
        reason: `getMe HTTP ${response.status} — ${store.consecutiveFails} fails consécutifs`,
      };
    }

    // Premier fail → on laisse passer (pas encore critical)
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Fail — incrémenter le compteur
    const store = loadTelegramHealth();
    store.consecutiveFails += 1;
    saveTelegramHealth(store);

    if (store.consecutiveFails >= 2) {
      return { ok: false, reason: `getMe erreur : ${msg} — ${store.consecutiveFails} fails consécutifs` };
    }

    return { ok: true };
  }
}

// ============================================================
// Helpers — SSL certificate expiry check (item 7)
// ============================================================

/**
 * Récupère la date d'expiration du certificat SSL d'un domaine.
 * Utilise node:tls avec timeout 5s.
 * Retourne null si erreur (domaine injoignable, etc.).
 */
function checkSslExpiry(hostname: string): Promise<Date | null> {
  return new Promise((resolvePromise) => {
    const timer = setTimeout(() => {
      socket.destroy();
      resolvePromise(null);
    }, 5000);

    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, rejectUnauthorized: false },
      () => {
        try {
          const cert = socket.getPeerCertificate();
          if (cert && cert.valid_to) {
            const expiryDate = new Date(cert.valid_to);
            clearTimeout(timer);
            socket.destroy();
            resolvePromise(isNaN(expiryDate.getTime()) ? null : expiryDate);
          } else {
            clearTimeout(timer);
            socket.destroy();
            resolvePromise(null);
          }
        } catch {
          clearTimeout(timer);
          socket.destroy();
          resolvePromise(null);
        }
      },
    );

    socket.on('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolvePromise(null);
    });
  });
}

/** Expose le chemin du store Telegram (pour les tests) */
export function getTelegramHealthPath(): string {
  return TELEGRAM_HEALTH_PATH;
}
