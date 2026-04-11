import type { Metadata } from 'next';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Overline } from '@/components/ui/Overline';
import { Button } from '@/components/ui/Button';
import { ContactForm } from '@/components/ui/ContactForm';
import { siteConfig } from '@/config/site';

/**
 * Page d'accueil — version monopage light (session 9).
 * Toutes les sections sont sur cette page unique. Pas de pages internes dans le menu.
 * Les CTAs hero scrollent vers le formulaire de contact en bas de page (#contact).
 * Respecte le Principe directeur #0 : VITRINE pas conversion.
 */

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: {
    absolute: 'ISSA Capital — Holding patrimoniale familiale',
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
    title: 'ISSA Capital — Holding patrimoniale familiale',
    description:
      "Holding patrimoniale de la famille Issa, aux racines libanaises, établie en France. Immobilier, participations, conseil stratégique.",
    images: [siteConfig.ogImage],
  },
};

export default function HomePage(): JSX.Element {
  return (
    <>
      {/* Section 1 — Hero principal */}
      {/* C1 : py-3xl mobile (64px), py-5xl desktop (128px) — mobile-first proportionné. */}
      <Section tone="inverse" className="py-3xl md:py-5xl">
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
          {/* 2 CTAs : scroll vers le formulaire avec pré-sélection du sujet */}
          <div className="mt-2xl flex flex-col items-center justify-center gap-md sm:flex-row sm:gap-lg">
            <Button href="#contact" variant="primary-inverse" size="lg">
              Présenter une opportunité d&apos;affaires
            </Button>
            <Button
              href="#contact"
              variant="ghost"
              size="lg"
              className="border border-parchment-100/40 bg-transparent text-parchment-100 hover:bg-parchment-100/10 active:bg-parchment-100/20"
            >
              Être accompagné
            </Button>
          </div>
        </Container>
      </Section>

      {/* Section 2 — Notre raison d'être */}
      {/* C3 : text-h2 au lieu de text-h3 — section narrative principale, titre le plus imposant après le hero */}
      {/* C4 : space-y-lg (24px) au lieu de space-y-md (16px) — respiration éditoriale entre paragraphes */}
      <Section tone="default">
        <Container width="editorial">
          <Overline>Notre raison d&apos;être</Overline>
          <h2 className="mt-lg font-heading text-h2 text-ink-950">
            Une holding née d&apos;une lignée.
          </h2>
          <div className="mt-xl space-y-lg text-lead text-ink-700">
            <p>
              ISSA Capital est la holding patrimoniale de la famille Issa,
              établie en France. Sa raison d&apos;être&nbsp;: structurer ce qui
              s&apos;est construit sur trois décennies, le faire fructifier,
              le transmettre.
            </p>
            <p>
              Une structure indépendante, dont les Issa sont les seuls actionnaires, et
              dont l&apos;horizon est intergénérationnel.
            </p>
          </div>
        </Container>
      </Section>

      {/* Section 3 — Stats */}
      {/* C5/C16 : py-3xl md:py-5xl — valorise les 3 chiffres, leur donne l'espace d'une déclaration */}
      {/* C6 : gap-2xl en colonne mobile (48px) donne à chaque chiffre son propre espace de respiration */}
      <Section tone="inverse" className="py-3xl md:py-5xl">
        <Container width="editorial">
          <dl className="grid grid-cols-1 gap-2xl sm:grid-cols-3 sm:gap-xl">
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

      {/* Section 4 — Écosystème (3 participations, sans lien vers /participations) */}
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
            {[
              {
                name: 'Gradient One',
                sector: 'Holding intermédiaire',
                desc: "Holding intermédiaire co-fondée en 2020. Détient Versi Immobilier, Versi Invest, Immocrew et Versimo.",
              },
              {
                name: 'Versi Immobilier',
                sector: 'Marchand de biens',
                desc: 'Marché secondaire résidentiel — acquisition, rénovation, revente.',
                url: 'https://versi-immobilier.fr',
              },
              {
                name: 'Versi Invest',
                sector: 'Co-acquisitions & accompagnement',
                desc: 'Conseil en investissement immobilier et co-investissement sur sélection.',
                url: 'https://versi-invest.fr',
              },
            ].map((p) => (
              /* C8 : border-ink-100 (plus subtil que ink-200), duration-normal = token 300ms vs défaut Tailwind 150ms */
              <article
                key={p.name}
                className="flex flex-col border border-ink-100 bg-white p-xl transition-colors duration-normal hover:border-levant-500"
              >
                {/* C7 : classes primitives explicites — la classe .overline n'existe pas dans la config Tailwind */}
                <p className="font-body text-xs font-semibold uppercase tracking-[0.12em] text-levant-700">{p.sector}</p>
                <h3 className="mt-sm font-heading text-h4 text-ink-950">{p.name}</h3>
                <p className="mt-sm flex-1 text-sm text-ink-600">{p.desc}</p>
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-md inline-flex items-center gap-xs text-sm text-levant-700 hover:text-levant-500 focus-visible:outline-none focus-visible:underline"
                  >
                    {p.url.replace('https://', '')}
                    <span aria-hidden="true">→</span>
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </Container>
      </Section>

      {/* Section 5 — Trois filtres */}
      {/*
        C10 : tone="inverse" au lieu de "subtle".
        Raisonnement : Section 4 (default=parchment-100) et Section 5 (subtle=parchment-50)
        sont visuellement quasi identiques — parchment-100 vs parchment-50, différence imperceptible.
        Sequence avant : inverse→default→inverse→default→subtle→elevated (deux sections parchment consécutives).
        Sequence après : inverse→default→inverse→default→inverse→elevated (alternance propre, rythme marqué).
        C11 : adaptation des couleurs texte pour le fond inverse.
        ink-300 (#ADADAD) sur ink-950 (#0A0A0A) = ratio 6.3:1. PASS WCAG AA.
      */}
      <Section tone="inverse">
        <Container width="content">
          <div className="mb-2xl">
            <Overline tone="light">Nos filtres de décision</Overline>
            <h2 className="mt-md font-heading text-h2 text-parchment-100">
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
                title: 'Préservation de l\u2019environnement',
                desc: "Ce que nous finançons doit tenir sur trente ans. Un modèle qui dégrade l\u2019environnement ne tient pas.",
              },
              {
                title: 'Éthique humaine',
                desc: "Certains secteurs sont hors périmètre, indépendamment du dossier.",
              },
            ].map((f) => (
              <div key={f.title} className="border-l-2 border-levant-500 pl-lg">
                <h3 className="font-heading text-h4 text-parchment-100">{f.title}</h3>
                <p className="mt-sm text-base text-ink-300">{f.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Section 6 — Contact */}
      {/*
        C12 : ajout de l'Overline comme repère de section avant le formulaire.
        Toutes les autres sections ont Overline + H2. La section Contact ne doit pas faire exception.
        L'Overline "Entrer en relation" positionne la section, le heading "Nous écrire." est l'invitation.
        Les deux coexistent sans redondance car ils ont des niveaux sémantiques différents.
      */}
      <Section tone="elevated" id="contact">
        <Container width="editorial">
          <div className="mb-2xl">
            <Overline>Entrer en relation</Overline>
          </div>
          <ContactForm
            variant="contact"
            heading="Nous écrire."
            intro="Une question, une proposition, un dossier. Écrivez-nous."
          />
        </Container>
      </Section>
    </>
  );
}
