import type { Resend as ResendClient } from 'resend';
import { getServerEnv } from '@/lib/env';
import type { ContactRequest } from '@/lib/contactSchema';
import { sanitizeString } from '@/lib/sanitize';

/**
 * Client Resend — instancié à la première utilisation via dynamic import.
 * L'import dynamique garantit que le module `resend` n'est jamais chargé
 * pendant la phase `Collecting page data` de `next build`, ce qui évite
 * un crash sur Replit si la variable d'environnement n'est pas encore
 * disponible au moment du build.
 */
let client: ResendClient | null = null;

async function getClient(apiKey: string): Promise<ResendClient> {
  if (!client) {
    const { Resend } = await import('resend');
    client = new Resend(apiKey);
  }
  return client;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSubject(req: ContactRequest): string {
  switch (req.variant) {
    case 'contact':
      return `[ISSA Capital] Contact — ${req.subject}`;
    case 'accompagnement':
      return `[ISSA Capital] Accompagnement — ${req.name}`;
    case 'opportunite':
      return `[ISSA Capital] Opportunité ${req.opportunityType} — ${req.name}`;
  }
}

function buildBody(req: ContactRequest): { html: string; text: string } {
  const lines: Array<[string, string]> = [
    ['Nom', sanitizeString(req.name)],
    ['Email', sanitizeString(req.email)],
  ];

  if (req.variant === 'contact') {
    lines.push(['Sujet', req.subject]);
    lines.push(['Message', sanitizeString(req.message)]);
  } else if (req.variant === 'accompagnement') {
    lines.push(['Type', 'Demande accompagnement']);
    lines.push(['Message', sanitizeString(req.message)]);
  } else {
    lines.push(['Type opportunité', req.opportunityType]);
    if (req.location) lines.push(['Localisation', sanitizeString(req.location)]);
    lines.push(['Description', sanitizeString(req.description)]);
    if (req.ticket) lines.push(['Ticket indicatif', sanitizeString(req.ticket)]);
    if (req.source) lines.push(['Source', req.source]);
  }

  const text = lines.map(([k, v]) => `${k} : ${v}`).join('\n');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #0a0a0a; max-width: 640px;">
      <h1 style="font-family: Georgia, serif; font-size: 24px; color: #0a0a0a; border-bottom: 2px solid #c4935a; padding-bottom: 12px;">Nouvelle prise de contact — ISSA Capital</h1>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        ${lines
          .map(
            ([k, v]) => `
            <tr>
              <td style="padding: 8px 0; color: #525252; font-size: 14px; width: 160px; vertical-align: top;">${escapeHtml(k)}</td>
              <td style="padding: 8px 0; color: #0a0a0a; font-size: 14px;">${escapeHtml(v).replace(/\n/g, '<br>')}</td>
            </tr>`,
          )
          .join('')}
      </table>
      <p style="margin-top: 24px; font-size: 12px; color: #6b6b6b;">
        Transmis depuis le formulaire du site issa-capital.com — variant : ${req.variant}
      </p>
    </div>
  `;

  return { html, text };
}

export type SendResult =
  | { success: true; id: string }
  | { success: false; error: string };

export async function sendContactEmail(req: ContactRequest): Promise<SendResult> {
  const env = getServerEnv();

  if (!env.RESEND_API_KEY || env.RESEND_API_KEY.startsWith('re_xxxxx')) {
    // eslint-disable-next-line no-console
    console.warn('[resend] Clé API absente ou placeholder — email non envoyé.');
    return { success: false, error: 'Service email non configuré' };
  }
  if (!env.RESEND_FROM_EMAIL || !env.RESEND_TO_EMAIL) {
    return { success: false, error: 'Configuration email manquante' };
  }

  const { html, text } = buildBody(req);
  const subject = buildSubject(req);

  try {
    const resend = await getClient(env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: env.RESEND_TO_EMAIL,
      replyTo: req.email,
      subject,
      html,
      text,
    });

    if (result.error) {
      return { success: false, error: result.error.message };
    }
    return { success: true, id: result.data?.id ?? 'unknown' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    // eslint-disable-next-line no-console
    console.error('[resend] Erreur envoi :', message);
    return { success: false, error: 'Échec de l envoi de l email' };
  }
}
