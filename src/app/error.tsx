'use client';

import { useEffect } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app] Unhandled error :', error);
  }, [error]);

  return (
    <Section tone="default" className="py-5xl">
      <Container width="editorial" className="text-center">
        <p className="overline text-reserve-600">Une erreur est survenue</p>
        <h1 className="mt-md font-heading text-h1 text-ink-950">
          Quelque chose n&apos;a pas fonctionné.
        </h1>
        <p className="mt-lg text-lead text-ink-700">
          Nous avons été notifiés. Vous pouvez recharger la page ou nous écrire à
          contact@issa-capital.com.
        </p>
        <div className="mt-xl flex justify-center gap-md">
          <Button onClick={reset} variant="primary" size="md">
            Réessayer
          </Button>
          <Button href="/" variant="secondary" size="md">
            Accueil
          </Button>
        </div>
      </Container>
    </Section>
  );
}
