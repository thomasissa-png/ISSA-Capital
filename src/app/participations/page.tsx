import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { siteConfig } from '@/config/site';

/**
 * /participations — rendu statique (SSG).
 *
 * Refonte session 6 Variante A (par domaine d'activité) — score 9.6/10.
 * Source de vérité : docs/strategy/participations-refonte-10-10-session6.md
 * (verbatim section 3 + handoff lignes 380-416).
 *
 * Architecture 4 sections (par domaine d'activité, pas par organigramme) :
 *   1. Immobilier en direct — Patrimoine IDF + Versi Immobilier
 *   2. Accompagnement et co-investissement — Gradient One + Versi Invest
 *   3. Technologie au service de l'immobilier — Immocrew + Versimo +
 *      Calendrier Tempo
 *   4. Une thèse, pas un portefeuille — éditoriale + liens sortie
 *
 * Gradient One disparaît comme structure de page. Elle est définie une seule
 * fois, discrètement, dans le hero (2 lignes text-xs italic) — Karim lit les
 * activités avant de lire les noms d'entités. Logique sectorielle, lisible
 * sans connaissance préalable de l'organigramme. Traitement "featured" sur
 * Versi Invest supprimé (pas de bordure renforcée ni de colonne élargie).
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Participations',
  description:
    "L'écosystème immobilier d'ISSA Capital construit depuis 2020 : Patrimoine résidentiel IDF, Versi Immobilier, Gradient One, Versi Invest, Immocrew, Versimo, Calendrier Tempo.",
  alternates: { canonical: `${siteConfig.url}/participations` },
  openGraph: {
    title: 'Participations — ISSA Capital',
    description:
      "Un écosystème immobilier construit depuis 2020 : immobilier en direct, accompagnement et co-investissement, technologie au service de l'immobilier.",
    url: `${siteConfig.url}/participations`,
  },
};

export default function ParticipationsPage(): JSX.Element {
  return (
    <>
      {/* Hero — H1 sectoriel + intro 3 lignes + note contextuelle Gradient One
          (discrète, text-xs italic) + ligne statut. */}
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
              Un écosystème immobilier construit depuis 2020.
            </h1>
            <p className="mt-lg text-lead text-ink-700">
              ISSA Capital investit dans l&apos;immobilier — en direct et via des
              participations — depuis 2020. Cet écosystème n&apos;est pas le
              résultat d&apos;opportunités saisies au fil du temps : il reflète
              une conviction familiale ancrée dans l&apos;immobilier depuis trois
              décennies.
            </p>
            <p className="mt-md text-base text-ink-600">
              Cette page présente la cartographie des participations et actifs
              d&apos;ISSA Capital.
            </p>
          </div>
        </Container>
      </Section>

      {/* Section 1 — Immobilier en direct.
          2 blocs : Patrimoine résidentiel IDF (détention directe ISSA Capital)
          + Versi Immobilier (marchand de biens). */}
      <Section tone="elevated">
        <Container width="content">
          <div className="mb-2xl max-w-editorial">
            <Overline>Actifs détenus</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Immobilier en direct.
            </h2>
            <p className="mt-md text-lead text-ink-700">
              ISSA Capital détient des actifs immobiliers résidentiels — en propre
              et via Versi Immobilier.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-xl md:grid-cols-2">
            {/* Bloc A — Patrimoine immobilier résidentiel (détention directe) */}
            <article className="flex flex-col border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">
                Patrimoine immobilier résidentiel
              </h3>
              <p className="mt-xs text-sm text-ink-500">
                Île-de-France — détention directe ISSA Capital
              </p>
              <p className="mt-lg text-base leading-relaxed text-ink-700">
                Actifs résidentiels détenus et gérés en direct. Constitution
                patrimoniale, revenus locatifs, gestion directe.
              </p>
              <dl className="mt-auto space-y-sm pt-lg text-sm">
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Détention</dt>
                  <dd className="text-ink-800">Directe — ISSA Capital</dd>
                </div>
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Horizon</dt>
                  <dd className="text-ink-800">Long terme</dd>
                </div>
              </dl>
            </article>

            {/* Bloc B — Versi Immobilier (marchand de biens) */}
            <article className="flex flex-col border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">
                Versi Immobilier
              </h3>
              <p className="mt-xs text-sm text-ink-500">
                Marchand de biens — marché secondaire résidentiel
              </p>
              <p className="mt-lg text-base leading-relaxed text-ink-700">
                Acquisition, rénovation, revente sur le marché secondaire
                résidentiel.
              </p>
              <dl className="mt-auto space-y-sm pt-lg text-sm">
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Rôle</dt>
                  <dd className="text-ink-800">Actionnaire co-gérant</dd>
                </div>
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Entrée</dt>
                  <dd className="text-ink-800">2025</dd>
                </div>
              </dl>
            </article>
          </div>
        </Container>
      </Section>

      {/* Section 2 — Accompagnement et co-investissement.
          Session 8 CHECKPOINT Thomas : restructuration.
          - Gradient One ajouté en premier (holding intermédiaire co-fondée
            par ISSA Capital en 2020, détient les participations
            opérationnelles et financières de l'écosystème).
          - Versi Invest reste.
          - Immocrew déplacé vers Section 3 "Technologie au service de
            l'immobilier" (cohérent avec la dimension outil/produit). */}
      <Section tone="subtle">
        <Container width="content">
          <div className="mb-2xl max-w-editorial">
            <Overline>Services aux professionnels</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Accompagnement et co-investissement.
            </h2>
            <p className="mt-md text-lead text-ink-700">
              Deux entités de l&apos;écosystème accompagnent les professionnels et
              investisseurs de l&apos;immobilier.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-xl md:grid-cols-2">
            {/* Bloc A — Gradient One (holding intermédiaire) */}
            <article className="flex flex-col border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">Gradient One</h3>
              <p className="mt-xs text-sm text-ink-500">
                Holding intermédiaire — co-fondée par ISSA Capital
              </p>
              <p className="mt-lg text-base leading-relaxed text-ink-700">
                Holding intermédiaire détenant les participations opérationnelles
                et financières de l&apos;écosystème ISSA Capital. Co-fondée par
                Thomas Issa et deux associés en 2020.
              </p>
              <dl className="mt-auto space-y-sm pt-lg text-sm">
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Rôle</dt>
                  <dd className="text-ink-800">Co-fondateur</dd>
                </div>
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Entrée</dt>
                  <dd className="text-ink-800">2020 — Co-fondation</dd>
                </div>
              </dl>
            </article>

            {/* Bloc B — Versi Invest */}
            <article className="flex flex-col border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">Versi Invest</h3>
              <p className="mt-lg text-base leading-relaxed text-ink-700">
                Conseil en investissement immobilier et co-investissement sur
                sélection.
              </p>
              <dl className="mt-auto space-y-sm pt-lg text-sm">
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Rôle</dt>
                  <dd className="text-ink-800">Co-gérant</dd>
                </div>
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Entrée</dt>
                  <dd className="text-ink-800">2026</dd>
                </div>
              </dl>
            </article>
          </div>
        </Container>
      </Section>

      {/* Section 3 — Technologie au service de l'immobilier.
          Session 8 CHECKPOINT Thomas : section élargie à 3 blocs.
          - Immocrew déplacé depuis Section 2 (outil marketing pour
            mandataires — dimension produit numérique).
          - Versimo (inchangé — home staging virtuel par IA).
          - Calendrier Tempo (nouvelle participation — outil web grand
            public de suivi du calendrier Tempo EDF). */}
      <Section tone="default">
        <Container width="content">
          <div className="mb-2xl max-w-editorial">
            <Overline>Innovation</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Technologie au service de l&apos;immobilier.
            </h2>
            <p className="mt-md text-lead text-ink-700">
              Plusieurs participations de l&apos;écosystème développent des
              outils numériques pour les professionnels du secteur et le grand
              public.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-xl md:grid-cols-2 lg:grid-cols-3">
            {/* Bloc A — Immocrew (déplacé depuis Section 2) */}
            <article className="flex flex-col border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">Immocrew</h3>
              <p className="mt-lg text-base leading-relaxed text-ink-700">
                Marketing externalisé pour mandataires immobiliers indépendants.
                « Tu publies, on fait le reste. »
              </p>
              <dl className="mt-auto space-y-sm pt-lg text-sm">
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Rôle</dt>
                  <dd className="text-ink-800">Actionnaire</dd>
                </div>
              </dl>
              <div className="mt-md">
                <a
                  href="https://immocrew.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-sm text-sm text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
                >
                  immocrew.fr
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only"> (nouvelle fenêtre)</span>
                </a>
              </div>
            </article>

            {/* Bloc B — Versimo */}
            <article className="flex flex-col border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">Versimo</h3>
              <p className="mt-lg text-base leading-relaxed text-ink-700">
                Home staging virtuel par IA. Une pièce meublée en 90 secondes.
              </p>
              <dl className="mt-auto space-y-sm pt-lg text-sm">
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Rôle</dt>
                  <dd className="text-ink-800">Actionnaire</dd>
                </div>
              </dl>
              <div className="mt-md">
                <a
                  href="https://versimo.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-sm text-sm text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
                >
                  versimo.fr
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only"> (nouvelle fenêtre)</span>
                </a>
              </div>
            </article>

            {/* Bloc C — Calendrier Tempo (nouvelle participation) */}
            <article className="flex flex-col border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">
                Calendrier Tempo
              </h3>
              <p className="mt-xs text-sm text-ink-500">
                Outil web — calendrier des jours Tempo EDF
              </p>
              <p className="mt-lg text-base leading-relaxed text-ink-700">
                Outil web grand public de suivi du calendrier Tempo EDF.
                Participation détenue par ISSA Capital.
              </p>
              <dl className="mt-auto space-y-sm pt-lg text-sm">
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Rôle</dt>
                  <dd className="text-ink-800">Actionnaire</dd>
                </div>
                <div className="flex gap-md">
                  <dt className="w-24 text-ink-500">Entrée</dt>
                  <dd className="text-ink-800">2025</dd>
                </div>
              </dl>
              <div className="mt-md">
                <a
                  href="https://www.calendrier-tempo.fr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-sm text-sm text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
                >
                  calendrier-tempo.fr
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only"> (nouvelle fenêtre)</span>
                </a>
              </div>
            </article>
          </div>
        </Container>
      </Section>

      {/* Section 4 — Une thèse, pas un portefeuille.
          Éditoriale finale + liens de sortie. Verbatim verrouillé session 6
          lignes 144-156 du livrable participations-refonte-10-10-session6.md */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Cohérence</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Une thèse, pas un portefeuille.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              L&apos;immobilier et la technologie au service de l&apos;immobilier
              ne sont pas le résultat d&apos;une stratégie construite sur
              PowerPoint. Ils reflètent un héritage familial — Sonia Issa,
              architecte d&apos;intérieur, mère de Thomas — et une conviction :
              l&apos;habitat est un secteur de durée, pas de spéculation.
            </p>
            <p>
              Chaque entité de l&apos;écosystème sert un maillon de la même
              chaîne : acquérir, valoriser, gérer, transmettre.
            </p>
          </div>
          <div className="mt-2xl flex flex-wrap gap-lg">
            <Link
              href="/opportunites"
              className="inline-flex items-center gap-sm text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
            >
              Proposer une opportunité →
            </Link>
            <Link
              href="/accompagnement"
              className="inline-flex items-center gap-sm text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
            >
              Besoin d&apos;être accompagné ? →
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
