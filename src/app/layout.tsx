import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { siteConfig } from '@/config/site';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

/**
 * Fonts — configurées dans globals.css via @font-face avec fallbacks système.
 *
 * TODO (Phase 2b post-network) : remplacer par next/font/local dès que les
 * fichiers .woff2 de Cormorant Garamond + Inter sont placés dans public/fonts/.
 * L'environnement de build actuel n'a pas d'accès réseau, donc next/font/google
 * échoue. Les CSS variables --font-cormorant et --font-inter sont définies dans
 * globals.css avec des stacks système (Georgia serif, system-ui sans-serif).
 * Voir docs/dev-decisions.md pour le contexte complet.
 */

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Holding patrimoniale familiale`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: 'Thomas Issa' }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  keywords: [
    'holding patrimoniale',
    'famille Issa',
    'investissement immobilier',
    'participations',
    'conseil stratégique',
    'Nanterre',
    'ISSA Capital',
  ],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.baseline}`,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — ${siteConfig.baseline}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Favicons : gérés par la convention file-based Next.js App Router
  // (src/app/favicon.ico, src/app/icon.svg, src/app/apple-icon.png).
  // Cette convention génère automatiquement les <link> dans le <head>
  // et prend priorité sur metadata.icons. Plus fiable qu'une déclaration manuelle.
  //
  // Session 7 — Direction 1 Sceau : les 3 fichiers file-based ci-dessus sont
  // synchronisés depuis public/favicon.svg|.ico et public/apple-touch-icon.png
  // (générés par scripts/generate-assets.mjs à partir des SVG sources @design).
  //
  // Le mask-icon Safari (rel non-standard) est déclaré via icons.other car
  // la convention file-based ne couvre pas ce cas.
  icons: {
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#C4935A',
      },
    ],
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: siteConfig.url,
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': ['Organization', 'FinancialService'],
  name: siteConfig.legalName,
  alternateName: siteConfig.name,
  url: siteConfig.url,
  logo: `${siteConfig.url}/logo.svg`,
  email: siteConfig.email,
  description: siteConfig.description,
  address: {
    '@type': 'PostalAddress',
    streetAddress: siteConfig.address.street,
    postalCode: siteConfig.address.postalCode,
    addressLocality: siteConfig.address.city,
    addressCountry: 'FR',
  },
  founder: {
    '@type': 'Person',
    name: 'Thomas Issa',
  },
  foundingDate: '2026',
  vatID: siteConfig.tvaIntra,
  taxID: siteConfig.siren,
  sameAs: [
    'https://www.linkedin.com/in/thomasissa',
    'https://versi-immobilier.fr',
    'https://versi-invest.fr',
  ],
  subOrganization: [
    {
      '@type': 'Organization',
      name: 'Gradient One',
      description: "Holding intermédiaire co-fondée en 2020. Détient Versi Immobilier, Versi Invest, Immocrew et Versimo.",
    },
    {
      '@type': 'Organization',
      name: 'Versi Immobilier',
      url: 'https://versi-immobilier.fr',
      description: 'Marchand de biens — marché secondaire résidentiel : acquisition, rénovation, revente.',
    },
    {
      '@type': 'Organization',
      name: 'Versi Invest',
      url: 'https://versi-invest.fr',
      description: 'Conseil en investissement immobilier et co-investissement sur sélection.',
    },
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: siteConfig.email,
    areaServed: 'FR',
    availableLanguage: ['French', 'English'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="fr">
      <head>
        <Script
          id="umami-analytics"
          src="https://cloud.umami.is/script.js"
          data-website-id="ecdaae22-72f5-4759-a454-6774de025c74"
          strategy="afterInteractive"
          defer
        />
        <Script
          id="jsonld-organization"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="bg-parchment-100 text-ink-950 antialiased">
        <a href="#main-content" className="skip-link">
          Aller au contenu principal
        </a>
        <Header />
        <main id="main-content">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
