import { NextResponse, type NextRequest } from 'next/server';
import { contactRequestSchema } from '@/lib/contactSchema';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendContactEmail } from '@/lib/resend';

/**
 * POST /api/contact
 *
 * Handle les 3 variants de formulaire (contact, accompagnement, opportunite).
 * Pipeline :
 *  1. Extraction IP + rate limit (5 req / 10 min par défaut)
 *  2. Parsing JSON
 *  3. Validation Zod stricte (discriminated union sur `variant`)
 *  4. Vérification honeypot (champ `website` — doit être vide)
 *  5. Envoi via Resend
 *
 * Réponses :
 *  - 200 : { success: true }
 *  - 400 : { success: false, error: 'validation', fields }
 *  - 429 : { success: false, error: 'rate_limit', retryAfter }
 *  - 500 : { success: false, error: 'server' }
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? 'unknown';
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`contact:${ip}`);

  if (!rl.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'rate_limit',
        message: 'Trop de demandes. Merci de réessayer plus tard.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfterSeconds),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid_json', message: 'Requête invalide.' },
      { status: 400 },
    );
  }

  const parsed = contactRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'validation',
        message: 'Certains champs sont invalides.',
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  // Honeypot : on répond 200 pour ne pas donner d'info aux bots, mais on n'envoie rien.
  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  const result = await sendContactEmail(parsed.data);
  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'server',
        message:
          "Le message n'a pas pu être envoyé. Merci d'écrire directement à contact@issa-capital.com.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { success: true, message: 'Votre message a été transmis.' },
    { status: 200 },
  );
}
