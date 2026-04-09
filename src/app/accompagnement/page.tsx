import type { Metadata } from 'next';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { ContactForm } from '@/components/ui/ContactForm';
import { siteConfig } from '@/config/site';

/**
 * /accompagnement — rendu statique (SSG).
 *
 * Refonte session 6 Variante A (duo opérationnel) AJUSTÉE session 7 en
 * "Variante A flexible" — CHECKPOINT #5 Thomas : *"A, ça peut être aussi
 * l'un, l'autre ou les 2 suivant les missions"*. Jean-Pierre ET Thomas sont
 * opérationnels dans les missions clients, mais la composition de l'équipe
 * mission est flexible selon le contexte.
 *
 * Source de vérité : docs/strategy/accompagnement-refonte-10-10-session6.md
 * section 8 (lignes 550-664) — verbatim ajusté session 7 + sections
 * inchangées de la Variante A session 6 (bios Jean-Pierre et Thomas
 * lignes 88-116).
 *
 * Architecture 8 sections :
 *   1. Hero — overline "Conseil & accompagnement" + H1 duo
 *   2. Pour qui — filtre Karim (inchangé)
 *   3. Jean-Pierre Issa — bio opérationnelle 4 paragraphes + domaines
 *   4. Thomas Issa — bio 5 paragraphes + formation
 *   5. Ce que le duo produit — méthode + paragraphe flexibilité session 7
 *   6. Ce qui ne correspond pas — phrase d'ouverture ajustée session 7
 *   7. Deux formats — inchangé
 *   8. Signature + formulaire — signature inchangée + phrase finale flexibilité
 *
 * Faits biographiques verrouillés :
 * - 2J Impression rachat = 2016 (jamais 1994)
 * - Jean-Pierre né à Dakar en 1958, famille d'origine libanaise
 * - Thomas 15 ans chez Sony Europe, co-fondateur TEOS
 * - Mention Sony/TEOS/TikTok/Adidas/Lego AUTORISÉE ici uniquement
 *   (exception Q2 session 5 — coupée de /mission)
 * - Identité libanaise jamais française
 * - Zéro mention nom agence Thomas — "une agence de communication
 *   internationale"
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Conseil & accompagnement — Jean-Pierre Issa et Thomas Issa',
  description:
    "Jean-Pierre Issa et Thomas Issa accompagnent fondateurs et dirigeants sur ce qu'ils ont eux-mêmes construit. Structuration de holding, rachat et développement, internationalisation, stratégie patrimoniale.",
  alternates: { canonical: `${siteConfig.url}/accompagnement` },
  openGraph: {
    title: 'Conseil & accompagnement — ISSA Capital',
    description:
      "Jean-Pierre Issa et Thomas Issa accompagnent fondateurs et dirigeants. Selon la nature de la mission, l'un, l'autre ou les deux interviennent.",
    url: `${siteConfig.url}/accompagnement`,
  },
};

type Domaine = string;

// Domaines Jean-Pierre (Variante A session 6 ligne 98 du livrable)
const domainesJeanPierre: ReadonlyArray<Domaine> = [
  'Rachat et développement d’entreprise',
  'Structuration co-actionnariat',
  'Internationalisation opérationnelle',
  'Gouvernance long terme',
];

// Domaines Thomas (Variante A session 6 ligne 114 du livrable)
const domainesThomas: ReadonlyArray<Domaine> = [
  'Structuration de holding et écosystème patrimonial',
  'Investissement immobilier en direct',
  'Advisory corporate et stratégie internationale',
  'Product management',
  'Positionnement de marque',
];

export default function AccompagnementPage(): JSX.Element {
  return (
    <>
      {/* Section 1 — Hero (overline ajusté session 7 : "Conseil & accompagnement"
          en lieu et place de "Mission de conseil & accompagnement" / "Un
          accompagnement à deux voix" — raison : "à deux voix" sous-entendrait
          une présence systématique des deux, or la composition est flexible). */}
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
            <Overline>Conseil & accompagnement</Overline>
            <h1 className="mt-md font-heading text-h1 text-ink-950">
              Jean-Pierre Issa et Thomas Issa accompagnent fondateurs et
              dirigeants sur ce qu&apos;ils ont eux-mêmes construit.
            </h1>
          </div>
        </Container>
      </Section>

      {/* Section 2 — Pour qui (filtre Karim — inchangé session 6) */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Pour qui</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Un fondateur ou dirigeant qui a déjà fait ses preuves.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              Qui gère une ou plusieurs structures, a déjà pris des décisions de
              capital, et n&apos;attend pas qu&apos;on lui apprenne son métier.
              Qui cherche des pairs pour structurer ce qui vient ensuite —
              patrimoine, holding, immobilier en direct, participations — pas
              des prestataires qui lui vendront une prestation.
            </p>
            <p>
              Si vous vous reconnaissez, la suite de cette page est pour vous.
              Sinon, elle ne le sera pas — et c&apos;est très bien.
            </p>
          </div>
        </Container>
      </Section>

      {/* Section 3 — Jean-Pierre Issa (tone="elevated" pour cohérence avec
          /mission Section 2). Bio 4 paragraphes + domaines. Verbatim verrouillé
          Variante A session 6 lignes 88-98 du livrable. 2J Impression rachat
          2016 (jamais 1994). */}
      <Section tone="elevated">
        <Container width="editorial">
          <Overline>Jean-Pierre Issa</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Trente ans de construction opérationnelle.
          </h2>
          <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
            <p>
              Jean-Pierre Issa est né à Dakar en 1958, dans une famille
              d&apos;origine libanaise. Après IBM dans les années 1980, il fait
              partie de l&apos;équipe fondatrice qui lance Lexmark en Europe
              lors de sa scission d&apos;IBM : Directeur de filiales dans
              plusieurs pays, Directeur Marketing EMEA. Deux décennies à
              construire des organisations depuis le terrain, continent après
              continent.
            </p>
            <p>
              En 2016, avec deux associés, il rachète 2J Impression à Mérignac —
              une structure de distribution multimarque de matériel
              d&apos;impression numérique industrielle. L&apos;entreprise
              atteint 4 millions d&apos;euros de chiffre d&apos;affaires et
              opère dans 17 pays. Co-Managing Director, Jean-Pierre Issa y
              applique la logique apprise chez IBM : construire avec méthode,
              tenir dans la durée, décider avec rigueur.
            </p>
            <p>
              Ce qu&apos;il apporte dans une mission d&apos;accompagnement : la
              lecture longue. Rachat d&apos;une structure, développement
              opérationnel dans la durée, internationalisation réelle,
              co-actionnariat. Pour les fondateurs qui veulent construire
              quelque chose qui tient sur dix ou vingt ans.
            </p>
          </div>

          <div className="mt-2xl border-t border-ink-200 pt-xl">
            <Overline>Domaines</Overline>
            <ul className="mt-md space-y-sm text-sm text-ink-700">
              {domainesJeanPierre.map((d) => (
                <li key={d} className="flex gap-md">
                  <span className="text-levant-700" aria-hidden="true">
                    —
                  </span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* Section 4 — Thomas Issa (tone="default"). Bio 5 paragraphes + formation.
          Verbatim verrouillé Variante A session 6 lignes 102-116 du livrable.
          Mention Sony/TEOS/TikTok/Adidas/Lego AUTORISÉE ici (exception Q2
          session 5). Nom de l'agence : "une agence de communication
          internationale" (jamais le nom). */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Thomas Issa</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            De la création d&apos;entreprise à la structuration patrimoniale.
          </h2>
          <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
            <p>
              Thomas Issa a passé 15 ans chez Sony Europe, où il a co-fondé
              TEOS — une solution de gestion d&apos;espaces de travail construite
              à partir d&apos;un deck de dix slides — et l&apos;a déployée dans
              7 régions du monde en moins d&apos;un an, la faisant passer de
              0 à 8 millions d&apos;euros de chiffre d&apos;affaires en 4 ans.
            </p>
            <p>
              Depuis 2020, il a travaillé avec TikTok, Adidas, Lego via
              l&apos;agence de communication internationale qu&apos;il a créée
              et qui réunit plus de 40 experts, avec des missions dans les
              grandes verticales mondiales.
            </p>
            <p>
              Depuis 2026, il développe l&apos;écosystème ISSA Capital :
              holding patrimoniale, participations dans l&apos;immobilier tech
              et les services aux professionnels, patrimoine résidentiel en
              gestion directe en Île-de-France.
            </p>
            <p>
              Ce qu&apos;il apporte dans une mission d&apos;accompagnement : la
              lecture du moment présent. Structuration de holding, advisory
              corporate et tech, stratégie internationale, positionnement de
              marque. Pour les fondateurs qui veulent construire une
              architecture patrimoniale cohérente dans les contextes
              d&apos;aujourd&apos;hui.
            </p>
          </div>

          <div className="mt-2xl border-t border-ink-200 pt-xl">
            <Overline>Domaines</Overline>
            <ul className="mt-md space-y-sm text-sm text-ink-700">
              {domainesThomas.map((d) => (
                <li key={d} className="flex gap-md">
                  <span className="text-levant-700" aria-hidden="true">
                    —
                  </span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-2xl border-t border-ink-200 pt-xl">
            <Overline>Formation</Overline>
            <p className="mt-md text-sm text-ink-700">
              HEC School of Management, University of California Irvine,
              IMT Atlantique, prépa Sainte-Geneviève. Major de promotion × 3.
              Bilingue.
            </p>
          </div>
        </Container>
      </Section>

      {/* Section 5 — Ce que le duo produit (tone="subtle"). Verbatim session 7
          lignes 587-595 du livrable — inclut le paragraphe de flexibilité
          (§2 : "Selon la nature de la mission, Jean-Pierre, Thomas, ou les
          deux interviennent directement. Le duo s'adapte au contexte — pas
          l'inverse."). */}
      <Section tone="subtle">
        <Container width="editorial">
          <Overline>Ce que le duo produit</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Une méthode héritée. Deux lectures du même sujet.
          </h2>
          <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
            <p>
              Jean-Pierre a bâti des structures qui tiennent sur vingt ans —
              dans l&apos;industrie, dans le co-actionnariat, dans
              l&apos;internationalisation réelle. Thomas a traduit cette méthode
              dans les contextes d&apos;aujourd&apos;hui — holding patrimoniale,
              advisory tech, marchés européens. Les deux ont fait leurs erreurs
              pour leur propre compte, pas pour celui d&apos;un client.
            </p>
            <p>
              Selon la nature de la mission, Jean-Pierre, Thomas, ou les deux
              interviennent directement. Le duo s&apos;adapte au contexte — pas
              l&apos;inverse. Une mission de structuration patrimoniale et
              d&apos;advisory tech sera portée par Thomas. Un rachat industriel
              ou une question de gouvernance long terme mobilisera Jean-Pierre.
              Une mission qui croise les deux registres mobilisera les deux.
            </p>
            <p>
              Leurs structures actuelles suivent les mêmes logiques
              qu&apos;ils transmettent. Ce n&apos;est pas du conseil de
              cabinet. C&apos;est la lecture de deux personnes qui ont la peau
              dans le jeu.
            </p>
          </div>
        </Container>
      </Section>

      {/* Section 6 — Ce qui ne correspond pas. Phrase d'ouverture ajustée
          session 7 (lignes 603-607 du livrable) : mention explicite de la
          flexibilité duo dans la phrase d'ouverture. Liste 7 puces inchangée. */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Ce qui ne correspond pas</Overline>
          <h2 className="mt-md font-heading text-h3 text-ink-950">
            Ce qui est hors périmètre.
          </h2>
          <div className="mt-lg space-y-md text-base leading-relaxed text-ink-700">
            <p>
              Le périmètre d&apos;accompagnement ISSA Capital — qu&apos;il soit
              porté par Jean-Pierre, Thomas, ou les deux — concerne des
              fondateurs et des investisseurs qui ont déjà fait leurs preuves.
              Pas les premières étapes d&apos;un projet.
            </p>
            <ul className="space-y-sm text-ink-700">
              {[
                'Projets crypto / Web3 purs — hors scope.',
                'First-time founders en pre-seed.',
                'Démarches non sollicitées ou pitchs génériques sans lien avec le périmètre décrit ici.',
                "Missions de moins d'un mois — trop court pour apporter une valeur réelle.",
                'Tickets immobiliers inférieurs à 200 000 € dans le cadre d’un co-investissement.',
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
          </div>
        </Container>
      </Section>

      {/* Section 7 — Deux formats (inchangé session 6) */}
      <Section tone="subtle">
        <Container width="content">
          <Overline>Deux formats</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Deux formats.
          </h2>
          <div className="mt-xl grid grid-cols-1 gap-xl md:grid-cols-2">
            <article className="border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">
                Mission ponctuelle
              </h3>
              <p className="mt-md text-base text-ink-700">
                Une intervention délimitée avec un objectif clair : structuration
                patrimoniale, positionnement, stratégie internationale,
                go-to-market, audit stratégique. Durée minimum : un mois.
                Livrables définis en amont.
              </p>
            </article>
            <article className="border border-ink-200 bg-white p-xl">
              <h3 className="font-heading text-h3 text-ink-950">Advisoring</h3>
              <p className="mt-md text-base text-ink-700">
                Un rôle d&apos;advisor récurrent auprès du fondateur ou du
                dirigeant — stratégie, développement, organisation. Sparring
                partner de fond, présence informelle au board possible.
              </p>
            </article>
          </div>
        </Container>
      </Section>

      {/* Section 8a — Signature (inchangée) */}
      <Section tone="inverse" className="py-2xl">
        <Container width="editorial" className="text-center">
          <p className="font-heading text-h2 italic text-parchment-100">
            Patient par choix. Exigeant par principe.
          </p>
        </Container>
      </Section>

      {/* Section 8b — Formulaire (phrase finale ajoutée session 7 :
          "Selon le contexte, Jean-Pierre, Thomas, ou les deux répondront."). */}
      <Section tone="default" id="contact">
        <Container width="narrow">
          <div className="mb-xl text-center">
            <Overline>Prenons contact</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">
              Si le périmètre correspond, prenons contact.
            </h2>
            <p className="mt-sm text-sm text-ink-500">
              Chaque mission démarre par un échange — pas par un devis. Selon
              le contexte, Jean-Pierre, Thomas, ou les deux répondront.
            </p>
            <p className="mt-md text-base text-ink-700">
              Quelques informations pour comprendre votre situation. Chaque
              message est lu.
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
