import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { Button } from '@/components/ui/Button';
import { siteConfig } from '@/config/site';

/**
 * Page d'accueil — rendu statique (SSG).
 * Pas de données dynamiques, pas de fetch. Next la rend à build time.
 * Respecte le Principe directeur #0 : VITRINE pas conversion — CTAs discrets,
 * ton éditorial, hero typographique sans CTA agressif.
 */

export const dynamic = 'force-static';

// NOTE : le title est utilisé tel quel (pas de suffixe — c'est la home).
// Le layout root applique `template: '%s — ISSA Capital'`, donc on définit ici
// un title "absolute" via l'objet pour neutraliser le template sur la home.
export const metadata: Metadata = {
  title: {
    absolute: 'ISSA Capital — Holding patrimoniale famille libanaise',
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
    title: 'ISSA Capital — Holding patrimoniale famille libanaise',
    description:
      "Holding patrimoniale d'une famille aux racines libanaises, établie en France. Immobilier, participations, conseil stratégique.",
    images: [siteConfig.ogImage],
  },
};

export default function HomePage(): JSX.Element {
  return (
    <>
      {/* Section 1 — Hero principal */}
      <Section tone="inverse" className="py-4xl md:py-5xl">
        <Container width="editorial" className="text-center">
          <Overline tone="light">Holding patrimoniale — famille libanaise</Overline>
          <h1 className="mt-lg font-heading text-display leading-[1.08] text-parchment-100">
            On décide.
            <br />
            Pas un calendrier de fonds.
          </h1>
          <p className="mx-auto mt-xl max-w-[520px] font-body text-lead text-ink-300">
            La holding patrimoniale d&apos;une famille aux racines libanaises qui investit
            pour les générations à venir, dans des projets qu&apos;elle peut transmettre
            fièrement.
          </p>
          <div className="mt-2xl flex flex-col items-center justify-center gap-md sm:flex-row">
            <Button href="/opportunites" variant="primary-inverse" size="lg">
              Présenter une opportunité d&apos;affaires
            </Button>
            <Button href="/accompagnement" variant="ghost" size="lg" className="text-parchment-100 hover:bg-ink-800">
              Travailler avec Thomas Issa
            </Button>
          </div>
          <p className="mt-2xl font-heading italic text-ink-400">
            Racines libanaises. Exigences sans exception.
          </p>
        </Container>
      </Section>

      {/* Section 2 — Chapeau mission */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Notre raison d&apos;être</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            ISSA Capital, c&apos;est une décision de famille.
          </h2>
          <div className="mt-lg space-y-md text-lead text-ink-700">
            <p>
              ISSA Capital est la holding patrimoniale de la famille Issa — famille aux
              racines libanaises, établie en France. Sa raison d&apos;être est simple :
              faire fructifier le patrimoine familial dans la durée et organiser sa
              transmission entre les générations.
            </p>
            <p>
              Pas un fonds. Pas une structure à terme. Une holding indépendante, dont la
              famille est le seul actionnaire, et dont l&apos;horizon est intergénérationnel.
            </p>
            <p>
              Cette holding n&apos;est pas née en 2026. Elle est l&apos;aboutissement de
              trois décennies de construction patrimoniale — une famille libanaise qui a
              appris à construire, à tenir, et à transmettre.
            </p>
          </div>
          <Link
            href="/mission"
            className="mt-xl inline-flex items-center gap-sm font-body text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
          >
            Lire notre mission
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </Container>
      </Section>

      {/* Section 3 — Key stats */}
      <Section tone="inverse">
        <Container width="content">
          <div className="grid grid-cols-1 gap-xl md:grid-cols-3 md:divide-x md:divide-ink-800">
            <div className="px-xl text-center md:text-left">
              <p className="font-heading text-[4rem] leading-none text-levant-500">50%</p>
              <p className="mt-sm font-body text-sm uppercase tracking-wider text-ink-300">
                Gradient One
              </p>
              <p className="mt-xs font-body text-xs text-ink-400">
                Holding intermédiaire — co-fondée en 2020
              </p>
            </div>
            <div className="px-xl text-center md:text-left">
              <p className="font-heading text-[4rem] leading-none text-levant-500">2020</p>
              <p className="mt-sm font-body text-sm uppercase tracking-wider text-ink-300">
                Première participation
              </p>
            </div>
            <div className="px-xl text-center md:text-left">
              <p className="font-heading text-[4rem] leading-none text-levant-500">4</p>
              <p className="mt-sm font-body text-sm uppercase tracking-wider text-ink-300">
                Participations opérationnelles
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — Deux points d'entrée */}
      <Section tone="subtle">
        <Container width="content">
          <div className="mb-2xl">
            <Overline>Deux points d&apos;entrée</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Deux raisons de prendre contact.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-xl md:grid-cols-2">
            <article className="border border-ink-200 bg-white p-xl md:p-2xl">
              <p className="overline text-levant-700">Pour les dirigeants</p>
              <h3 className="mt-md font-heading text-h3 text-ink-950">
                Structurer votre patrimoine avec quelqu&apos;un qui l&apos;a fait.
              </h3>
              <p className="mt-md text-base text-ink-700">
                Thomas Issa a co-fondé une holding, investi en direct dans l&apos;immobilier
                francilien et accompagné des fondateurs pendant sept ans. Si vous cherchez
                un pair qui connaît les arbitrages — pas un conseiller qui vend des produits
                — c&apos;est l&apos;interlocuteur.
              </p>
              <Link
                href="/accompagnement"
                className="mt-lg inline-flex items-center gap-sm text-base text-levant-700 hover:text-levant-700"
              >
                Découvrir l&apos;accompagnement
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </article>
            <article className="border border-ink-200 bg-white p-xl md:p-2xl">
              <p className="overline text-levant-700">Pour les apporteurs d&apos;affaires</p>
              <h3 className="mt-md font-heading text-h3 text-ink-950">
                Proposer un deal à une holding qui décide vite.
              </h3>
              <p className="mt-md text-base text-ink-700">
                ISSA Capital investit dans l&apos;immobilier résidentiel et des
                participations minoritaires. Horizon long. Critères explicites. Aucun
                comité d&apos;investissement qui se réunit une fois par trimestre.
              </p>
              <Link
                href="/opportunites"
                className="mt-lg inline-flex items-center gap-sm text-base text-levant-700 hover:text-levant-700"
              >
                Consulter nos critères
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </Container>
      </Section>

      {/* Section 5 — Écosystème aperçu */}
      <Section tone="default">
        <Container width="content">
          <div className="mb-2xl">
            <Overline>Notre écosystème</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Un écosystème construit depuis 2020.
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
                desc: 'Co-fondée en 2020. Détient Versi, Immocrew et Versimo.',
              },
              {
                name: 'Versi Immobilier',
                sector: 'Marchand de biens',
                desc: 'Marché secondaire résidentiel.',
              },
              {
                name: 'Immocrew',
                sector: 'Marketing immobilier',
                desc: 'Services pour mandataires indépendants.',
              },
              {
                name: 'Versimo',
                sector: 'Home staging IA',
                desc: 'Transformation de photos en espaces meublés en 90 secondes.',
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
          <div className="mt-2xl text-center">
            <Button href="/participations" variant="secondary" size="md">
              Voir toutes nos participations
            </Button>
          </div>
        </Container>
      </Section>

      {/* Section 6 — Trois filtres */}
      <Section tone="subtle">
        <Container width="content">
          <div className="mb-2xl">
            <Overline>Nos filtres de décision</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Trois filtres. Aucune exception.
            </h2>
            <p className="mt-md max-w-editorial text-lead text-ink-700">
              Nos décisions d&apos;investissement ne sont pas négociables sur ces trois
              critères.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-xl md:grid-cols-3">
            {[
              {
                title: 'Horizon patrimonial long terme',
                desc: "Nous raisonnons en décennies. Un investissement est évalué sur sa capacité à créer de la valeur sur 20 ou 30 ans — pas sur son TRI à 5 ans.",
              },
              {
                title: 'Préservation de l’environnement',
                desc: "Toute opportunité dont le modèle économique repose sur la dégradation de l'environnement est éliminée, quelle que soit sa rentabilité.",
              },
              {
                title: 'Éthique humaine',
                desc: "ISSA Capital n'investit jamais dans ce qui va à l'encontre de l'humanité. Ce filtre est non négociable.",
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

      {/* Section 7 — Deux portes d'entrée symétriques (Karim ↔ Leila) */}
      <Section tone="inverse">
        <Container width="content">
          <div className="mb-2xl text-center">
            <Overline tone="light">Deux façons d&apos;entrer en relation</Overline>
            <h2 className="mt-md font-heading text-h2 text-parchment-100">
              Deux portes. Une même exigence.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-xl md:grid-cols-2">
            {/* Porte 1 — Dirigeants / Karim → /accompagnement */}
            <article className="flex flex-col border border-ink-800 bg-ink-900 p-xl md:p-2xl">
              <p className="overline text-levant-500">Pour les dirigeants</p>
              <h3 className="mt-md font-heading text-h3 text-parchment-100">
                Travailler avec Thomas Issa.
              </h3>
              <p className="mt-md flex-1 text-base text-ink-300">
                Une mission ponctuelle ou un rôle d&apos;advisor récurrent. Pour les
                fondateurs et dirigeants qui cherchent un pair — pas un prestataire.
              </p>
              <div className="mt-lg">
                <Button href="/accompagnement" variant="primary-inverse" size="lg">
                  Découvrir l&apos;accompagnement
                </Button>
              </div>
            </article>

            {/* Porte 2 — Apporteurs d'affaires / Leila → /opportunites */}
            <article className="flex flex-col border border-ink-800 bg-ink-900 p-xl md:p-2xl">
              <p className="overline text-levant-500">Pour les apporteurs d&apos;affaires</p>
              <h3 className="mt-md font-heading text-h3 text-parchment-100">
                Présenter une opportunité.
              </h3>
              <p className="mt-md flex-1 text-base text-ink-300">
                Immobilier résidentiel ou participation minoritaire. Critères explicites,
                horizon long, décision rapide. Nous étudions chaque dossier qualifié.
              </p>
              <div className="mt-lg">
                <Button href="/opportunites" variant="primary-inverse" size="lg">
                  Présenter une opportunité
                </Button>
              </div>
            </article>
          </div>
          <p className="mt-2xl text-center text-xs text-ink-400">
            Ou contactez-nous directement : contact@issa-capital.com
          </p>
        </Container>
      </Section>
    </>
  );
}
