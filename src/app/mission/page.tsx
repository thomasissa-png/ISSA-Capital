import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { siteConfig } from '@/config/site';

/**
 * /mission — page éditoriale. Rendu statique (SSG) — contenu 100% statique.
 * Histoire de la famille Issa, filiation Jean-Pierre → Thomas, filtres de décision.
 * JSON-LD Person pour Thomas injecté en bas de page.
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Mission & Philosophie',
  description:
    "La mission d'ISSA Capital : faire fructifier le patrimoine d'une famille aux racines libanaises et organiser sa transmission. Filtres de décision, valeurs.",
  alternates: { canonical: `${siteConfig.url}/mission` },
  openGraph: {
    title: 'Mission & Philosophie — ISSA Capital',
    description:
      "Holding patrimoniale d'une famille aux racines libanaises, établie en France. Sa raison d'être, ses valeurs, ses filtres de décision non négociables.",
    url: `${siteConfig.url}/mission`,
    type: 'article',
  },
};

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Thomas Issa',
  jobTitle: 'Fondateur et Président',
  worksFor: {
    '@type': 'Organization',
    name: siteConfig.legalName,
    url: siteConfig.url,
  },
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: 'HEC School of Management' },
    { '@type': 'CollegeOrUniversity', name: 'University of California, Irvine' },
    { '@type': 'CollegeOrUniversity', name: 'IMT Atlantique' },
  ],
  knowsLanguage: ['fr', 'en', 'de', 'ar'],
  sameAs: ['https://www.linkedin.com/in/thomasissa'],
};

export default function MissionPage(): JSX.Element {
  return (
    <>
      <Script
        id="jsonld-person-thomas"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />

      {/* Hero interne */}
      <Section tone="default">
        <Container width="content">
          <nav aria-label="Fil d'Ariane" className="text-xs text-ink-500">
            <Link href="/" className="hover:text-ink-950">
              Accueil
            </Link>
            <span className="mx-sm" aria-hidden="true">
              /
            </span>
            <span>Mission & Philosophie</span>
          </nav>
          <div className="mt-lg md:grid md:grid-cols-12 md:gap-xl">
            <div className="md:col-span-8">
              <Overline>Notre raison d&apos;être</Overline>
              <h1 className="mt-md font-heading text-h1 leading-[1.1] text-ink-950">
                Famille libanaise.
                <br />
                Horizons intergénérationnels.
              </h1>
              <p className="mt-lg max-w-[560px] text-lead text-ink-700">
                Ce que nous construisons, et pourquoi. L&apos;aboutissement de trois
                décennies de construction patrimoniale — organisé pour traverser les
                générations.
              </p>
              <div className="mt-xl h-[2px] w-12 bg-levant-500" />
            </div>
          </div>
        </Container>
      </Section>

      {/* Notre histoire */}
      <Section tone="elevated">
        <Container width="editorial">
          <Overline>Ce qui précède la holding</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Une filiation, pas une création.
          </h2>
          <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
            <p>
              ISSA Capital a commencé avec Jean-Pierre Issa, né à Dakar en 1958 dans une
              famille libanaise, qui a appris le monde dans les salles de réunion
              d&apos;IBM et fait partie de l&apos;équipe qui a lancé Lexmark en Europe
              dans les années 1990. Directeur de filiales dans plusieurs pays. Directeur
              Marketing EMEA. Un homme qui a construit un patrimoine — immobilier à
              Paris, en Normandie, au Liban — décision après décision, continent après
              continent.
            </p>
            <p>
              Puis, en co-actionnariat avec deux partenaires, Jean-Pierre rachète 2J
              Impression — une société française fondée en 1994 à Mérignac, spécialisée
              dans l&apos;impression numérique industrielle d&apos;étiquettes. En trente
              ans, il la développe jusqu&apos;à la présence dans dix-sept pays, de
              l&apos;Europe au Brésil en passant par l&apos;Afrique. Il en est toujours
              Co-Managing Director.
            </p>
            <p>
              Thomas Issa est son fils. C&apos;est de lui qu&apos;il a tout appris sur la
              valeur des actifs réels, la patience, et la transmission comme horizon
              naturel de toute décision économique. ISSA Capital est la formalisation
              juridique de ce legs — une SAS créée en 2026 pour organiser ce qui existait
              déjà dans les convictions d&apos;une famille.
            </p>
            <p>
              C&apos;est l&apos;aboutissement de trois décennies de construction
              patrimoniale, transmis d&apos;un père à son fils, destiné à passer à la
              génération suivante.
            </p>
          </div>
        </Container>
      </Section>

      {/* Décision fondatrice */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>La décision fondatrice</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Une décision simple.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              La famille Issa a choisi de garder le contrôle de son patrimoine —
              indépendant, privé, organisé selon ses propres convictions.
              L&apos;horizon est celui des générations à venir.
            </p>
          </div>
        </Container>
      </Section>

      {/* L'identité */}
      <Section tone="subtle">
        <Container width="editorial">
          <Overline>L&apos;identité</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Racines libanaises. Ancrée en France.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              La famille Issa est d&apos;origine libanaise. ISSA Capital est une SAS
              française, domiciliée à Nanterre. Ces deux faits coexistent — ils se
              complètent.
            </p>
            <p>
              L&apos;héritage libanais apporte une conception du patrimoine transmise de
              génération en génération — une culture de la durée qui précède les
              structures juridiques. L&apos;ancrage français apporte la structure et
              l&apos;accès à un marché immobilier solide.
            </p>
          </div>
        </Container>
      </Section>

      {/* Vision 30 ans */}
      <Section tone="elevated">
        <Container width="editorial">
          <Overline>La vision à trente ans</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Ce que nous voulons que nos enfants reçoivent.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              Jean-Pierre Issa a construit quelque chose. Thomas l&apos;a reçu, compris,
              et décidé de l&apos;organiser. Les trois enfants de Thomas devront, à leur
              tour, décider de ce qu&apos;ils en font.
            </p>
            <p>
              ISSA Capital est là pour que cette question ne soit jamais contrainte par
              des erreurs de structuration, des décisions prises à court terme, ou un
              patrimoine qui s&apos;est effrité faute d&apos;organisation.
            </p>
            <p>
              Dans trente ans, la génération à venir regardera chaque décision prise
              aujourd&apos;hui. Pas seulement pour ce qu&apos;elle aura produit
              financièrement. Pour ce qu&apos;elle aura respecté.
            </p>
            <p>C&apos;est ce que nous construisons. Décision après décision.</p>
          </div>
        </Container>
      </Section>

      {/* Trois filtres */}
      <Section tone="inverse">
        <Container width="editorial">
          <Overline tone="light">Nos filtres</Overline>
          <h2 className="mt-md font-heading text-h2 text-parchment-100">
            Trois filtres. Aucune exception.
          </h2>
          <p className="mt-md text-lead text-ink-300">
            Ces filtres précèdent toute analyse financière.
          </p>

          <div className="mt-2xl space-y-xl">
            <div className="border-l-2 border-levant-500 pl-lg">
              <h3 className="font-heading text-h3 text-parchment-100">
                Horizon patrimonial long terme
              </h3>
              <p className="mt-sm text-base text-ink-300">
                Nous raisonnons en décennies. Un investissement est évalué sur sa
                capacité à créer de la valeur sur vingt ou trente ans — pas sur son
                potentiel de plus-value à horizon de sortie. ISSA Capital entre dans un
                projet pour y rester.
              </p>
            </div>
            <div className="border-l-2 border-levant-500 pl-lg">
              <h3 className="font-heading text-h3 text-parchment-100">
                Préservation de l&apos;environnement
              </h3>
              <p className="mt-sm text-base text-ink-300">
                Une opportunité d&apos;investissement dont le modèle économique repose
                structurellement sur la dégradation de l&apos;environnement est éliminée.
                Ce n&apos;est pas une démarche RSE — c&apos;est un critère de sélection
                réel.
              </p>
            </div>
            <div className="border-l-2 border-levant-500 pl-lg">
              <h3 className="font-heading text-h3 text-parchment-100">Éthique humaine</h3>
              <p className="mt-sm text-base text-ink-300">
                ISSA Capital n&apos;investit jamais dans ce qui va à l&apos;encontre de
                l&apos;humanité. Ce filtre est non négociable et précède toute autre
                analyse.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Ce que nous sommes */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Ce que nous sommes</Overline>
          <h2 className="mt-md font-heading text-h3 text-ink-950">
            Une holding patrimoniale familiale.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              ISSA Capital gère son propre patrimoine familial — pas des capitaux tiers.
              Elle n&apos;a pas d&apos;horizon de sortie contraint, pas de logique de
              revente à cinq ans. Son écosystème est cohérent : immobilier, tech,
              services aux professionnels.
            </p>
            <p>
              La famille fondatrice est libanaise. C&apos;est une réalité qui compte dans
              chaque décision.
            </p>
          </div>
          <div className="mt-2xl flex flex-wrap gap-lg">
            <Link
              href="/participations"
              className="inline-flex items-center gap-sm text-base text-levant-700 hover:text-levant-700"
            >
              Découvrir nos participations →
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
