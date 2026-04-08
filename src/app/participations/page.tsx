import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { siteConfig } from '@/config/site';

/**
 * /participations — rendu statique (SSG).
 * Écosystème ISSA Capital → Gradient One → filiales. Traitement discret
 * pour l'immobilier en direct (pas de chiffres conformément à la directive Thomas).
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Participations',
  description:
    "L'écosystème de participations d'ISSA Capital : Gradient One, Versi Immobilier, Immocrew, Versimo et patrimoine immobilier en Île-de-France.",
  alternates: { canonical: `${siteConfig.url}/participations` },
  openGraph: {
    title: "Participations — ISSA Capital",
    description:
      'Holding patrimoniale familiale. Écosystème cohérent : tech, immobilier, services aux professionnels.',
    url: `${siteConfig.url}/participations`,
  },
};

type Filiale = {
  name: string;
  activity: string;
  role: string;
  date?: string;
  url?: string;
  note?: string;
  featured?: boolean;
};

// Ordre d'affichage : Versi Invest en tête (participation phare — décision Thomas Bloc 4).
// Versi Invest porte la stratégie d'acquisitions immobilières et d'accompagnement
// partenaires ; Versimo et Immocrew sont des participations d'écosystème plus secondaires.
const filiales: ReadonlyArray<Filiale> = [
  {
    name: 'Versi Invest',
    activity: 'Acquisitions immobilières et accompagnement de partenaires',
    role: 'Co-gérant (via Gradient One)',
    date: '2026',
    featured: true,
  },
  {
    name: 'Versi Immobilier',
    activity: 'Marchand de biens — marché secondaire résidentiel',
    role: 'Actionnaire co-gérant (via Gradient One)',
    date: '2025',
  },
  {
    name: 'Immocrew',
    activity: 'Marketing externalisé pour mandataires immobiliers indépendants',
    role: 'Actionnaire (via Gradient One)',
    url: 'https://immocrew.fr',
  },
  {
    name: 'Versimo',
    activity: 'Home staging virtuel par IA — pièces meublées en 90 secondes',
    role: 'Actionnaire (via Gradient One)',
    url: 'https://versimo.fr',
  },
];

export default function ParticipationsPage(): JSX.Element {
  return (
    <>
      {/* Hero */}
      <Section tone="default">
        <Container width="content">
          <nav aria-label="Fil d'Ariane" className="text-xs text-ink-500">
            <Link href="/" className="hover:text-ink-950">
              Accueil
            </Link>
            <span className="mx-sm" aria-hidden="true">
              /
            </span>
            <span>Participations</span>
          </nav>
          <div className="mt-lg max-w-[800px]">
            <Overline>Notre écosystème</Overline>
            <h1 className="mt-md font-heading text-h1 text-ink-950">
              Un écosystème construit décision après décision.
            </h1>
            <p className="mt-lg text-lead text-ink-700">
              ISSA Capital gère un portefeuille de participations cohérent, structuré
              autour de deux pôles — l&apos;immobilier et la technologie au service de
              l&apos;immobilier.
            </p>
          </div>
        </Container>
      </Section>

      {/* Niveau 1 — Gradient One */}
      <Section tone="elevated">
        <Container width="content">
          <Overline>Participation directe</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Détenu directement par ISSA Capital.
          </h2>

          <div className="mt-xl grid grid-cols-1 gap-xl md:grid-cols-12">
            <div className="md:col-span-7">
              <div className="border border-ink-200 bg-parchment-50 p-xl md:p-2xl">
                <span className="inline-block border border-levant-500 bg-levant-100 px-md py-2xs text-xs font-medium uppercase tracking-wider text-levant-700">
                  Participation directe — 50%
                </span>
                <h3 className="mt-md font-heading text-h2 text-ink-950">Gradient One</h3>
                <p className="mt-xs text-sm text-ink-500">
                  Holding intermédiaire — depuis 2020
                </p>
                <p className="mt-lg text-base leading-relaxed text-ink-700">
                  Gradient One détient les participations opérationnelles de
                  l&apos;écosystème — Versi Immobilier, Versi Invest, Immocrew, Versimo.
                  C&apos;est la structure qui agrège les projets entrepreneuriaux et
                  immobiliers co-fondés depuis 2020.
                </p>
                <p className="mt-md text-xs italic text-ink-500">
                  Gradient One n&apos;a pas de site public.
                </p>
              </div>
            </div>

            <div className="md:col-span-5">
              <div className="border border-ink-200 bg-white p-xl">
                <Overline>Filiales de Gradient One</Overline>
                <ul className="mt-md space-y-md">
                  {filiales.map((f) => (
                    <li key={f.name} className="border-t border-ink-100 pt-md first:border-t-0 first:pt-0">
                      <p className="font-heading text-h4 text-ink-950">{f.name}</p>
                      <p className="text-xs text-ink-600">{f.activity}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Filiales en détail */}
      <Section tone="subtle">
        <Container width="content">
          <div className="mb-2xl max-w-editorial">
            <Overline>Au sein de Gradient One</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Quatre participations opérationnelles.
            </h2>
            <p className="mt-md text-lead text-ink-700">
              Chacune dans son secteur.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-xl md:grid-cols-2">
            {filiales.map((f) => (
              <article
                key={f.name}
                className={
                  f.featured
                    ? 'flex flex-col border-2 border-levant-500 bg-white p-xl md:col-span-2 md:p-2xl'
                    : 'flex flex-col border border-ink-200 bg-white p-xl'
                }
              >
                {f.featured ? (
                  <span className="mb-md inline-block self-start border border-levant-500 bg-levant-100 px-md py-2xs text-xs font-medium uppercase tracking-wider text-levant-700">
                    Participation phare
                  </span>
                ) : null}
                <h3 className="font-heading text-h3 text-ink-950">{f.name}</h3>
                <p className="mt-md text-sm text-ink-700">{f.activity}</p>
                <dl className="mt-lg space-y-sm text-sm">
                  <div className="flex gap-md">
                    <dt className="w-24 text-ink-500">Rôle</dt>
                    <dd className="text-ink-800">{f.role}</dd>
                  </div>
                  {f.date ? (
                    <div className="flex gap-md">
                      <dt className="w-24 text-ink-500">Entrée</dt>
                      <dd className="text-ink-800">{f.date}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-auto pt-lg">
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-sm text-sm text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
                    >
                      Visiter le site
                      <ExternalLink size={14} aria-hidden="true" />
                      <span className="sr-only"> (nouvelle fenêtre)</span>
                    </a>
                  ) : (
                    <p className="text-xs italic text-ink-500">
                      Site bientôt disponible
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </Container>
      </Section>

      {/* Immobilier direct */}
      <Section tone="inverse">
        <Container width="editorial">
          <Overline tone="light">Patrimoine immobilier en direct</Overline>
          <h2 className="mt-md font-heading text-h3 text-parchment-100">
            Résidentiel — Île-de-France
          </h2>
          <p className="mt-md text-base leading-relaxed text-ink-300">
            ISSA Capital gère en direct un patrimoine résidentiel en Île-de-France.
            Constitution patrimoniale et revenus locatifs — gestion directe, horizon long
            terme.
          </p>
        </Container>
      </Section>

      {/* Cohérence */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Cohérence</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Une thèse, pas un portefeuille opportuniste.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              L&apos;immobilier et la technologie au service de l&apos;immobilier ne sont
              pas le résultat d&apos;une stratégie construite sur PowerPoint. Ils
              reflètent un héritage familial — Sonia Issa, mère de Thomas, architecte
              d&apos;intérieur toute sa carrière — et une conviction : l&apos;habitat est
              un secteur de durée, pas de spéculation.
            </p>
            <p>
              Gradient One, Versi, Immocrew, Versimo et le patrimoine direct d&apos;ISSA
              Capital forment un ensemble cohérent. Chaque entité sert un maillon de la
              même chaîne : acquérir, valoriser, gérer, transmettre.
            </p>
          </div>
          <div className="mt-2xl flex flex-wrap gap-lg">
            <Link
              href="/opportunites"
              className="inline-flex items-center gap-sm text-base text-levant-700 hover:text-levant-700"
            >
              Proposer une opportunité →
            </Link>
            <Link
              href="/accompagnement"
              className="inline-flex items-center gap-sm text-base text-levant-700 hover:text-levant-700"
            >
              Besoin d&apos;être accompagné ? →
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
