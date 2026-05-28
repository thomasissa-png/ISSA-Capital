import { describe, it, expect } from 'vitest';
import {
  buildWhatsappNoMatchCard,
  parseWhatsappNoMatchCallback,
  WA_NOMATCH_CALLBACK_PREFIX,
  type WhatsappNoMatchPending,
} from '../whatsapp-no-match-card';

function makePending(overrides: Partial<WhatsappNoMatchPending> = {}): WhatsappNoMatchPending {
  return {
    id: 'uuid-abc',
    chatId: '33664850631@s.whatsapp.net',
    chatName: 'Marc Gernot',
    phone: '664850631',
    summary: 'Marc demande un point sur le compromis Lot 3.',
    defaultType: 'pro',
    userContext: null,
    cardMessageId: null,
    createdAt: '2026-05-28T06:00:00Z',
    ...overrides,
  };
}

describe('buildWhatsappNoMatchCard', () => {
  it('contient nom de chat, numéro, résumé, et 5 boutons préfixés wa_nomatch:', () => {
    const { text, inlineKeyboard } = buildWhatsappNoMatchCard(makePending());
    expect(text).toContain('Contact WhatsApp inconnu');
    expect(text).toContain('Marc Gernot');
    expect(text).toContain('664850631');
    expect(text).toContain('compromis Lot 3');
    expect(text).toContain('AVANT de cliquer');

    const allButtons = inlineKeyboard.flat();
    expect(allButtons).toHaveLength(5);
    const labels = allButtons.map((b) => b.text);
    expect(labels.some((l) => l.includes('Pro'))).toBe(true);
    expect(labels.some((l) => l.includes('Famille'))).toBe(true);
    expect(labels.some((l) => l.includes('Amis'))).toBe(true);
    expect(labels.some((l) => l.includes('Autres'))).toBe(true);
    expect(labels.some((l) => l.includes('Skip'))).toBe(true);

    for (const b of allButtons) {
      // Tous les boutons no-match ont un callback_data (jamais un url-button).
      const cb = (b as { callback_data?: string }).callback_data;
      expect(cb).toMatch(/^wa_nomatch:(pro|famille|amis|autres|skip):uuid-abc$/);
    }
  });

  it('omet la ligne numéro si phone est null (groupe ou DM sans téléphone normalisé)', () => {
    const { text } = buildWhatsappNoMatchCard(makePending({ phone: null }));
    expect(text).not.toContain('Numéro');
  });

  it('tronque un résumé trop long (>400 caractères)', () => {
    const long = 'x'.repeat(800);
    const { text } = buildWhatsappNoMatchCard(makePending({ summary: long }));
    // 400 chars de la troncature + ellipsis
    expect(text).toContain('…');
    expect(text).not.toContain('x'.repeat(500));
  });

  it('échappe le HTML dans chatName et summary', () => {
    const { text } = buildWhatsappNoMatchCard(
      makePending({ chatName: '<script>x</script>', summary: '& "rendez-vous"' }),
    );
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
    expect(text).toContain('&amp;');
  });
});

describe('parseWhatsappNoMatchCallback', () => {
  it('parse les 5 actions valides', () => {
    for (const action of ['pro', 'famille', 'amis', 'autres', 'skip'] as const) {
      const r = parseWhatsappNoMatchCallback(`${WA_NOMATCH_CALLBACK_PREFIX}${action}:uuid-1`);
      expect(r).toEqual({ action, noMatchId: 'uuid-1' });
    }
  });

  it('renvoie null pour un préfixe différent', () => {
    expect(parseWhatsappNoMatchCallback('email_nomatch:pro:uuid-1')).toBeNull();
    expect(parseWhatsappNoMatchCallback('email_val:valider:abc')).toBeNull();
  });

  it('renvoie null pour une action inconnue', () => {
    expect(parseWhatsappNoMatchCallback('wa_nomatch:hack:uuid-1')).toBeNull();
  });

  it('renvoie null si le format est cassé (pas de :, id vide)', () => {
    expect(parseWhatsappNoMatchCallback('wa_nomatch:pro')).toBeNull();
    expect(parseWhatsappNoMatchCallback('wa_nomatch:pro:')).toBeNull();
    expect(parseWhatsappNoMatchCallback('')).toBeNull();
  });
});
