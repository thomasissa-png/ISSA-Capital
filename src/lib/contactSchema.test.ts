import { describe, expect, it } from 'vitest';
import { contactRequestSchema } from './contactSchema';

describe('contactRequestSchema', () => {
  it('accepte un payload contact valide', () => {
    const parsed = contactRequestSchema.safeParse({
      variant: 'contact',
      name: 'Jean Dupont',
      email: 'jean@example.com',
      subject: 'presse',
      message: 'Bonjour, je suis journaliste et souhaite un entretien.',
      consent: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejette un email invalide', () => {
    const parsed = contactRequestSchema.safeParse({
      variant: 'contact',
      name: 'Jean Dupont',
      email: 'not-an-email',
      subject: 'autre',
      message: 'Message assez long pour valider.',
      consent: true,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejette un consent = false', () => {
    const parsed = contactRequestSchema.safeParse({
      variant: 'contact',
      name: 'Jean Dupont',
      email: 'jean@example.com',
      subject: 'autre',
      message: 'Message assez long.',
      consent: false,
    });
    expect(parsed.success).toBe(false);
  });

  it('rejette une opportunité immobiliere sans localisation', () => {
    const parsed = contactRequestSchema.safeParse({
      variant: 'opportunite',
      name: 'Leila Benamar',
      email: 'leila@example.com',
      opportunityType: 'immobilier_residentiel',
      location: '',
      description: 'Immeuble de rapport 6 lots, opportunité rare.',
      consent: true,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      expect(fields.location).toBeDefined();
    }
  });

  it('accepte une opportunité participation sans localisation', () => {
    const parsed = contactRequestSchema.safeParse({
      variant: 'opportunite',
      name: 'Leila Benamar',
      email: 'leila@example.com',
      opportunityType: 'participation_entreprise',
      description: 'Participation minoritaire dans une PME industrielle.',
      consent: true,
    });
    expect(parsed.success).toBe(true);
  });

  it('accepte un payload opportunite valide', () => {
    const parsed = contactRequestSchema.safeParse({
      variant: 'opportunite',
      name: 'Leila Benamar',
      email: 'leila@example.com',
      opportunityType: 'immobilier_residentiel',
      location: 'Paris 11e',
      description: 'Immeuble de rapport 6 lots à Paris, opportunité rare.',
      ticket: '980 000 €',
      source: 'linkedin',
      consent: true,
    });
    expect(parsed.success).toBe(true);
  });
});
