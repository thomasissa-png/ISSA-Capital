/**
 * POST /api/secretariat/ticktick/webhook
 *
 * Endpoint webhook TickTick — reçoit les événements de complétion/modification.
 * Quand une tâche créée par Anya est complétée par Thomas dans TickTick,
 * Anya est notifiée via Telegram.
 *
 * Auth : secret TICKTICK_WEBHOOK_SECRET dans le body ou header.
 *
 * Jalon 5C — Session 15.
 */

import { type NextRequest, NextResponse } from 'next/server';
import type { TickTickWebhookEvent } from '@/lib/secretariat/ticktick/types';

// ============================================================
// POST handler
// ============================================================

export async function POST(req: NextRequest): Promise<Response> {
  const webhookSecret = process.env.TICKTICK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[ticktick-webhook] TICKTICK_WEBHOOK_SECRET non configuré');
    return NextResponse.json({ ok: false, error: 'Non configuré' }, { status: 500 });
  }

  // Vérifier l'auth (TickTick peut envoyer le secret dans un header ou le body)
  const headerSecret = req.headers.get('x-webhook-secret');

  let body: TickTickWebhookEvent;
  try {
    body = (await req.json()) as TickTickWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: 'Body JSON invalide' }, { status: 400 });
  }

  // Vérifier le secret (header ou payload)
  const receivedSecret = headerSecret ?? (body as unknown as { secret?: string }).secret;
  if (!receivedSecret || receivedSecret !== webhookSecret) {
    return NextResponse.json({ ok: false, error: 'Non autorisé' }, { status: 401 });
  }

  console.warn(`[ticktick-webhook] événement reçu : ${body.event}`);

  // Traiter les événements de complétion
  if (body.event === 'task.completed' || (body.payload?.status === 2)) {
    await handleTaskCompleted(body);
  }

  return NextResponse.json({ ok: true });
}

// ============================================================
// Handlers
// ============================================================

async function handleTaskCompleted(event: TickTickWebhookEvent): Promise<void> {
  const taskTitle = event.payload?.title ?? 'Tâche inconnue';
  const taskId = event.payload?.taskId ?? 'unknown';

  console.warn(`[ticktick-webhook] Tâche complétée : "${taskTitle}" (id=${taskId})`);

  // Notification Telegram à Thomas
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID_THOMAS;

  if (!telegramBotToken || !telegramChatId) {
    console.warn('[ticktick-webhook] Telegram non configuré — notification skip');
    return;
  }

  const message = `✅ Tâche TickTick complétée : "${taskTitle}"`;

  try {
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (err) {
    console.warn(
      `[ticktick-webhook] erreur notification Telegram : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
