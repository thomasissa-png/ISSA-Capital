import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { siteConfig } from '@/config/site';

/**
 * /a-propos — page éditoriale famille fondatrice (rendu statique SSG).
 *
 * Structure narrative en 5 sections :
 *   A. Hero — ancrage identitaire libanais
 *   B. Racines — Jean-Pierre Issa (héritage paternel)
 *   C. Construire — Thomas Issa (parcours fondateur)
 *   D. Transmettre — famille et horizon intergénérationnel
 *   E. Fermeture — liens sobres vers /mission et /participations
 *
 * Décisions clés (session 4 Bloc 4) :
 * - Section B texte seul (pas d'archive Jean-Pierre disponible — RES H5)
 * - Section C fallback 1 colonne (pas de portrait Thomas — RES H4)
 * - Section E pas de Button : 2 liens texte discrets, ton VITRINE
 * - Phrase-pont @creative-strategy Décision 4 verrouillée (ne pas reformuler)
 * - Sortie agence ("pour se consacrer à sa famille...") verrouillée par Thomas
 * - Placeholder [Nom de l'agence] = ellipse pivotable à remplacer quand révélation publique
 *
 * Source copy : docs/copy/about-page-copy.md Partie 1
 * Source archi : docs/ux/about-page-architecture.md
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'La famille fondatrice',
  description:
    "ISSA Capital est portée par la famille Issa — d'origine libanaise, établie en France. Jean-Pierre Issa, Thomas Issa, et l'horizon intergénérationnel d'une holding patrimoniale construite pour durer.",
  alternates: { canonical: `${siteConfig.url}/a-propos` },
  openGraph: {
    title: 'La famille fondatrice — ISSA Capital',
    description:
      "Une famille d'origine libanaise. Un projet de trois générations. L'histoire de Jean-Pierre et Thomas Issa, et du patrimoine qu'ils construisent pour transmettre.",
    url: `${siteConfig.url}/a-propos`,
    type: 'article',
  },
};

export default function AProposPage(): JSX.Element {
  return (
    <>
      {/* Section A — Hero */}
      <Section tone="inverse" id="hero" className="py-3xl md:py-5xl">
        <Container width="editorial" className="text-center">
          <Overline tone="light">Famille fondatrice</Overline>
          <h1 className="mt-lg font-heading text-display leading-[1.1] text-parchment-100">
            Une famille d&apos;origine libanaise.
            <br />
            Un projet de trois générations.
          </h1>
          <p className="mx-auto mt-xl max-w-[560px] font-body text-lead text-ink-300">
            Ce qu&apos;ISSA Capital est aujourd&apos;hui a été construit bien avant sa
            création formelle.
          </p>
        </Container>
      </Section>

      {/* Section B — Racines (Jean-Pierre Issa) */}
      <Section tone="subtle" id="racines">
        <Container width="editorial">
          <Overline>Trois décennies avant la holding</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Jean-Pierre Issa
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
              En 1994, avec deux associés, il rachète 2J Impression à Mérignac —
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

      {/* Section C — Construire (Thomas Issa) — fallback 1 colonne (pas de portrait) */}
      <Section tone="default" id="construire">
        <Container width="content">
          <div className="max-w-editorial">
            <Overline>Le fondateur</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Thomas Issa
            </h2>
            <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
              <p>
                Thomas Issa naît en France à la fin des années 1980, dans une famille
                qui a appris à s&apos;adapter et à construire. Sa formation est
                internationale dès le départ : Institut Florimont à Genève, puis
                l&apos;Afrique du Sud, puis l&apos;université de Californie à Irvine.
                Avant de rentrer en France, un détour par l&apos;Inde — quelques mois
                d&apos;engagement humanitaire qui laissent une marque. Il revient
                avec une conviction : les structures qui durent sont celles
                qu&apos;on construit avec intention, pas avec précipitation.
              </p>
              <p>
                Il rejoint ensuite Sony, puis TEOS, et travaille en conseil
                stratégique — des postes en entreprise qui lui donnent une lecture
                fine des organisations, de leurs angles morts et de ce qu&apos;il
                faut pour les faire avancer. C&apos;est là qu&apos;il identifie un
                manque : il ne trouve pas l&apos;agence de communication avec
                laquelle il veut travailler. Alors il la crée.
              </p>
              {/* TODO: remplacer [Nom de l'agence] quand Thomas valide la révélation publique */}
              <p>
                [Nom de l&apos;agence], agence de communication internationale
                qu&apos;il fonde à 35 ans, grandit rapidement : plus de 35 experts,
                des équipes sur 5 continents, des missions dans plus de 45 pays, une
                notation parmi les meilleures de sa catégorie sur les plateformes
                globales. Le modèle opérationnel repose sur des relais 24h/24 entre
                fuseaux horaires, en 18 langues, pour des clients dans les grandes
                verticales mondiales — tech, luxe, logistique, biens de
                consommation. Une structure construite à partir de rien, dans la
                complexité internationale, avec l&apos;exigence d&apos;un opérateur
                qui sait ce qu&apos;il veut.
              </p>
              {/* Phrase-pont Décision 4 @creative-strategy VERROUILLÉE — ne pas reformuler */}
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

      {/* Section D — Transmettre (Famille) */}
      <Section tone="subtle" id="transmettre">
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

      {/* Section E — Fermeture (2 liens texte sobres, pas de Button) */}
      <Section tone="default" id="fermeture" className="py-2xl md:py-3xl">
        <Container width="editorial">
          <p className="font-heading text-h3 text-ink-950">
            Ce que cette histoire construit
          </p>
          <p className="mt-md text-lead text-ink-700">
            ISSA Capital est l&apos;expression de ce parcours — une structure
            organisée pour durer, portée par une famille qui a appris à construire.
          </p>
          <div className="mt-xl flex flex-col gap-md sm:flex-row sm:flex-wrap sm:gap-xl">
            <Link
              href="/mission"
              className="inline-flex min-h-[48px] items-center gap-sm font-body text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
            >
              Notre mission
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              href="/participations"
              className="inline-flex min-h-[48px] items-center gap-sm font-body text-base text-levant-700 hover:text-levant-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-levant-500 focus-visible:ring-offset-2"
            >
              Nos participations
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
