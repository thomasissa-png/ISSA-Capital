/**
 * Site-wide configuration — ISSA Capital.
 * Source de vérité pour toutes les valeurs business partagées (URLs, emails, metadata).
 */

export const siteConfig = {
  name: 'ISSA Capital',
  legalName: 'ISSA Capital SAS',
  baseline: 'Racines libanaises. Exigences sans exception.',
  description:
    "Holding patrimoniale d'une famille aux racines libanaises, établie en France. Investissement immobilier, participations, conseil stratégique.",
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://issa-capital.com',
  email: 'contact@issa-capital.com',
  address: {
    street: '54 Rue Henri Barbusse',
    postalCode: '92000',
    city: 'Nanterre',
    country: 'France',
  },
  siren: '102 356 094',
  tvaIntra: 'FR50102356094',
  capital: '1 047 562,00 €',
  ogImage: '/og-image.png',
  nav: [
    { label: 'Mission', href: '/mission' },
    { label: 'Participations', href: '/participations' },
    { label: 'Accompagnement', href: '/accompagnement' },
    { label: 'Opportunités', href: '/opportunites' },
    { label: 'Contact', href: '/contact' },
  ],
  footerLinks: [
    { label: 'Mission', href: '/mission' },
    { label: 'Participations', href: '/participations' },
    { label: 'Accompagnement', href: '/accompagnement' },
    { label: 'Opportunités', href: '/opportunites' },
    { label: 'Contact', href: '/contact' },
    { label: 'Mentions légales', href: '/mentions-legales' },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
