/**
 * Démarrage serveur — runtime Node uniquement (importé par instrumentation.ts).
 *
 * PROBLÈME (S23) : sur le VPS, `next start` ne peuple pas process.env depuis
 * `.env.local` pour les accès DYNAMIQUES (`process.env[clé]`). Seuls les accès
 * statiques sont inlinés au build. Le code multi-boîtes Outlook lit des clés
 * dynamiques (`OUTLOOK_*_<BOX>`) → invisibles au runtime malgré un .env.local
 * correct.
 *
 * Fix : charger explicitement .env.local au démarrage via @next/env (le loader
 * de Next, qui lit bien le fichier), peuplant process.env pour tout le process.
 * Idempotent, sans effet sur les accès déjà inlinés.
 */
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

// Diagnostic (noms uniquement, jamais les valeurs) — visible au journal.
const keys = [
  'OUTLOOK_CLIENT_ID_SARANI',
  'OUTLOOK_TENANT_ID_SARANI',
  'OUTLOOK_CLIENT_SECRET_SARANI',
  'OUTLOOK_CLIENT_ID_VERSI',
  'OUTLOOK_TENANT_ID_VERSI',
  'OUTLOOK_CLIENT_SECRET_VERSI',
];
const status = keys.map((k) => `${k}=${process.env[k] ? 'OK' : 'X'}`).join(' ');
console.warn(`[startup-env] après loadEnvConfig — ${status}`);
