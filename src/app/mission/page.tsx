import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { siteConfig } from '@/config/site';

/**
 * /mission — page éditoriale. Rendu statique (SSG) — contenu 100% statique.
 *
 * Refonte session 6 (CHECKPOINT #2 Thomas) : fusion /mission + /a-propos.
 * La page absorbe la biographie Thomas complète, la section famille (enfants
 * Antoine/Noémie/Lucas), et Sonia Issa depuis /a-propos. Structure en 7 sections
 * (voir docs/copy/mission-page-fusion-copy.md) :
 *
 *   1. Hero — ancrage identitaire libanais
 *   2. Ce qui précède la holding — Jean-Pierre Issa + Sonia
 *   3. Le fondateur — Thomas Issa (biographie complète)
 *   4. La famille — enfants, horizon transmissif
 *   5. L'identité — racines libanaises, ancrage français
 *   6. Trois filtres — corrections session 6 (Filtre 2 Option B, Filtre 3 Option A)
 *   7. Ce que nous sommes — clôture, 2 liens sobres
 *
 * Décisions verrouillées CHECKPOINT #2 :
 * - Filtre 2 "Préservation environnement" = Option B (principiel)
 * - Filtre 3 "Éthique humaine" = Option A (pragmatique)
 * - Biographie Thomas verbatim (phrase-pont Décision 4 @creative-strategy,
 *   sortie agence, ellipse "Une agence de communication internationale")
 * - Prénoms et dates enfants : Antoine 2015, Noémie 2018, Lucas 2023
 *
 * Source copy : docs/copy/mission-page-fusion-copy.md
 * Source architecture : refonte fusion Phase 5 session 6
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Mission & Philosophie',
  description:
    "La mission d'ISSA Capital : faire fructifier le patrimoine d'une famille aux racines libanaises et organiser sa transmission. Jean-Pierre Issa, Thomas Issa, filtres de décision.",
  alternates: { canonical: `${siteConfig.url}/mission` },
  openGraph: {
    title: 'Mission & Philosophie — ISSA Capital',
    description:
      "Holding patrimoniale d'une famille aux racines libanaises, établie en France. Sa raison d'être, la filiation Jean-Pierre → Thomas, ses filtres de décision non négociables.",
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
    { '@type': 'CollegeOrUniversity', name: 'Institut Florimont, Genève' },
    { '@type': 'CollegeOrUniversity', name: 'University of California, Irvine' },
  ],
  knowsLanguage: ['fr', 'en', 'ar'],
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

      {/* Section 1 — Hero */}
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

      {/* Section 2 — Ce qui précède la holding (Jean-Pierre Issa + Sonia) */}
      <Section tone="elevated">
        <Container width="editorial">
          <Overline>Ce qui précède la holding</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Une filiation, pas une création.
          </h2>
          <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
            <p>
              Jean-Pierre Issa est né à Dakar en 1958, dans une famille d&apos;origine
              libanaise. Comme beaucoup de familles libanaises de sa génération, il
              quitte le Liban dans les années 1970, quand la guerre civile recompose
              les destins. Il fait ses études en France, entre dans l&apos;industrie
              et rejoint IBM dans les années 1980 — une école de rigueur et de
              discipline internationale. En 1991, il fait partie de l&apos;équipe
              fondatrice qui lance Lexmark en Europe lors de sa scission d&apos;IBM :
              Directeur de filiales dans plusieurs pays, Directeur Marketing EMEA.
              Un parcours construit dans les salles de réunion et sur le terrain,
              continent après continent.
            </p>
            <p>
              En 2016, avec deux associés, il rachète 2J Impression à Mérignac —
              une structure de distribution multimarque de matériel d&apos;impression
              numérique industrielle. L&apos;entreprise développe ses activités dans
              17 pays, atteint 4 millions d&apos;euros de chiffre d&apos;affaires et
              s&apos;impose comme un acteur sérieux de son segment. Co-Managing
              Director et membre du conseil, Jean-Pierre Issa y applique la même
              logique qu&apos;il a apprise chez IBM : construire avec méthode,
              tenir dans la durée, décider avec rigueur.
            </p>
            <p className="border-l-2 border-levant-500 pl-lg italic text-ink-700">
              À ses côtés depuis le début, Sonia Issa — architecte d&apos;intérieur —
              a donné à la famille son sens de l&apos;espace, de la forme et du
              beau. Une sensibilité qui traverse discrètement tout ce que la famille
              construit.
            </p>
          </div>
        </Container>
      </Section>

      {/* Section 3 — Le fondateur (Thomas Issa) — biographie absorbée depuis /a-propos
          Formulations verrouillées :
          - Phrase-pont @creative-strategy Décision 4 (ne pas reformuler)
          - Sortie agence "pour se consacrer à sa famille..." (verrouillée Thomas)
          - Ellipse "Une agence de communication internationale" (pivotable si
            Thomas valide la révélation publique future) */}
      <Section tone="default">
        <Container width="content">
          <div className="max-w-editorial">
            <Overline>Le fondateur</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">Thomas Issa</h2>
            <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
              <p>
                Thomas Issa naît en France à la fin des années 1980, dans une famille
                qui a appris à s&apos;adapter et à construire. Sa formation est
                internationale dès le départ : une jeunesse en Afrique du Sud,
                puis l&apos;Institut Florimont à Genève, puis l&apos;université de
                Californie à Irvine. Avant de rentrer en France, un détour par
                l&apos;Inde — quelques mois d&apos;engagement humanitaire qui
                laissent une marque. Il revient avec une conviction : les
                structures qui durent sont celles qu&apos;on construit avec
                intention, pas avec précipitation.
              </p>
              <p>
                Il rejoint ensuite Sony, puis TEOS, et travaille en conseil
                stratégique — des postes en entreprise qui lui donnent une lecture
                fine des organisations, de leurs angles morts et de ce qu&apos;il
                faut pour les faire avancer. C&apos;est là qu&apos;il identifie un
                manque : il ne trouve pas l&apos;agence de communication avec
                laquelle il veut travailler. Alors il la crée.
              </p>
              <p>
                Une agence de communication internationale qu&apos;il fonde à
                35 ans, qui grandit rapidement jusqu&apos;à réunir plus de 35
                experts, avec des missions dans les grandes verticales mondiales —
                tech, luxe, logistique, biens de consommation. Parmi ses clients :
                TikTok, Adidas, Lego. Une structure construite à partir de rien,
                dans la complexité internationale, avec l&apos;exigence d&apos;un
                opérateur qui sait ce qu&apos;il veut.
              </p>
              <p>
                Ce qu&apos;il retient de ces années : qu&apos;on peut construire une
                structure solide à partir de rien, à condition de choisir ses
                engagements avec exigence. C&apos;est la même logique qu&apos;il
                applique aujourd&apos;hui à ISSA Capital — à une autre échelle, avec
                une autre temporalité. En 2025, il quitte l&apos;agence pour se
                consacrer à sa famille et au développement des activités
                d&apos;ISSA Capital. La holding est créée en 2026.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — La famille (enfants) — absorbée depuis /a-propos Section D
          Prénoms et dates validés CHECKPOINT Thomas session 4 (A3). */}
      <Section tone="subtle">
        <Container width="editorial">
          <Overline>La famille</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Ce que tout cela construit
          </h2>
          <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
            <p>
              Thomas Issa est marié à une Française. Ensemble, ils ont trois enfants
              franco-libanais : Antoine, né en 2015, Noémie en 2018, Lucas en 2023.
              La famille est ancrée à Paris. Ces prénoms et ces dates ne sont pas
              des détails biographiques — ils sont la raison pour laquelle ISSA
              Capital existe. Une holding patrimoniale sans horizon transmissif
              n&apos;est qu&apos;une structure juridique. Ici, l&apos;horizon a des
              prénoms.
            </p>
            <p>
              Ce que Jean-Pierre Issa a bâti, Thomas en a hérité la méthode. Ce que
              Thomas construit, Antoine, Noémie et Lucas en hériteront un jour —
              avec les racines libanaises qui traversent trois générations et la
              rigueur de ceux qui ont appris à tenir dans la durée. C&apos;est ce
              que la famille Issa appelle transmettre.
            </p>
          </div>
        </Container>
      </Section>

      {/* Section 5 — L'identité */}
      <Section tone="default">
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
              L&apos;héritage libanais apporte une conception du patrimoine transmise
              de génération en génération — une culture de la durée qui précède les
              structures juridiques. L&apos;ancrage français apporte la structure et
              l&apos;accès à un marché immobilier solide.
            </p>
          </div>
        </Container>
      </Section>

      {/* Section 6 — Trois filtres
          Corrections session 6 CHECKPOINT #2 Thomas :
          - Suppression phrase méta "Ces filtres précèdent toute analyse financière."
          - Filtre 2 Environnement : Option B (principiel) verbatim
          - Filtre 3 Éthique humaine : Option A (pragmatique) verbatim */}
      <Section tone="inverse">
        <Container width="editorial">
          <Overline tone="light">Nos filtres</Overline>
          <h2 className="mt-md font-heading text-h2 text-parchment-100">
            Trois filtres. Aucune exception.
          </h2>

          <div className="mt-2xl space-y-xl">
            <div className="border-l-2 border-levant-500 pl-lg">
              <h3 className="font-heading text-h3 text-parchment-100">
                Horizon patrimonial long terme
              </h3>
              <p className="mt-sm text-base text-ink-300">
                Nous raisonnons en décennies. Un investissement est évalué sur sa
                capacité à créer de la valeur sur vingt ou trente ans — pas sur son
                potentiel de plus-value à horizon de sortie. ISSA Capital entre dans
                un projet pour y rester.
              </p>
            </div>
            <div className="border-l-2 border-levant-500 pl-lg">
              <h3 className="font-heading text-h3 text-parchment-100">
                Préservation de l&apos;environnement
              </h3>
              <p className="mt-sm text-base text-ink-300">
                Ce que nous finançons doit tenir sur trente ans. Un modèle qui
                dégrade l&apos;environnement ne tient pas.
              </p>
            </div>
            <div className="border-l-2 border-levant-500 pl-lg">
              <h3 className="font-heading text-h3 text-parchment-100">Éthique humaine</h3>
              <p className="mt-sm text-base text-ink-300">
                Certains secteurs sont hors périmètre, indépendamment du dossier.
                Ce n&apos;est pas une question d&apos;analyse.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Section 7 — Ce que nous sommes (clôture) */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Ce que nous sommes</Overline>
          <h2 className="mt-md font-heading text-h3 text-ink-950">
            Une holding patrimoniale familiale.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              ISSA Capital gère son propre patrimoine familial — pas des capitaux
              tiers. Elle n&apos;a pas d&apos;horizon de sortie contraint, pas de
              logique de revente à cinq ans. Son écosystème est cohérent :
              immobilier, tech, services aux professionnels.
            </p>
            <p>
              La famille fondatrice est libanaise. C&apos;est une réalité qui compte
              dans chaque décision.
            </p>
          </div>
          <div className="mt-2xl flex flex-wrap gap-lg">
            <Link
              href="/participations"
              className="inline-flex min-h-[48px] items-center gap-sm text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
            >
              Découvrir nos participations →
            </Link>
            <Link
              href="/accompagnement"
              className="inline-flex min-h-[48px] items-center gap-sm text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
            >
              Besoin d&apos;être accompagné ? →
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
