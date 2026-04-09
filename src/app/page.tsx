import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { Button } from '@/components/ui/Button';
import { ContactForm } from '@/components/ui/ContactForm';
import { siteConfig } from '@/config/site';

/**
 * Page d'accueil — version monopage light (session 9).
 * Toutes les sections sont sur cette page unique. Pas de pages internes dans le menu.
 * Les CTAs hero scrollent vers le formulaire de contact en bas de page (#contact).
 * Respecte le Principe directeur #0 : VITRINE pas conversion.
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: {
    absolute: 'ISSA Capital — Holding patrimoniale familiale',
  },
  description:
    "Holding patrimoniale d'une famille aux racines libanaises, établie en France. Investissement immobilier, participations, conseil stratégique.",
  alternates: { canonical: `${siteConfig.url}/` },
  openGraph: {
    title: 'ISSA Capital — Racines libanaises. Exigences sans exception.',
    description:
      'Holding patrimoniale familiale. Horizon intergénérationnel. Filtres de décision non négociables. Immobilier, participations, conseil.',
    url: `${siteConfig.url}/`,
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
    title: 'ISSA Capital — Holding patrimoniale familiale',
    description:
      "Holding patrimoniale de la famille Issa, aux racines libanaises, établie en France. Immobilier, participations, conseil stratégique.",
    images: [siteConfig.ogImage],
  },
};

export default function HomePage(): JSX.Element {
  return (
    <>
      {/* Section 1 — Hero principal */}
      <Section tone="inverse" className="py-4xl md:py-5xl">
        <Container width="editorial" className="text-center">
          <Overline tone="light">Holding patrimoniale familiale</Overline>
          <h1 className="mt-lg font-heading text-display leading-[1.08] text-parchment-100">
            Racines libanaises.
            <br />
            Exigences sans exception.
          </h1>
          <p className="mx-auto mt-xl max-w-[520px] font-body text-lead text-ink-300">
            La holding patrimoniale de la famille Issa, établie en France.
            Patrimoine, participations, transmission.
          </p>
          <div className="mt-2xl flex flex-col items-center justify-center gap-md sm:flex-row sm:gap-lg">
            <Button href="#contact" variant="primary-inverse" size="lg">
              Nous écrire
            </Button>
          </div>
        </Container>
      </Section>

      {/* Section 2 — Notre raison d'être */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Notre raison d&apos;être</Overline>
          <h2 className="mt-md max-w-[640px] font-heading text-h3 text-ink-950">
            Une holding née d&apos;une lignée.
          </h2>
          <div className="mt-lg space-y-md text-lead text-ink-700">
            <p>
              ISSA Capital est la holding patrimoniale de la famille Issa,
              établie en France. Sa raison d&apos;être : structurer ce qui s&apos;est
              construit sur trois décennies, le faire fructifier, le transmettre.
            </p>
            <p>
              Une structure indépendante, dont les Issa sont les seuls actionnaires, et
              dont l&apos;horizon est intergénérationnel.
            </p>
            <p>
              Elle est l&apos;aboutissement de trois décennies de construction
              patrimoniale — un héritage libanais qui a appris à se tenir dans la durée.
            </p>
          </div>
        </Container>
      </Section>

      {/* Section 3 — Stats */}
      <Section tone="inverse">
        <Container width="editorial">
          <dl className="grid grid-cols-1 gap-xl sm:grid-cols-3">
            <div className="border-l-2 border-levant-500 pl-lg">
              <dt className="font-body text-xs uppercase tracking-wider text-ink-400">
                Co-fondation
              </dt>
              <dd className="mt-sm font-heading text-h2 text-parchment-100">
                2020
              </dd>
            </div>
            <div className="border-l-2 border-levant-500 pl-lg">
              <dt className="font-body text-xs uppercase tracking-wider text-ink-400">
                Participations
              </dt>
              <dd className="mt-sm font-heading text-h2 text-parchment-100">
                6
              </dd>
            </div>
            <div className="border-l-2 border-levant-500 pl-lg">
              <dt className="font-body text-xs uppercase tracking-wider text-ink-400">
                Générations
              </dt>
              <dd className="mt-sm font-heading text-h2 text-parchment-100">
                3
              </dd>
            </div>
          </dl>
        </Container>
      </Section>

      {/* Section 4 — Écosystème (3 participations, sans lien vers /participations) */}
      <Section tone="default">
        <Container width="content">
          <div className="mb-2xl">
            <Overline>Notre écosystème</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Un écosystème cohérent.
            </h2>
            <p className="mt-md max-w-editorial text-lead text-ink-700">
              Participations directes et indirectes — immobilier, tech, services aux
              professionnels.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                name: 'Gradient One',
                sector: 'Holding intermédiaire',
                desc: "Co-fondée en 2020. Porte les participations opérationnelles et financières de la famille Issa — immobilier, tech, services aux professionnels.",
              },
              {
                name: 'Versi Immobilier',
                sector: 'Marchand de biens',
                desc: 'Marché secondaire résidentiel — acquisition, rénovation, revente.',
              },
              {
                name: 'Versi Invest',
                sector: 'Co-acquisitions & accompagnement',
                desc: 'Conseil en investissement immobilier et co-investissement sur sélection.',
              },
            ].map((p) => (
              <article
                key={p.name}
                className="border border-ink-200 bg-white p-xl transition-colors hover:border-levant-500"
              >
                <p className="overline text-levant-700">{p.sector}</p>
                <h3 className="mt-sm font-heading text-h4 text-ink-950">{p.name}</h3>
                <p className="mt-sm text-sm text-ink-600">{p.desc}</p>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      {/* Section 5 — Trois filtres */}
      <Section tone="subtle">
        <Container width="content">
          <div className="mb-2xl">
            <Overline>Nos filtres de décision</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Trois filtres. Aucune exception.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-xl md:grid-cols-3">
            {[
              {
                title: 'Horizon patrimonial long terme',
                desc: "Nous raisonnons en décennies. Un investissement est évalué sur sa capacité à créer de la valeur sur 20 ou 30 ans — pas sur son TRI à 5 ans.",
              },
              {
                title: 'Préservation de l\u2019environnement',
                desc: "Ce que nous finançons doit tenir sur trente ans. Un modèle qui dégrade l\u2019environnement ne tient pas.",
              },
              {
                title: 'Éthique humaine',
                desc: "Certains secteurs sont hors périmètre, indépendamment du dossier. Ce n\u2019est pas une question d\u2019analyse.",
              },
            ].map((f) => (
              <div key={f.title} className="border-l-2 border-levant-500 pl-lg">
                <h3 className="font-heading text-h4 text-ink-950">{f.title}</h3>
                <p className="mt-sm text-base text-ink-700">{f.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Section 6 — Contact (remplace "Deux façons d'entrer en relation") */}
      <Section tone="elevated" id="contact">
        <Container width="editorial">
          <div className="mb-xl">
            <Overline>Entrer en relation</Overline>
          </div>
          <ContactForm
            variant="contact"
            heading="Nous écrire."
            intro={
              <>
                Vous pouvez nous adresser une demande, une proposition ou une question.
                Nous répondons aux messages qualifiés.
              </>
            }
          />
        </Container>
      </Section>
    </>
  );
}
