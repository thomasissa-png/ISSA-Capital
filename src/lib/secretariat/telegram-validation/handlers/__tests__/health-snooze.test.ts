/**
 * Tests handler health_snooze — callback Telegram.
 *
 * Mock les dépendances (dedup-store, telegram, monitored-items).
 *
 * Jalon S15.5E — Task C.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MonitoredItem } from '../../../health-monitor/types';

// ============================================================
// Mocks (hoisted)
// ============================================================

const mocks = vi.hoisted(() => ({
  snooze: vi.fn(),
  editMessageText: vi.fn().mockResolvedValue(true),
  answerCallbackQuery: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../../health-monitor/dedup-store', () => ({
  snooze: mocks.snooze,
}));

vi.mock('../../telegram-cards', () => ({
  editMessageText: mocks.editMessageText,
}));

vi.mock('../../../telegram', () => ({
  answerCallbackQuery: mocks.answerCallbackQuery,
}));

// Mock monitored-items avec items de test
vi.mock('../../../health-monitor/monitored-items', () => ({
  MONITORED_ITEMS: [
    { id: 'ticktick_access_token', label: 'TickTick Access Token', category: 'oauth' },
    { id: 'domain_renewal', label: 'Renouvellement domaine', category: 'domain' },
  ] as Partial<MonitoredItem>[],
}));

// Import APRES les mocks (mock non-OAuth pour vérifier pas de recordOAuthCallback)
vi.mock('../../../health-monitor/oauth-timestamps', () => ({
  recordOAuthCallback: vi.fn(),
}));

import { handleHealthSnooze } from '../health-snooze';
import type { HealthCallbackParams } from '../health-renewed';
import { recordOAuthCallback } from '../../../health-monitor/oauth-timestamps';

// ============================================================
// Helpers
// ============================================================

function makeParams(itemId: string): HealthCallbackParams {
  return {
    callbackQueryId: 'cb-snooze-456',
    callbackData: `health_snooze:${itemId}`,
    chatId: 12345,
    messageId: 300,
  };
}

// ============================================================
// Tests
// ============================================================

describe('handleHealthSnooze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appelle snooze(itemId, 7) avec le bon itemId', async () => {
    await handleHealthSnooze(makeParams('ticktick_access_token'));

    expect(mocks.snooze).toHaveBeenCalledWith('ticktick_access_token', 7);
  });

  it('N\'appelle PAS recordOAuthCallback (snooze != renouvellement)', async () => {
    await handleHealthSnooze(makeParams('ticktick_access_token'));

    expect(recordOAuthCallback).not.toHaveBeenCalled();
  });

  it('edit le message Telegram avec texte de rappel', async () => {
    await handleHealthSnooze(makeParams('domain_renewal'));

    expect(mocks.editMessageText).toHaveBeenCalledWith(
      12345,
      300,
      'Rappel dans 7 jours pour Renouvellement domaine',
    );
  });

  it('answerCallback "Item inconnu" si itemId invalide', async () => {
    await handleHealthSnooze(makeParams('nonexistent_item'));

    expect(mocks.answerCallbackQuery).toHaveBeenCalledWith('cb-snooze-456', 'Item inconnu');
    expect(mocks.snooze).not.toHaveBeenCalled();
  });

  it('ne crash pas si editMessageText échoue', async () => {
    mocks.editMessageText.mockRejectedValueOnce(new Error('Telegram down'));

    // Devrait logger le warning mais ne pas throw
    await expect(
      handleHealthSnooze(makeParams('ticktick_access_token')),
    ).resolves.toBeUndefined();

    // snooze est appelé avant editMessageText, donc il a été appelé
    expect(mocks.snooze).toHaveBeenCalled();
  });
});
