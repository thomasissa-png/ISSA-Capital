/**
 * Tests `telegram-send.ts` — parsing chat ID, garde-fous, envoi. sendTelegramMessage mocké.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendTelegramMessage: vi.fn(),
}));

vi.mock('../../telegram', () => ({
  sendTelegramMessage: mocks.sendTelegramMessage,
}));

import { sendMorningBrief } from '../telegram-send';

describe('sendMorningBrief', () => {
  const original = process.env.TELEGRAM_CHAT_ID_THOMAS;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_CHAT_ID_THOMAS = '123456';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.TELEGRAM_CHAT_ID_THOMAS;
    else process.env.TELEGRAM_CHAT_ID_THOMAS = original;
  });

  it('envoie au chat de Thomas et retourne true', async () => {
    mocks.sendTelegramMessage.mockResolvedValue({ success: true });
    const ok = await sendMorningBrief('Bonjour');
    expect(ok).toBe(true);
    expect(mocks.sendTelegramMessage).toHaveBeenCalledWith(123456, 'Bonjour');
  });

  it('chat ID manquant → false, pas d’appel', async () => {
    delete process.env.TELEGRAM_CHAT_ID_THOMAS;
    const ok = await sendMorningBrief('Bonjour');
    expect(ok).toBe(false);
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('chat ID invalide (NaN) → false', async () => {
    process.env.TELEGRAM_CHAT_ID_THOMAS = 'pas-un-nombre';
    const ok = await sendMorningBrief('Bonjour');
    expect(ok).toBe(false);
    expect(mocks.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('échec API → false', async () => {
    mocks.sendTelegramMessage.mockResolvedValue({ success: false, error: 'boom' });
    const ok = await sendMorningBrief('Bonjour');
    expect(ok).toBe(false);
  });
});
