import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { ContactForm } from '@/components/ui/ContactForm';
import { siteConfig } from '@/config/site';

/**
 * /opportunites — rendu statique (SSG).
 * Qualification avant formulaire : critères tranchants, filtres éthiques,
 * clause de non-démarchage L.411-1 CMF en fin de page.
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: "Opportunités d'affaires",
  description:
    "Soumettez votre opportunité à ISSA Capital — holding familiale qui investit dans l'immobilier et des participations minoritaires. Critères explicites, horizon long terme.",
  alternates: { canonical: `${siteConfig.url}/opportunites` },
  openGraph: {
    title: 'Proposer une opportunité à ISSA Capital',
    description:
      "ISSA Capital étudie des opportunités de rapprochement dans l'immobilier et les participations. Critères lisibles, décision rapide.",
    url: `${siteConfig.url}/opportunites`,
  },
};

export default function OpportunitesPage(): JSX.Element {
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
            <span>Opportunités d&apos;affaires</span>
          </nav>
          <div className="mt-lg max-w-[800px]">
            <Overline>Ce que nous recherchons</Overline>
            <h1 className="mt-md font-heading text-h1 text-ink-950">
              Vous avez un dossier. Voyons s&apos;il correspond.
            </h1>
            <p className="mt-lg text-lead text-ink-700">
              ISSA Capital investit son propre patrimoine familial dans des projets
              sélectionnés — immobilier résidentiel et participations minoritaires.
              Critères explicites. Horizon intergénérationnel.
            </p>
          </div>
        </Container>
      </Section>

      {/* Intro positionnement */}
      <Section tone="elevated">
        <Container width="editorial">
          <p className="text-base leading-relaxed text-ink-700">
            Cette page est faite pour les apporteurs d&apos;affaires et les fondateurs
            qui cherchent un partenaire capitalistique sérieux. Pas un fonds. Pas un
            comité d&apos;investissement qui se réunit tous les 6 mois. Une holding
            familiale qui décide vite sur les dossiers qualifiés.
          </p>
        </Container>
      </Section>

      {/* Critères */}
      <Section tone="subtle">
        <Container width="content">
          <div className="mb-2xl max-w-editorial">
            <Overline>Nos critères</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Ce que nous étudions — et ce que nous n&apos;étudions pas.
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-xl md:grid-cols-2">
            {/* Immobilier résidentiel */}
            <article className="border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">
                Immobilier résidentiel
              </h3>
              <div className="mt-lg space-y-md text-sm text-ink-700">
                <div>
                  <p className="overline text-levant-600">Ce que nous étudions</p>
                  <p className="mt-sm">
                    Acquisitions résidentielles en Île-de-France. Immeubles de rapport,
                    biens à rénover, lots multiples. Horizon de détention long terme —
                    nous n&apos;achetons pas pour revendre.
                  </p>
                </div>
                <div>
                  <p className="overline text-levant-600">Ticket minimum</p>
                  <p className="mt-sm font-heading text-h4 text-ink-950">200 000 €</p>
                </div>
                <div>
                  <p className="overline text-ink-500">Ce que nous n&apos;étudions pas</p>
                  <p className="mt-sm text-ink-600">
                    Biens en dehors de l&apos;Île-de-France sauf cas structurant. Tickets
                    inférieurs à 200 000 €. Opérations conçues avec une logique de
                    plus-value court terme.
                  </p>
                </div>
              </div>
            </article>

            {/* Participations */}
            <article className="border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">
                Participations minoritaires
              </h3>
              <div className="mt-lg space-y-md text-sm text-ink-700">
                <div>
                  <p className="overline text-levant-600">Ce que nous étudions</p>
                  <p className="mt-sm">
                    Prises de participation minoritaires dans des entreprises
                    opérationnelles — tech, services aux professionnels, immobilier,
                    secteurs cohérents avec notre écosystème existant. Fondateurs qui
                    cherchent un actionnaire de long terme, pas un fonds à horizon de
                    sortie contraint.
                  </p>
                </div>
                <div>
                  <p className="overline text-ink-500">Ce que nous n&apos;étudions pas</p>
                  <p className="mt-sm text-ink-600">
                    Projets crypto / Web3 purs. Véhicules spéculatifs court terme.
                    Secteurs contraires à nos filtres éthiques (environnement, humanité).
                    First-time founders en pre-seed sans traction démontrée.
                  </p>
                </div>
              </div>
            </article>
          </div>

          <div className="mt-2xl border-l-2 border-levant-500 pl-lg">
            <p className="font-heading text-h4 text-ink-950">
              Ce que nous ne faisons jamais
            </p>
            <p className="mt-sm text-base text-ink-700">
              Quel que soit le dossier : nous n&apos;investissons pas dans ce qui
              contrevient à nos filtres de décision non négociables. Environnement :
              toute opportunité dont le modèle économique repose structurellement sur la
              dégradation de l&apos;environnement est refusée. Éthique humaine : ISSA
              Capital n&apos;investit jamais dans ce qui va à l&apos;encontre de
              l&apos;humanité.
            </p>
          </div>
        </Container>
      </Section>

      {/* Comment nous travaillons */}
      <Section tone="default">
        <Container width="content">
          <div className="mb-2xl max-w-editorial">
            <Overline>Notre process</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Trois étapes. Pas de comité trimestriel.
            </h2>
          </div>
          <ol className="grid grid-cols-1 gap-xl md:grid-cols-3">
            {[
              {
                n: '1',
                title: 'Soumission',
                desc: 'Vous remplissez le formulaire ci-dessous. Moins de 5 minutes. Aucune présentation complète requise à ce stade.',
              },
              {
                n: '2',
                title: 'Analyse',
                desc: "Nous étudions chaque dossier. Réponse dans la journée. Si votre opportunité correspond à nos critères, nous prenons contact pour un échange direct.",
              },
              {
                n: '3',
                title: 'Échange et décision',
                desc: "Un échange direct avec Thomas Issa. Pas de présentation formelle obligatoire. Si l'opportunité est retenue, nous structurons ensemble les modalités.",
              },
            ].map((step) => (
              <li key={step.n} className="border-t-2 border-levant-500 pt-md">
                <p className="font-heading text-h2 text-levant-600">{step.n}</p>
                <h3 className="mt-sm font-heading text-h4 text-ink-950">{step.title}</h3>
                <p className="mt-sm text-sm text-ink-700">{step.desc}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Tagline */}
      <Section tone="inverse" className="py-2xl">
        <Container width="editorial" className="text-center">
          <p className="font-heading text-h2 italic text-parchment-100">
            Vingt ans devant. Pas de sortie prévue.
          </p>
        </Container>
      </Section>

      {/* Formulaire */}
      <Section tone="elevated" id="formulaire">
        <Container width="narrow">
          <div className="mb-xl">
            <Overline>Soumettre une opportunité</Overline>
            <h2 className="mt-md font-heading text-h3 text-ink-950">
              Proposer une opportunité.
            </h2>
            <p className="mt-sm text-sm text-ink-600">
              7 champs. Deux lignes suffisent pour démarrer.
            </p>
          </div>
          <ContactForm variant="opportunite" />
        </Container>
      </Section>

      {/* Clause légale */}
      <Section tone="default" className="py-xl">
        <Container width="editorial">
          <p className="text-xs italic leading-relaxed text-ink-500">
            Les informations publiées sur cette page ne constituent pas une offre de
            titres financiers, une invitation à investir, ni un démarchage financier au
            sens des articles L.341-1 et suivants du Code monétaire et financier. ISSA
            Capital est une holding patrimoniale familiale non soumise à agrément AMF.
            Elle n&apos;effectue aucun appel public à l&apos;épargne. Les prises de
            contact via ce formulaire sont exclusivement à l&apos;initiative des tiers
            souhaitant proposer des opportunités de rapprochement à ISSA Capital.
          </p>
        </Container>
      </Section>
    </>
  );
}
