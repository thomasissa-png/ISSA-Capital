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
 * Refonte session 6 Version RICHE v2 (CHECKPOINT #5 session 7 — Thomas arbitre
 * Sonia gardée, feedback "beaucoup trop de détails, concentrons-nous sur la
 * mission"). Architecture 6 sections :
 *
 *   1. Hero — ancrage identitaire libanais
 *   2. Ce qui précède la holding — Jean-Pierre (bio resserrée, sans dates exactes
 *      ni titres, sans 2J Impression) + Sonia (1 phrase italique, gardée)
 *   3. Le fondateur — Thomas Issa (1 § unique, sans écoles, sans employeurs
 *      précédents ni noms de clients, sans prénoms enfants)
 *   4. L'horizon — NOUVELLE section : "Ce que tout cela construit"
 *   5. Trois filtres — corrections session 6 (Filtre 2 Option B, Filtre 3 Option A)
 *   6. Ce que nous sommes — clôture fusionnée avec identité (racines libanaises
 *      + ancrage français en §2)
 *
 * Suppressions par rapport à la v1 session 6 :
 * - Thomas §§ écoles, employeurs précédents, noms de clients (ces mentions
 *   restent uniquement sur /accompagnement — exception Q2 session 5)
 * - Section 4 "La famille" : prénoms enfants et dates retirés
 * - Jean-Pierre §2 : 2J Impression et chiffres retirés (restent uniquement
 *   sur /accompagnement)
 * - JSON-LD Person : champ des formations (écoles) supprimé
 *
 * Sonia Issa : CONSERVÉE (1 phrase italique en Section 2, décision Thomas
 * session 6 question finale livrable mission-refonte-10-10).
 *
 * Source copy : docs/strategy/mission-refonte-10-10-session6.md (section
 * Handoff lignes 498-568 — verbatim final retenu Version RICHE v2).
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

      {/* Section 2 — Ce qui précède la holding (Jean-Pierre Issa + Sonia)
          Version RICHE v2 : bio Jean-Pierre resserrée à 1 paragraphe de 4 phrases,
          sans dates exactes (1958/1970/1980/1991) ni titres précis (Directeur de
          filiales / Directeur Marketing EMEA). Le §2 sur 2J Impression/Mérignac
          est retiré de /mission — il reste uniquement sur /accompagnement.
          Sonia Issa : phrase italique conservée (décision Thomas session 6). */}
      <Section tone="elevated">
        <Container width="editorial">
          <Overline>Ce qui précède la holding</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Une filiation, pas une création.
          </h2>
          <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
            <p>
              Jean-Pierre Issa est né dans une famille d&apos;origine libanaise. Il
              entre dans l&apos;industrie dans les années 1980, chez IBM, puis fait
              partie de l&apos;équipe fondatrice qui lance Lexmark en Europe. Il
              construit ensuite sa propre structure avec ses associés — une
              entreprise déployée dans plusieurs dizaines de pays, construite avec
              méthode, tenue dans la durée. Un parcours cohérent : entrer pour
              rester, décider avec rigueur, transmettre ce qui a été appris.
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

      {/* Section 3 — Le fondateur (Thomas Issa)
          Version RICHE v2 : 1 § unique. Coupés de /mission : écoles, employeurs
          précédents, noms de clients, nom de l'agence, prénoms enfants. Ces
          mentions restent UNIQUEMENT sur /accompagnement (exception Q2
          session 5). "Afrique du Sud" reste comme ancrage de jeunesse. */}
      <Section tone="default">
        <Container width="content">
          <div className="max-w-editorial">
            <Overline>Le fondateur</Overline>
            <h2 className="mt-md font-heading text-h2 text-ink-950">Thomas Issa</h2>
            <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
              <p>
                Thomas Issa a grandi dans cette logique, avec une jeunesse en
                Afrique du Sud qui l&apos;a formé à la mobilité et à
                l&apos;adaptation. Après quinze ans dans l&apos;industrie
                internationale à travers plusieurs pays, puis la co-fondation
                d&apos;une agence de communication internationale, il a tiré une
                conviction simple : les structures qui durent sont celles
                qu&apos;on construit avec intention. C&apos;est ce qu&apos;il
                applique à ISSA Capital. En 2025, il quitte l&apos;agence pour se
                consacrer à sa famille. En 2026, ISSA Capital prend forme.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {/* Section 4 — L'horizon (NOUVELLE section Version RICHE v2)
          Remplace l'ancienne Section 4 "La famille" qui nommait les enfants
          et citait les dates. La nouvelle section parle de la transmission
          sans révéler d'information biographique sur les enfants. L'ancienne
          Section 5 "L'identité" est fusionnée dans Section 6 "Ce que nous sommes"
          (voir ci-dessous). */}
      <Section tone="subtle">
        <Container width="editorial">
          <Overline>L&apos;horizon</Overline>
          <h2 className="mt-md font-heading text-h2 text-ink-950">
            Ce que tout cela construit.
          </h2>
          <div className="mt-xl space-y-lg text-base leading-relaxed text-ink-800">
            <p>
              ISSA Capital n&apos;existe pas pour gérer un actif. Elle existe parce
              que Thomas Issa a des enfants, et que ce qu&apos;il construit
              aujourd&apos;hui doit être transmissible demain. Ce que Jean-Pierre a
              bâti, Thomas en a hérité la méthode. Ce que Thomas construit, ses
              enfants en hériteront — avec les racines libanaises qui traversent
              trois générations. L&apos;horizon de la holding, c&apos;est le leur.
            </p>
          </div>
        </Container>
      </Section>

      {/* Section 5 — Trois filtres
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

      {/* Section 6 — Ce que nous sommes (clôture — fusionnée avec l'ancienne
          Section 5 "L'identité" conformément Version RICHE v2 : §2 remplacé par
          le verbatim fusion racines libanaises + ancrage français). */}
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
              La famille fondatrice est d&apos;origine libanaise. ISSA Capital est
              une SAS française, domiciliée à Nanterre. Ces deux réalités
              coexistent — elles se complètent.
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
