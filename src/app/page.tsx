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
    absolute: "ISSA Capital — Holding patrimoniale d'une famille libanaise",
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
    title: "ISSA Capital — Holding patrimoniale d'une famille libanaise",
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
            Racines libanaises.
            <br />
            Exigences sans exception.
          </h1>
          <p className="mx-auto mt-xl max-w-[520px] font-body text-lead text-ink-300">
            La holding patrimoniale d&apos;une famille libanaise, établie en France.
            Patrimoine, participations, transmission.
          </p>
          <div className="mt-2xl flex flex-col items-center justify-center gap-md sm:flex-row sm:gap-lg">
            <Button href="/opportunites" variant="primary-inverse" size="lg">
              Présenter une opportunité d&apos;affaires
            </Button>
            <Button
              href="/accompagnement"
              variant="ghost"
              size="lg"
              className="border border-parchment-100/40 bg-transparent text-parchment-100 hover:bg-parchment-100/10 active:bg-parchment-100/20"
            >
              Être accompagné
            </Button>
          </div>
        </Container>
      </Section>

      {/* Section 2 — Chapeau mission + passerelle /a-propos */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Notre raison d&apos;être</Overline>
          <h2 className="mt-md max-w-[640px] font-heading text-h3 text-ink-950">
            Une holding née d&apos;une lignée.
          </h2>
          <div className="mt-lg space-y-md text-lead text-ink-700">
            <p>
              ISSA Capital est la holding patrimoniale d&apos;une famille libanaise,
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
          <div className="mt-xl flex flex-col gap-md sm:flex-row sm:flex-wrap sm:gap-xl">
            <Link
              href="/mission"
              className="inline-flex items-center gap-sm font-body text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
            >
              Lire notre mission
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              href="/a-propos"
              className="inline-flex items-center gap-sm font-body text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
            >
              Découvrir la famille fondatrice
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </Section>

      {/* Section 3 — Key stats */}
      <Section tone="inverse">
        <Container width="content">
          <div className="grid grid-cols-1 gap-xl md:grid-cols-3 md:divide-x md:divide-ink-800">
            <div className="border-b border-ink-800 px-xl pb-xl text-center last:border-b-0 last:pb-0 md:border-b-0 md:pb-0 md:text-left">
              <p className="font-heading text-display leading-none text-levant-500">50%</p>
              <p className="mt-sm font-body text-sm uppercase tracking-wider text-ink-300">
                Gradient One
              </p>
              <p className="mt-xs font-body text-xs text-ink-400">
                Holding intermédiaire — co-fondée en 2020
              </p>
            </div>
            <div className="border-b border-ink-800 px-xl pb-xl text-center last:border-b-0 last:pb-0 md:border-b-0 md:pb-0 md:text-left">
              <p className="font-heading text-display leading-none text-levant-500">2020</p>
              <p className="mt-sm font-body text-sm uppercase tracking-wider text-ink-300">
                Première participation
              </p>
            </div>
            <div className="border-b border-ink-800 px-xl pb-xl text-center last:border-b-0 last:pb-0 md:border-b-0 md:pb-0 md:text-left">
              <p className="font-heading text-display leading-none text-levant-500">4</p>
              <p className="mt-sm font-body text-sm uppercase tracking-wider text-ink-300">
                Participations opérationnelles
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — Écosystème aperçu (ex-Section 5 — Section 4 Filiation migrée vers /a-propos) */}
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
            {/*
              Décision Thomas session 5 (retour #2) : la homepage est un teaser et
              n'affiche QUE 3 participations — Gradient One, Versi Immobilier,
              Versi Invest. L'écosystème complet (Immocrew, Versimo, immobilier
              direct) est exclusivement présenté sur /participations, qui assume
              le rôle de cartographie exhaustive.
            */}
            {[
              {
                name: 'Gradient One',
                sector: 'Holding intermédiaire',
                desc: "Co-fondée en 2020. 50% ISSA Capital — porte les participations opérationnelles de l'écosystème.",
              },
              {
                name: 'Versi Immobilier',
                sector: 'Marchand de biens',
                desc: 'Marché secondaire résidentiel — acquisition, rénovation, revente.',
              },
              {
                name: 'Versi Invest',
                sector: 'Acquisitions & accompagnement',
                desc: 'Acquisitions immobilières et accompagnement de partenaires investisseurs.',
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

      {/* Section 6 — Deux portes d'entrée symétriques (Karim ↔ Leila) */}
      <Section tone="inverse">
        <Container width="content">
          <div className="mb-2xl text-center">
            <Overline tone="light">Deux façons d&apos;entrer en relation</Overline>
            <h2 className="mt-md font-heading text-h2 text-parchment-100">
              Deux raisons de prendre contact.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-xl md:grid-cols-2">
            {/* Porte 1 — Dirigeants / Karim → /accompagnement */}
            <article className="flex flex-col border border-ink-800 bg-ink-900 p-xl md:p-2xl">
              <Overline tone="light">Pour les dirigeants</Overline>
              <h3 className="mt-md font-heading text-h3 text-parchment-100">
                Accompagnement de dirigeants.
              </h3>
              <p className="mt-md flex-1 text-base text-ink-300">
                Une mission ponctuelle ou un rôle d&apos;advisor récurrent. Pour les
                fondateurs et dirigeants qui cherchent un pair — pas un prestataire.
              </p>
              <div className="mt-lg">
                <Button href="/accompagnement" variant="primary-inverse" size="lg">
                  Besoin d&apos;être accompagné ?
                </Button>
              </div>
            </article>

            {/* Porte 2 — Apporteurs d'affaires / Leila → /opportunites */}
            <article className="flex flex-col border border-ink-800 bg-ink-900 p-xl md:p-2xl">
              <Overline tone="light">Pour les apporteurs d&apos;affaires</Overline>
              <h3 className="mt-md font-heading text-h3 text-parchment-100">
                Présenter une opportunité.
              </h3>
              <p className="mt-md flex-1 text-base text-ink-300">
                Vous avez un actif à présenter ou une opportunité à faire étudier. ISSA
                Capital investit en propre — immobilier résidentiel francilien ou
                participations minoritaires dans des entreprises saines. Critères
                explicites, horizon long, aucun comité trimestriel à convaincre.
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
