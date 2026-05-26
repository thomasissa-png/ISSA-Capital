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

// Test de connectivité Outlook (S23) — valide refresh token + lecture identité
// de chaque boîte. Lecture seule, best-effort, non bloquant.
void (async () => {
  try {
    const { OUTLOOK_BOXES, checkConnectivity } = await import(
      './lib/secretariat/outlook-source/outlook-client'
    );
    for (const box of OUTLOOK_BOXES) {
      const r = await checkConnectivity(box);
      console.warn(
        `[startup-outlook] ${box} — ${r.ok ? `OK (${r.email})` : `ÉCHEC : ${r.error}`}`,
      );
    }
  } catch (err) {
    console.warn(
      `[startup-outlook] test connectivité échoué : ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Sonde Beeper (Phase 2 — découverte API + validation token). Best-effort.
  try {
    const { probeBeeperApi, isBeeperConfigured } = await import(
      './lib/secretariat/beeper-source/beeper-client'
    );
    if (isBeeperConfigured()) {
      await probeBeeperApi();
    } else {
      console.warn('[startup-beeper] BEEPER_ACCESS_TOKEN absent — sonde ignorée');
    }
  } catch (err) {
    console.warn(
      `[startup-beeper] sonde échouée : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
})();

