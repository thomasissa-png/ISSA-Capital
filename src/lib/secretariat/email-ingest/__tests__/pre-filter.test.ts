/**
 * Tests unitaires — pré-filtre heuristique email-ingest.
 *
 * Vérifie la détection de spam/newsletter par patterns :
 * - Adresses noreply, notifications, mailer-daemon
 * - Domaines sendgrid, mailgun, amazonses, *newsletter*
 * - Sujets newsletter, digest, weekly, unsubscribe
 * - Faux positifs : vrais emails qui ne doivent PAS être filtrés
 */

import { describe, it, expect } from 'vitest';
import { isLikelySpamByHeuristic } from '../pre-filter';
import type { EmailMessage } from '../../gmail-source/types';

// ============================================================
// Fixtures
// ============================================================

function makeEmail(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    source: 'gmail',
    id: 'msg_test_001',
    from: { email: 'jean.dupont@example.com', name: 'Jean Dupont' },
    to: [{ email: 'thomas@issacapital.com' }],
    cc: [],
    subject: 'Bonjour Thomas',
    bodyPlain: 'Ceci est un email normal.',
    receivedAt: new Date('2026-05-13T10:00:00Z'),
    attachments: [],
    rawRef: 'https://mail.google.com/mail/u/0/#inbox/msg_test_001',
    ...overrides,
  };
}

// ============================================================
// Tests — détection positive (spam/newsletter)
// ============================================================

describe('isLikelySpamByHeuristic', () => {
  describe('détection positive (doit retourner true)', () => {
    it('détecte noreply@', () => {
      const email = makeEmail({ from: { email: 'noreply@company.com' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte no-reply@', () => {
      const email = makeEmail({ from: { email: 'no-reply@company.com' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte notifications@', () => {
      const email = makeEmail({ from: { email: 'notifications@linkedin.com' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte notification@ (singulier)', () => {
      const email = makeEmail({ from: { email: 'notification@service.fr' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte mailer-daemon@', () => {
      const email = makeEmail({ from: { email: 'mailer-daemon@google.com' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte newsletter@', () => {
      const email = makeEmail({ from: { email: 'newsletter@techcrunch.com' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte info@', () => {
      const email = makeEmail({ from: { email: 'info@company.com' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte alert@', () => {
      const email = makeEmail({ from: { email: 'alert@monitoring.io' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte domaine sendgrid', () => {
      const email = makeEmail({ from: { email: 'user@sendgrid.net' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte domaine mailgun', () => {
      const email = makeEmail({ from: { email: 'bounce@mailgun.org' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte domaine amazonses', () => {
      const email = makeEmail({ from: { email: 'user@amazonses.com' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte domaine contenant newsletter', () => {
      const email = makeEmail({ from: { email: 'user@my-newsletter-service.com' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte domaine contenant marketing', () => {
      const email = makeEmail({ from: { email: 'campaign@email-marketing.io' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte sujet "Newsletter" en début', () => {
      const email = makeEmail({ subject: 'Newsletter du 13 mai 2026' });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte sujet "Your weekly" en début', () => {
      const email = makeEmail({ subject: 'Your weekly digest from Product Hunt' });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte sujet "Digest" en début', () => {
      const email = makeEmail({ subject: 'Digest: 5 nouveaux articles' });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte sujet "Re: [tag] Newsletter"', () => {
      const email = makeEmail({ subject: 'Re: [External] Newsletter Mai 2026' });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('détecte sujet "Reminder:" en début', () => {
      const email = makeEmail({ subject: 'Reminder: your subscription expires' });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });

    it('est insensible à la casse pour le from', () => {
      const email = makeEmail({ from: { email: 'NoReply@Company.COM' } });
      expect(isLikelySpamByHeuristic(email)).toBe(true);
    });
  });

  // ============================================================
  // Tests — faux positifs (ne doit PAS retourner true)
  // ============================================================

  describe('faux positifs (doit retourner false)', () => {
    it('ne filtre pas un email de locataire normal', () => {
      const email = makeEmail({
        from: { email: 'martin.dupont@gmail.com', name: 'Martin Dupont' },
        subject: 'Demande de quittance mai 2026',
      });
      expect(isLikelySpamByHeuristic(email)).toBe(false);
    });

    it('ne filtre pas un email de professionnel', () => {
      const email = makeEmail({
        from: { email: 'avocat@cabinet-legal.fr', name: 'Me Durand' },
        subject: 'Dossier SCI Villeneuve',
      });
      expect(isLikelySpamByHeuristic(email)).toBe(false);
    });

    it('ne filtre pas un email avec un domaine normal contenant "info" au milieu', () => {
      const email = makeEmail({
        from: { email: 'thomas@information-system.fr' },
        subject: 'Proposition de service',
      });
      expect(isLikelySpamByHeuristic(email)).toBe(false);
    });

    it('ne filtre pas un email personnel', () => {
      const email = makeEmail({
        from: { email: 'maman@orange.fr', name: 'Sonia Issa' },
        subject: 'Re: Photos Normandie',
      });
      expect(isLikelySpamByHeuristic(email)).toBe(false);
    });

    it('ne filtre pas un email de notaire', () => {
      const email = makeEmail({
        from: { email: 'etude.martin@notaires.fr' },
        subject: 'Acte de vente — signature le 20 mai',
      });
      expect(isLikelySpamByHeuristic(email)).toBe(false);
    });
  });
});
