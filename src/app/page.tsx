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
    absolute: "ISSA Capital — Holding patrimoniale familiale",
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
    title: "ISSA Capital — Holding patrimoniale familiale",
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

      {/* Section 2 — Chapeau mission
          Session 6 Phase 5 : /a-propos a été fusionnée dans /mission (biographie
          Thomas, Sonia, famille absorbées). Le second lien "Découvrir la famille
          fondatrice" pointait vers /a-propos — il est supprimé car redondant
          avec "Lire notre mission" qui mène désormais à la page unifiée. */}
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
          <div className="mt-xl flex flex-col gap-md sm:flex-row sm:flex-wrap sm:gap-xl">
            <Link
              href="/mission"
              className="inline-flex items-center gap-sm font-body text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
            >
              Lire notre mission
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </Section>

      {/* Section 3 — Stats d'ancrage (stats-only strict)
          Session 7 CHECKPOINT #5 Thomas : texte éditorial Gradient One retiré.
          La homepage ne conserve QUE les stats (2020 / 6 / 3) — le titre, le
          sous-titre italique et la description de Gradient One ajoutés en
          Phase 3+5 session 6 sont supprimés. Raison : éviter de sur-mettre
          Gradient One en avant sur la homepage (cohérent avec le traitement
          discret adopté sur /participations — note hero uniquement).
          Le chiffre 50 reste verrouillé hors scope (CHECKPOINT #2 session 6). */}
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

      {/* Section 4 — Écosystème aperçu (teaser 3 participations, cartographie complète sur /participations) */}
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
                desc: "Co-fondée en 2020. Porte les participations opérationnelles et financières de l'écosystème.",
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
                desc: "Ce que nous finançons doit tenir sur trente ans. Un modèle qui dégrade l'environnement ne tient pas.",
              },
              {
                title: 'Éthique humaine',
                desc: "Certains secteurs sont hors périmètre, indépendamment du dossier. Ce n'est pas une question d'analyse.",
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
            {/* Porte 1 — Apporteurs d'affaires / Leila → /opportunites
                Session 8 CHECKPOINT Thomas : ordre inversé — Opportunités
                à gauche, Accompagnement à droite (cohérent avec l'ordre du
                nav top qui place également Opportunités avant Accompagnement). */}
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

            {/* Porte 2 — Dirigeants / Karim → /accompagnement */}
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
          </div>
          <p className="mt-2xl text-center text-xs text-ink-400">
            Ou contactez-nous directement : contact@issa-capital.com
          </p>
        </Container>
      </Section>
    </>
  );
}
