import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import PlausibleProvider from 'next-plausible';
import Script from 'next/script';
import { siteConfig } from '@/config/site';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

/**
 * next/font/google — polices bundled et servies depuis le domaine propre au build.
 * Conformément au brief : pas de CDN Google Fonts runtime (next/font copie les fichiers
 * dans le bundle et les sert en self-host au build — conforme CSP font-src 'self').
 */
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Holding patrimoniale famille libanaise`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: 'Thomas Issa' }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  keywords: [
    'holding patrimoniale',
    'famille libanaise',
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
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
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
  '@type': 'Organization',
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <html lang="fr" className={`${cormorant.variable} ${inter.variable}`}>
      <head>
        {plausibleDomain ? (
          <PlausibleProvider domain={plausibleDomain} trackOutboundLinks />
        ) : null}
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
