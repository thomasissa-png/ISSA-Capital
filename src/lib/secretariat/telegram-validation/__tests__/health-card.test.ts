/**
 * Tests health-card — construction des cartes Telegram d'alerte santé.
 *
 * Jalon S15.5E — Task C.
 */

import { describe, it, expect } from 'vitest';
import type { MonitoredItemStatus } from '../../health-monitor/types';
import { buildHealthAlertCard } from '../health-card';

// ============================================================
// Helpers
// ============================================================

function makeStatus(overrides: Partial<MonitoredItemStatus> = {}): MonitoredItemStatus {
  return {
    itemId: 'ticktick_access_token',
    label: 'TickTick Access Token',
    category: 'oauth',
    state: 'warn',
    expiresAt: new Date('2026-06-01'),
    daysRemaining: 14,
    thresholdHit: 30,
    renewalInstructions: 'Ouvrir lien OAuth et renouveler le token.',
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe('buildHealthAlertCard', () => {
  it('contient le label de l\'item dans le texte', () => {
    const status = makeStatus({ label: 'Gmail OAuth Consent' });
    const { text } = buildHealthAlertCard(status);

    expect(text).toContain('Gmail OAuth Consent');
  });

  it('affiche l\'état WARN pour un item en warn', () => {
    const status = makeStatus({ state: 'warn' });
    const { text } = buildHealthAlertCard(status);

    expect(text).toContain('WARN');
  });

  it('affiche l\'état CRITICAL pour un item critical', () => {
    const status = makeStatus({ state: 'critical', daysRemaining: 1 });
    const { text } = buildHealthAlertCard(status);

    expect(text).toContain('CRITICAL');
  });

  it('affiche les jours restants quand daysRemaining est positif', () => {
    const status = makeStatus({ daysRemaining: 14 });
    const { text } = buildHealthAlertCard(status);

    expect(text).toContain('14j restants');
  });

  it('affiche "expiré depuis Xj" quand daysRemaining est négatif', () => {
    const status = makeStatus({ state: 'critical', daysRemaining: -3 });
    const { text } = buildHealthAlertCard(status);

    expect(text).toContain('expiré depuis 3j');
  });

  it('affiche la reason quand daysRemaining est null', () => {
    const status = makeStatus({
      daysRemaining: null,
      expiresAt: null,
      reason: 'getMe HTTP 401',
    });
    const { text } = buildHealthAlertCard(status);

    expect(text).toContain('getMe HTTP 401');
  });

  it('inclut les instructions de renouvellement', () => {
    const status = makeStatus({
      renewalInstructions: 'Renouveler chez le registrar OVH.',
    });
    const { text } = buildHealthAlertCard(status);

    expect(text).toContain('Renouveler chez le registrar OVH.');
  });

  it('affiche la catégorie de l\'item', () => {
    const status = makeStatus({ category: 'domain' });
    const { text } = buildHealthAlertCard(status);

    expect(text).toContain('domain');
  });

  it('génère 2 boutons callback (renewed + snooze) en première ligne', () => {
    const status = makeStatus();
    const { buttons } = buildHealthAlertCard(status);

    expect(buttons.length).toBeGreaterThanOrEqual(1);
    const row1 = buttons[0]!;
    expect(row1).toHaveLength(2);

    const btn1 = row1[0]!;
    const btn2 = row1[1]!;

    expect(btn1.text).toBe('Marqué comme renouvelé');
    expect('callback_data' in btn1 && btn1.callback_data).toBe('health_renewed:ticktick_access_token');

    expect(btn2.text).toBe('Rappeler dans 7 jours');
    expect('callback_data' in btn2 && btn2.callback_data).toBe('health_snooze:ticktick_access_token');
  });

  it('ajoute un 3e bouton URL si renewalUrl est défini', () => {
    const status = makeStatus({
      renewalUrl: 'https://issa-capital.com/api/secretariat/ticktick/oauth/init',
    });
    const { buttons } = buildHealthAlertCard(status);

    expect(buttons.length).toBe(2);
    const row2 = buttons[1]!;
    expect(row2).toHaveLength(1);

    const urlBtn = row2[0]!;
    expect(urlBtn.text).toBe('Ouvrir page renouvellement');
    expect('url' in urlBtn && urlBtn.url).toBe(
      'https://issa-capital.com/api/secretariat/ticktick/oauth/init',
    );
  });

  it('n\'ajoute PAS de bouton URL si renewalUrl est absent', () => {
    const status = makeStatus({ renewalUrl: undefined });
    const { buttons } = buildHealthAlertCard(status);

    // Seulement la ligne callback (renewed + snooze)
    expect(buttons.length).toBe(1);
  });

  it('encode correctement l\'itemId dans callback_data', () => {
    const status = makeStatus({ itemId: 'domain_renewal' });
    const { buttons } = buildHealthAlertCard(status);

    const row1 = buttons[0]!;
    const btn1 = row1[0]!;
    const btn2 = row1[1]!;

    expect('callback_data' in btn1 && btn1.callback_data).toBe('health_renewed:domain_renewal');
    expect('callback_data' in btn2 && btn2.callback_data).toBe('health_snooze:domain_renewal');
  });
});
