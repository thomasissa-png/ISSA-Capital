import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { ContactForm } from '@/components/ui/ContactForm';
import { siteConfig } from '@/config/site';

/**
 * /accompagnement — rendu statique (SSG).
 * Page de conseil Thomas Issa. Ton éditorial, aucun pricing, signature
 * "Patient par choix. Exigeant par principe."
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Conseil & accompagnement — Thomas Issa',
  description:
    "Thomas Issa accompagne fondateurs et investisseurs en structuration patrimoniale, holding, immo en direct et participations. 15 ans Sony, co-fondateur TEOS.",
  alternates: { canonical: `${siteConfig.url}/accompagnement` },
  openGraph: {
    title: 'Travailler avec Thomas Issa — ISSA Capital',
    description:
      'Stratège, co-fondateur, opérateur immo. Thomas Issa accompagne les décideurs qui cherchent un pair — pas un prestataire.',
    url: `${siteConfig.url}/accompagnement`,
  },
};

type Domaine = { title: string; desc: string };

const domainesPatrimonial: ReadonlyArray<Domaine> = [
  {
    title: 'Structuration de holding et écosystème patrimonial',
    desc: "ISSA Capital, Gradient One, Versi, Immocrew, Versimo — co-fondés et développés. Pour les fondateurs qui veulent construire une architecture patrimoniale cohérente, pas un portefeuille d'actifs épars.",
  },
  {
    title: 'Investissement immobilier en direct et participations minoritaires',
    desc: "Patrimoine résidentiel en gestion directe en Île-de-France. Co-investisseur dans plusieurs structures. Pour les fondateurs qui veulent intégrer l'immo dans leur stratégie patrimoniale.",
  },
];

const domainesCorporate: ReadonlyArray<Domaine> = [
  {
    title: 'Stratégie internationale et go-to-market Europe',
    desc: "Déploiement d'une solution dans 7 régions en moins d'un an. Partenariats, équipes locales, relations HQ Japon. Pour les fondateurs qui veulent étendre leur activité hors de France sans partir à l'aveugle.",
  },
  {
    title: 'Intrapreneuriat et création depuis zéro',
    desc: "TEOS est née dans une grande entreprise, avec peu de ressources et un horizon très court. Si vous construisez quelque chose dans un contexte où les ressources ne sont pas illimitées, Thomas a fait ça.",
  },
  {
    title: 'Product management premium B2B et B2C',
    desc: "Deux lignes de produits Sony menées simultanément, chacune avec son positionnement, ses canaux, ses clients. Pour les fondateurs qui gèrent plusieurs offres ou doivent arbitrer entre segments.",
  },
  {
    title: 'Stratégie marketing et positionnement de marque',
    desc: "De 2% à 35% de part de marché en deux ans sur le segment haut de gamme. Pour les fondateurs qui veulent construire une position dominante sur leur segment, pas juste de la notoriété.",
  },
  {
    title: 'Relations corporate internationales',
    desc: "HQ Japon, partenariats européens, clients Fortune 500. Pour les fondateurs qui doivent naviguer dans des structures où la hiérarchie et la culture comptent autant que l'offre.",
  },
];

export default function AccompagnementPage(): JSX.Element {
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
            <span>Conseil & accompagnement</span>
          </nav>
          <div className="mt-lg max-w-[900px]">
            <Overline>Mission de conseil & accompagnement</Overline>
            <h1 className="mt-md font-heading text-h1 text-ink-950">
              Thomas Issa accompagne les décideurs qui cherchent un pair — pas un
              prestataire.
            </h1>
          </div>
        </Container>
      </Section>

      {/* Citation */}
      <Section tone="elevated">
        <Container width="editorial">
          <figure className="border-l-2 border-levant-500 pl-lg">
            <blockquote>
              <p className="font-heading text-h2 italic text-ink-950">
                « J&apos;ai besoin de quelqu&apos;un qui l&apos;a fait, pas de quelqu&apos;un
                qui m&apos;explique. »
              </p>
            </blockquote>
            <figcaption className="mt-md text-sm text-ink-500">
              — Verbatim entrepreneur accompagné
            </figcaption>
          </figure>
        </Container>
      </Section>

      {/* Proposition */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Ce que Thomas fait</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Ce que Thomas fait — et ce qu&apos;il ne fait pas.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              Thomas Issa n&apos;est pas un cabinet de gestion de patrimoine. Il ne vend
              pas de produits financiers, pas de fonds, pas d&apos;assurance-vie. Il
              accompagne des fondateurs et des investisseurs sur des sujets où il a
              lui-même pris des décisions difficiles : structurer une holding, investir
              dans l&apos;immobilier en direct, co-fonder des participations, déployer
              une stratégie internationale depuis zéro.
            </p>
            <p>
              Deux formats uniquement : une mission ponctuelle délimitée, ou un rôle
              d&apos;advisor récurrent auprès du dirigeant. Dans les deux cas : un
              engagement de fond, pas une prestation standardisée.
            </p>
          </div>
        </Container>
      </Section>

      {/* Parcours */}
      <Section tone="inverse">
        <Container width="editorial">
          <Overline tone="light">Le parcours</Overline>
          <h2 className="mt-md font-heading text-h2 text-parchment-100">
            15 ans de décisions — pas de théorie.
          </h2>
          <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-300">
            <p>
              Thomas Issa a passé 15 ans chez Sony Europe, où il a co-fondé TEOS — une
              solution de gestion d&apos;espaces de travail construite à partir d&apos;un
              deck de dix slides — et l&apos;a déployée dans 7 régions du monde en moins
              d&apos;un an, avec un ROI de 6000% la première année. Les clients : Lego,
              Siemens, Netflix, Cap Gemini, Suzuki, Hilton, Mango.
            </p>
            <p>
              Il a simultanément géré deux lignes de produits Sony en parallèle — Home
              Theater et Professional Displays — transformant des parts de marché
              marginales en positions dominantes sur leur segment haut de gamme.
            </p>
            <p>
              Depuis 2018, il accompagne des startups en tant qu&apos;advisor stratégique
              — jusqu&apos;à cinq projets par an, sur la mise sur le marché en Europe, le
              positionnement, le branding et la structuration commerciale. Il a travaillé
              avec TikTok, Adidas, Lego.
            </p>
            <p>
              Depuis 2020, il co-fonde et développe l&apos;écosystème ISSA Capital :
              holding patrimoniale, participations dans l&apos;immobilier tech et les
              services aux professionnels, patrimoine résidentiel en gestion directe en
              Île-de-France.
            </p>
          </div>

          <div className="mt-2xl border-t border-ink-800 pt-xl">
            <Overline tone="light">Formation</Overline>
            <ul className="mt-md space-y-sm text-sm text-ink-300">
              <li>HEC School of Management — Intelligence Marketing</li>
              <li>University of California, Irvine — International Marketing</li>
              <li>IMT Atlantique — Business Engineering, Droit des affaires</li>
              <li>Classe préparatoire Sainte-Geneviève — Maths Physique</li>
            </ul>
            <p className="mt-md text-xs text-ink-400">
              Major de promotion × 3. Exceptional Contribution Award × 2 (Sony). Best
              Sony Europe Performance Award 2014. Quadrilingue : français, anglais,
              allemand, arabe.
            </p>
          </div>
        </Container>
      </Section>

      {/* Domaines — regroupés en deux familles : Patrimonial / Corporate */}
      <Section tone="subtle">
        <Container width="content">
          <div className="mb-2xl max-w-editorial">
            <Overline>Les sujets sur lesquels Thomas intervient</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Sept domaines, déduits de son parcours réel.
            </h2>
            <p className="mt-md text-lead text-ink-700">
              Pas une offre construite pour le marché. Deux familles : patrimoniale et
              corporate.
            </p>
          </div>

          <div className="space-y-2xl">
            <div>
              <div className="mb-xl flex items-baseline gap-md">
                <Overline>Patrimonial</Overline>
                <span className="text-xs text-ink-500" aria-hidden="true">
                  — {domainesPatrimonial.length} domaines
                </span>
              </div>
              <div className="grid grid-cols-1 gap-xl md:grid-cols-2">
                {domainesPatrimonial.map((d) => (
                  <div key={d.title} className="border-l-2 border-levant-500 pl-lg">
                    <h3 className="font-heading text-h4 text-ink-950">{d.title}</h3>
                    <p className="mt-sm text-sm text-ink-700">{d.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-xl flex items-baseline gap-md">
                <Overline>Corporate</Overline>
                <span className="text-xs text-ink-500" aria-hidden="true">
                  — {domainesCorporate.length} domaines
                </span>
              </div>
              <div className="grid grid-cols-1 gap-xl md:grid-cols-2">
                {domainesCorporate.map((d) => (
                  <div key={d.title} className="border-l-2 border-levant-500 pl-lg">
                    <h3 className="font-heading text-h4 text-ink-950">{d.title}</h3>
                    <p className="mt-sm text-sm text-ink-700">{d.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Ce que Thomas n'accepte pas */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Ce qui ne correspond pas</Overline>
          <h2 className="mt-md font-heading text-h3 text-ink-950">
            Ce qui ne correspond pas au périmètre.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              Thomas accompagne des fondateurs et des investisseurs qui ont déjà fait
              leurs preuves. Il n&apos;est pas un incubateur et n&apos;accompagne pas les
              premières étapes d&apos;un projet.
            </p>
            <ul className="space-y-sm text-ink-700">
              {[
                'Projets crypto / Web3 purs — hors scope.',
                "First-time founders en pre-seed.",
                "Démarches non sollicitées ou pitchs génériques sans lien avec le périmètre décrit ici.",
                "Missions de moins d'un mois — trop court pour apporter une valeur réelle.",
                "Tickets immobiliers inférieurs à 200 000 € dans le cadre d'un co-investissement.",
                "Projets contraires aux filtres éthiques d'ISSA Capital — environnement, humanité.",
                'Véhicules spéculatifs court-terme.',
              ].map((item) => (
                <li key={item} className="flex gap-md">
                  <span className="text-levant-700" aria-hidden="true">
                    —
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p>
              Ce ne sont pas des précautions — ce sont des critères. Ils permettent à
              Thomas de consacrer son attention aux projets où il peut apporter une
              contribution substantielle.
            </p>
          </div>
        </Container>
      </Section>

      {/* Formats */}
      <Section tone="subtle">
        <Container width="content">
          <Overline>Deux formats</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Deux formats. Pas de troisième option.
          </h2>
          <div className="mt-xl grid grid-cols-1 gap-xl md:grid-cols-2">
            <article className="border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">Mission ponctuelle</h3>
              <p className="mt-md text-base text-ink-700">
                Une intervention délimitée avec un objectif clair : structuration
                patrimoniale, positionnement, stratégie internationale, go-to-market,
                audit stratégique. Durée minimum : un mois. Livrables définis en amont.
              </p>
            </article>
            <article className="border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">Advisoring</h3>
              <p className="mt-md text-base text-ink-700">
                Un rôle d&apos;advisor récurrent auprès du fondateur ou du dirigeant —
                conseil stratégique régulier, sparring partner long terme, présence
                informelle au board possible. Durée : à déterminer selon la situation.
              </p>
            </article>
          </div>
          <p className="mt-xl text-sm italic text-ink-500">
            Dans les deux cas : aucun tarif affiché. La mission commence par un échange
            de qualification.
          </p>
        </Container>
      </Section>

      {/* Signature — placée AVANT le formulaire pour clore l'argumentaire éditorial */}
      <Section tone="inverse" className="py-2xl">
        <Container width="editorial" className="text-center">
          <p className="font-heading text-h2 italic text-parchment-100">
            Patient par choix. Exigeant par principe.
          </p>
        </Container>
      </Section>

      {/* CTA + formulaire */}
      <Section tone="default" id="contact">
        <Container width="narrow">
          <div className="mb-xl text-center">
            <Overline>Prenons contact</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Si le périmètre correspond, prenons contact.
            </h2>
            <p className="mt-md text-base text-ink-700">
              Un échange. Pas un formulaire de dix champs. Si votre situation correspond
              au périmètre décrit ici, envoyez-nous un message.
            </p>
          </div>
          <ContactForm
            variant="accompagnement"
            intro="Deux lignes sur ce que vous cherchez suffisent pour démarrer."
          />
        </Container>
      </Section>
    </>
  );
}
