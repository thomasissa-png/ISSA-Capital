/**
 * Tests unitaires — system-email-filter.
 *
 * Vérifie la détection des emails "système" (boîtes non humaines) pour
 * éviter qu'Anya propose de créer une fiche contact pour un robot.
 *
 * Couvre :
 *   - Patterns exact match (noreply@, contact@, etc.)
 *   - Patterns préfixe + séparateur (info.fr@, newsletter-tech@, etc.)
 *   - Case-insensitive
 *   - Inputs invalides (vide, sans @, null/undefined-like)
 *   - Faux positifs prévenus (humain dont la partie locale commence par
 *     une lettre du pattern mais sans séparateur, ex: "contactez@")
 *
 * Décision Thomas S18.5.
 */

import { describe, it, expect } from 'vitest';
import { isSystemEmail, SYSTEM_EMAIL_PATTERNS } from '../system-email-filter';

describe('isSystemEmail', () => {
  // --- Exact matches ---

  it('détecte noreply@ (exact)', () => {
    expect(isSystemEmail('noreply@stripe.com')).toBe(true);
  });

  it('détecte no-reply@ (exact, avec tiret)', () => {
    expect(isSystemEmail('no-reply@example.com')).toBe(true);
  });

  it('détecte nepasrepondre@ (exact, français)', () => {
    expect(isSystemEmail('nepasrepondre@orange.fr')).toBe(true);
  });

  it('détecte ne-pas-repondre@ (exact, français avec tirets)', () => {
    expect(isSystemEmail('ne-pas-repondre@sfr.fr')).toBe(true);
  });

  it('détecte donotreply@ (exact)', () => {
    expect(isSystemEmail('donotreply@example.com')).toBe(true);
  });

  it('détecte do-not-reply@ (exact)', () => {
    expect(isSystemEmail('do-not-reply@example.com')).toBe(true);
  });

  it('détecte notifications@ (pluriel)', () => {
    expect(isSystemEmail('notifications@github.com')).toBe(true);
  });

  it('détecte notification@ (singulier)', () => {
    expect(isSystemEmail('notification@linkedin.com')).toBe(true);
  });

  it('détecte mailer-daemon@', () => {
    expect(isSystemEmail('mailer-daemon@gmail.com')).toBe(true);
  });

  it('détecte mailerdaemon@', () => {
    expect(isSystemEmail('mailerdaemon@example.com')).toBe(true);
  });

  it('détecte bounce@', () => {
    expect(isSystemEmail('bounce@mailchimp.com')).toBe(true);
  });

  it('détecte postmaster@', () => {
    expect(isSystemEmail('postmaster@example.com')).toBe(true);
  });

  it('détecte contact@ (boîte générique)', () => {
    expect(isSystemEmail('contact@example.com')).toBe(true);
  });

  it('détecte info@ (boîte générique)', () => {
    expect(isSystemEmail('info@example.com')).toBe(true);
  });

  it('détecte support@', () => {
    expect(isSystemEmail('support@stripe.com')).toBe(true);
  });

  it('détecte newsletter@', () => {
    expect(isSystemEmail('newsletter@medium.com')).toBe(true);
  });

  it('détecte admin@', () => {
    expect(isSystemEmail('admin@example.com')).toBe(true);
  });

  // --- Préfixe + séparateur ---

  it('détecte info.fr@ (préfixe + ".")', () => {
    expect(isSystemEmail('info.fr@example.com')).toBe(true);
  });

  it('détecte noreply-mail@ (préfixe + "-")', () => {
    expect(isSystemEmail('noreply-mail@example.com')).toBe(true);
  });

  it('détecte newsletter-tech@ (préfixe + "-")', () => {
    expect(isSystemEmail('newsletter-tech@example.com')).toBe(true);
  });

  it('détecte notifications_app@ (préfixe + "_")', () => {
    expect(isSystemEmail('notifications_app@example.com')).toBe(true);
  });

  it('détecte contact.fr@', () => {
    expect(isSystemEmail('contact.fr@example.com')).toBe(true);
  });

  it('détecte support-client@', () => {
    expect(isSystemEmail('support-client@example.com')).toBe(true);
  });

  // --- Case-insensitive ---

  it('est insensible à la casse (NOREPLY)', () => {
    expect(isSystemEmail('NOREPLY@stripe.com')).toBe(true);
  });

  it('est insensible à la casse (NoReply)', () => {
    expect(isSystemEmail('NoReply@stripe.com')).toBe(true);
  });

  it('est insensible à la casse (Contact)', () => {
    expect(isSystemEmail('Contact@example.com')).toBe(true);
  });

  it('est insensible à la casse (préfixe + sep, INFO.FR)', () => {
    expect(isSystemEmail('INFO.FR@example.com')).toBe(true);
  });

  // --- Négatifs : humains ---

  it('ne détecte PAS thomas@ comme système', () => {
    expect(isSystemEmail('thomas@issacapital.com')).toBe(false);
  });

  it('ne détecte PAS jean.dupont@ comme système', () => {
    expect(isSystemEmail('jean.dupont@example.com')).toBe(false);
  });

  it('ne détecte PAS martin@ comme système', () => {
    expect(isSystemEmail('martin@pnmavocats.law')).toBe(false);
  });

  it('ne détecte PAS emmanuel@gomez.com comme système', () => {
    expect(isSystemEmail('emmanuel@gomez.com')).toBe(false);
  });

  it('ne détecte PAS marc.durand@nouveauclient.com comme système', () => {
    expect(isSystemEmail('marc.durand@nouveauclient.com')).toBe(false);
  });

  // --- Négatifs : faux positifs prévenus ---

  it('ne détecte PAS contactez@ comme système (pattern au milieu, sans sep)', () => {
    // "contactez" commence par "contact" mais sans séparateur après → humain
    expect(isSystemEmail('contactez@example.com')).toBe(false);
  });

  it('ne détecte PAS infomaniak@ comme système (pas de sep après info)', () => {
    expect(isSystemEmail('infomaniak@example.com')).toBe(false);
  });

  it('ne détecte PAS administrateur@ comme système', () => {
    expect(isSystemEmail('administrateur@example.com')).toBe(false);
  });

  it('ne détecte PAS systemic@ comme système', () => {
    expect(isSystemEmail('systemic@example.com')).toBe(false);
  });

  it('ne détecte PAS newsfeed@ comme système (newsfeed != news.X / news-X)', () => {
    expect(isSystemEmail('newsfeed@example.com')).toBe(false);
  });

  it('ne détecte PAS automated2@ comme système (pas de sep après "automated")', () => {
    expect(isSystemEmail('automated2@example.com')).toBe(false);
  });

  // --- Inputs invalides ---

  it('retourne false pour une string vide', () => {
    expect(isSystemEmail('')).toBe(false);
  });

  it('retourne false pour une string sans @', () => {
    expect(isSystemEmail('noreply')).toBe(false);
  });

  it('retourne false pour une string avec @ mais sans local part', () => {
    expect(isSystemEmail('@example.com')).toBe(false);
  });

  it('retourne false pour null/undefined (typage défensif)', () => {
    // @ts-expect-error - test du typage défensif
    expect(isSystemEmail(null)).toBe(false);
    // @ts-expect-error - test du typage défensif
    expect(isSystemEmail(undefined)).toBe(false);
  });

  it('retourne false pour une valeur non-string', () => {
    // @ts-expect-error - test du typage défensif
    expect(isSystemEmail(123)).toBe(false);
    // @ts-expect-error - test du typage défensif
    expect(isSystemEmail({})).toBe(false);
  });

  // --- Edge case : pattern le plus long matche en premier ---

  it('"mailer-daemon@" matche le pattern long, pas juste "mailer"', () => {
    // Vérifie que mailer-daemon est bien détecté (matcherait aussi mailer + "-daemon")
    // Le résultat est true dans les deux cas, mais on s'assure que c'est cohérent.
    expect(isSystemEmail('mailer-daemon@example.com')).toBe(true);
  });

  // --- Whitespace tolerance ---

  it('trim les espaces avant le @ (défensif)', () => {
    expect(isSystemEmail(' noreply @example.com')).toBe(true);
  });
});

describe('SYSTEM_EMAIL_PATTERNS', () => {
  it('est un tableau readonly non vide', () => {
    expect(Array.isArray(SYSTEM_EMAIL_PATTERNS)).toBe(true);
    expect(SYSTEM_EMAIL_PATTERNS.length).toBeGreaterThan(15);
  });

  it('contient les patterns critiques', () => {
    expect(SYSTEM_EMAIL_PATTERNS).toContain('noreply');
    expect(SYSTEM_EMAIL_PATTERNS).toContain('no-reply');
    expect(SYSTEM_EMAIL_PATTERNS).toContain('contact');
    expect(SYSTEM_EMAIL_PATTERNS).toContain('notifications');
    expect(SYSTEM_EMAIL_PATTERNS).toContain('mailer-daemon');
  });

  it('tous les patterns sont en lowercase', () => {
    for (const pattern of SYSTEM_EMAIL_PATTERNS) {
      expect(pattern).toBe(pattern.toLowerCase());
    }
  });
});
