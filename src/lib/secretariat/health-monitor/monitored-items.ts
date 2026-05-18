/**
 * Registre des items surveillés par le health-monitor.
 *
 * V1 : 3 items OAuth (ticktick, gmail, drive).
 * Task B/C ajouteront d'autres catégories.
 *
 * Jalon S15.5E — Task A.
 */

import type { MonitoredItem } from './types';
import { getExpiresAt } from './oauth-timestamps';

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
];
