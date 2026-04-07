import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';

export default function NotFound(): JSX.Element {
  return (
    <Section tone="default" className="py-5xl">
      <Container width="editorial" className="text-center">
        <p className="overline text-levant-700">Erreur 404</p>
        <h1 className="mt-md font-heading text-h1 text-ink-950">Page introuvable.</h1>
        <p className="mt-lg text-lead text-ink-700">
          La page que vous cherchez n&apos;existe pas — ou plus.
        </p>
        <div className="mt-xl">
          <Button href="/" variant="primary" size="lg">
            Retour à l&apos;accueil
          </Button>
        </div>
        <div className="mt-xl flex flex-wrap justify-center gap-lg text-sm">
          <Link href="/mission" className="text-levant-700 hover:text-levant-700">
            Mission
          </Link>
          <Link href="/participations" className="text-levant-700 hover:text-levant-700">
            Participations
          </Link>
          <Link href="/contact" className="text-levant-700 hover:text-levant-700">
            Contact
          </Link>
        </div>
      </Container>
    </Section>
  );
}
