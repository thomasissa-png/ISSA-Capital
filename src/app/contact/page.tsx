import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { ContactForm } from '@/components/ui/ContactForm';
import { siteConfig } from '@/config/site';

/**
 * /contact — rendu statique (SSG).
 * Point de contact généraliste. Formulaire minimaliste, email direct exposé.
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Prenez contact avec ISSA Capital. Pour toute demande — opportunité, accompagnement ou presse — écrivez à contact@issa-capital.com.',
  alternates: { canonical: `${siteConfig.url}/contact` },
  openGraph: {
    title: 'Contact — ISSA Capital',
    description:
      'Formulaire de contact ISSA Capital. Pour les opportunités d’affaires, utilisez la page dédiée.',
    url: `${siteConfig.url}/contact`,
  },
};

export default function ContactPage(): JSX.Element {
  return (
    <>
      <Section tone="default">
        <Container width="editorial" className="text-center">
          <nav aria-label="Fil d'Ariane" className="text-xs text-ink-500">
            <Link href="/" className="hover:text-ink-950">
              Accueil
            </Link>
            <span className="mx-sm" aria-hidden="true">
              /
            </span>
            <span>Contact</span>
          </nav>
          <h1 className="mt-xl font-heading text-h1 text-ink-950">Prendre contact.</h1>
          <p className="mx-auto mt-lg max-w-[560px] text-lead text-ink-700">
            Pour toute demande — opportunité d&apos;affaires, accompagnement, presse ou
            autre — vous pouvez utiliser le formulaire ci-dessous ou écrire directement
            à contact@issa-capital.com.
          </p>
          <p className="mx-auto mt-md max-w-[560px] text-sm text-ink-600">
            Pour les opportunités d&apos;investissement immobilier ou de participation,
            la{' '}
            <Link
              href="/opportunites"
              className="text-levant-700 underline underline-offset-2 hover:text-levant-700"
            >
              page Opportunités d&apos;affaires
            </Link>{' '}
            vous permettra de qualifier votre dossier plus efficacement.
          </p>
        </Container>
      </Section>

      <Section tone="elevated">
        <Container width="narrow">
          <ContactForm variant="contact" heading="Formulaire de contact" />
        </Container>
      </Section>

      <Section tone="subtle">
        <Container width="editorial" className="text-center">
          <Overline>Contact direct</Overline>
          <p className="mt-md text-base text-ink-700">Ou écrivez-nous directement :</p>
          <a
            href={`mailto:${siteConfig.email}`}
            className="mt-sm inline-block font-heading text-h3 text-levant-700 hover:text-levant-700"
          >
            {siteConfig.email}
          </a>
          <address className="mt-lg text-sm not-italic text-ink-500">
            {siteConfig.address.street}, {siteConfig.address.postalCode}{' '}
            {siteConfig.address.city}
          </address>
          <p className="mt-md text-xs italic text-ink-500">
            Nous répondons aux demandes qualifiées.
          </p>
        </Container>
      </Section>
    </>
  );
}
