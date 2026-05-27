import { describe, it, expect } from 'vitest';
import { isDirectlyAddressed } from '../addressee';
import type { EmailAddress } from '../../gmail-source/types';

const a = (email: string): EmailAddress => ({ email });
const SELF = ['thomas.issa@gmail.com'];

describe('isDirectlyAddressed — garde destinataire direct (S24)', () => {
  it('Thomas dans To → adressé (brouillon)', () => {
    const r = isDirectlyAddressed(SELF, [a('thomas.issa@gmail.com')], []);
    expect(r.addressed).toBe(true);
  });

  it('Thomas dans To parmi plusieurs destinataires → adressé', () => {
    const r = isDirectlyAddressed(
      SELF,
      [a('autre@x.com'), a('THOMAS.ISSA@gmail.com')],
      [a('cc@x.com')],
    );
    expect(r.addressed).toBe(true);
  });

  it('Thomas seulement en Cc → PAS adressé', () => {
    const r = isDirectlyAddressed(SELF, [a('quelquun@x.com')], [a('thomas.issa@gmail.com')]);
    expect(r.addressed).toBe(false);
    expect(r.reason).toMatch(/copie/i);
  });

  it('Thomas ni To ni Cc (liste/Bcc) avec destinataires présents → PAS adressé', () => {
    const r = isDirectlyAddressed(SELF, [a('liste@x.com')], [a('autre@x.com')]);
    expect(r.addressed).toBe(false);
  });

  it('propriétaire inconnu (self vide) → fail-open (adressé)', () => {
    const r = isDirectlyAddressed([], [a('quelquun@x.com')], []);
    expect(r.addressed).toBe(true);
  });

  it('To et Cc vides (parsing KO) → fail-open (adressé)', () => {
    const r = isDirectlyAddressed(SELF, [], []);
    expect(r.addressed).toBe(true);
  });

  it('matching insensible à la casse et aux espaces', () => {
    const r = isDirectlyAddressed(['Thomas.Issa@Gmail.com'], [a('  thomas.issa@gmail.com  ')], []);
    expect(r.addressed).toBe(true);
  });
});
