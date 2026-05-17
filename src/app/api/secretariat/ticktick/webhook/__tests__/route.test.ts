/**
 * Tests unitaires — POST /api/secretariat/ticktick/webhook
 *
 * Vérifie l'auth par secret, le dispatch des événements, la notification Telegram.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================
// Mocks
// ============================================================

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ ok: true }),
});
vi.stubGlobal('fetch', mockFetch);

// Env vars
vi.stubEnv('TICKTICK_WEBHOOK_SECRET', 'webhook-secret-test');
vi.stubEnv('TELEGRAM_BOT_TOKEN', 'fake-bot-token');
vi.stubEnv('TELEGRAM_CHAT_ID_THOMAS', '123456');

// ============================================================
// Import du module testé (APRÈS les mocks)
// ============================================================

import { POST } from '../route';

// ============================================================
// Helpers
// ============================================================

function makeWebhookRequest(
  body: unknown,
  headerSecret?: string,
): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (headerSecret) {
    headers['x-webhook-secret'] = headerSecret;
  }

  return new NextRequest('http://localhost:3000/api/secretariat/ticktick/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
});

// ============================================================
// Tests
// ============================================================

describe('POST /api/secretariat/ticktick/webhook', () => {
  it('retourne 401 si le secret est absent', async () => {
    const req = makeWebhookRequest({ event: 'task.completed', payload: {} });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('retourne 401 si le secret est incorrect', async () => {
    const req = makeWebhookRequest(
      { event: 'task.completed', payload: {} },
      'wrong-secret',
    );
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('retourne 200 avec secret correct dans le header', async () => {
    const req = makeWebhookRequest(
      { event: 'task.created', payload: { taskId: 't1', title: 'Test' } },
      'webhook-secret-test',
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('envoie une notification Telegram sur task.completed', async () => {
    const req = makeWebhookRequest(
      {
        event: 'task.completed',
        payload: { taskId: 't1', title: 'Appeler le notaire', status: 2 },
      },
      'webhook-secret-test',
    );

    await POST(req);

    // Vérifie qu'un appel Telegram a été fait
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('api.telegram.org');
    expect(url).toContain('sendMessage');
    const fetchBody = JSON.parse(options.body as string);
    expect(fetchBody.text).toContain('Appeler le notaire');
    expect(fetchBody.chat_id).toBe('123456');
  });

  it('envoie une notification Telegram quand status=2 même sans event=task.completed', async () => {
    const req = makeWebhookRequest(
      {
        event: 'task.updated',
        payload: { taskId: 't1', title: 'Tâche mise à jour', status: 2 },
      },
      'webhook-secret-test',
    );

    await POST(req);

    expect(mockFetch).toHaveBeenCalled();
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('sendMessage');
  });

  it('ne notifie PAS pour un événement non-complétion', async () => {
    const req = makeWebhookRequest(
      {
        event: 'task.created',
        payload: { taskId: 't1', title: 'Nouvelle tâche', status: 0 },
      },
      'webhook-secret-test',
    );

    await POST(req);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retourne 400 pour un body JSON invalide', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/secretariat/ticktick/webhook',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-secret': 'webhook-secret-test',
        },
        body: 'invalid json{{{',
      },
    );

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('retourne 500 si TICKTICK_WEBHOOK_SECRET non configuré', async () => {
    const original = process.env.TICKTICK_WEBHOOK_SECRET;
    delete process.env.TICKTICK_WEBHOOK_SECRET;

    const req = makeWebhookRequest(
      { event: 'task.completed', payload: {} },
      'any',
    );
    const res = await POST(req);

    expect(res.status).toBe(500);

    process.env.TICKTICK_WEBHOOK_SECRET = original;
  });

  it('accepte le secret dans le body (fallback)', async () => {
    const req = makeWebhookRequest({
      event: 'task.completed',
      payload: { taskId: 't1', title: 'From body', status: 2 },
      secret: 'webhook-secret-test',
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
  });
});
