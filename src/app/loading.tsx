import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';

export default function Loading(): JSX.Element {
  return (
    <Section tone="default" className="py-5xl">
      <Container width="editorial" className="text-center">
        <div className="flex items-center justify-center gap-md text-ink-500">
          <span
            aria-hidden="true"
            className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span className="text-sm">Chargement en cours…</span>
        </div>
      </Container>
    </Section>
  );
}
