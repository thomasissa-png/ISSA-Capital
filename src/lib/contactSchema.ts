import { z } from 'zod';

/**
 * Schémas Zod pour le formulaire de contact ISSA Capital.
 * Trois variants qui partagent une base commune (nom, email, honeypot, consentement).
 * Chaque variant a ses champs spécifiques :
 *  - contact : subject (enum), message
 *  - accompagnement : subject implicite, message
 *  - opportunite : type d'opportunité, localisation, description, ticket, source
 */

const baseSchema = z.object({
  name: z.string().trim().min(2, 'Prénom et nom requis').max(120),
  email: z.string().trim().email('Email invalide').max(200),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Le consentement RGPD est requis' }),
  }),
  // Honeypot : champ caché qui doit rester vide. Si rempli → bot.
  website: z.string().max(0, 'bot').optional().or(z.literal('')),
});

export const contactSchema = baseSchema.extend({
  variant: z.literal('contact'),
  subject: z.enum([
    'opportunite',
    'accompagnement',
    'presse',
    'autre',
  ]),
  message: z.string().trim().min(10, 'Message trop court').max(1000),
});

export const accompagnementSchema = baseSchema.extend({
  variant: z.literal('accompagnement'),
  message: z.string().trim().min(10, 'Message trop court').max(1000),
});

export const opportuniteSchema = baseSchema.extend({
  variant: z.literal('opportunite'),
  opportunityType: z.enum([
    'immobilier_residentiel',
    'participation_entreprise',
    'autre',
  ]),
  location: z.string().trim().max(200).optional().or(z.literal('')),
  description: z.string().trim().min(10, 'Description trop courte').max(500),
  ticket: z.string().trim().max(100).optional().or(z.literal('')),
  source: z
    .enum(['linkedin', 'recommandation', 'recherche', 'autre'])
    .optional(),
});

export const contactRequestSchema = z.discriminatedUnion('variant', [
  contactSchema,
  accompagnementSchema,
  opportuniteSchema,
]);

export type ContactRequest = z.infer<typeof contactRequestSchema>;
export type ContactVariant = ContactRequest['variant'];
