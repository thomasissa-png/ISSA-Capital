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
  it('contient nom de chat, numéro formaté +33, résumé, et 5 boutons préfixés wa_nomatch:', () => {
    const { text, inlineKeyboard } = buildWhatsappNoMatchCard(makePending());
    expect(text).toContain('Contact WhatsApp inconnu');
    expect(text).toContain('Marc Gernot');
    // S26 Bug #1 — affichage formaté `+33 6 64 85 06 31` au lieu des 9 chiffres bruts.
    expect(text).toContain('+33 6 64 85 06 31');
    expect(text).not.toContain('664850631');
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

  // S26 I3 — Quand le total réel d'homonymes > 3, la carte doit afficher le
  // chiffre RÉEL (pas la version tronquée à 3) et NE PAS afficher de bouton Lier.
  it('S26 I3 : existingMatchHintsTotal=5 (hints capés à 3) → "5 homonymes (top 3)" + pas de bouton Lier', () => {
    const hints = Array.from({ length: 3 }, (_, i) => ({
      displayName: `Homonyme ${i + 1}`,
      knownPhones: [],
      folderPath: '07. Contacts/03. Pro',
      filename: `Homonyme ${i + 1}.md`,
    }));
    const { text, inlineKeyboard } = buildWhatsappNoMatchCard(
      makePending({ existingMatchHints: hints, existingMatchHintsTotal: 5 }),
    );
    expect(text).toContain('5 homonymes');
    expect(text).toContain('top 3 affichés');
    // Pas de bouton Lier quand >3
    const labels = inlineKeyboard.flat().map((b) => b.text);
    expect(labels.some((l) => l.includes('Lier à'))).toBe(false);
  });

  it('S26 I3 : existingMatchHintsTotal=2 (≤3) → "2 homonymes" + boutons Lier affichés', () => {
    const hints = [
      { displayName: 'A', knownPhones: [], folderPath: '07. Contacts/03. Pro', filename: 'A.md' },
      { displayName: 'B', knownPhones: [], folderPath: '07. Contacts/03. Pro', filename: 'B.md' },
    ];
    const { text, inlineKeyboard } = buildWhatsappNoMatchCard(
      makePending({ existingMatchHints: hints, existingMatchHintsTotal: 2 }),
    );
    expect(text).toContain('2 homonymes');
    const labels = inlineKeyboard.flat().map((b) => b.text);
    expect(labels.filter((l) => l.includes('Lier à'))).toHaveLength(2);
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
