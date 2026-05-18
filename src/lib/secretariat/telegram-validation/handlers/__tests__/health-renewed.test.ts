/**
 * Tests handler health_renewed — callback Telegram.
 *
 * Mock les dépendances (dedup-store, oauth-timestamps, telegram, monitored-items).
 *
 * Jalon S15.5E — Task C.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MonitoredItem } from '../../../health-monitor/types';

// ============================================================
// Mocks (hoisted)
// ============================================================

const mocks = vi.hoisted(() => ({
  resetItem: vi.fn(),
  recordOAuthCallback: vi.fn(),
  editMessageText: vi.fn().mockResolvedValue(true),
  answerCallbackQuery: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../../health-monitor/dedup-store', () => ({
  resetItem: mocks.resetItem,
}));

vi.mock('../../../health-monitor/oauth-timestamps', () => ({
  recordOAuthCallback: mocks.recordOAuthCallback,
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
    { id: 'gmail_oauth_consent', label: 'Gmail OAuth Consent', category: 'oauth' },
    { id: 'drive_oauth_consent', label: 'Drive OAuth Consent', category: 'oauth' },
    { id: 'domain_renewal', label: 'Renouvellement domaine', category: 'domain' },
    { id: 'ssl_certificate', label: 'Certificat SSL', category: 'cert' },
  ] as Partial<MonitoredItem>[],
}));

import { handleHealthRenewed } from '../health-renewed';
import type { HealthCallbackParams } from '../health-renewed';

// ============================================================
// Helpers
// ============================================================

function makeParams(itemId: string): HealthCallbackParams {
  return {
    callbackQueryId: 'cb-test-123',
    callbackData: `health_renewed:${itemId}`,
    chatId: 12345,
    messageId: 200,
  };
}

// ============================================================
// Tests
// ============================================================

describe('handleHealthRenewed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appelle resetItem avec le bon itemId', async () => {
    await handleHealthRenewed(makeParams('ticktick_access_token'));

    expect(mocks.resetItem).toHaveBeenCalledWith('ticktick_access_token');
  });

  it('appelle recordOAuthCallback pour un item OAuth (ticktick)', async () => {
    await handleHealthRenewed(makeParams('ticktick_access_token'));

    expect(mocks.recordOAuthCallback).toHaveBeenCalledWith('ticktick');
  });

  it('appelle recordOAuthCallback pour un item OAuth (gmail)', async () => {
    await handleHealthRenewed(makeParams('gmail_oauth_consent'));

    expect(mocks.recordOAuthCallback).toHaveBeenCalledWith('gmail');
  });

  it('appelle recordOAuthCallback pour un item OAuth (drive)', async () => {
    await handleHealthRenewed(makeParams('drive_oauth_consent'));

    expect(mocks.recordOAuthCallback).toHaveBeenCalledWith('drive');
  });

  it('N\'appelle PAS recordOAuthCallback pour un item non-OAuth (domain)', async () => {
    await handleHealthRenewed(makeParams('domain_renewal'));

    expect(mocks.recordOAuthCallback).not.toHaveBeenCalled();
  });

  it('N\'appelle PAS recordOAuthCallback pour un item non-OAuth (cert)', async () => {
    await handleHealthRenewed(makeParams('ssl_certificate'));

    expect(mocks.recordOAuthCallback).not.toHaveBeenCalled();
  });

  it('edit le message Telegram avec texte de confirmation', async () => {
    await handleHealthRenewed(makeParams('ticktick_access_token'));

    expect(mocks.editMessageText).toHaveBeenCalledWith(
      12345,
      200,
      '[OK] Marqué comme renouvelé — TickTick Access Token',
    );
  });

  it('answerCallback "Item inconnu" si itemId invalide', async () => {
    await handleHealthRenewed(makeParams('nonexistent_item'));

    expect(mocks.answerCallbackQuery).toHaveBeenCalledWith('cb-test-123', 'Item inconnu');
    expect(mocks.resetItem).not.toHaveBeenCalled();
  });
});
