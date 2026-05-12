/**
 * GET /api/telegram/setup — Configure le menu auto-complétion des commandes Telegram.
 *
 * Lit les commandes depuis le workflow registry + commandes système,
 * puis appelle l'API Telegram setMyCommands pour mettre à jour le menu.
 *
 * Protégé par un token admin (ADMIN_SETUP_TOKEN dans Replit Secrets).
 * Thomas visite cette URL après chaque déploiement pour synchroniser le menu.
 *
 * Usage : GET /api/telegram/setup?token=<ADMIN_SETUP_TOKEN>
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { listWorkflowCommands } from '@/lib/secretariat/workflows/registry';

const TELEGRAM_API = 'https://api.telegram.org/bot';

interface TelegramCommand {
  command: string;
  description: string;
}

/** Commandes système (pas liées à un workflow) */
const SYSTEM_COMMANDS: TelegramCommand[] = [
  { command: 'status', description: "Voir l'état d'Anya (mode actif, photos en attente)" },
  { command: 'inbox', description: 'Revenir au mode inbox (réception simple)' },
  { command: 'cancel', description: 'Annuler le workflow en cours' },
];

export async function GET(request: Request): Promise<Response> {
  // --- Vérification du token admin ---
  const adminToken = process.env.ADMIN_SETUP_TOKEN;
  if (!adminToken) {
    return new Response(
      htmlPage(
        'Configuration manquante',
        '#dc2626',
        '<p>ADMIN_SETUP_TOKEN non configuré dans les Secrets Replit.</p>' +
          '<p>Ajoute un token avec <code>openssl rand -hex 32</code> puis configure-le dans Replit Secrets.</p>',
      ),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const url = new URL(request.url);
  const provided = url.searchParams.get('token');

  if (provided !== adminToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  // --- Construction de la liste de commandes ---
  const workflowCommands = listWorkflowCommands();
  const allCommands: TelegramCommand[] = [...workflowCommands, ...SYSTEM_COMMANDS];

  // --- Appel API Telegram setMyCommands ---
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || botToken === '__TO_FILL__') {
    return new Response(
      htmlPage(
        'Configuration manquante',
        '#dc2626',
        '<p>TELEGRAM_BOT_TOKEN manquant ou placeholder.</p>',
      ),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const response = await fetch(`${TELEGRAM_API}${botToken}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commands: allCommands }),
    signal: AbortSignal.timeout(10_000),
  });

  const data = (await response.json()) as Record<string, unknown>;

  const commandsList = allCommands
    .map((c) => `<li><code>/${c.command}</code> — ${c.description}</li>`)
    .join('');

  const statusColor = response.ok ? '#16a34a' : '#dc2626';
  const statusIcon = response.ok ? 'Menu commandes mis à jour' : 'Erreur Telegram';

  return new Response(
    htmlPage(
      statusIcon,
      statusColor,
      `<pre style="background:#f5f5f5;padding:12px;border-radius:6px;overflow-x:auto;">${JSON.stringify(data, null, 2)}</pre>` +
        `<h2>${allCommands.length} commandes configurées :</h2>` +
        `<ul>${commandsList}</ul>` +
        `<p style="margin-top:20px;color:#666;">Teste en tapant <code>/</code> dans le chat Telegram avec Anya.</p>`,
    ),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/** Helper — génère une page HTML minimale avec titre coloré */
function htmlPage(title: string, color: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:sans-serif;max-width:700px;margin:40px auto;padding:20px;">
  <h1 style="color:${color}">${title}</h1>
  ${body}
</body>
</html>`;
}
